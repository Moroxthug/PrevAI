// APP-8a — where the user is when they talk to the assistant. The app sends
// the screen it is on (path + the ids in it); the server checks each id
// belongs to the company before it reaches the model, so a crafted id can
// neither leak another company's data nor steer the tools to it.
import { z } from "zod";
import { db, projectsTable, quotesTable, invoicesTable, clientsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { toIsoDate } from "../jobs/dates.js";

const uuid = z.string().uuid();

export const pageContextSchema = z
  .object({
    path: z.string().max(200).regex(/^\/[\w\-/]*$/),
    projectId: uuid.nullish(),
    quoteId: uuid.nullish(),
    invoiceId: uuid.nullish(),
  })
  .strict();

export type PageContext = z.infer<typeof pageContextSchema>;

/** What the prompt says about the screen, and the job the tools default to. */
export type ResolvedContext = { projectId: string | null; line: string };

const SCREEN_NAMES: [RegExp, string][] = [
  [/^\/dashboard\/?$/, "la home (Oggi)"],
  [/^\/dashboard\/quotes/, "i preventivi"],
  [/^\/dashboard\/new/, "il nuovo preventivo"],
  [/^\/dashboard\/jobs/, "i cantieri"],
  [/^\/dashboard\/invoices/, "le fatture"],
  [/^\/dashboard\/clients/, "i clienti"],
  [/^\/dashboard\/leads/, "le richieste"],
  [/^\/dashboard\/contracts/, "i contratti"],
  [/^\/dashboard\/team/, "la squadra"],
  [/^\/dashboard\/analytics/, "l'analisi"],
  [/^\/dashboard\/fisco/, "il fisco"],
  [/^\/dashboard\/amministrazione/, "l'amministrazione"],
  [/^\/dashboard\/settings/, "le impostazioni"],
];

export function screenName(path: string): string | null {
  return SCREEN_NAMES.find(([re]) => re.test(path))?.[1] ?? null;
}

const euro = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export async function resolvePageContext(userId: string, ctx: PageContext | null | undefined): Promise<ResolvedContext> {
  if (!ctx) return { projectId: null, line: "" };
  const parts: string[] = [];
  let projectId: string | null = null;

  if (ctx.projectId) {
    const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, ctx.projectId), eq(projectsTable.userId, userId)));
    if (p) {
      projectId = p.id;
      const client = p.clientId ? (await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, p.clientId)))[0] : null;
      parts.push(`il cantiere id ${p.id} — "${p.name}"${client ? ` per ${client.name}` : ""}, stato ${p.status}, ${p.progressPercent}% completato, ${toIsoDate(p.plannedStart ?? p.startDate) ?? "?"} → ${toIsoDate(p.plannedEnd ?? p.endDate) ?? "?"}`);
    }
  }
  if (ctx.quoteId) {
    const [q] = await db
      .select({ id: quotesTable.id, numero: quotesTable.numeroPreventivoData, client: quotesTable.clientData, totale: quotesTable.totale, status: quotesTable.status, descrizione: quotesTable.descrizioneGenerale })
      .from(quotesTable)
      .where(and(eq(quotesTable.id, ctx.quoteId), eq(quotesTable.userId, userId)));
    if (q) {
      const status = { draft: "bozza", unlocked: "pronto", pending_payment: "in attesa di pagamento", accepted: "accettato dal cliente" }[q.status] ?? q.status;
      parts.push(`il preventivo${q.numero ? ` ${q.numero}` : ""} per ${q.client?.nome || "un cliente senza nome"}, totale ${euro(Number(q.totale))} IVA inclusa, ${status}${q.descrizione ? ` — "${q.descrizione.slice(0, 160)}"` : ""}`);
    }
  }
  if (ctx.invoiceId) {
    const [i] = await db
      .select({ number: invoicesTable.number, customer: invoicesTable.customer, totalCents: invoicesTable.totalCents, paidCents: invoicesTable.paidCents, status: invoicesTable.status, projectId: invoicesTable.projectId, dueDate: invoicesTable.dueDate })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.id, ctx.invoiceId), eq(invoicesTable.userId, userId)));
    if (i) {
      projectId ??= i.projectId;
      parts.push(`la fattura ${i.number} a ${i.customer?.name || "?"}, totale ${euro(i.totalCents / 100)}, incassati ${euro(i.paidCents / 100)}, stato ${i.status}, scadenza ${toIsoDate(i.dueDate) ?? "?"}`);
    }
  }

  const screen = screenName(ctx.path);
  if (!parts.length && !screen) return { projectId, line: "" };
  const where = parts.length ? parts.join("; ") : `la pagina con ${screen}`;
  return {
    projectId,
    line: `\nIn questo momento l'utente sta guardando ${where}. Quando dice "questo", "qui" o non nomina altro, intende questo${projectId ? "; gli strumenti usano questo cantiere come default" : ""}.`,
  };
}
