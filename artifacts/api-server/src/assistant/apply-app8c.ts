// APP-8c — carrying out the new cards (tools-app8c.ts), with the same services
// as the screens: the quote generator, the Invia dialog, the contract send, the
// lead "Manda adesso", the customer email path, the job notes. Annulla for the
// ones that can be taken back: a draft quote never sent, a client's details, a note.
import {
  db,
  quotesTable,
  clientsTable,
  jobNotesTable,
  projectsTable,
  businessProfilesTable,
  authUsersTable,
  clientDedupKey,
  type AssistantProposal,
  type QuoteClientData,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { writeAudit } from "../lib/notifications.js";
import { buildQuoteFromAI, saveQuoteToDb } from "../lib/generateQuoteFromText.js";
import { sendQuoteByEmail, QuoteSendError, quoteQuotaExceeded } from "../quotes/send.js";
import { sendContractToCustomer } from "../contracts/service.js";
import { sendLeadNow, LeadSendError } from "../leads/send-now.js";
import { sendClientMessage } from "../lib/clientMessage.js";
import { isKnownContact } from "./tools-app8c.js";

type Who = { orgId: string; actorId: string };
type Out = { entityType: string; entityId: string; link: string | null };

/** Errors the person reads on the card (apply.ts turns them into ProposalError). */
export class App8cError extends Error {
  constructor(message: string, public code = "PROPOSAL_FAILED", public status = 400) { super(message); }
}

const CLIENT_TO_QUOTE: Record<string, keyof QuoteClientData> = { email: "email", phone: "phone", address: "indirizzo", city: "city", postalCode: "postalCode", province: "province", businessNumber: "partitaIva" };

export async function executeApp8c(proposal: AssistantProposal, who: Who, ip: string | null, level: "auto" | "ask"): Promise<Out> {
  const p = proposal.payload as Record<string, unknown>;
  const userId = who.orgId;
  const audit = (entityType: string, entityId: string, action: string, diff: Record<string, unknown> = {}) =>
    writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType, entityId, action, diff: { ...diff, level, requestedBy: who.actorId }, ip });

  switch (proposal.kind) {
    case "draft_quote": {
      if (await quoteQuotaExceeded(userId)) throw new App8cError("Hai finito i preventivi del mese previsti dal piano.", "QUOTA_EXCEEDED", 429);
      const name = String(p.clientName ?? "").trim();
      const data = await buildQuoteFromAI({ userId, rawInput: String(p.rawInput), log: logger, clientData: name ? { nome: name, indirizzo: String(p.clientAddress ?? "") } : undefined });
      const email = String(p.clientEmail ?? "").trim();
      const phone = String(p.clientPhone ?? "").trim();
      if (email || phone) data.clientData = { ...data.clientData, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
      const quote = await saveQuoteToDb({ userId, data, source: "assistant" });
      await audit("quote", quote.id, "drafted_via_assistant");
      return { entityType: "quote", entityId: quote.id, link: `/dashboard/quotes/${quote.id}` };
    }
    case "send_quote": {
      try {
        const { quote } = await sendQuoteByEmail({ userId, quoteId: String(p.quoteId), toEmail: String(p.toEmail), clientName: String(p.clientName ?? "") || undefined, actorId: who.actorId, log: logger });
        await audit("quote", quote.id, "sent_via_assistant", { to: p.toEmail });
        return { entityType: "quote", entityId: quote.id, link: `/dashboard/quotes/${quote.id}` };
      } catch (err) {
        if (err instanceof QuoteSendError) throw new App8cError(err.code === "PAYMENT_REQUIRED" ? "Il preventivo è ancora bloccato: sbloccalo dalla sua pagina, poi riprova." : err.code === "BAD_EMAIL" ? "L'indirizzo email non è valido." : "Preventivo non trovato.", err.code, err.code === "NOT_FOUND" ? 404 : 409);
        throw err;
      }
    }
    case "send_contract": {
      try {
        const { contract } = await sendContractToCustomer({ contractId: String(p.contractId), userId, message: String(p.message ?? "") || undefined, ip });
        await audit("contract", contract.id, "sent_via_assistant");
        return { entityType: "contract", entityId: contract.id, link: `/dashboard/contracts/${contract.id}` };
      } catch (err) {
        const m = (err as Error).message;
        if (m === "SIGN_FIRST") throw new App8cError("Firma prima il contratto dalla sua pagina.", m, 409);
        if (m === "CUSTOMER_EMAIL_MISSING") throw new App8cError("Manca l'email del cliente sul contratto.", m, 400);
        if (m === "Contract not found") throw new App8cError("Contratto non trovato.", "NOT_FOUND", 404);
        throw err;
      }
    }
    case "reply_lead": {
      try {
        const { lead, channel } = await sendLeadNow({ userId, leadId: String(p.leadId), actorUserId: who.actorId, via: "assistant" });
        await audit("lead", lead.id, "messaged_via_assistant", { channel });
        return { entityType: "lead", entityId: lead.id, link: "/dashboard/leads" };
      } catch (err) {
        if (err instanceof LeadSendError) throw new App8cError(err.code === "UNSUBSCRIBED" ? "Questa persona si è disiscritta." : err.code === "SEND_FAILED" ? `Invio non riuscito (${err.reason ?? "errore"}).` : "Richiesta non trovata.", err.code, err.code === "NOT_FOUND" ? 404 : 409);
        throw err;
      }
    }
    case "message_client": {
      const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
      if (!profile) throw new App8cError("Profilo dell'impresa mancante.");
      // SEC-1: checked again at send time (the card may be old; the address may have changed).
      if (!(await isKnownContact(userId, String(p.toEmail)))) throw new App8cError("Questo indirizzo non è fra i contatti dell'impresa: scrivi dalla schermata Clienti o Richieste.", "UNKNOWN_CONTACT", 409);
      await sendClientMessage({ userId, toEmail: String(p.toEmail), subject: String(p.subject), body: String(p.body), profile });
      await audit("client_message", proposal.id, "sent_via_assistant", { to: p.toEmail, subject: p.subject });
      return { entityType: "client_message", entityId: proposal.id, link: null };
    }
    case "update_client": {
      const [c] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, String(p.clientId)), eq(clientsTable.userId, userId)));
      if (!c) throw new App8cError("Cliente non trovato.", "NOT_FOUND", 404);
      const changes = p.changes as Record<string, string>;
      await applyClient(userId, c, changes);
      await audit("client", c.id, "updated_via_assistant", { changes });
      return { entityType: "client", entityId: c.id, link: "/dashboard/clients" };
    }
    case "job_note": {
      const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, String(p.projectId)), eq(projectsTable.userId, userId)));
      if (!project) throw new App8cError("Cantiere non trovato.", "NOT_FOUND", 404);
      const [author] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, who.actorId));
      const [note] = await db.insert(jobNotesTable).values({ userId, actorUserId: who.actorId, authorName: author?.name ? `${author.name} (assistente)` : "Assistente", projectId: project.id, body: String(p.body), source: "typed" }).returning();
      await audit("job_note", note!.id, "created_via_assistant");
      return { entityType: "job_note", entityId: note!.id, link: `/dashboard/jobs/${project.id}` };
    }
    case "call": {
      // APP-8g: nothing to carry out here — the app opens the phone (or shows the number and a QR).
      // Confirming only records who asked to call whom; the call itself never goes through PrevAI.
      await audit(String(p.contactType), String(p.contactId), "call_opened_via_assistant", { phone: p.phone });
      return { entityType: String(p.contactType), entityId: String(p.contactId), link: `tel:${String(p.phone)}` };
    }
    default:
      throw new App8cError(`Unsupported proposal kind ${proposal.kind}`);
  }
}

/** Writes a client's new details and fills them on its quotes still open (tools-app8c.ts listed them). */
async function applyClient(userId: string, c: typeof clientsTable.$inferSelect, changes: Record<string, string | null>): Promise<void> {
  const next = { ...c, ...changes } as typeof c;
  const touchesKey = "email" in changes || "phone" in changes;
  await db.update(clientsTable).set({ ...changes, ...(touchesKey ? { dedupKey: clientDedupKey({ name: c.name, email: next.email, phone: next.phone }) } : {}) }).where(and(eq(clientsTable.id, c.id), eq(clientsTable.userId, userId)));
  const quoteFields = Object.entries(changes).filter(([k, v]) => CLIENT_TO_QUOTE[k] && v);
  if (!quoteFields.length) return;
  const open = await db.select({ id: quotesTable.id, clientData: quotesTable.clientData }).from(quotesTable).where(and(eq(quotesTable.userId, userId), eq(quotesTable.clientId, c.id), inArray(quotesTable.status, ["draft", "unlocked", "pending_payment"]))).limit(50);
  for (const q of open) {
    const cd = { ...(q.clientData ?? { nome: c.name, indirizzo: "" }) } as QuoteClientData;
    for (const [k, v] of quoteFields) (cd as Record<string, unknown>)[CLIENT_TO_QUOTE[k]!] = v;
    await db.update(quotesTable).set({ clientData: cd }).where(eq(quotesTable.id, q.id));
  }
}

/** Annulla on a card that ran by itself; throws App8cError when it can't be taken back any more. */
export async function undoApp8c(proposal: AssistantProposal, who: Who): Promise<void> {
  const id = proposal.resultEntityId!;
  const p = proposal.payload as Record<string, unknown>;
  switch (proposal.kind) {
    case "draft_quote": {
      // Only a draft nobody has sent, downloaded or accepted.
      const deleted = await db.delete(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.userId, who.orgId), eq(quotesTable.status, "draft"), isNull(quotesTable.sentAt), isNull(quotesTable.pdfDownloadedAt))).returning({ id: quotesTable.id });
      if (!deleted.length) throw new App8cError("Il preventivo non è più una bozza: archivialo dalla sua pagina.", "NOT_UNDOABLE", 409);
      return;
    }
    case "update_client": {
      const [c] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, who.orgId)));
      if (!c) throw new App8cError("Cliente non trovato.", "NOT_FOUND", 404);
      const before = (p.before ?? {}) as Record<string, string | null>;
      const next = { ...c, ...before } as typeof c;
      await db.update(clientsTable).set({ ...before, dedupKey: clientDedupKey({ name: c.name, email: next.email, phone: next.phone }) }).where(eq(clientsTable.id, c.id));
      for (const q of (p.quotesBefore ?? []) as { id: string; clientData: QuoteClientData | null }[]) {
        if (q.clientData) await db.update(quotesTable).set({ clientData: q.clientData }).where(and(eq(quotesTable.id, q.id), eq(quotesTable.userId, who.orgId)));
      }
      return;
    }
    case "job_note": {
      await db.delete(jobNotesTable).where(and(eq(jobNotesTable.id, id), eq(jobNotesTable.userId, who.orgId)));
      return;
    }
    default:
      throw new App8cError("Questa azione non si può annullare.", "NOT_UNDOABLE", 409);
  }
}

export const APP8C_KINDS = new Set(["draft_quote", "send_quote", "send_contract", "reply_lead", "message_client", "update_client", "job_note", "call"]);
