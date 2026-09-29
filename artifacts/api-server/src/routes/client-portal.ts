import { Router, type Response } from "express";
import { z } from "zod";
import { db, clientsTable, clientPortalsTable, projectsTable, businessProfilesTable, quotesTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireAuth, getUserId, getActorUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { sendPortalInviteEmail } from "../lib/emailPortal.js";
import { ensureClientForQuote } from "../lib/clients.js";
import { ensurePortalLink, loadPortal, portalReady, unreadClientMessageCount } from "../portal/service.js";
import { listThread, markClientMessagesRead, postClientMessage, MAX_MESSAGE_LENGTH } from "../portal/messages.js";

// ── CLI-1: il lato impresa del portale del cliente (QuoteAI Phase 76) ───────
// Il link del portale e l'invito, e lo scambio di messaggi (letto dalla scheda
// del cantiere o dalla pagina del cliente, scritto da tutte e due). Tutto parte
// da un cliente dell'impresa che agisce; un cantiere, se c'è, deve essere di
// quel cliente.

const router = Router();

// `/dashboard/clients` raggruppa i preventivi, quindi l'id nell'indirizzo della
// pagina di un cliente è `md5(dedup key)` e non l'UUID di `clients` (QuoteAI
// Phase 82). Si accettano tutti e due.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MD5_RE = /^[0-9a-f]{32}$/i;

async function ownedClient(userId: string, id: string) {
  if (UUID_RE.test(id)) {
    const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
    return client ?? null;
  }
  if (!MD5_RE.test(id)) return null;
  const md5 = id.toLowerCase();
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.userId, userId), sql`md5(${clientsTable.dedupKey}) = ${md5}`));
  if (client) return client;

  // Nessuna riga ancora: un preventivo scritto prima che esistessero i clienti
  // non l'ha creata. Si trova il gruppo nei preventivi e si crea il cliente con
  // la stessa funzione delle rotte dei preventivi, così la dedup key (e l'md5) combacia.
  const [quote] = await db
    .select({ clientData: quotesTable.clientData })
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.userId, userId),
        sql`md5(concat_ws('|',
          lower(trim(${quotesTable.clientData}->>'nome')),
          coalesce(lower(trim(${quotesTable.clientData}->>'email')), ''),
          coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')
        )) = ${md5}`,
      ),
    )
    .orderBy(desc(quotesTable.createdAt))
    .limit(1);
  if (!quote) return null;
  const createdId = await ensureClientForQuote(userId, quote.clientData);
  if (!createdId) return null;
  const [created] = await db.select().from(clientsTable).where(eq(clientsTable.id, createdId));
  return created ?? null;
}

/** 503 finché la migrazione 0018 non è stata eseguita. */
async function notReady(res: Response): Promise<boolean> {
  if (await portalReady()) return false;
  res.status(503).json({ error: "PORTAL_NOT_READY", message: "Il portale del cliente non è ancora attivo." });
  return true;
}

// GET /api/clients/:id/portal — link, invito e ultima visita, risposte non lette
router.get("/clients/:id/portal", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    if (await notReady(res)) return;
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const url = await ensurePortalLink(client);
    const portal = await loadPortal(client.id);
    res.json({
      // La pagina del cliente elenca cantieri e fatture di questo cliente, che portano l'UUID (l'indirizzo ha l'md5).
      clientId: client.id,
      url,
      hasEmail: !!client.email,
      email: client.email,
      invitedAt: portal?.invitedAt?.toISOString() ?? null,
      lastSeenAt: portal?.lastSeenAt?.toISOString() ?? null,
      unread: await unreadClientMessageCount(userId, client.id),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading client portal status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/clients/:id/portal/invite — manda il link del portale per email
router.post("/clients/:id/portal/invite", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    if (await notReady(res)) return;
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const url = await ensurePortalLink(client);
    if (!client.email || !url) {
      res.status(409).json({ error: "NO_EMAIL", message: "Aggiungi prima un indirizzo email al cliente." });
      return;
    }
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    await sendPortalInviteEmail({ userId, toEmail: client.email, clientName: client.name, companyName: profile?.companyName || "PrevAI", portalUrl: url, logoUrl: profile?.logoUrl ?? null, replyTo: profile?.email ?? null });
    const now = new Date();
    await db.update(clientPortalsTable).set({ invitedAt: now }).where(eq(clientPortalsTable.clientId, client.id));
    await writeAudit({ userId, actorType: "user", actorId: getActorUserId(res), entityType: "client", entityId: client.id, action: "portal_invited", ip: req.ip });
    res.json({ success: true, invitedAt: now.toISOString(), url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Email service not configured") {
      res.status(503).json({ error: "EMAIL_NOT_CONFIGURED" });
      return;
    }
    req.log.error({ err }, "Error sending portal invite");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/clients/:id/messages — lo scambio; aprirlo segna lette le risposte del cliente
router.get("/clients/:id/messages", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    if (await notReady(res)) return;
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await markClientMessagesRead(client);
    const messages = await listThread(client);
    const portal = await loadPortal(client.id);
    res.json({ messages, client: { id: client.id, name: client.name, email: client.email, portalLastSeenAt: portal?.lastSeenAt?.toISOString() ?? null } });
  } catch (err) {
    req.log.error({ err }, "Error loading client thread");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/clients/:id/messages — scrivi al cliente (arriva per email col link del portale)
router.post("/clients/:id/messages", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    if (await notReady(res)) return;
    const userId = getUserId(res);
    const client = await ownedClient(userId, req.params.id as string);
    if (!client) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH), jobId: z.string().uuid().nullable().optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    let projectId: string | null = null;
    if (body.data.jobId) {
      const [job] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, body.data.jobId), eq(projectsTable.userId, userId), eq(projectsTable.clientId, client.id)));
      if (!job) {
        res.status(404).json({ error: "JOB_NOT_FOUND", message: "Il cantiere non è di questo cliente." });
        return;
      }
      projectId = job.id;
    }
    const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const senderName = getUserName(res) || profile?.companyName || "";
    const result = await postClientMessage({ client, sender: "contractor", senderName, body: body.data.body, projectId, ip: req.ip, actorUserId: getActorUserId(res) });
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "Error posting client message");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
