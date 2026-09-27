import { Resend } from "resend";
import { MARKET } from "@workspace/config";
import { db, authUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createNotification } from "../lib/notifications.js";
import { escapeHtml } from "../lib/email.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { logger } from "../lib/logger.js";

// ── A-6: avvisi fra cliente e professionista ─────────────────────────────────
// Una notifica in app e, se l'email è configurata, un'email breve con il link.
// Nessun dato fiscale nel testo dell'email: solo che cosa è successo e dove
// guardarlo, dopo l'accesso.

export async function avvisa(params: { userId: string; tipo: string; titolo: string; corpo: string; link: string; entityId?: string }): Promise<void> {
  await createNotification({
    userId: params.userId,
    type: params.tipo,
    title: params.titolo,
    body: params.corpo,
    link: params.link,
    entityType: "incarico",
    entityId: params.entityId,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const [utente] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, params.userId));
  if (!utente?.email || utente.email.endsWith(".invalid")) return;
  try {
    const url = `${getBaseUrl()}${params.link}`;
    await new Resend(apiKey).emails.send({
      from: `${MARKET.brand} <no-reply@${MARKET.domain}>`,
      to: [utente.email],
      subject: params.titolo,
      html: `<p>${escapeHtml(params.corpo)}</p><p><a href="${escapeHtml(url)}">Apri in ${escapeHtml(MARKET.brand)}</a></p>`,
    });
  } catch (err) {
    logger.warn({ err, tipo: params.tipo }, "A-6: email di avviso non inviata");
  }
}
