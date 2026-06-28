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
import { eq, and, gt, gte, sql, desc, sum } from "drizzle-orm";
import type { WhatsappPreferences } from "@workspace/db";
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
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
if (!WA_VERIFY_TOKEN) {
  logger.error("WARNING: WHATSAPP_VERIFY_TOKEN is not set. WhatsApp webhook verification will fail.");
}
const PREVAI_BASE_URL = getBaseUrl();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ITERATIONS = 3; // max correction rounds before forcing save-as-draft

// ── In-memory deduplication + per-number lock ──────────────────────────────────
const processedMessageIds = new Set<string>();
const processingLocks = new Map<string, boolean>();
const MESSAGE_ID_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicateMessage(messageId: string): boolean {
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  // Keep window bounded (cleanup every ~1000 entries)
  if (processedMessageIds.size > 2000) {
    const ids = Array.from(processedMessageIds);
    processedMessageIds.clear();
    ids.slice(-1000).forEach(id => processedMessageIds.add(id));
  }
  return false;
}

async function acquireProcessingLock(phoneNumber: string): Promise<boolean> {
  if (processingLocks.get(phoneNumber)) return false;
  processingLocks.set(phoneNumber, true);
  return true;
}

function releaseProcessingLock(phoneNumber: string): void {
  processingLocks.delete(phoneNumber);
}

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
): Promise<{ text: string | null; imageDataUrls?: string[] }> {
  const msgType = message.type;

  if (msgType === "text") {
    return { text: message.text?.body?.trim() ?? null };
  }

  if (msgType === "audio" || msgType === "voice") {
    const mediaId = message.audio?.id ?? message.voice?.id;
    if (!mediaId) return { text: null };
    try {
      const { buffer, mimeType } = await downloadMetaMedia(mediaId);
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "mp3";
      const file = new File([new Uint8Array(buffer)], `audio.${ext}`, { type: mimeType });
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const transcription = await openai.audio.transcriptions.create({
        model: "gpt-4o-transcribe",
        file,
        language: "it",
      });
      return { text: transcription.text };
    } catch (err) {
      logger.error({ err }, "WhatsApp audio transcription failed");
      await sendWhatsappText(from, "❌ Non riuscito a trascrivere il messaggio vocale. Prova a scrivere in testo.");
      return { text: null };
    }
  }

  if (msgType === "image") {
    if (!message.image?.id) return { text: null };
    try {
      const { buffer, mimeType } = await downloadMetaMedia(message.image.id);
      const base64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: `Sei un esperto di estrazione dati da appunti di cantiere per artigiani edili italiani.

Analizza l'immagine e trascrive TUTTO il contenuto visibile:
- Testo scritto a mano: nomi, indirizzi, misure, materiali, prezzi, unità di misura
- Numeri e quantità (mq, mc, ml, kg, ore, pezzi, ecc.)
- Voci di lavoro con descrizioni complete
- Prezzi unitari e totali
- Qualsiasi altra informazione utile per un preventivo professionale

Restituisci il contenuto in formato strutturato, voce per voce, mantenendo tutti i numeri, prezzi e misure ESATTI così come appaiono negli appunti. Scrivi in italiano.` },
          { role: "user", content: [{ type: "text", text: "Trascrivi tutto il contenuto di questi appunti di cantiere per generare un preventivo professionale:" }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
        ],
      });
      const text = completion.choices[0]?.message?.content ?? null;
      return { text, imageDataUrls: text ? [dataUrl] : undefined };
    } catch (err) {
      logger.error({ err }, "WhatsApp image analysis failed");
      await sendWhatsappText(from, "❌ Non riuscito ad analizzare l'immagine. Prova a scrivere la descrizione in testo.");
      return { text: null };
    }
  }

  if (msgType === "document") {
    await sendWhatsappText(
      from,
      "ℹ️ I file allegati non sono supportati.\n\nInviami la descrizione del lavoro in *testo*, un *messaggio vocale* o una *foto* degli appunti per generare un preventivo."
    );
    return { text: null };
  }

  await sendWhatsappText(from, "ℹ️ Invia una *descrizione del lavoro* in testo, un *messaggio vocale* o una *foto* per generare un preventivo.");
  return { text: null };
}

// ── Session helpers ─────────────────────────────────────────────────────────────

type SessionState =
  | "awaiting_template_selection"
  | "awaiting_client_choice"
  | "awaiting_job_input"
  | "awaiting_confirmation"
  | "awaiting_client_data"  // legacy — kept for in-flight sessions
  | "menu_main"
  | "menu_clients"
  | "menu_template"
  | "menu_iva";

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

async function upsertSession(
  phoneNumber: string,
  userId: string,
  state: SessionState,
  payload: Record<string, unknown>,
  iterationCount: number,
) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(whatsappSessionsTable)
    .values({ phoneNumber, userId, state, pendingQuoteData: payload, iterationCount, expiresAt })
    .onConflictDoUpdate({
      target: whatsappSessionsTable.phoneNumber,
      set: { state, pendingQuoteData: payload, iterationCount, expiresAt, updatedAt: new Date() },
    });
}

async function deleteSession(phoneNumber: string) {
  await db.delete(whatsappSessionsTable).where(eq(whatsappSessionsTable.phoneNumber, phoneNumber));
}

// ── Preferences helpers ─────────────────────────────────────────────────────────

async function getPreferences(userId: string): Promise<WhatsappPreferences> {
  const [conn] = await db
    .select({ preferences: whatsappConnectionsTable.preferences })
    .from(whatsappConnectionsTable)
    .where(eq(whatsappConnectionsTable.userId, userId));
  return (conn?.preferences as WhatsappPreferences | null) ?? {};
}

async function setPreferences(userId: string, prefs: Partial<WhatsappPreferences>): Promise<void> {
  const current = await getPreferences(userId);
  await db
    .update(whatsappConnectionsTable)
    .set({ preferences: { ...current, ...prefs } as Record<string, unknown> })
    .where(eq(whatsappConnectionsTable.userId, userId));
}

// ── Menu trigger detection ──────────────────────────────────────────────────────

function isMenuTrigger(text: string): boolean {
  const t = text.toLowerCase().trim();
  return ["/menu", "menu", "aiuto", "help", "opzioni", "impostazioni", "m", "?"].includes(t);
}

// ── Client list helper ──────────────────────────────────────────────────────────

async function getExistingClients(userId: string): Promise<{ nome: string; indirizzo: string }[]> {
  const quotes = await db
    .select({ clientData: quotesTable.clientData })
    .from(quotesTable)
    .where(eq(quotesTable.userId, userId))
    .orderBy(desc(quotesTable.createdAt))
    .limit(20);

  const seen = new Set<string>();
  const clients: { nome: string; indirizzo: string }[] = [];

  for (const q of quotes) {
    const cd = q.clientData as { nome?: string; indirizzo?: string } | null;
    const nome = cd?.nome?.trim() ?? "";
    if (!nome || seen.has(nome.toLowerCase())) continue;
    seen.add(nome.toLowerCase());
    clients.push({ nome, indirizzo: cd?.indirizzo?.trim() ?? "" });
    if (clients.length >= 5) break;
  }

  return clients;
}

// ── Template helpers ────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: "standard", label: "Starter", emoji: "📄", desc: "Layout base professionale" },
  { id: "mariagrazia", label: "Elegante", emoji: "✨", desc: "Lista numerata con header OFFERTA aziendale" },
  { id: "arosio", label: "Professionale", emoji: "🏗️", desc: "Capitolato con sezioni e subtotali per capitolo" },
];

function templateFromChoice(text: string): string | null {
  const t = text.trim();
  if (t === "1" || /starter/i.test(t)) return "standard";
  if (t === "2" || /elegante/i.test(t)) return "mariagrazia";
  if (t === "3" || /professionale/i.test(t)) return "arosio";
  return null;
}

function templateLabel(id: string): string {
  return TEMPLATES.find(t => t.id === id)?.label ?? "Starter";
}

// ── Intent classification ───────────────────────────────────────────────────────

type ConfirmIntent = "confirm" | "abandon" | "new_work_hint" | "correction";

function classifyConfirmationIntent(text: string): ConfirmIntent {
  const t = text.toLowerCase().trim();
  const confirmKeywords = ["ok", "va bene", "va benissimo", "perfetto", "procedi", "ottimo", "bene", "confermo", "conferma", "approvato", "giusto", "corretto", "andiamo", "yes", "go", "sì", "si"];
  const abandonKeywords = ["abbandona", "ricomincia", "nuovo preventivo", "lascia stare", "annulla", "cancella", "reset", "no grazie", "ricomincia da capo"];
  const socialBanal = ["ciao", "ciao!", "grazie", "grazie!", "grazie mille", "grazie mille!", "perfetto!", "ok!", "ottimo!", "bene!", "va bene!", "ok grazie", "ok grazie!"];

  if (confirmKeywords.some(kw => t === kw || t.startsWith(`${kw} `) || t.endsWith(` ${kw}`))) {
    return "confirm";
  }
  if (socialBanal.some(kw => t === kw)) {
    return "confirm";
  }
  if (abandonKeywords.some(kw => t.includes(kw))) {
    return "abandon";
  }
  if (looksLikeNewWorkRequest(t)) {
    return "new_work_hint";
  }
  return "correction";
}

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

// ── Preview sending helper ──────────────────────────────────────────────────────

async function sendQuotePreview(from: string, data: PendingQuoteData, iterationCount: number) {
  const totale = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(data.totale));

  // Fast text-only preview (skip slow headless-browser image generation)
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

  const remainingEdits = MAX_ITERATIONS - iterationCount;
  const confirmMsg = iterationCount === 0
    ? `✅ Ecco la tua anteprima!\n\n📝 Puoi chiedermi *correzioni* (es. "cambia il prezzo delle piastrelle", "aggiungi la pulizia finale") — hai *${remainingEdits} modifiche* disponibili.\n\nOppure scrivi *OK* per salvare e ricevere il PDF.`
    : `✅ Preventivo aggiornato!\n\n📝 Altre correzioni oppure scrivi *OK* per procedere. Modifiche rimanenti: *${remainingEdits}*.`;

  await sendWhatsappText(from, confirmMsg);
}

// ── Flow: greeting → template selection (or fast-track with defaults) ──────────

async function handleGreeting(from: string, userId: string, profile: typeof businessProfilesTable.$inferSelect) {
  const isPro = profile.subscriptionStatus === "active" &&
    (profile.subscriptionPlan === "monthly_pro" || profile.subscriptionPlan === "monthly_elite");

  const prefs = await getPreferences(userId);

  // Resolve effective template (if default Pro template but user downgraded → fallback to standard)
  const effectiveTemplate = prefs.defaultTemplate
    ? ((isPro || prefs.defaultTemplate === "standard") ? prefs.defaultTemplate : "standard")
    : null;

  // Fast-track: both template AND client are pre-set → skip straight to job input
  if (effectiveTemplate && prefs.defaultClient?.nome) {
    await sendWhatsappText(from, [
      `✅ Template: *${templateLabel(effectiveTemplate)}* | Cliente: *${prefs.defaultClient.nome}*`,
      `_(predefiniti — scrivi *menu* per cambiarli)_`,
      ``,
      `📝 Descrivi il lavoro da preventivare (testo, vocale o foto):`,
    ].join("\n"));
    await upsertSession(from, userId, "awaiting_job_input", {
      templateId: effectiveTemplate,
      clientData: prefs.defaultClient,
    }, 0);
    return;
  }

  // Fast-track: only template is pre-set → skip template selection
  if (effectiveTemplate) {
    const existingClients = await getExistingClients(userId);
    if (existingClients.length > 0) {
      const clientList = existingClients
        .map((c, i) => `*${i + 1}* — ${c.nome}${c.indirizzo ? ` – ${c.indirizzo}` : ""}`)
        .join("\n");
      await sendWhatsappText(from, [
        `✅ Template: *${templateLabel(effectiveTemplate)}* _(predefinito)_`,
        ``,
        `👤 Scegli il cliente:`,
        ``,
        `*0* — Nuovo cliente`,
        clientList,
        ``,
        `Rispondi con il *numero* oppure inserisci direttamente *nome e indirizzo*.`,
      ].join("\n"));
      await upsertSession(from, userId, "awaiting_client_choice", {
        templateId: effectiveTemplate,
        existingClients,
      }, 0);
    } else {
      await sendWhatsappText(from, [
        `✅ Template: *${templateLabel(effectiveTemplate)}* _(predefinito)_`,
        ``,
        `👤 Inserisci *nome e indirizzo* del cliente (es. "Mario Rossi, Via Roma 1, Milano"), oppure scrivi *salta*.`,
      ].join("\n"));
      await upsertSession(from, userId, "awaiting_client_choice", {
        templateId: effectiveTemplate,
        existingClients: [],
      }, 0);
    }
    return;
  }

  // Full greeting → ask template
  const templateLines = TEMPLATES.map((t, i) =>
    isPro || t.id === "standard"
      ? `*${i + 1}* — ${t.emoji} ${t.label}: ${t.desc}`
      : `*${i + 1}* — ${t.emoji} ${t.label}: ${t.desc} _(richiede Piano Pro/Elite)_`
  ).join("\n");

  await sendWhatsappText(from, [
    `👋 Ciao! Sono *PrevAI*, il tuo assistente per preventivi professionali.`,
    ``,
    `Che tipo di preventivo vuoi creare?`,
    ``,
    templateLines,
    ``,
    `Rispondi con *1*, *2* o *3*`,
    `_(scrivi *menu* per le impostazioni)_`,
  ].join("\n"));

  await upsertSession(from, userId, "awaiting_template_selection", {}, 0);
}

// ── Menu: main menu ─────────────────────────────────────────────────────────────

async function sendMainMenu(from: string, userId: string, prefs: WhatsappPreferences) {
  const defaultTmpl = templateLabel(prefs.defaultTemplate ?? "standard");
  const defaultClient = prefs.defaultClient?.nome || "nessuno";
  const defaultIva = prefs.defaultIva ?? 22;

  await sendWhatsappText(from, [
    `📋 *MENU PREVAI*`,
    ``,
    `📊 *Statistiche:*`,
    `*1* — 📊 Analitiche del mese`,
    `*2* — 📋 Storico ultimi 5 preventivi`,
    ``,
    `⚙️ *Impostazioni rapide:*`,
    `*3* — 👥 Cliente predefinito  _(ora: ${defaultClient})_`,
    `*4* — 📄 Template PDF  _(ora: ${defaultTmpl})_`,
    `*5* — 💶 Aliquota IVA  _(ora: ${defaultIva}%)_`,
    ``,
    `🆘 *Supporto:*`,
    `*6* — Assistenza & supporto`,
    ``,
    `✏️ *P* — Nuovo preventivo`,
    ``,
    `Rispondi con un numero o *P*.`,
  ].join("\n"));

  await upsertSession(from, userId, "menu_main", { prefs: prefs as unknown as Record<string, unknown> }, 0);
}

async function handleMenuMainReply(
  from: string,
  userId: string,
  text: string,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const t = text.trim().toLowerCase();

  if (t === "p" || t === "preventivo" || t === "nuovo preventivo") {
    await deleteSession(from);
    await handleGreeting(from, userId, profile);
    return;
  }

  const choice = parseInt(t, 10);
  const prefs = await getPreferences(userId);

  switch (choice) {
    case 1: await handleAnalytics(from, userId, profile); await deleteSession(from); break;
    case 2: await handleQuoteHistory(from, userId); await deleteSession(from); break;
    case 3: await handleClientsMenu(from, userId, prefs); break;
    case 4: await handleTemplateMenu(from, userId, prefs, profile); break;
    case 5: await handleIvaMenu(from, userId, prefs); break;
    case 6: await handleSupport(from); await deleteSession(from); break;
    default:
      await sendWhatsappText(from, "🤔 Rispondi con *1-6* o *P* per un nuovo preventivo.\nScrivi *menu* per rivedere le opzioni.");
  }
}

// ── Menu: analytics ─────────────────────────────────────────────────────────────

async function handleAnalytics(
  from: string,
  userId: string,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [monthData] = await db
    .select({
      count: sql<number>`count(*)::int`,
      waCount: sql<number>`sum(case when source = 'whatsapp' then 1 else 0 end)::int`,
      webCount: sql<number>`sum(case when source = 'web' then 1 else 0 end)::int`,
      totalValue: sum(quotesTable.totale),
    })
    .from(quotesTable)
    .where(and(eq(quotesTable.userId, userId), gte(quotesTable.createdAt, startOfMonth)));

  const [allData] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalValue: sum(quotesTable.totale),
    })
    .from(quotesTable)
    .where(eq(quotesTable.userId, userId));

  const eur = (v: string | null) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(v ?? 0));

  const now = new Date();
  const monthName = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const isPro = profile.subscriptionStatus === "active" && profile.subscriptionPlan === "monthly_pro";
  const waUsed = monthData?.waCount ?? 0;
  const waLimit = isPro ? 20 : null;
  const usageStr = waLimit != null
    ? `WhatsApp questo mese: *${waUsed}/${waLimit}* utilizzati`
    : `WhatsApp questo mese: *${waUsed}*`;

  await sendWhatsappText(from, [
    `📊 *Analitiche — ${monthName}*`,
    ``,
    `📋 Preventivi creati: *${monthData?.count ?? 0}*`,
    `  • Via WhatsApp: ${waUsed}`,
    `  • Via sito web: ${monthData?.webCount ?? 0}`,
    `💶 Valore totale mese: *${eur(monthData?.totalValue ?? null)}*`,
    ``,
    `📈 *Storico totale:*`,
    `📋 Preventivi: *${allData?.count ?? 0}*`,
    `💶 Valore cumulativo: *${eur(allData?.totalValue ?? null)}*`,
    ``,
    usageStr,
    ``,
    `_Scrivi *menu* per tornare al menu._`,
  ].join("\n"));
}

// ── Menu: quote history ─────────────────────────────────────────────────────────

async function handleQuoteHistory(from: string, userId: string) {
  const quotes = await db
    .select({
      id: quotesTable.id,
      titoloPreventivoRiga2: quotesTable.titoloPreventivoRiga2,
      clientData: quotesTable.clientData,
      totale: quotesTable.totale,
      createdAt: quotesTable.createdAt,
    })
    .from(quotesTable)
    .where(eq(quotesTable.userId, userId))
    .orderBy(desc(quotesTable.createdAt))
    .limit(5);

  if (quotes.length === 0) {
    await sendWhatsappText(from, "📋 Non hai ancora creato preventivi.\n\nScrivi *P* per creare il tuo primo preventivo!");
    return;
  }

  const eur = (v: string | null) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(v ?? 0));

  const lines = quotes.map((q, i) => {
    const cd = q.clientData as { nome?: string } | null;
    const clientStr = cd?.nome ? ` — ${cd.nome}` : "";
    const dateStr = q.createdAt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
    const total = eur(q.totale);
    return `*${i + 1}.* ${q.titoloPreventivoRiga2 ?? "Preventivo"}${clientStr}\n    ${total} — ${dateStr}`;
  });

  await sendWhatsappText(from, [
    `📋 *Ultimi ${quotes.length} preventivi:*`,
    ``,
    lines.join("\n"),
    ``,
    `_Visualizzali su: ${PREVAI_BASE_URL}/dashboard_`,
    `_Scrivi *menu* per tornare al menu._`,
  ].join("\n"));
}

// ── Menu: clients ───────────────────────────────────────────────────────────────

async function handleClientsMenu(from: string, userId: string, prefs: WhatsappPreferences) {
  const clients = await getExistingClients(userId);

  if (clients.length === 0) {
    await sendWhatsappText(from, "👥 Non hai ancora clienti nei tuoi preventivi.\n\nCrea il tuo primo preventivo e il cliente verrà salvato automaticamente.");
    await deleteSession(from);
    return;
  }

  const currentDefaultName = prefs.defaultClient?.nome?.toLowerCase();
  const lines = clients.map((c, i) => {
    const isDefault = currentDefaultName && c.nome.toLowerCase() === currentDefaultName;
    return `*${i + 1}* — ${c.nome}${c.indirizzo ? ` – ${c.indirizzo}` : ""}${isDefault ? " ✓" : ""}`;
  });

  const currentStr = prefs.defaultClient?.nome
    ? `Cliente predefinito: *${prefs.defaultClient.nome}*`
    : "Nessun cliente predefinito impostato.";

  await sendWhatsappText(from, [
    `👥 *Clienti recenti:*`,
    ``,
    ...lines,
    ``,
    `*0* — Rimuovi cliente predefinito`,
    ``,
    currentStr,
    ``,
    `Scegli un numero per impostarlo come predefinito per i prossimi preventivi.`,
  ].join("\n"));

  await upsertSession(from, userId, "menu_clients", { existingClients: clients }, 0);
}

async function handleClientsMenuReply(from: string, userId: string, text: string, session: typeof whatsappSessionsTable.$inferSelect) {
  const payload = session.pendingQuoteData as Record<string, unknown>;
  const existingClients = (payload.existingClients as { nome: string; indirizzo: string }[] | undefined) ?? [];
  const choice = parseInt(text.trim(), 10);

  if (choice === 0) {
    await setPreferences(userId, { defaultClient: null });
    await sendWhatsappText(from, "✅ Cliente predefinito rimosso.\n\n_Scrivi *menu* per le impostazioni o *P* per un nuovo preventivo._");
    await deleteSession(from);
  } else if (choice >= 1 && choice <= existingClients.length) {
    const client = existingClients[choice - 1]!;
    await setPreferences(userId, { defaultClient: client });
    await sendWhatsappText(from, `✅ *${client.nome}* impostato come cliente predefinito.\n\n_Scrivi *menu* per le impostazioni o *P* per un nuovo preventivo._`);
    await deleteSession(from);
  } else {
    await sendWhatsappText(from, "🤔 Scegli un numero dalla lista o *0* per rimuovere il predefinito.");
  }
}

// ── Menu: template ──────────────────────────────────────────────────────────────

async function handleTemplateMenu(
  from: string,
  userId: string,
  prefs: WhatsappPreferences,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const isPro = profile.subscriptionStatus === "active" &&
    (profile.subscriptionPlan === "monthly_pro" || profile.subscriptionPlan === "monthly_elite");

  const currentDefault = prefs.defaultTemplate ?? "standard";
  const lines = TEMPLATES.map((t, i) => {
    const isDefault = t.id === currentDefault;
    const available = isPro || t.id === "standard";
    return `*${i + 1}* — ${t.emoji} ${t.label}${isDefault ? " ✓" : ""}${!available ? " _(Pro/Elite)_" : ""}`;
  });

  await sendWhatsappText(from, [
    `📄 *Template PDF predefinito:*`,
    ``,
    ...lines,
    ``,
    `Scegli un numero per impostare il template predefinito.`,
    `Il template influenza il layout del PDF e la lunghezza delle descrizioni.`,
  ].join("\n"));

  await upsertSession(from, userId, "menu_template", { isPro }, 0);
}

async function handleTemplateMenuReply(
  from: string,
  userId: string,
  text: string,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const isPro = profile.subscriptionStatus === "active" &&
    (profile.subscriptionPlan === "monthly_pro" || profile.subscriptionPlan === "monthly_elite");

  const templateId = templateFromChoice(text);
  if (!templateId) {
    await sendWhatsappText(from, "🤔 Rispondi con *1* (Starter), *2* (Elegante) o *3* (Professionale).");
    return;
  }

  if ((templateId === "mariagrazia" || templateId === "arosio") && !isPro) {
    await sendWhatsappText(from, `⚠️ Il template *${templateLabel(templateId)}* richiede Piano Pro/Elite.\n\nAggiorna su: ${PREVAI_BASE_URL}/dashboard/settings`);
    return;
  }

  await setPreferences(userId, { defaultTemplate: templateId });
  await sendWhatsappText(from, `✅ Template *${templateLabel(templateId)}* impostato come predefinito.\n\n_Scrivi *menu* per le impostazioni o *P* per un nuovo preventivo._`);
  await deleteSession(from);
}

// ── Menu: IVA ───────────────────────────────────────────────────────────────────

const IVA_OPTIONS = [4, 5, 10, 22];

async function handleIvaMenu(from: string, userId: string, prefs: WhatsappPreferences) {
  const currentIva = prefs.defaultIva ?? 22;
  const lines = IVA_OPTIONS.map((iva, i) =>
    `*${i + 1}* — ${iva}%${iva === currentIva ? " ✓" : ""}`
  );

  await sendWhatsappText(from, [
    `💶 *Aliquota IVA predefinita:*`,
    ``,
    ...lines,
    ``,
    `Scegli l'aliquota IVA da applicare automaticamente nei prossimi preventivi.`,
    `_(standard lavori edili: 10% — standard generico: 22%)_`,
  ].join("\n"));

  await upsertSession(from, userId, "menu_iva", {}, 0);
}

async function handleIvaMenuReply(from: string, userId: string, text: string) {
  const choice = parseInt(text.trim(), 10);

  if (choice >= 1 && choice <= IVA_OPTIONS.length) {
    const iva = IVA_OPTIONS[choice - 1]!;
    await setPreferences(userId, { defaultIva: iva });
    await sendWhatsappText(from, `✅ Aliquota IVA predefinita impostata a *${iva}%*.\n\n_Scrivi *menu* per le impostazioni o *P* per un nuovo preventivo._`);
    await deleteSession(from);
  } else {
    await sendWhatsappText(from, `🤔 Rispondi con *1* (4%), *2* (5%), *3* (10%) o *4* (22%).`);
  }
}

// ── Menu: support ───────────────────────────────────────────────────────────────

async function handleSupport(from: string) {
  await sendWhatsappText(from, [
    `🆘 *Assistenza PrevAI*`,
    ``,
    `📖 Guida e FAQ:`,
    `${PREVAI_BASE_URL}/whatsapp`,
    ``,
    `🌐 Dashboard e impostazioni:`,
    `${PREVAI_BASE_URL}/dashboard/settings`,
    ``,
    `✉️ Scrivi a: supporto@prevai.it`,
    ``,
    `_Per tornare al menu scrivi *menu*._`,
  ].join("\n"));
}

// ── Flow: template selected → ask client ───────────────────────────────────────

async function handleTemplateSelectionReply(
  from: string,
  userId: string,
  text: string,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const templateId = templateFromChoice(text);

  if (!templateId) {
    await sendWhatsappText(from, "🤔 Non ho capito. Rispondi con *1* (Starter), *2* (Elegante) o *3* (Professionale).");
    return;
  }

  const isPro = profile.subscriptionStatus === "active" &&
    (profile.subscriptionPlan === "monthly_pro" || profile.subscriptionPlan === "monthly_elite");

  if ((templateId === "mariagrazia" || templateId === "arosio") && !isPro) {
    await sendWhatsappText(
      from,
      `⚠️ Il template *${templateLabel(templateId)}* è disponibile solo per i piani Pro ed Elite.\n\nAggiorna il tuo piano su ${PREVAI_BASE_URL}/dashboard/settings oppure scegli il template *Starter* (rispondi *1*).`
    );
    return;
  }

  const existingClients = await getExistingClients(userId);

  if (existingClients.length > 0) {
    const clientList = existingClients
      .map((c, i) => `*${i + 1}* — ${c.nome}${c.indirizzo ? ` – ${c.indirizzo}` : ""}`)
      .join("\n");

    await sendWhatsappText(from, [
      `✅ Template *${templateLabel(templateId)}* selezionato.`,
      ``,
      `👤 Scegli il cliente:`,
      ``,
      `*0* — Nuovo cliente`,
      clientList,
      ``,
      `Rispondi con il *numero*, oppure inserisci direttamente *nome e indirizzo* del nuovo cliente (es. "Mario Rossi, Via Roma 1, Milano")`,
    ].join("\n"));

    await upsertSession(from, userId, "awaiting_client_choice", {
      templateId,
      existingClients,
    }, 0);
  } else {
    await sendWhatsappText(from, [
      `✅ Template *${templateLabel(templateId)}* selezionato.`,
      ``,
      `👤 Inserisci il *nome e indirizzo* del cliente (es. "Mario Rossi, Via Roma 1, Milano"), oppure scrivi *salta* per lasciare vuoto.`,
    ].join("\n"));

    await upsertSession(from, userId, "awaiting_client_choice", {
      templateId,
      existingClients: [],
    }, 0);
  }
}

// ── Flow: client chosen → ask job description ──────────────────────────────────

async function handleClientChoiceReply(
  from: string,
  userId: string,
  text: string,
  session: typeof whatsappSessionsTable.$inferSelect,
) {
  const payload = session.pendingQuoteData as Record<string, unknown>;
  const templateId = (payload.templateId as string | undefined) ?? "standard";
  const existingClients = (payload.existingClients as { nome: string; indirizzo: string }[] | undefined) ?? [];

  let clientData: { nome: string; indirizzo: string };

  const t = text.trim();
  const numChoice = parseInt(t, 10);
  const awaitingNewClientText = !!(payload._awaitingNewClientText as boolean | undefined);

  // If we're waiting for the user to type their new client's name/address
  if (awaitingNewClientText) {
    if (/^(salta|skip|nessun cliente|-)$/i.test(t)) {
      clientData = { nome: "", indirizzo: "" };
    } else {
      const parts = t.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
      clientData = { nome: parts[0] ?? "", indirizzo: parts.slice(1).join(", ") };
    }
    // Fall through to send job input prompt below
  } else if (!isNaN(numChoice) && numChoice === 0) {
    // User chose "Nuovo cliente" — ask for name+address before proceeding
    await sendWhatsappText(from, [
      `👤 Inserisci *nome e indirizzo* del nuovo cliente (es. "Mario Rossi, Via Roma 1, Milano"),`,
      `oppure scrivi *salta* per lasciare vuoto.`,
    ].join("\n"));
    await upsertSession(from, userId, "awaiting_client_choice", {
      ...payload,
      _awaitingNewClientText: true,
    }, 0);
    return;
  } else if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= existingClients.length) {
    clientData = existingClients[numChoice - 1]!;
  } else if (/^(salta|skip|nessun cliente|-)$/i.test(t)) {
    clientData = { nome: "", indirizzo: "" };
  } else {
    // Parse as "Nome, Indirizzo"
    const parts = t.split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
    clientData = { nome: parts[0] ?? "", indirizzo: parts.slice(1).join(", ") };
  }

  const clientLabel = clientData.nome
    ? `*${clientData.nome}*${clientData.indirizzo ? ` – ${clientData.indirizzo}` : ""}`
    : "nessun cliente specificato";

  await sendWhatsappText(from, [
    `✅ Cliente: ${clientLabel}`,
    ``,
    `📝 Ora *descrivi il lavoro* da preventivare — puoi inviare testo, un vocale o una foto degli appunti.`,
    ``,
    `Es. "Tinteggiatura di un appartamento di 80mq con due mani di pittura lavabile bianca. Includere rasatura di una parete in soggiorno."`,
  ].join("\n"));

  await upsertSession(from, userId, "awaiting_job_input", {
    templateId,
    clientData,
  }, 0);
}

// ── Flow: job description → generate quote → preview ──────────────────────────

async function handleJobInputReply(
  from: string,
  userId: string,
  rawInput: string,
  session: typeof whatsappSessionsTable.$inferSelect,
  profile: typeof businessProfilesTable.$inferSelect,
  imageDataUrls?: string[],
) {
  const payload = session.pendingQuoteData as Record<string, unknown>;
  const templateId = (payload.templateId as string | undefined) ?? "standard";
  const clientData = (payload.clientData as { nome: string; indirizzo: string } | undefined) ?? { nome: "", indirizzo: "" };

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

  // Prepend default IVA hint to rawInput if user has set a non-default rate
  const prefs = await getPreferences(userId);
  const ivaHint = prefs.defaultIva && prefs.defaultIva !== 22
    ? `[Usa aliquota IVA ${prefs.defaultIva}%]\n`
    : "";
  const augmentedInput = `${ivaHint}${rawInput}`;

  const data = await buildQuoteFromAI({ userId, rawInput: augmentedInput, log: logger, templateId, clientData: clientData.nome ? clientData : undefined, imageDataUrls });
  await upsertSession(from, userId, "awaiting_confirmation", data as unknown as Record<string, unknown>, 0);
  await sendQuotePreview(from, data, 0);
}

// ── Flow: confirmation/correction loop ─────────────────────────────────────────

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
    await sendWhatsappText(from, "🗑️ Preventivo annullato.\n\nInviami un nuovo messaggio quando vuoi creare un preventivo.");
    return;
  }

  if (intent === "confirm") {
    await finalizeQuote(from, userId, pendingData, profile);
    return;
  }

  // Corrections exhausted: save as draft and redirect
  if (iterationCount >= MAX_ITERATIONS) {
    await sendWhatsappText(from, "ℹ️ Hai utilizzato tutte le *3 modifiche* disponibili via WhatsApp. Salvo il preventivo come bozza...");
    try {
      const quote = await saveQuoteToDb({ userId, data: pendingData, source: "whatsapp", templateId: pendingData.templateId });
      await deleteSession(from);
      const quoteUrl = `${PREVAI_BASE_URL}/dashboard/quotes/${quote.id}`;
      await sendWhatsappText(from, [
        `📋 *Bozza salvata!*`,
        ``,
        `Puoi modificarla liberamente su prevai.it:`,
        quoteUrl,
        ``,
        `_Il sito ti permette di cambiare qualsiasi voce, aggiungere capitoli e scaricare il PDF finale._`,
      ].join("\n"));
    } catch (err) {
      logger.error({ err }, "WhatsApp draft save failed");
      await sendWhatsappText(from, "❌ Errore nel salvataggio. Accedi a prevai.it per completare il preventivo.");
    }
    return;
  }

  // Looks like a brand-new work request
  if (intent === "new_work_hint") {
    await sendWhatsappText(
      from,
      `ℹ️ Hai già un preventivo in corso per:\n*${pendingData.titoloPreventivoRiga2 || "preventivo attuale"}*\n\n` +
      `Se vuoi *annullarlo* e iniziarne uno nuovo, scrivi *abbandona*.\n` +
      `Oppure invia le tue *correzioni* al preventivo in corso.`
    );
    return;
  }

  // Apply correction
  await sendWhatsappText(from, "✏️ Sto aggiornando il preventivo...");
  try {
    const updatedData = await regenerateWithCorrection({ userId, current: pendingData, correction: text, log: logger });
    const newCount = iterationCount + 1;
    await upsertSession(from, userId, "awaiting_confirmation", updatedData as unknown as Record<string, unknown>, newCount);
    await sendQuotePreview(from, updatedData, newCount);
  } catch (err) {
    logger.error({ err }, "WhatsApp correction regeneration failed");
    await sendWhatsappText(from, "❌ Non riuscito ad aggiornare il preventivo. Riprova con una correzione diversa, oppure scrivi *OK* per salvare il preventivo attuale.");
  }
}

// ── Flow: legacy awaiting_client_data (backward compat) ───────────────────────

async function handleClientDataReply(
  from: string,
  userId: string,
  text: string,
  session: typeof whatsappSessionsTable.$inferSelect,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  const pendingData = session.pendingQuoteData as unknown as PendingQuoteData;

  const t = text.toLowerCase().trim();
  const abandonKeywords = ["abbandona", "ricomincia", "annulla", "cancella", "reset", "ricomincia da capo"];
  if (abandonKeywords.some(kw => t.includes(kw))) {
    await deleteSession(from);
    await sendWhatsappText(from, "🗑️ Preventivo annullato.\n\nInviami un nuovo messaggio quando vuoi.");
    return;
  }

  const parts = text.trim().split(/[,\n]+/).map(p => p.trim()).filter(Boolean);
  const clientData = /^(salta|skip|nessun cliente|-)$/i.test(text.trim())
    ? { nome: "", indirizzo: "" }
    : { nome: parts[0] ?? "", indirizzo: parts.slice(1).join(", ") };

  const finalData: PendingQuoteData = { ...pendingData, clientData };
  await finalizeQuote(from, userId, finalData, profile);
}

// ── Shared finalization: save quote + send PDF ─────────────────────────────────

async function finalizeQuote(
  from: string,
  userId: string,
  data: PendingQuoteData,
  profile: typeof businessProfilesTable.$inferSelect,
) {
  await sendWhatsappText(from, "⏳ Sto salvando il preventivo e generando il PDF...");

  try {
    const quote = await saveQuoteToDb({ userId, data, source: "whatsapp", templateId: data.templateId });
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
    const messageId = message.id;

    // Deduplicate by message id
    if (isDuplicateMessage(messageId)) {
      logger.info({ from, msgType, messageId }, "WhatsApp message deduplicated");
      return;
    }

    // Acquire per-number lock to prevent parallel processing of multiple messages
    const lockAcquired = await acquireProcessingLock(from);
    if (!lockAcquired) {
      logger.info({ from, msgType, messageId }, "WhatsApp message skipped: already processing");
      return;
    }

    try {
      logger.info({ from, msgType, messageId }, "WhatsApp message received");

      // ── OTP shortcut ────────────────────────────────────────────────────────────
      if (msgType === "text" && /^\d{6}$/.test(message.text?.body?.trim() ?? "")) {
        await handleInboundOtpVerification(from, message.text!.body.trim());
        return;
      }

      // ── Extract input ───────────────────────────────────────────────────────────
      const { text: rawInput, imageDataUrls } = await extractRawInput(message, from);
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

      // ── Menu trigger — intercepts any state (except OTP, handled above) ─────────
      if (isMenuTrigger(rawInput)) {
        const prefs = await getPreferences(connection.userId);
        await sendMainMenu(from, connection.userId, prefs);
        return;
      }

      // ── Menu state routing ───────────────────────────────────────────────────────
      if (session?.state === "menu_main") {
        await handleMenuMainReply(from, connection.userId, rawInput, profile);
        return;
      }

      if (session?.state === "menu_clients") {
        await handleClientsMenuReply(from, connection.userId, rawInput, session);
        return;
      }

      if (session?.state === "menu_template") {
        await handleTemplateMenuReply(from, connection.userId, rawInput, profile);
        return;
      }

      if (session?.state === "menu_iva") {
        await handleIvaMenuReply(from, connection.userId, rawInput);
        return;
      }

      // ── Quote flow state routing ─────────────────────────────────────────────────
      if (session?.state === "awaiting_template_selection") {
        await handleTemplateSelectionReply(from, connection.userId, rawInput, profile);
        return;
      }

      if (session?.state === "awaiting_client_choice") {
        await handleClientChoiceReply(from, connection.userId, rawInput, session);
        return;
      }

      if (session?.state === "awaiting_job_input") {
        await handleJobInputReply(from, connection.userId, rawInput, session, profile, imageDataUrls);
        return;
      }

      if (session?.state === "awaiting_confirmation") {
        await handleConfirmationReply(from, connection.userId, rawInput, session, profile);
        return;
      }

      if (session?.state === "awaiting_client_data") {
        // Legacy backward-compat handler
        await handleClientDataReply(from, connection.userId, rawInput, session, profile);
        return;
      }

      // ── No session: start greeting flow ─────────────────────────────────────────
      await handleGreeting(from, connection.userId, profile);
    } finally {
      releaseProcessingLock(from);
    }
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
    `✅ *Account collegato!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nInviami qualsiasi messaggio per iniziare a creare un preventivo professionale.`
  );
}

// ── Management routes ─────────────────────────────────────────────────────────

router.get("/whatsapp/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [connection] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
    const businessNumber = process.env.WHATSAPP_BUSINESS_NUMBER ?? null;
    res.json({ connected: !!connection, phoneNumber: connection?.phoneNumber ?? null, isEnabled: connection?.isEnabled ?? null, businessNumber });
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
    await sendWhatsappText(normalized, `✅ *Account collegato con successo!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nInviami qualsiasi messaggio per iniziare a creare un preventivo.`);
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
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string };
  voice?: { id: string };
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
