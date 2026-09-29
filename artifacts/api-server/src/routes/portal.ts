import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Readable } from "node:stream";
import { db, clientsTable, clientPortalsTable, invoicesTable, invoicePaymentsTable, contractsTable, contractSignersTable, jobPhotosTable, projectsTable, hasFeature, type Client, type ClientPortal } from "@workspace/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { writeAudit } from "../lib/notifications.js";
import { sendPortalOtpEmail } from "../lib/emailPortal.js";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { buildInvoicePdf } from "../invoices/pdf.js";
import { reportBankTransferSent } from "../invoices/service.js";
import { createInvoiceCheckoutSession } from "../invoices/stripeConnect.js";
import { contractPdfBuffer, logContractEvent, newRawToken, hashToken as hashSignToken } from "../contracts/service.js";
import {
  hashToken,
  maskEmail,
  newOtpCode,
  otpHash,
  otpMatches,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  issueSession,
  resolveSession,
  revokeSession,
  buildOverview,
  portalHeader,
  portalReady,
  PORTAL_INVOICE_STATUSES,
  PORTAL_CONTRACT_STATUSES,
  contractCanSign,
} from "../portal/service.js";
import { postClientMessage, MAX_MESSAGE_LENGTH } from "../portal/messages.js";

// ── CLI-1: portale del cliente (/portal/:token) — QuoteAI Phase 76 ──────────
// Pubblico e indirizzato da un token come /sign e /i: il token del link si
// trasforma in hash prima di cercarlo e ogni rotta ha un limite per IP. Il
// token da solo dice solo quale impresa e un'email mascherata; tutto il resto
// vuole una sessione, che si ottiene dimostrando la casella con un codice di 6
// cifre via email. La sessione viaggia nell'header `X-Portal-Session` (mai un
// cookie: la sessione dell'impresa nell'app e quella del cliente nel portale
// non si possono mescolare).

const router = Router();
const objectStorage = new ObjectStorageService();
const viewLimiter = ipRateLimiter({ name: "portal.viewLimiter", windowMs: 60_000, max: 120, message: "Troppe richieste" });
const otpLimiter = ipRateLimiter({ name: "portal.otpLimiter", windowMs: 15 * 60_000, max: 8, message: "Troppi tentativi. Riprova più tardi." });
const actionLimiter = ipRateLimiter({ name: "portal.actionLimiter", windowMs: 60_000, max: 20, message: "Troppe richieste" });

const PORTAL_SESSION_HEADER = "x-portal-session";
/** Un nuovo codice non parte prima di tanti secondi dal precedente (la casella del cliente non si riempie). */
const OTP_RESEND_GAP_MS = 30_000;

async function resolveClient(rawToken: string): Promise<{ client: Client; portal: ClientPortal } | null> {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  if (!(await portalReady())) return null;
  const [row] = await db
    .select({ client: clientsTable, portal: clientPortalsTable })
    .from(clientPortalsTable)
    .innerJoin(clientsTable, eq(clientsTable.id, clientPortalsTable.clientId))
    .where(and(eq(clientPortalsTable.tokenHash, hashToken(rawToken)), isNull(clientsTable.archivedAt)));
  return row ?? null;
}

function sessionHeader(req: Request): string | undefined {
  const v = req.headers[PORTAL_SESSION_HEADER];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

/** Token → cliente, poi sessione → dentro. Scrive da sé la risposta d'errore e restituisce null. */
async function authenticate(req: Request, res: Response): Promise<Client | null> {
  const found = await resolveClient(req.params.token as string);
  if (!found) {
    res.status(404).json({ error: "not_found" });
    return null;
  }
  const session = await resolveSession(found.client, sessionHeader(req));
  if (!session) {
    res.status(401).json({ error: "session_required" });
    return null;
  }
  return found.client;
}

// GET /api/portal/:token — per chi è, e se la sessione del browser vale ancora
router.get("/portal/:token", viewLimiter, async (req, res) => {
  try {
    const found = await resolveClient(req.params.token as string);
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { client } = found;
    const { company } = await portalHeader(client);
    const session = await resolveSession(client, sessionHeader(req));
    res.json({
      company,
      client: { name: client.name, emailMasked: client.email ? maskEmail(client.email) : null },
      authenticated: !!session,
      sessionExpiresAt: session?.expiresAt.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Portal header failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/otp — manda il codice di 6 cifre
router.post("/portal/:token/otp", otpLimiter, async (req, res) => {
  try {
    const found = await resolveClient(req.params.token as string);
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { client, portal } = found;
    if (!client.email) {
      res.status(409).json({ error: "no_email" });
      return;
    }
    if (portal.otpExpiresAt && portal.otpExpiresAt.getTime() - OTP_TTL_MS > Date.now() - OTP_RESEND_GAP_MS) {
      res.status(429).json({ error: "wait", message: "Il codice è appena partito: controlla la posta o riprova tra poco." });
      return;
    }
    const code = newOtpCode();
    await db.update(clientPortalsTable).set({ otpHash: otpHash(client.id, code), otpExpiresAt: new Date(Date.now() + OTP_TTL_MS), otpAttempts: 0 }).where(eq(clientPortalsTable.clientId, client.id));
    const { company } = await portalHeader(client);
    await sendPortalOtpEmail({ toEmail: client.email, code, companyName: company.name || "PrevAI" });
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "portal_otp_sent", ip: req.ip });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Portal OTP send failed");
    res.status(500).json({ error: "Impossibile inviare il codice" });
  }
});

// POST /api/portal/:token/verify — controlla il codice, dà una sessione
router.post("/portal/:token/verify", otpLimiter, async (req, res) => {
  try {
    const found = await resolveClient(req.params.token as string);
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { client, portal } = found;
    const body = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    if (!portal.otpHash || !portal.otpExpiresAt || portal.otpExpiresAt < new Date()) {
      res.status(400).json({ error: "code_expired" });
      return;
    }
    if (portal.otpAttempts >= OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: "too_many_attempts" });
      return;
    }
    if (!otpMatches(portal, body.data.code)) {
      await db.update(clientPortalsTable).set({ otpAttempts: portal.otpAttempts + 1 }).where(eq(clientPortalsTable.clientId, client.id));
      res.status(400).json({ error: "invalid_code", attemptsLeft: OTP_MAX_ATTEMPTS - portal.otpAttempts - 1 });
      return;
    }
    await db.update(clientPortalsTable).set({ otpHash: null, otpExpiresAt: null, otpAttempts: 0 }).where(eq(clientPortalsTable.clientId, client.id));
    const session = await issueSession(client, { ip: req.ip, userAgent: req.headers["user-agent"] });
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "portal_signed_in", ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ success: true, session: session.raw, expiresAt: session.expiresAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Portal OTP verify failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/logout
router.post("/portal/:token/logout", actionLimiter, async (req, res) => {
  try {
    const found = await resolveClient(req.params.token as string);
    if (!found) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const raw = sessionHeader(req);
    if (raw) await revokeSession(found.client, raw);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Portal logout failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/portal/:token/overview — tutto, in una chiamata
router.get("/portal/:token/overview", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const { profile, company } = await portalHeader(client);
    const overview = await buildOverview(client, profile);
    res.json({ company, client: { name: client.name, email: client.email }, ...overview });
  } catch (err) {
    req.log.error({ err }, "Portal overview failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/messages — il cliente scrive all'impresa
router.post("/portal/:token/messages", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const body = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), jobId: z.string().uuid().nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_message" });
      return;
    }
    let projectId: string | null = null;
    if (body.data.jobId) {
      const [job] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, body.data.jobId), eq(projectsTable.userId, client.userId), eq(projectsTable.clientId, client.id)));
      if (!job) {
        res.status(404).json({ error: "job_not_found" });
        return;
      }
      projectId = job.id;
    }
    const { message } = await postClientMessage({ client, sender: "client", senderName: client.name, body: body.data.body, projectId, ip: req.ip });
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "Portal message failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/portal/:token/photos/:photoId/file — una foto di un cantiere del cliente
router.get("/portal/:token/photos/:photoId/file", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const [row] = await db
      .select({ photo: jobPhotosTable })
      .from(jobPhotosTable)
      .innerJoin(projectsTable, eq(projectsTable.id, jobPhotosTable.projectId))
      .where(and(eq(jobPhotosTable.id, req.params.photoId as string), eq(projectsTable.clientId, client.id), eq(projectsTable.userId, client.userId), isNull(projectsTable.archivedAt)));
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const file = await objectStorage.downloadPrivateObject(row.photo.fileUrl.replace(/^\/objects\//, ""));
    res.status(file.status);
    file.headers.forEach((v, k) => res.setHeader(k, v));
    if (file.body) Readable.fromWeb(file.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    req.log.error({ err }, "Portal photo failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Pro-forma e fatture: PDF, paga con carta, "ho fatto il bonifico" ────────

async function clientInvoice(client: Client, invoiceId: string) {
  if (!z.string().uuid().safeParse(invoiceId).success) return null;
  const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.clientId, client.id), eq(invoicesTable.userId, client.userId), isNull(invoicesTable.archivedAt)));
  if (!inv || !(PORTAL_INVOICE_STATUSES as readonly string[]).includes(inv.status)) return null;
  return inv;
}

router.get("/portal/:token/invoices/:id/pdf", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id)).orderBy(asc(invoicePaymentsTable.date));
    const { buffer } = await buildInvoicePdf(inv, payments);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${inv.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Portal invoice PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/:token/invoices/:id/pay-link", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { profile } = await portalHeader(client);
    if (!hasFeature(profile, "invoice_card_payments")) {
      res.status(403).json({ error: "NOT_AVAILABLE" });
      return;
    }
    const { url } = await createInvoiceCheckoutSession(inv);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "CARD_PAYMENTS_NOT_ENABLED") {
      res.status(403).json({ error: "NOT_AVAILABLE" });
      return;
    }
    req.log.error({ err }, "Portal pay-link failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal/:token/invoices/:id/mark-sent", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const inv = await clientInvoice(client, req.params.id as string);
    if (!inv) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const updated = await reportBankTransferSent({ invoiceId: inv.id, ip: req.ip, userAgent: req.headers["user-agent"] ?? null });
    res.json({ status: updated.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "NOT_OPEN") {
      res.status(400).json({ error: "NOT_OPEN" });
      return;
    }
    req.log.error({ err }, "Portal mark-sent failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Contratti: PDF e "firma ora" ────────────────────────────────────────────

async function clientContract(client: Client, contractId: string) {
  if (!z.string().uuid().safeParse(contractId).success) return null;
  const [c] = await db.select().from(contractsTable).where(and(eq(contractsTable.id, contractId), eq(contractsTable.clientId, client.id), eq(contractsTable.userId, client.userId), isNull(contractsTable.archivedAt)));
  if (!c || !(PORTAL_CONTRACT_STATUSES as readonly string[]).includes(c.status)) return null;
  return c;
}

router.get("/portal/:token/contracts/:id/pdf", viewLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const c = await clientContract(client, req.params.id as string);
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const { buffer, filename } = await contractPdfBuffer(c.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Portal contract PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/portal/:token/contracts/:id/sign-link — un link /sign nuovo per un
// contratto che aspetta la firma del cliente. La sessione del portale ha già
// dimostrato la stessa casella che dimostrerebbe il codice della firma, quindi
// il firmatario risulta verificato e la pagina va dritta alla firma. Il link
// dell'email viene sostituito (un solo token valido per firmatario).
router.post("/portal/:token/contracts/:id/sign-link", actionLimiter, async (req, res) => {
  try {
    const client = await authenticate(req, res);
    if (!client) return;
    const c = await clientContract(client, req.params.id as string);
    if (!c) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const [signer] = await db.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, c.id), eq(contractSignersTable.role, "customer")));
    if (!contractCanSign(c, signer, client.email)) {
      res.status(409).json({ error: "not_signable" });
      return;
    }
    const raw = newRawToken();
    await db
      .update(contractSignersTable)
      .set({ tokenHash: hashSignToken(raw), tokenExpiresAt: c.expiresAt, otpVerifiedAt: new Date(), status: signer!.status === "pending" ? "viewed" : signer!.status })
      .where(eq(contractSignersTable.id, signer!.id));
    await logContractEvent({ contractId: c.id, type: "otp_verified", actor: "customer", signerId: signer!.id, detail: { via: "portal" }, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ url: `${getBaseUrl()}/sign/${raw}` });
  } catch (err) {
    req.log.error({ err }, "Portal sign-link failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
