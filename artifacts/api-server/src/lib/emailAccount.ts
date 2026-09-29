import { MARKET } from "@workspace/config";
import { logger } from "./logger.js";
import { FROM, escapeHtml, resendOrThrow, shell } from "./emailContracts.js";

// ── APP-1c: le tre email della cancellazione dell'account ──────────────────
// Richiesta (con la data e il link per annullare), promemoria 7 giorni prima,
// cancellazione fatta. Tutte best-effort: un'email che non parte non ferma
// né la richiesta né la cancellazione (resta nei log).

const fmt = (d: Date) => d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

async function send(to: string, subject: string, html: string, what: string): Promise<void> {
  try {
    await resendOrThrow().emails.send({ from: FROM, to: [to], subject, html });
    logger.info({ what }, "Account email sent");
  } catch (err) {
    logger.warn({ err, what }, "Account email not sent (non-fatal)");
  }
}

export async function sendDeletionRequestedEmail(p: { to: string; name: string; scheduledFor: Date; ownsOrg: boolean; cancelUrl: string }): Promise<void> {
  const when = fmt(p.scheduledFor);
  const org = p.ownsOrg
    ? "<p>Con il tuo account cancelleremo anche i dati della tua impresa (clienti, preventivi, cantieri, listino, collegamenti) e la squadra perderà l'accesso. Gli abbonamenti a PrevAI non si rinnovano più.</p>"
    : "";
  await send(
    p.to,
    `Cancellazione dell'account ${MARKET.brand} il ${when}`,
    shell({
      headerTitle: "Abbiamo ricevuto la richiesta",
      headerSub: `Il tuo account sarà cancellato il ${when}`,
      bodyHtml: `<p>Ciao ${escapeHtml(p.name)},</p><p>hai chiesto di cancellare il tuo account ${MARKET.brand}. Lo cancelleremo il <strong>${when}</strong>: fino ad allora puoi ancora entrare, scaricare i tuoi documenti e cambiare idea.</p>${org}<div class="cta"><a class="btn" href="${p.cancelUrl}">Annulla la cancellazione</a></div><p class="muted">Non sei stato tu? Entra, annulla la cancellazione e cambia la password.</p>`,
      footer: `${MARKET.brand} · Cancellazione dell'account`,
    }),
    "requested",
  );
}

export async function sendDeletionReminderEmail(p: { to: string; name: string; scheduledFor: Date; cancelUrl: string }): Promise<void> {
  const when = fmt(p.scheduledFor);
  await send(
    p.to,
    `Il tuo account ${MARKET.brand} sarà cancellato il ${when}`,
    shell({
      headerTitle: "Mancano pochi giorni",
      headerSub: `Cancellazione il ${when}`,
      bodyHtml: `<p>Ciao ${escapeHtml(p.name)},</p><p>ti ricordiamo che il tuo account ${MARKET.brand} sarà cancellato il <strong>${when}</strong>. Se vuoi tenere una copia dei tuoi preventivi, contratti o fatture, scaricala prima di quella data.</p><div class="cta"><a class="btn" href="${p.cancelUrl}">Annulla la cancellazione</a></div>`,
      footer: `${MARKET.brand} · Cancellazione dell'account`,
    }),
    "reminder",
  );
}

export async function sendDeletionCancelledEmail(p: { to: string; name: string }): Promise<void> {
  await send(
    p.to,
    `Cancellazione dell'account ${MARKET.brand} annullata`,
    shell({
      headerTitle: "Cancellazione annullata",
      headerSub: "Il tuo account resta attivo",
      bodyHtml: `<p>Ciao ${escapeHtml(p.name)},</p><p>la cancellazione del tuo account ${MARKET.brand} è stata annullata: non cancelleremo nulla. Se avevi un abbonamento, si rinnova di nuovo alla sua scadenza.</p><p class="muted">Non sei stato tu? Cambia subito la password da Impostazioni → Sicurezza.</p>`,
      footer: `${MARKET.brand} · Cancellazione dell'account`,
    }),
    "cancelled",
  );
}

export async function sendDeletionCompletedEmail(p: { to: string; name: string; retained: boolean }): Promise<void> {
  const kept = p.retained
    ? "<p>Come richiede la legge, conserviamo in archivio solo i contratti firmati e le fatture emesse o ricevute, per 10 anni: non sono visibili né usati per altro e vengono cancellati alla scadenza.</p>"
    : "";
  await send(
    p.to,
    `Il tuo account ${MARKET.brand} è stato cancellato`,
    shell({
      headerTitle: "Account cancellato",
      headerSub: "Grazie di aver usato " + MARKET.brand,
      bodyHtml: `<p>Ciao ${escapeHtml(p.name)},</p><p>abbiamo cancellato il tuo account ${MARKET.brand} e i dati collegati. Questa è l'ultima email che ricevi da noi.</p>${kept}<p class="muted">Per qualsiasi domanda scrivi a privacy@${MARKET.domain}.</p>`,
      footer: `${MARKET.brand} · Cancellazione dell'account`,
    }),
    "completed",
  );
}

// ── GDPR-1: l'esportazione dei dati è pronta ────────────────────────────────
// L'email non porta il file né un link diretto: rimanda alla pagina dell'app,
// dove serve essere entrati. Uno ZIP con tutti i clienti non deve poter
// girare in una casella di posta.

const mb = (bytes: number) => (bytes < 1024 * 1024 ? "meno di 1 MB" : `${Math.round(bytes / (1024 * 1024))} MB`);

export async function sendExportReadyEmail(p: { to: string; name: string; parts: number; bytes: number; expiresAt: Date; url: string }): Promise<void> {
  const parti = p.parts === 1 ? "un file ZIP" : `${p.parts} file ZIP`;
  await send(
    p.to,
    `I tuoi dati ${MARKET.brand} sono pronti da scaricare`,
    shell({
      headerTitle: "I tuoi dati sono pronti",
      headerSub: `Scaricabili fino al ${fmt(p.expiresAt)}`,
      bodyHtml: `<p>Ciao ${escapeHtml(p.name)},</p><p>l'esportazione che hai chiesto è pronta: ${parti}, ${mb(p.bytes)} in tutto. Dentro trovi le tabelle della tua impresa in JSON e in CSV (si aprono con Excel) e tutti i tuoi file: PDF, foto, ricevute, fatture.</p><p>Per scaricarla entra in ${MARKET.brand} e vai in <strong>Impostazioni → Il tuo accesso → Scarica i tuoi dati</strong>. Resta disponibile fino al <strong>${fmt(p.expiresAt)}</strong>, poi la cancelliamo.</p><div class="cta"><a class="btn" href="${p.url}">Vai allo scaricamento</a></div><p class="muted">Non l'hai chiesta tu? Cambia subito la password da Impostazioni → Sicurezza e scrivi a privacy@${MARKET.domain}.</p>`,
      footer: `${MARKET.brand} · I tuoi dati`,
    }),
    "export-ready",
  );
}
