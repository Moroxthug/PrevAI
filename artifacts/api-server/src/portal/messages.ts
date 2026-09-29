import { db, clientMessagesTable, projectsTable, businessProfilesTable, authUsersTable, type Client, type ClientMessage } from "@workspace/db";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getBaseUrl } from "../lib/baseUrl.js";
import { logger } from "../lib/logger.js";
import { createNotification, writeAudit } from "../lib/notifications.js";
import { sendClientMessageEmail, sendClientReplyEmail } from "../lib/emailPortal.js";
import { ensurePortalLink, serializeMessage, type PortalMessage } from "./service.js";

// ── CLI-1: lo scambio di messaggi impresa ↔ cliente (QuoteAI Phase 76) ──────
// Una sola funzione scrive in tutte e due le direzioni, così la rotta dell'app
// e quella del portale si comportano uguale: salva la riga, poi (se riesce)
// manda l'email all'altra parte e — per le risposte — la notifica nell'app. La
// copia via email è una cortesia: la riga è il documento, quindi un invio
// fallito non fa mai fallire il messaggio.

export const MAX_MESSAGE_LENGTH = 4000;

/** L'id nell'indirizzo di /dashboard/clients/:id — md5 della dedup key, come in routes/clients.ts. */
export function clientPagePath(client: Pick<Client, "dedupKey">): string {
  return createHash("md5").update(client.dedupKey).digest("hex");
}

async function jobNameMap(userId: string, ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (wanted.length === 0) return new Map();
  const rows = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.userId, userId), inArray(projectsTable.id, wanted)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function listThread(client: Pick<Client, "id" | "userId">): Promise<PortalMessage[]> {
  const rows = await db.select().from(clientMessagesTable).where(and(eq(clientMessagesTable.clientId, client.id), eq(clientMessagesTable.userId, client.userId))).orderBy(asc(clientMessagesTable.createdAt)).limit(300);
  const names = await jobNameMap(client.userId, rows.map((r) => r.projectId));
  return rows.map((m) => serializeMessage(m, names));
}

/** L'impresa ha aperto lo scambio: ogni messaggio del cliente è letto. */
export async function markClientMessagesRead(client: Pick<Client, "id">): Promise<number> {
  const rows = await db
    .update(clientMessagesTable)
    .set({ readAt: new Date() })
    .where(and(eq(clientMessagesTable.clientId, client.id), eq(clientMessagesTable.sender, "client"), isNull(clientMessagesTable.readAt)))
    .returning({ id: clientMessagesTable.id });
  return rows.length;
}

export async function postClientMessage(params: {
  client: Client;
  sender: "contractor" | "client";
  senderName: string;
  body: string;
  projectId: string | null;
  ip?: string | null;
  /** Dall'app: chi scrive (per il registro). */
  actorUserId?: string | null;
}): Promise<{ message: PortalMessage; emailed: boolean }> {
  const { client } = params;
  const body = params.body.trim().slice(0, MAX_MESSAGE_LENGTH);
  const [row] = await db
    .insert(clientMessagesTable)
    .values({ userId: client.userId, clientId: client.id, projectId: params.projectId, sender: params.sender, senderName: params.senderName.slice(0, 120), body, ip: params.ip ?? null })
    .returning();
  const names = await jobNameMap(client.userId, [params.projectId]);
  const jobName = params.projectId ? (names.get(params.projectId) ?? null) : null;

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, client.userId));
  let emailed = false;

  if (params.sender === "contractor") {
    const portalUrl = await ensurePortalLink(client);
    if (client.email && portalUrl) {
      try {
        await sendClientMessageEmail({ userId: client.userId, toEmail: client.email, clientName: client.name, companyName: profile?.companyName || "PrevAI", senderName: params.senderName, body, jobName, portalUrl, logoUrl: profile?.logoUrl ?? null, replyTo: profile?.email ?? null });
        emailed = true;
      } catch (err) {
        logger.warn({ err, clientId: client.id }, "Client message email not sent");
      }
    }
    await writeAudit({ userId: client.userId, actorType: "user", actorId: params.actorUserId ?? null, entityType: "client", entityId: client.id, action: "message_sent", diff: { messageId: row!.id, projectId: params.projectId, emailed }, ip: params.ip ?? null });
  } else {
    // La pagina del cliente ha nell'indirizzo l'md5 del raggruppamento dei preventivi (= della dedup key), non l'id.
    const link = params.projectId ? `/dashboard/jobs/${params.projectId}?tab=messages` : `/dashboard/clients/${clientPagePath(client)}?tab=messages`;
    await createNotification({
      userId: client.userId,
      type: "client_message",
      title: jobName ? `${client.name} ha risposto per ${jobName}` : `${client.name} ti ha scritto`,
      body: body.slice(0, 280),
      link,
      entityType: "client",
      entityId: client.id,
    });
    const [owner] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, client.userId));
    const toEmail = profile?.email || owner?.email;
    if (toEmail) {
      try {
        await sendClientReplyEmail({ toEmail, clientName: client.name, body, jobName, dashboardUrl: `${getBaseUrl()}${link}` });
        emailed = true;
      } catch (err) {
        logger.warn({ err, clientId: client.id }, "Client reply email not sent");
      }
    }
    await writeAudit({ userId: client.userId, actorType: "customer", actorId: client.id, entityType: "client", entityId: client.id, action: "message_received", diff: { messageId: row!.id, projectId: params.projectId }, ip: params.ip ?? null });
  }

  if (emailed) await db.update(clientMessagesTable).set({ emailedAt: new Date() }).where(eq(clientMessagesTable.id, row!.id));
  const stored: ClientMessage = { ...row!, emailedAt: emailed ? new Date() : null };
  return { message: serializeMessage(stored, names), emailed };
}
