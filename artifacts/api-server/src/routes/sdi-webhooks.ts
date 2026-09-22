import { Router } from "express";
import { db, eInvoicesTable, sdiSettingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { decryptField } from "../lib/fieldCrypto.js";
import { intermediarioPer } from "../sdi/providers/index.js";
import { registraEvento } from "../sdi/service.js";
import { sincronizzaPassive } from "../sdi/passive.js";

const router = Router();
const webhookLimiter = ipRateLimiter({ windowMs: 60_000, max: 300, message: "Troppe notifiche SDI da questo indirizzo" });

// ── A-1: notifiche dell'intermediario ────────────────────────────────────────
// Lo SdI non parla con noi: parla con l'intermediario, che ci richiama su un
// URL registrato una volta sola (in Openapi: `POST /api_configurations` con
// gli eventi customer-notification e supplier-invoice).
//
// Rotta pubblica, quindi vale la regola del perimetro: l'unico titolo per
// essere creduti è il segreto scelto dall'impresa e conservato cifrato. Il
// corpo della richiesta è **dato**, non istruzioni: ne leggiamo solo i campi
// che conosciamo, e l'idempotenza la garantisce `provider_event_id`.

router.post("/webhooks/sdi/:userId", webhookLimiter, async (req, res) => {
  // Il rate limiter allarga il tipo di req.params: qui è sempre una stringa.
  const userId = String(req.params.userId);
  const [settings] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, userId));
  if (!settings) {
    // Nessuna informazione a chi tenta a caso: stessa risposta del segreto sbagliato.
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const segreto = decryptField(settings.webhookSecret);
  const fornito = (req.query.token as string | undefined) ?? req.header("x-sdi-secret") ?? undefined;
  const intermediario = intermediarioPer(settings);
  const valido = intermediario.verificaWebhook({
    corpo: typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}),
    intestazioni: { ...(req.headers as Record<string, string | undefined>), "x-sdi-secret": fornito },
    segreto,
  });
  if (!valido) {
    logger.warn({ userId }, "Webhook SDI rifiutato: segreto non valido");
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  // Fatture di acquisto: l'evento dice solo "ne è arrivata una", il documento
  // lo scarichiamo noi — e solo se l'impresa ha aderito al ciclo passivo.
  const tipoEvento = String((req.body as Record<string, unknown> | undefined)?.event ?? (req.body as Record<string, unknown> | undefined)?.type ?? "");
  if (tipoEvento.includes("supplier")) {
    if (settings.cicloPassivoAttivo) {
      sincronizzaPassive({ userId }).catch((err: unknown) => logger.warn({ err, userId }, "Sincronizzazione passive dal webhook fallita"));
    }
    res.json({ ok: true, ignorato: !settings.cicloPassivoAttivo });
    return;
  }

  const eventi = intermediario.leggiWebhook(req.body);
  let applicati = 0;
  for (const evento of eventi) {
    if (!evento.providerDocumentId) continue;
    const [riga] = await db
      .select()
      .from(eInvoicesTable)
      .where(and(eq(eInvoicesTable.userId, userId), eq(eInvoicesTable.providerDocumentId, evento.providerDocumentId)));
    if (!riga) {
      logger.warn({ userId, providerDocumentId: evento.providerDocumentId }, "Evento SDI per un documento sconosciuto");
      continue;
    }
    await registraEvento(riga, evento);
    applicati++;
  }
  res.json({ ok: true, applicati });
});

export default router;
