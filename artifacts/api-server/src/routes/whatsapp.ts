import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { db, whatsappConnectionsTable, whatsappOtpTable, businessProfilesTable, quotesTable } from "@workspace/db";
import { eq, and, gt, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { generateQuoteFromText } from "../lib/generateQuoteFromText.js";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const WA_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "prevai_webhook_secret";
const PREVAI_BASE_URL = "https://www.prevai.it";

// ── Helpers ────────────────────────────────────────────────────────────────────

async function sendWhatsappText(to: string, text: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    logger.warn("WhatsApp env vars not configured — skipping send");
    return;
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error({ err, to }, "WhatsApp send failed");
  }
}

async function downloadMetaMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!metaRes.ok) throw new Error(`Meta media info failed: ${metaRes.status}`);
  const { url, mime_type } = (await metaRes.json()) as { url: string; mime_type: string };

  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${WA_TOKEN}` },
  });
  if (!mediaRes.ok) throw new Error(`Media download failed: ${mediaRes.status}`);
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return { buffer, mimeType: mime_type };
}

async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : mimeType.includes("mpeg") ? "mp3" : "ogg";
  const file = new File([new Uint8Array(buffer)], `audio.${ext}`, { type: mimeType });
  const transcription = await openai.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file,
    language: "it",
  });
  return transcription.text;
}

async function extractDescriptionFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: "Sei un assistente che aiuta artigiani e imprese edili italiane. Analizza l'immagine e estrai una descrizione testuale del lavoro da fare per generare un preventivo. Scrivi in italiano. Se sono appunti scritti a mano, trascrivili. Rispondi SOLO con la descrizione del lavoro, senza altre spiegazioni.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Descrivi il lavoro da fare in questa immagine o trascrivi gli appunti:" },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  if (/^\+\d{7,15}$/.test(digits)) return digits.replace("+", "");
  if (/^\d{7,15}$/.test(digits)) return digits;
  return null;
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
// Note: signature verification is handled upstream in app.ts via raw body middleware
router.post("/whatsapp/webhook", async (req, res) => {
  res.status(200).json({ status: "ok" });

  try {
    const body = req.body as WhatsappWebhookBody;
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.length) return;

    const message = value.messages[0]!;
    const from = message.from;
    const msgType = message.type;

    logger.info({ from, msgType }, "WhatsApp message received");

    let rawInput: string | null = null;

    if (msgType === "text") {
      const text = message.text?.body?.trim() ?? "";

      // Fallback OTP path: user sends OTP directly to the business number
      if (/^\d{6}$/.test(text)) {
        await handleInboundOtpVerification(from, text);
        return;
      }

      rawInput = text;
    } else if (msgType === "audio") {
      const mediaId = message.audio?.id;
      if (!mediaId) return;
      try {
        const { buffer, mimeType } = await downloadMetaMedia(mediaId);
        rawInput = await transcribeAudio(buffer, mimeType);
        logger.info({ from, rawInput: rawInput.slice(0, 100) }, "WhatsApp audio transcribed");
      } catch (err) {
        logger.error({ err }, "WhatsApp audio transcription failed");
        await sendWhatsappText(from, "❌ Non riuscito a trascrivere il messaggio vocale. Prova a scrivere la descrizione del lavoro in testo.");
        return;
      }
    } else if (msgType === "image") {
      const mediaId = message.image?.id;
      if (!mediaId) return;
      try {
        const { buffer, mimeType } = await downloadMetaMedia(mediaId);
        rawInput = await extractDescriptionFromImage(buffer, mimeType);
        logger.info({ from, rawInput: rawInput?.slice(0, 100) }, "WhatsApp image analyzed");
      } catch (err) {
        logger.error({ err }, "WhatsApp image analysis failed");
        await sendWhatsappText(from, "❌ Non riuscito ad analizzare l'immagine. Prova a scrivere la descrizione del lavoro in testo.");
        return;
      }
    } else {
      await sendWhatsappText(from, "ℹ️ Invia una *descrizione del lavoro* in testo, un *messaggio vocale* o una *foto degli appunti* per generare un preventivo.");
      return;
    }

    if (!rawInput?.trim()) {
      await sendWhatsappText(from, "ℹ️ Non ho capito la descrizione del lavoro. Prova a inviare un messaggio più dettagliato.");
      return;
    }

    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(eq(whatsappConnectionsTable.phoneNumber, from));

    if (!connection) {
      await sendWhatsappText(
        from,
        `ℹ️ Il tuo numero WhatsApp non è ancora collegato a nessun account prevai.\n\nAccedi a ${PREVAI_BASE_URL}/dashboard/settings e collega il tuo numero WhatsApp per generare preventivi direttamente da qui.`
      );
      return;
    }

    if (!connection.isEnabled) {
      await sendWhatsappText(
        from,
        `ℹ️ L'integrazione WhatsApp è disabilitata. Riabilitala su ${PREVAI_BASE_URL}/dashboard/settings`
      );
      return;
    }

    // Check that the user has an active Pro or Elite plan
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, connection.userId));
    const allowedPlans = ["monthly_pro", "monthly_elite"];
    if (profile?.subscriptionStatus !== "active" || !allowedPlans.includes(profile?.subscriptionPlan ?? "")) {
      await sendWhatsappText(
        from,
        `⚠️ Il tuo account non ha un piano attivo che include WhatsApp. Aggiorna il tuo piano su ${PREVAI_BASE_URL}/dashboard/settings`
      );
      return;
    }

    // For Pro: enforce 20 WhatsApp quotes per calendar month
    if (profile.subscriptionPlan === "monthly_pro") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotesTable)
        .where(
          and(
            eq(quotesTable.userId, connection.userId),
            eq(quotesTable.source, "whatsapp"),
            gte(quotesTable.createdAt, startOfMonth)
          )
        );
      const used = countResult?.count ?? 0;
      if (used >= 20) {
        await sendWhatsappText(
          from,
          `⚠️ Hai raggiunto il limite di *20 preventivi WhatsApp* per questo mese (Piano Pro).\n\nIl contatore si azzera il 1° del mese prossimo.\nPer preventivi WhatsApp illimitati, passa al piano Elite: ${PREVAI_BASE_URL}/dashboard/settings`
        );
        return;
      }
    }

    await sendWhatsappText(from, "⏳ Sto generando il tuo preventivo, attendi qualche secondo...");

    const quote = await generateQuoteFromText({
      userId: connection.userId,
      rawInput: rawInput.trim(),
      log: logger,
      source: "whatsapp",
    });

    const totale = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(quote.totale));
    const capitoli = Array.isArray(quote.capitoli) ? quote.capitoli : [];
    const quoteUrl = `${PREVAI_BASE_URL}/dashboard/quotes/${quote.id}`;

    const replyText = [
      `✅ *Preventivo generato!*`,
      ``,
      `📋 *${quote.titoloPreventivoRiga2 ?? "Nuovo preventivo"}*`,
      `📁 Capitoli: ${capitoli.length}`,
      `💶 Totale: *${totale}* (IVA ${quote.ivaPercentuale}% inclusa)`,
      ``,
      `👉 Visualizza e scarica il PDF su:`,
      quoteUrl,
    ].join("\n");

    await sendWhatsappText(from, replyText);
  } catch (err) {
    logger.error({ err }, "WhatsApp webhook handler error");
  }
});

/** Fallback: user sent the OTP directly to the business WhatsApp number */
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
    `✅ *Account collegato con successo!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nOra puoi inviarmi la descrizione di qualsiasi lavoro (testo, vocale o foto degli appunti) e genererò un preventivo professionale in pochi secondi.\n\nProva subito!`
  );
}

// ── GET /api/whatsapp/status — connection status ──────────────────────────────
router.get("/whatsapp/status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(eq(whatsappConnectionsTable.userId, userId));

    res.json({
      connected: !!connection,
      phoneNumber: connection?.phoneNumber ?? null,
      isEnabled: connection?.isEnabled ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "WhatsApp status error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/whatsapp/connect — generate OTP and send via WhatsApp ───────────
router.post("/whatsapp/connect", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { phoneNumber } = req.body as { phoneNumber?: string };

    if (!phoneNumber?.trim()) {
      res.status(400).json({ error: "phoneNumber is required" });
      return;
    }

    const normalized = normalizePhone(phoneNumber.trim());
    if (!normalized) {
      res.status(400).json({ error: "Numero di telefono non valido. Usa il formato internazionale, es: +39 333 1234567" });
      return;
    }

    // Only Pro and Elite plans can use WhatsApp integration
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    const allowedPlans = ["monthly_pro", "monthly_elite"];
    if (profile?.subscriptionStatus !== "active" || !allowedPlans.includes(profile?.subscriptionPlan ?? "")) {
      res.status(403).json({ error: "L'integrazione WhatsApp è disponibile solo per i piani Pro ed Elite. Aggiorna il tuo piano nelle impostazioni." });
      return;
    }

    const existingForPhone = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(eq(whatsappConnectionsTable.phoneNumber, normalized));

    if (existingForPhone.length > 0 && existingForPhone[0]!.userId !== userId) {
      res.status(409).json({ error: "Questo numero WhatsApp è già collegato a un altro account." });
      return;
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .insert(whatsappOtpTable)
      .values({ phoneNumber: normalized, otp, userId, expiresAt })
      .onConflictDoUpdate({
        target: whatsappOtpTable.phoneNumber,
        set: { otp, userId, expiresAt },
      });

    // Require WhatsApp to be configured before claiming we sent anything
    if (!WA_TOKEN || !WA_PHONE_ID) {
      res.status(503).json({ error: "L'integrazione WhatsApp non è ancora configurata. Riprova più tardi." });
      return;
    }

    // Send OTP to the user's WhatsApp number
    await sendWhatsappText(
      normalized,
      `🔐 *Codice di verifica PrevAI*\n\nIl tuo codice è: *${otp}*\n\nInseriscilo nella pagina Impostazioni per collegare il tuo account. Valido 15 minuti.`
    );

    res.json({ sent: true, phoneNumber: normalized });
  } catch (err) {
    req.log.error({ err }, "WhatsApp connect error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/whatsapp/verify — verify OTP entered in UI ──────────────────────
router.post("/whatsapp/verify", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { phoneNumber, otp } = req.body as { phoneNumber?: string; otp?: string };

    if (!phoneNumber?.trim() || !otp?.trim()) {
      res.status(400).json({ error: "phoneNumber and otp are required" });
      return;
    }

    const normalized = normalizePhone(phoneNumber.trim());
    if (!normalized) {
      res.status(400).json({ error: "Numero di telefono non valido" });
      return;
    }

    const now = new Date();
    const [otpRow] = await db
      .select()
      .from(whatsappOtpTable)
      .where(and(eq(whatsappOtpTable.phoneNumber, normalized), gt(whatsappOtpTable.expiresAt, now)));

    if (!otpRow) {
      res.status(400).json({ error: "Codice scaduto. Richiedi un nuovo codice." });
      return;
    }

    if (otpRow.userId !== userId) {
      res.status(403).json({ error: "Questo codice non appartiene al tuo account." });
      return;
    }

    if (otpRow.otp !== otp.trim()) {
      res.status(400).json({ error: "Codice errato. Ricontrolla il messaggio WhatsApp e riprova." });
      return;
    }

    await db.delete(whatsappOtpTable).where(eq(whatsappOtpTable.phoneNumber, normalized));

    await db
      .insert(whatsappConnectionsTable)
      .values({ userId, phoneNumber: normalized, isEnabled: true })
      .onConflictDoUpdate({
        target: whatsappConnectionsTable.userId,
        set: { phoneNumber: normalized, isEnabled: true, connectedAt: new Date() },
      });

    const [profile] = await db
      .select({ companyName: businessProfilesTable.companyName })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    await sendWhatsappText(
      normalized,
      `✅ *Account collegato con successo!*\n\nCiao ${profile?.companyName ?? ""}! 👋\n\nOra puoi inviarmi la descrizione di qualsiasi lavoro (testo, vocale o foto degli appunti) e genererò un preventivo professionale in pochi secondi.\n\nProva subito!`
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "WhatsApp verify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/whatsapp/disconnect ───────────────────────────────────────────
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

// ── PATCH /api/whatsapp/toggle ────────────────────────────────────────────────
router.patch("/whatsapp/toggle", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const { isEnabled } = req.body as { isEnabled?: boolean };
    if (typeof isEnabled !== "boolean") {
      res.status(400).json({ error: "isEnabled (boolean) is required" });
      return;
    }
    await db
      .update(whatsappConnectionsTable)
      .set({ isEnabled })
      .where(eq(whatsappConnectionsTable.userId, userId));
    res.json({ success: true, isEnabled });
  } catch (err) {
    req.log.error({ err }, "WhatsApp toggle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

type WhatsappWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from: string;
          type: string;
          text?: { body: string };
          audio?: { id: string };
          image?: { id: string };
        }>;
      };
    }>;
  }>;
};

export default router;
