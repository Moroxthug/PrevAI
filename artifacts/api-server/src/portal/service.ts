import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  db,
  clientsTable,
  clientPortalsTable,
  clientPortalSessionsTable,
  clientMessagesTable,
  quotesTable,
  contractsTable,
  contractSignersTable,
  invoicesTable,
  projectsTable,
  milestonesTable,
  jobPhotosTable,
  businessProfilesTable,
  hasFeature,
  type Client,
  type ClientPortal,
  type BusinessProfile,
  type ClientMessage,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getBaseUrl } from "../lib/baseUrl.js";
import { ownLogoPath } from "../lib/logo.js";
import { tableReady } from "../assistant/ready.js";
import { invoiceToken } from "../invoices/service.js";
import { balanceCents } from "../invoices/math.js";
import { getConnectAccount } from "../invoices/stripeConnect.js";
import { publicQuoteLink } from "../quotes/publicLink.js";

// ── CLI-1: portale del cliente (QuoteAI Phase 76) ───────────────────────────
// Il token del link è deterministico — un HMAC dell'id del cliente col segreto
// del server, come i link delle fatture — così le pagine /i, /sign e /p lo
// possono ricostruire; se ne salva solo l'hash (per trovarlo) e col token da
// solo non si legge niente: il cliente dimostra la casella con un codice di 6
// cifre via email e poi tiene un token di sessione.

/** migrations/v2/0018: finché non gira, il portale risponde 503 e le pagine pubbliche non lo offrono. */
export function portalReady(): Promise<boolean> {
  return tableReady("client_portals");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function linkSecret(): string {
  const secret = process.env.INVOICE_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error("No server secret configured for portal links (set INVOICE_LINK_SECRET)");
  return secret;
}

export function portalToken(client: Pick<Client, "id" | "userId">): string {
  return createHmac("sha256", linkSecret()).update(`portal:${client.userId}:${client.id}`).digest("base64url");
}

export function portalUrl(rawToken: string): string {
  return `${getBaseUrl()}/portal/${rawToken}`;
}

export async function loadPortal(clientId: string): Promise<ClientPortal | null> {
  const [row] = await db.select().from(clientPortalsTable).where(eq(clientPortalsTable.clientId, clientId));
  return row ?? null;
}

/**
 * Il link al portale del cliente; al primo uso crea la riga (l'hash del link).
 * Null quando il cliente non ha email (nessuno potrebbe ricevere il codice),
 * è archiviato, o la 0018 non è ancora stata eseguita.
 */
export async function ensurePortalLink(client: Pick<Client, "id" | "userId" | "email" | "archivedAt">): Promise<string | null> {
  if (!client.email || client.archivedAt) return null;
  if (!(await portalReady())) return null;
  const raw = portalToken(client);
  const tokenHash = hashToken(raw);
  if ((await loadPortal(client.id))?.tokenHash === tokenHash) return portalUrl(raw);
  await db
    .insert(clientPortalsTable)
    .values({ clientId: client.id, userId: client.userId, tokenHash })
    .onConflictDoUpdate({ target: clientPortalsTable.clientId, set: { tokenHash } });
  return portalUrl(raw);
}

/** Per le pagine dei documenti (/i, /sign, /p): il link al portale del client_id di una riga, o null. Non fa mai fallire la pagina. */
export async function portalLinkForClient(clientId: string | null | undefined): Promise<string | null> {
  if (!clientId) return null;
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
    if (!client) return null;
    return await ensurePortalLink(client);
  } catch {
    return null;
  }
}

export function maskEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
}

// ── Codice di accesso ───────────────────────────────────────────────────────

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function otpHash(clientId: string, code: string): string {
  return createHash("sha256").update(`portal:${clientId}:${code}`).digest("hex");
}

/** Confronto a tempo costante del codice con l'hash salvato. */
export function otpMatches(portal: Pick<ClientPortal, "clientId" | "otpHash">, code: string): boolean {
  if (!portal.otpHash) return false;
  const expected = Buffer.from(portal.otpHash, "hex");
  const provided = createHash("sha256").update(`portal:${portal.clientId}:${code}`).digest();
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// ── Sessioni ────────────────────────────────────────────────────────────────

const SESSION_DAYS = 30;

export async function issueSession(client: Client, meta: { ip?: string | null; userAgent?: string | null }): Promise<{ raw: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(clientPortalSessionsTable).values({ userId: client.userId, clientId: client.id, tokenHash: hashToken(raw), expiresAt, lastSeenAt: new Date(), ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null });
  await db.update(clientPortalsTable).set({ lastSeenAt: new Date() }).where(eq(clientPortalsTable.clientId, client.id));
  return { raw, expiresAt };
}

/** Una sessione valida per questo cliente, o null. Aggiorna `last_seen_at` (al massimo una volta al minuto). */
export async function resolveSession(client: Pick<Client, "id">, rawSession: string | undefined): Promise<{ id: string; expiresAt: Date } | null> {
  if (!rawSession || rawSession.length < 20 || rawSession.length > 200) return null;
  const [s] = await db.select().from(clientPortalSessionsTable).where(and(eq(clientPortalSessionsTable.tokenHash, hashToken(rawSession)), eq(clientPortalSessionsTable.clientId, client.id)));
  if (!s || s.revokedAt || s.expiresAt < new Date()) return null;
  if (!s.lastSeenAt || s.lastSeenAt.getTime() < Date.now() - 60_000) {
    await db.update(clientPortalSessionsTable).set({ lastSeenAt: new Date() }).where(eq(clientPortalSessionsTable.id, s.id));
    await db.update(clientPortalsTable).set({ lastSeenAt: new Date() }).where(eq(clientPortalsTable.clientId, client.id));
  }
  return { id: s.id, expiresAt: s.expiresAt };
}

/** Esci: vale solo per la sessione di questo cliente (un token di un altro portale non si revoca da qui). */
export async function revokeSession(client: Pick<Client, "id">, rawSession: string): Promise<void> {
  await db
    .update(clientPortalSessionsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(clientPortalSessionsTable.tokenHash, hashToken(rawSession)), eq(clientPortalSessionsTable.clientId, client.id)));
}

// ── Panoramica ──────────────────────────────────────────────────────────────
// Quello che vede il cliente. Stesse regole delle singole pagine pubbliche: i
// preventivi solo sbloccati o accettati (e col link non revocato), i contratti
// solo inviati, le pro-forma e le fatture solo inviate — le bozze non passano
// mai dal portale.

export type PortalQuote = { id: string; number: string; title: string; total: number; status: "unlocked" | "accepted"; acceptedAt: string | null; createdAt: string; url: string };
export type PortalContract = { id: string; contractNumber: string; kind: string; title: string; status: string; total: number; sentAt: string | null; signedAt: string | null; expiresAt: string | null; canSign: boolean; jobId: string | null };
export type PortalInvoice = { id: string; number: string; type: string; fiscale: boolean; status: string; title: string; issueDate: string; dueDate: string; totalCents: number; paidCents: number; balanceCents: number; canPayByCard: boolean; iban: string | null; jobId: string | null; url: string | null; paidAt: string | null };
type PortalMilestone = { id: string; title: string; status: string; plannedStart: string | null; plannedEnd: string | null; actualEnd: string | null };
type PortalPhoto = { id: string; caption: string; createdAt: string; milestoneId: string | null };
export type PortalJob = { id: string; name: string; address: string; status: string; progressPercent: number; plannedStart: string | null; plannedEnd: string | null; completedAt: string | null; milestones: PortalMilestone[]; photos: PortalPhoto[] };
export type PortalMessage = { id: string; sender: "contractor" | "client"; senderName: string; body: string; jobId: string | null; jobName: string | null; createdAt: string; readAt: string | null };

export function serializeMessage(m: ClientMessage, jobNames: Map<string, string>): PortalMessage {
  return { id: m.id, sender: m.sender, senderName: m.senderName, body: m.body, jobId: m.projectId, jobName: m.projectId ? (jobNames.get(m.projectId) ?? null) : null, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null };
}

/** Se il cliente può firmare questo contratto dal portale. */
export function contractCanSign(contract: { status: string; expiresAt: Date | null }, signer: { email: string; status: string } | undefined, clientEmail: string | null): boolean {
  if (!signer || !clientEmail) return false;
  if (contract.status !== "sent" && contract.status !== "viewed") return false;
  if (contract.expiresAt && contract.expiresAt < new Date()) return false;
  if (signer.status === "signed" || signer.status === "declined") return false;
  return signer.email.trim().toLowerCase() === clientEmail.trim().toLowerCase();
}

export const PORTAL_INVOICE_STATUSES = ["sent", "viewed", "pending_confirmation", "partially_paid", "paid", "overdue"] as const;
export const PORTAL_CONTRACT_STATUSES = ["sent", "viewed", "signed", "expired", "declined"] as const;

export async function buildOverview(client: Client, profile: BusinessProfile | undefined): Promise<{ quotes: PortalQuote[]; contracts: PortalContract[]; invoices: PortalInvoice[]; jobs: PortalJob[]; messages: PortalMessage[] }> {
  const [quotes, contracts, invoices, projects] = await Promise.all([
    db.select().from(quotesTable).where(and(eq(quotesTable.userId, client.userId), eq(quotesTable.clientId, client.id), inArray(quotesTable.status, ["unlocked", "accepted"]), isNull(quotesTable.archivedAt))).orderBy(desc(quotesTable.createdAt)),
    db.select().from(contractsTable).where(and(eq(contractsTable.userId, client.userId), eq(contractsTable.clientId, client.id), inArray(contractsTable.status, [...PORTAL_CONTRACT_STATUSES]), isNull(contractsTable.archivedAt))).orderBy(desc(contractsTable.createdAt)),
    db.select().from(invoicesTable).where(and(eq(invoicesTable.userId, client.userId), eq(invoicesTable.clientId, client.id), inArray(invoicesTable.status, [...PORTAL_INVOICE_STATUSES]), isNull(invoicesTable.archivedAt))).orderBy(desc(invoicesTable.issueDate)),
    db.select().from(projectsTable).where(and(eq(projectsTable.userId, client.userId), eq(projectsTable.clientId, client.id), isNull(projectsTable.archivedAt), ne(projectsTable.setupStatus, "pending_review"))).orderBy(desc(projectsTable.createdAt)),
  ]);

  const projectIds = projects.map((p) => p.id);
  const milestones = projectIds.length ? await db.select().from(milestonesTable).where(inArray(milestonesTable.projectId, projectIds)).orderBy(asc(milestonesTable.sortOrder)) : [];
  const photos = projectIds.length ? await db.select().from(jobPhotosTable).where(inArray(jobPhotosTable.projectId, projectIds)).orderBy(asc(jobPhotosTable.sortOrder), asc(jobPhotosTable.createdAt)) : [];
  const signers = contracts.length ? await db.select().from(contractSignersTable).where(and(inArray(contractSignersTable.contractId, contracts.map((c) => c.id)), eq(contractSignersTable.role, "customer"))) : [];

  const conn = profile && hasFeature(profile, "invoice_card_payments") ? await getConnectAccount(client.userId) : null;
  const canPayByCard = !!conn?.chargesEnabled;
  const jobNames = new Map(projects.map((p) => [p.id, p.name]));

  // SEC-4: il link firmato del preventivo (condiviso di nuovo, così la scadenza si sposta avanti);
  // un link che l'impresa ha revocato non torna in vita dal portale: quel preventivo non si mostra.
  const quoteLinks = await Promise.all(quotes.map((q) => publicQuoteLink(q, { share: true, reopen: false })));

  const messages = await db.select().from(clientMessagesTable).where(eq(clientMessagesTable.clientId, client.id)).orderBy(asc(clientMessagesTable.createdAt)).limit(300);
  // Aprire il portale vale come aver letto quello che ha scritto l'impresa.
  const unread = messages.filter((m) => m.sender === "contractor" && !m.readAt).map((m) => m.id);
  if (unread.length) {
    const now = new Date();
    await db.update(clientMessagesTable).set({ readAt: now }).where(inArray(clientMessagesTable.id, unread));
    for (const m of messages) if (unread.includes(m.id)) m.readAt = now;
  }

  return {
    quotes: quotes.flatMap((q, i) => {
      const url = quoteLinks[i]?.url;
      if (!url) return [];
      return [{
        id: q.id,
        number: q.numeroPreventivoData ?? "",
        title: q.titoloPreventivoRiga2 || q.descrizioneGenerale || q.titoloPreventivoRiga1 || "",
        total: Number(q.totale),
        status: q.status as "unlocked" | "accepted",
        acceptedAt: q.acceptedAt?.toISOString() ?? null,
        createdAt: q.createdAt.toISOString(),
        url,
      }];
    }),
    contracts: contracts.map((c) => {
      const signer = signers.find((s) => s.contractId === c.id);
      return {
        id: c.id,
        contractNumber: c.contractNumber,
        kind: c.kind,
        title: c.document.title,
        status: c.status,
        total: c.variables.total,
        sentAt: c.sentAt?.toISOString() ?? null,
        signedAt: c.signedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        canSign: contractCanSign(c, signer, client.email),
        jobId: c.projectId && jobNames.has(c.projectId) ? c.projectId : null,
      };
    }),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      type: inv.type,
      fiscale: inv.fiscale,
      status: inv.status,
      title: inv.title,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      balanceCents: balanceCents(inv),
      canPayByCard: canPayByCard && inv.type !== "credit_note" && balanceCents(inv) > 0 && inv.status !== "paid",
      iban: inv.paymentInstructions?.iban ?? null,
      jobId: inv.projectId && jobNames.has(inv.projectId) ? inv.projectId : null,
      url: inv.publicTokenHash ? `${getBaseUrl()}/i/${invoiceToken(inv)}` : null,
      paidAt: inv.paidAt?.toISOString() ?? null,
    })),
    jobs: projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      status: p.status,
      progressPercent: p.progressPercent,
      plannedStart: p.plannedStart?.toISOString() ?? null,
      plannedEnd: p.plannedEnd?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      milestones: milestones.filter((m) => m.projectId === p.id).map((m) => ({ id: m.id, title: m.title, status: m.status, plannedStart: m.plannedStart?.toISOString() ?? null, plannedEnd: m.plannedEnd?.toISOString() ?? null, actualEnd: m.actualEnd?.toISOString() ?? null })),
      photos: photos.filter((ph) => ph.projectId === p.id).map((ph) => ({ id: ph.id, caption: ph.caption, createdAt: ph.createdAt.toISOString(), milestoneId: ph.milestoneId })),
    })),
    messages: messages.map((m) => serializeMessage(m, jobNames)),
  };
}

/** Impresa e cliente, mostrati prima e dopo il codice. */
export async function portalHeader(client: Client): Promise<{ profile: BusinessProfile | undefined; company: { name: string; logoUrl: string | null; email: string | null; phone: string | null } }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, client.userId));
  return {
    profile,
    // SEC-3: del logo solo il percorso che scrive il caricamento per questa impresa.
    company: { name: profile?.companyName || "", logoUrl: ownLogoPath(profile?.logoUrl, client.userId), email: profile?.email ?? null, phone: profile?.phone ?? null },
  };
}

/** Risposte dei clienti non ancora lette dall'impresa, eventualmente di un cliente solo. */
export async function unreadClientMessageCount(userId: string, clientId?: string): Promise<number> {
  const rows = await db
    .select({ id: clientMessagesTable.id })
    .from(clientMessagesTable)
    .where(and(eq(clientMessagesTable.userId, userId), eq(clientMessagesTable.sender, "client"), isNull(clientMessagesTable.readAt), ...(clientId ? [eq(clientMessagesTable.clientId, clientId)] : [])));
  return rows.length;
}
