import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import {
  db,
  whatsappConnectionsTable,
  whatsappOtpTable,
  whatsappSessionsTable,
  businessProfilesTable,
  quotesTable,
} from "@workspace/db";
import { eq, and, gt, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import {
  buildQuoteFromAI,
  regenerateWithCorrection,
  saveQuoteToDb,
  generateQuoteFromText,
  type PendingQuoteData,
} from "../lib/generateQuoteFromText.js";
import { generateQuoteWhatsappPdfBuffer } from "../lib/generateQuoteWhatsappPdfBuffer.js";
import { generateQuotePreviewImage } from "../lib/generateQuotePreviewImage.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { randomUUID } from "crypto";

const objectStorage = new ObjectStorageService();
const router = Router();

const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "prevai_webhook_secret";
const PREVAI_BASE_URL = getBaseUrl();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ITERATIONS = 5;

// ── Low-level send helpers ──────────────────────────────────────────────────────

async function sendWhatsappText(to: string, text: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    logger.warn("WhatsApp env vars not configured — skipping send");
    return;
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) logger.error({ err: await res.text(), to }, "WhatsApp text send failed");
}

async function uploadMetaMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
  if (!WA_TOKEN || !WA_PHONE_ID) return null;
  try {
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("type", mimeType);
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    formData.append("file", new Blob([ab], { type: mimeType }), filename);
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN}` },
      body: formData,
    });
    if (!res.ok) { logger.error({ err: await res.text() }, "WhatsApp media upload failed"); return null; }
    const json = await res.json() as { id?: string };
    return json.id ?? null;
  } catch (err) {
    logger.error({ err }, "WhatsApp media upload error");
    return null;
  }
}

async function sendWhatsappImage(to: string, imageBuffer: Buffer, caption: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) return;

  const mediaId = await uploadMetaMedia(imageBuffer, "image/png", "preventivo_preview.png");

  if (mediaId) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { id: mediaId, caption },
      }),
    });
    if (res.ok) return;
    logger.error({ err: await res.text(), to }, "WhatsApp image send (media-id) failed — trying link fallback");
  }

  // Fallback: Object Storage presigned URL
  let subPath: string | null = null;
  try {
    subPath = `whatsapp-previews/${randomUUID()}.png`;
    await objectStorage.uploadObjectBuffer({ subPath, buffer: imageBuffer, contentType: "image/png" });
    const presignedUrl = await objectStorage.getPresignedGetURL(subPath, 3600);
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: presignedUrl, caption },
      }),
    });
    if (!res.ok) {
      logger.error({ err: await res.text(), to }, "WhatsApp image send (link fallback) failed");
    } else {
      void objectStorage.deleteObjectBuffer(subPath).catch(e => logger.warn({ e, subPath }, "Image cleanup failed"));
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp image storage fallback failed");
  }
}

async function sendWhatsappDocument(to: string, pdfBuffer: Buffer, filename: string, caption: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) return;

  const mediaId = await uploadMetaMedia(pdfBuffer, "application/pdf", filename);

  if (mediaId) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: { id: mediaId, filename, caption },
      }),
    });
    if (res.ok) return;
    logger.error({ err: await res.text(), to }, "WhatsApp document send (media-id) failed — trying link fallback");
  }

  let subPath: string | null = null;
  try {
    subPath = `whatsapp-pdfs/${randomUUID()}.pdf`;
    await objectStorage.uploadObjectBuffer({ subPath, buffer: pdfBuffer, contentType: "application/pdf" });
    const presignedUrl = await objectStorage.getPresignedGetURL(subPath, 3600);
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: { link: presignedUrl, filename, caption },
      }),
    });
    if (!res.ok) {
      logger.error({ err: await res.text(), to }, "WhatsApp document send (link fallback) failed");
    } else {
      void objectStorage.deleteObjectBuffer(subPath).catch(e => logger.warn({ e, subPath }, "PDF cleanup failed"));
    }
  } catch (err) {
    logger.error({ err }, "WhatsApp PDF storage fallback failed");
  }
}

async function downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!metaRes.ok) throw new Error(`Meta media info failed: ${metaRes.status}`);
  const { url, mime_type } = (await metaRes.json()) as { url: string; mime_type: string };
  const mediaRes = await fetch(url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
  if (!mediaRes.ok) throw new Error(`Media download failed: ${mediaRes.status}`);
  return { buffer: Buffer.from(await mediaRes.arrayBuffer()), mimeType: mime_type };
}

// ── Input extraction ────────────────────────────────────────────────────────────

async function extractRawInput(
  message: WaMessage,
  from: string,
): Promise<string | null> {
  const msgType = message.type;

  if (msgType === "text") {
    return message.text?.body?.trim() ?? null;
  }

  if (msgType === "audio") {
    if (!message.audio?.id) return null;
    try {
      const { buffer, mimeType } = await downloadMetaMedia(message.audio.id);
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "mp3";
      const file = new File([new Uint8Array(buffer)], `audio.${ext}`, { type: mimeType });
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const transcription = await openai.audio.transcriptions.create({
        model: "gpt-4o-transcribe",
        file,
        language: "it",
      });
      return transcription.text;
    } catch (err) {
      logger.error({ err }, "WhatsApp audio transcription failed");
      await sendWhatsappText(from, "❌ Non riuscito a trascrivere il messaggio vocale. Prova a scrivere in testo.");
      return null;
    }
  }

  if (msgType === "image") {
    if (!message.image?.id) return null;
    try {
      const { buffer, mimeType } = await downloadMetaMedia(message.image.id);
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: "Sei un assistente che aiuta artigiani italiani. Analizza l'immagine: se è un preventivo già fatto da altro programma, rispondi con 'IMPORT:' seguito dal contenuto testuale estratto. Altrimenti descrivi il lavoro da fare. Scrivi in italiano." },
          { role: "user", content: [{ type: "text", text: "Analizza questa immagine per generare un preventivo:" }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
        ],
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch (err) {
      logger.error({ err }, "WhatsApp image analysis failed");
      await sendWhatsappText(from, "❌ Non riuscito ad analizzare l'immagine. Prova a scrivere la descrizione in testo.");
      return null;
    }
  }

  if (msgType === "document") {
    // Documents (PDF, Word, etc.) are not supported as quote input via WhatsApp.
    // Inform the user and return null so no quote generation is triggered.
    await sendWhatsappText(
      from,
      "ℹ️ I file allegati non sono supportati.\n\nInviami la descrizione del lavoro in *testo*, un *messaggio vocale* o una *foto* degli appunti per generare un preventivo."
    );
    return null;
  }

  await sendWhatsappText(from, "ℹ️ Invia una *descrizione del lavoro* in testo, un *messaggio vocale* o una *foto* per generare un preventivo.");
  return null;
}

// ── Session helpers ─────────────────────────────────────────────────────────────

async function loadValidSession(phoneNumber: string) {
  const [session] = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.delete(whatsappSessionsTable).where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));
    return null;
  }

  return session;
}

async function upsertSession(phoneNumber: string, userId: string, state: "awaiting_confirmation" | "awaiting_client_data", pendingQuoteData: PendingQuoteData, iterationCount: number) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(whatsappSessionsTable)
    .values({ phoneNumber, userId, state, pendingQuoteData: pendingQuoteData as unknown as Record<string, unknown>, iterationCount, expiresAt })
    .onConflictDoUpdate({
      target: whatsappSessionsTable.phoneNumber,
      set: { state, pendingQuoteData: pendingQuoteData as unknown as Record<string, unknown>, iterationCount, expiresAt, updatedAt: new Date() },
    });
}

async function deleteSession(phoneNumber: string) {
  await db.delete(whatsappSessionsTable).where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));
}

// ── Intent classification ───────────────────────────────────────────────────────

/**
 * Session state machine:
 *   idle (no row in DB)
 *     └─ new work request → awaiting_confirmation
 *   awaiting_confirmation
 *     ├─ confirm keyword   → awaiting_client_data
 *     ├─ abandon keyword   → idle (delete session)
 *     ├─ new work hint     → warn user; remain in awaiting_confirmation
 *     └─ correction        → awaiting_confirmation (regenerate, iterationCount++)
 *   awaiting_client_data
 *     ├─ client data / skip → idle (save quote, send PDF, delete session)
 *     ├─ abandon keyword    → idle (delete session)
 *     └─ new work hint      → warn user; remain in awaiting_client_data
 */

type ConfirmIntent = "confirm" | "abandon" | "new_work_hint" | "correction";

function classifyConfirmationIntent(text: string): ConfirmIntent {
  const t = text.toLowerCase().trim();
  const confirmKeywords = ["ok", "va bene", "va benissimo", "perfetto", "procedi", "ottimo", "bene", "confermo", "conferma", "approvato", "giusto", "corretto", "andiamo", "yes", "go"];
  const abandonKeywords = ["abbandona", "ricomincia", "nuovo preventivo", "lascia stare", "annulla", "cancella", "reset", "no grazie", "ricomincia da capo"];

  if (t === "sì" || t === "si" || confirmKeywords.some(kw => t === kw || t.startsWith(`${kw} `) || t.endsWith(` ${kw}`))) {
    return "confirm";
  }
  if (abandonKeywords.some(kw => t.includes(kw))) {
    return "abandon";
  }
  // Detect a probable NEW work description (not a correction to the existing quote).
  // Criteria: message is long, lacks correction-verb starters, contains new-work language.
  if (looksLikeNewWorkRequest(t)) {
    return "new_work_hint";
  }
  return "correction";
}

/**
 * Returns true when `text` looks like a brand-new work description rather than
 * a correction to an already-generated quote.
 * Heuristic: message must be ≥ 70 chars, not start with a known correction verb,
 * and contain at least one new-work trigger phrase.
 */
function looksLikeNewWorkRequest(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length < 70) return false;
  const correctionStarters = ["cambia", "modifica", "aggiungi", "togli", "elimina", "riduci", "aumenta", "metti", "sostituisci", "correggi", "calcola", "ricalcola", "sposta", "rinomina"];
  if (correctionStarters.some(v => t.startsWith(v + " ") || t.startsWith(v + "i ") || t.startsWith(v + "re "))) return false;
  const newWorkPatterns = [
    /(?:voglio|devo|dobbiamo|bisogna)\s+(?:fare|rifare|installare|ristrutturare|tinteggiare|riparare|costruire)/,
    /preventivo\s+(?:per|di)\s+(?:un|una|il|la)/,
    /(?:nuovo\s+)?(?:cantiere|progetto|lavoro)\s+(?:a|in|da|di)/,
    /lavori\s+di\s+\w+/,
  ];
  return newWorkPatterns.some(p => p.test(t));
}

function parseClientData(text: string): { nome: string; indirizzo: string } {
  const t = text.trim();
  if (/^(salta|skip|nessun cliente|-)$/i.test(t)) return { nome: "", indirizzo: "" };
  const parts = t.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
  return { nome: parts[0] ?? "", indirizzo: parts.slice(1).join(", ") };
}

// ── Preview sending helper ──────────────────────────────────────────────────────

async function sendQuotePreview(from: string, data: PendingQuoteData, iterationCount: number) {
  const totale = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(data.totale));

  const imageBuffer = await generateQuotePreviewImage(data);

  if (imageBuffer) {
    const caption = `📋 ${data.titoloPreventivoRiga2 || "Preventivo"} — ${totale}`;
    await sendWhatsappImage(from, imageBuffer, caption);
  } else {
    // Text-only fallback preview
    const chapSummary = data.capitoli.map(c =>
      `  ${c.lettera}. ${c.titolo}: €${new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2 }).format(c.subtotale)}`
    ).join("\n");
    await sendWhatsappText(from, [
      `📋 *${data.titoloPreventivoRiga2 || "Preventivo generato"}*`,
      ``,
      chapSummary,
      ``,
      `💶 *Totale: ${totale}* (IVA ${data.ivaPercentuale}% inclusa)`,
    ].join("\n"));
  }

  const remainingEdits = MAX_ITERATIONS - iterationCount;
  const confirmMsg = iterationCount === 0
    ? `✅ Ecco la tua anteprima!\n\n📝 Rispondi con correzioni (es. "cambia il prezzo delle piastrelle a 35€/mq", "aggiungi una voce per la pulizia finale") oppure scrivi *OK* per procedere.`
    : `✅ Preventivo aggiornato!\n\n📝 Rispondi con altre correzioni oppure scrivi *OK* per procedere. Modifiche rimanenti: ${remainingEdits}.`;

  await sendWhatsappText(from, confirmMsg);
}

// ── Flow handlers ───────────────────────────────────────────────────────────────

async function handleNewQuoteRequest(
  from: string,
  userId: string,
  rawInput: string,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  // Usage check for Pro (20 WhatsApp quotes/month)
  if (profile.subscriptionPlan === "monthly_pro") {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), eq(quotesTable.source, "whatsapp"), gte(quotesTable.createdAt, startOfMonth)));
    if ((countResult?.count ?? 0) >= 20) {
      await sendWhatsappText(from, `⚠️ Hai raggiunto il limite di *20 preventivi WhatsApp* per questo mese (Piano Pro).\n\nIl contatore si azzera il 1° del mese prossimo.\nPer preventivi illimitati, passa al piano Elite: ${PREVAI_BASE_URL}/dashboard/settings`);
      return;
    }
  }

  await sendWhatsappText(from, "⏳ Sto generando il tuo preventivo, attendi qualche secondo...");

  const data = await buildQuoteFromAI({ userId, rawInput, log: logger });
  await upsertSession(from, userId, "awaiting_confirmation", data, 0);
  await sendQuotePreview(from, data, 0);
}

async function handleConfirmationReply(
  from: string,
  userId: string,
  text: string,
  session: typeof whatsappSessionsTable.$inferSelect,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const pendingData = session.pendingQuoteData as unknown as PendingQuoteData;
  const iterationCount = session.iterationCount;
  const intent = classifyConfirmationIntent(text);

  if (intent === "abandon") {
    await deleteSession(from);
    await sendWhatsappText(from, "🗑️ Preventivo annullato.\n\nInviami una nuova descrizione del lavoro quando vuoi.");
    return;
  }

  if (intent === "confirm" || iterationCount >= MAX_ITERATIONS) {
    if (iterationCount >= MAX_ITERATIONS && intent !== "confirm") {
      await sendWhatsappText(from, "ℹ️ Limite di modifiche raggiunto. Procedo con il preventivo attuale...");
    }
    await upsertSession(from, userId, "awaiting_client_data", pendingData, iterationCount);
    await sendWhatsappText(from, "👤 Perfetto! Inserisci il *nome del cliente* e l'*indirizzo* (es. \"Mario Rossi, Via Roma 1, Milano\"), oppure scrivi *salta* per lasciare vuoto.");
    return;
  }

  // Looks like a brand-new work request while a quote is already in progress
  if (intent === "new_work_hint") {
    await sendWhatsappText(
      from,
      `ℹ️ Hai già un preventivo in corso per:\n*${pendingData.titoloPreventivoRiga2 || "preventivo attuale"}*\n\n` +
      `Se vuoi *annullarlo* e iniziare una nuova richiesta, scrivi *abbandona*.\n` +
      `Oppure invia le tue *correzioni* al preventivo in corso (es. "cambia il prezzo delle piastrelle a 35€/mq").`
    );
    return;
  }

  // Correction
  await sendWhatsappText(from, "✏️ Sto aggiornando il preventivo...");
  try {
    const updatedData = await regenerateWithCorrection({ userId, current: pendingData, correction: text, log: logger });
    const newCount = iterationCount + 1;
    await upsertSession(from, userId, "awaiting_confirmation", updatedData, newCount);
    await sendQuotePreview(from, updatedData, newCount);
  } catch (err) {
    logger.error({ err }, "WhatsApp correction regeneration failed");
    await sendWhatsappText(from, "❌ Non riuscito ad aggiornare il preventivo. Riprova con una correzione diversa, oppure scrivi *OK* per procedere con il preventivo attuale.");
  }
}

async function handleClientDataReply(
  from: string,
  userId: string,
  text: string,
  session: typeof whatsappSessionsTable.$inferSelect,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const pendingData = session.pendingQuoteData as unknown as PendingQuoteData;

  // Explicit abandon while collecting client data
  const t = text.toLowerCase().trim();
  const abandonKeywords = ["abbandona", "ricomincia", "annulla", "cancella", "reset", "ricomincia da capo"];
  if (abandonKeywords.some(kw => t.includes(kw))) {
    await deleteSession(from);
    await sendWhatsappText(from, "🗑️ Preventivo annullato.\n\nInviami una nuova descrizione del lavoro quando vuoi.");
    return;
  }

  // Looks like a brand-new work request instead of client data
  if (looksLikeNewWorkRequest(t)) {
    await sendWhatsappText(
      from,
      `ℹ️ Stavo aspettando i dati del cliente per il preventivo:\n*${pendingData.titoloPreventivoRiga2 || "preventivo in corso"}*\n\n` +
      `Inserisci il *nome e indirizzo del cliente* (es. "Mario Rossi, Via Roma 1, Milano") oppure scrivi *salta*.\n` +
      `Se vuoi *annullare* questo preventivo e iniziarne uno nuovo, scrivi *abbandona*.`
    );
    return;
  }

  const clientData = parseClientData(text);

  const finalData: PendingQuoteData = {
    ...pendingData,
    clientData,
  };

  await sendWhatsappText(from, "⏳ Sto salvando il preventivo e generando il PDF...");

  try {
    const quote = await saveQuoteToDb({ userId, data: finalData, source: "whatsapp" });
    await deleteSession(from);

    const totale = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(quote.totale));
    const quoteUrl = `${PREVAI_BASE_URL}/dashboard/quotes/${quote.id}`;

    await sendWhatsappText(from, [
      `✅ *Preventivo salvato!*`,
      ``,
      `📋 *${quote.titoloPreventivoRiga2 ?? "Preventivo"}*`,
      `💶 Totale: *${totale}* (IVA ${quote.ivaPercentuale}% inclusa)`,
      ``,
      `👉 Visualizza e modifica su:`,
      quoteUrl,
    ].join("\n"));

    // Generate and send PDF
    const [profileRow] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const pdfBuffer = await generateQuoteWhatsappPdfBuffer(quote, profileRow ?? null);
    const safeTitle = (quote.titoloPreventivoRiga2 ?? "preventivo").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    await sendWhatsappDocument(from, pdfBuffer, `${safeTitle}.pdf`, `📄 PDF — ${quote.titoloPreventivoRiga2 ?? ""}`.trim());
  } catch (err) {
    logger.error({ err }, "WhatsApp save/PDF failed");
    await sendWhatsappText(from, "❌ Si è verificato un errore nel salvataggio. Riprova o accedi a prevai.it per completare il preventivo.");
  }
}

// ── GET /api/whatsapp/webhook — Meta webhook verification ──────────────────────

router.get("/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WA_VERIFY_TOKEN) {
    logger.info("WhatsApp webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: "Forbidden" });
  }
});

// ── POST /api/whatsapp/webhook — Incoming messages ────────────────────────────

router.post("/whatsapp/webhook", async (req, res) => {
  res.status(200).json({ status: "ok" });

  try {
    const body = req.body as WhatsappWebhookBody;
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const msgType = message.type;

    logger.info({ from, msgType }, "WhatsApp message received");

    // ── OTP shortcut ────────────────────────────────────────────────────────────
    if (msgType === "text" && /^\d{6}$/.test(message.text?.body?.trim() ?? "")) {
      await handleInboundOtpVerification(from, message.text!.body.trim());
      return;
    }

    // ── Extract input ───────────────────────────────────────────────────────────
    const rawInput = await extractRawInput(message, from);
    if (!rawInput?.trim()) return;

    // ── Connection check ────────────────────────────────────────────────────────
    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(eq(whatsappConnectionsTable.phoneNumber, from));

    if (!connection) {
      await sendWhatsappText(from, `ℹ️ Il tuo numero non è collegato a nessun account prevai.\n\nAccedi a ${PREVAI_BASE_URL}/dashboard/settings e collega il tuo numero WhatsApp.`);
      return;
    }

    if (!connection.isEnabled) {
      await sendWhatsappText(from, `ℹ️ L'integrazione WhatsApp è disabilitata. Riabilitala su ${PREVAI_BASE_URL}/dashboard/settings`);
      return;
    }

    // ── Plan check ──────────────────────────────────────────────────────────────
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, connection.userId));
    const allowedPlans = ["monthly_pro", "monthly_elite"];
    if (profile?.subscriptionStatus !== "active" || !allowedPlans.includes(profile?.subscriptionPlan ?? "")) {
      await sendWhatsappText(from, `⚠️ Il tuo account non ha un piano attivo che include WhatsApp. Aggiornalo su ${PREVAI_BASE_URL}/dashboard/settings`);
      return;
    }

    // ── Load session ────────────────────────────────────────────────────────────
    const session = await loadValidSession(from);

    if (session?.state === "awaiting_confirmation") {
      await handleConfirmationReply(from, connection.userId, rawInput, session, profile);
      return;
    }

    if (session?.state === "awaiting_client_data") {
      await handleClientDataReply(from, connection.userId, rawInput, session, profile);
      return;
    }

    // ── New quote request ───────────────────────────────────────────────────────
    await handleNewQuoteRequest(from, connection.userId, rawInput, profile);

  } catch (err) {
    logger.error({ err }, "WhatsApp webhook handler error");
  }
});

// ── Inbound OTP fallback ───────────────────────────────────────────────────────

async function handleInboundOtpVerification(phoneNumber: string, otp: string): Promise<void> {
  const now = new Date();
  const [otpRow] = await db
    .select()
    .from(whatsappOtpTable)
    .where(and(eq(whatsappOtpTable.phoneNumber, phoneNumber), gt(whatsappOtpTable.expiresAt, now)));

  if (!otpRow || otpRow.otp !== otp) {
    await sendWhatsappText(phoneNumber, "❌ Codice non valido o scaduto. Riprova dalla pagina impostazioni su prevai.it");
    return;
  }

  await db.delete(whatsappOtpTable).where(eq(whatsappOtpTable.phoneNumber, phoneNumber));
  await db
    .insert(whatsappConnectionsTable)
    .values({ userId: otpRow.userId, phoneNumber, isEnabled: true })
    .onConflictDoUpdate({
      target: whatsappConnectionsTable.userId,
      set: { phoneNumber, isEnabled: true, connectedAt: new Date() },
    });

  const [profile] = await db
    .select({ companyName: businessProfilesTable.companyName })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, otpRow.userId));

  await sendWhatsappText(
    phoneNumber,
    `✅ *Account collegato!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nInviami la descrizione di qualsiasi lavoro (testo, vocale o foto) e genererò un preventivo professionale in pochi secondi.`
  );
}

// ── Management routes (unchanged) ─────────────────────────────────────────────

router.get("/whatsapp/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [connection] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
    res.json({ connected: !!connection, phoneNumber: connection?.phoneNumber ?? null, isEnabled: connection?.isEnabled ?? null });
  } catch (err) {
    req.log.error({ err }, "WhatsApp status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/whatsapp/usage", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), eq(quotesTable.source, "whatsapp"), gte(quotesTable.createdAt, startOfMonth)));
    const used = countResult?.count ?? 0;
    const [profile] = await db
      .select({ subscriptionPlan: businessProfilesTable.subscriptionPlan, subscriptionStatus: businessProfilesTable.subscriptionStatus })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    const plan = profile?.subscriptionPlan ?? null;
    const isActive = profile?.subscriptionStatus === "active";
    const limit = isActive && plan === "monthly_pro" ? 20 : null;
    res.json({ used, limit, plan });
  } catch (err) {
    req.log.error({ err }, "WhatsApp usage error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/whatsapp/connect", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber?.trim()) { res.status(400).json({ error: "phoneNumber is required" }); return; }
    const normalized = normalizePhone(phoneNumber.trim());
    if (!normalized) { res.status(400).json({ error: "Numero non valido. Usa il formato internazionale, es: +39 333 1234567" }); return; }

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const allowedPlans = ["monthly_pro", "monthly_elite"];
    if (profile?.subscriptionStatus !== "active" || !allowedPlans.includes(profile?.subscriptionPlan ?? "")) {
      res.status(403).json({ error: "L'integrazione WhatsApp è disponibile solo per i piani Pro ed Elite." });
      return;
    }

    const existingForPhone = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.phoneNumber, normalized));
    if (existingForPhone.length > 0 && existingForPhone[0]!.userId !== userId) {
      res.status(409).json({ error: "Questo numero WhatsApp è già collegato a un altro account." });
      return;
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(whatsappOtpTable).values({ phoneNumber: normalized, otp, userId, expiresAt })
      .onConflictDoUpdate({ target: whatsappOtpTable.phoneNumber, set: { otp, userId, expiresAt } });

    if (!WA_TOKEN || !WA_PHONE_ID) { res.status(503).json({ error: "L'integrazione WhatsApp non è ancora configurata." }); return; }
    await sendWhatsappText(normalized, `🔐 *Codice di verifica PrevAI*\n\nIl tuo codice è: *${otp}*\n\nInseriscilo nella pagina Impostazioni. Valido 15 minuti.`);
    res.json({ sent: true, phoneNumber: normalized });
  } catch (err) {
    req.log.error({ err }, "WhatsApp connect error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/whatsapp/verify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { phoneNumber, otp } = req.body as { phoneNumber?: string; otp?: string };
    if (!phoneNumber?.trim() || !otp?.trim()) { res.status(400).json({ error: "phoneNumber and otp are required" }); return; }
    const normalized = normalizePhone(phoneNumber.trim());
    if (!normalized) { res.status(400).json({ error: "Numero non valido" }); return; }

    const now = new Date();
    const [otpRow] = await db.select().from(whatsappOtpTable)
      .where(and(eq(whatsappOtpTable.phoneNumber, normalized), gt(whatsappOtpTable.expiresAt, now)));
    if (!otpRow) { res.status(400).json({ error: "Codice scaduto. Richiedi un nuovo codice." }); return; }
    if (otpRow.userId !== userId) { res.status(403).json({ error: "Questo codice non appartiene al tuo account." }); return; }
    if (otpRow.otp !== otp.trim()) { res.status(400).json({ error: "Codice errato." }); return; }

    await db.delete(whatsappOtpTable).where(eq(whatsappOtpTable.phoneNumber, normalized));
    await db.insert(whatsappConnectionsTable).values({ userId, phoneNumber: normalized, isEnabled: true })
      .onConflictDoUpdate({ target: whatsappConnectionsTable.userId, set: { phoneNumber: normalized, isEnabled: true, connectedAt: new Date() } });

    const [profile] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    await sendWhatsappText(normalized, `✅ *Account collegato con successo!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nOra puoi inviarmi la descrizione di qualsiasi lavoro e genererò un preventivo in pochi secondi.`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "WhatsApp verify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/whatsapp/disconnect", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    await db.delete(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "WhatsApp disconnect error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/whatsapp/toggle", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { isEnabled } = req.body as { isEnabled?: boolean };
    if (typeof isEnabled !== "boolean") { res.status(400).json({ error: "isEnabled (boolean) is required" }); return; }
    await db.update(whatsappConnectionsTable).set({ isEnabled }).where(eq(whatsappConnectionsTable.userId, userId));
    res.json({ success: true, isEnabled });
  } catch (err) {
    req.log.error({ err }, "WhatsApp toggle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Utilities ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  if (/^\+\d{7,15}$/.test(digits)) return digits.replace("+", "");
  if (/^\d{7,15}$/.test(digits)) return digits;
  return null;
}

// Kept for backwards-compatibility with the web (non-WhatsApp) quote generation
export { generateQuoteFromText };

// ── Types ──────────────────────────────────────────────────────────────────────

type WaMessage = {
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  image?: { id: string };
  document?: { id: string; mime_type?: string };
};

type WhatsappWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WaMessage[];
      };
    }>;
  }>;
};

export default router;
