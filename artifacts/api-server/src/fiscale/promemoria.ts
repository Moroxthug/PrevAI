import { Resend } from "resend";
import { db, fiscalDeadlinesTable, authUsersTable, type ProfiloFiscale } from "@workspace/db";
import { MARKET, fmtEurCents, fmtIsoDateLong, normalizzaGiorniPromemoria, riepilogoScadenza } from "@workspace/config";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { createNotification } from "../lib/notifications.js";
import { sendWhatsappTemplate } from "../routes/whatsapp.js";
import type { VoceScadenzario } from "./scadenzario.js";

// ── A-3: promemoria delle scadenze fiscali ───────────────────────────────────
// Tre canali, in ordine di certezza: la notifica in app parte sempre, l'email
// se l'impresa la vuole, WhatsApp se l'impresa la vuole **e** il template Meta
// esiste (vedi sotto).
//
// Due regole che tengono il rumore basso, le stesse del monitor soglia (A-2):
//   1. un promemoria per soglia e per scadenza, mai due volte — `promemoria_inviati`
//      tiene il conto, e una soglia già passata non si recupera a ritroso;
//   2. niente promemoria su una scadenza senza importo o già versata.
//
// Il testo dice **cosa** scade, **quanto** e **con quale codice**, e si ferma.
// Non dice "paga", non dice "conviene rateizzare": sono scelte del
// contribuente e, per quelle con effetti duraturi, del suo commercialista
// (AMMINISTRAZIONE-PLAN.md §5).

/**
 * Template Meta approvato per i promemoria fiscali. **Finché questa variabile
 * non è impostata, il canale WhatsApp non invia nulla** — e non può fare
 * altrimenti: fuori dalla finestra di 24 ore Meta accetta solo template
 * pre-approvati, e il template va creato nel Business Manager del titolare e
 * approvato da Meta. È la parte inerte di A-3 (decisione D10 in
 * docs/PIANO-AZIONE.md): il codice è completo, l'interruttore è del titolare.
 *
 * Il template deve avere tre parametri nel corpo, in quest'ordine:
 *   {{1}} = cosa scade · {{2}} = data · {{3}} = importo
 */
const TEMPLATE_WHATSAPP = process.env.WHATSAPP_TEMPLATE_SCADENZA_FISCALE ?? "";

export function whatsappPromemoriaDisponibile(): boolean {
  return TEMPLATE_WHATSAPP.trim() !== "";
}

/**
 * Quale promemoria tocca oggi, se ne tocca uno. Le soglie si leggono dalla
 * più stretta alla più larga: chi apre il prodotto a 4 giorni dalla scadenza
 * riceve il promemoria dei 15 giorni? No — riceve quello dei 3, appena ci
 * arriva, e i 15 restano non inviati. Recuperare una soglia passata vorrebbe
 * dire mandare due messaggi nello stesso giorno.
 */
export function promemoriaDaInviare(voce: VoceScadenzario, soglie: readonly number[]): { chiave: string; soglia: number | null } | null {
  if (voce.stato !== "aperta") return null;
  if (voce.scadenza.importoCents <= 0) return null;
  const giorni = voce.giorniAllaScadenza;

  // Scaduta: un solo richiamo, e non oltre un mese dopo (più in là il
  // problema non è un promemoria).
  if (giorni < 0) {
    if (giorni < -30) return null;
    return voce.promemoriaInviati["scaduta"] ? null : { chiave: "scaduta", soglia: null };
  }

  // La soglia che conta è la **più stretta fra quelle già aperte**: a 4 giorni
  // dalla scadenza tocca quella dei 3 appena ci si arriva, non quella dei 15,
  // che ormai è passata. E se quella soglia è già partita ci si ferma lì: le
  // soglie più larghe non si recuperano a ritroso, o si manderebbero due
  // messaggi lo stesso giorno.
  const ordinate = [...soglie].sort((a, b) => a - b);
  for (const soglia of ordinate) {
    if (giorni > soglia) continue;
    const chiave = String(soglia);
    return voce.promemoriaInviati[chiave] ? null : { chiave, soglia };
  }
  return null;
}

function titolo(voce: VoceScadenzario): string {
  const importo = fmtEurCents(voce.scadenza.importoCents);
  if (voce.giorniAllaScadenza < 0) return `Scadenza passata: ${voce.scadenza.etichetta} — ${importo}`;
  if (voce.giorniAllaScadenza === 0) return `Scade oggi: ${voce.scadenza.etichetta} — ${importo}`;
  return `Fra ${voce.giorniAllaScadenza} giorni: ${voce.scadenza.etichetta} — ${importo}`;
}

function corpo(voce: VoceScadenzario): string {
  const quando = fmtIsoDateLong(voce.scadenza.data);
  const righe = riepilogoScadenza(voce.scadenza);
  const apertura =
    voce.giorniAllaScadenza < 0
      ? `Il termine era il ${quando}.`
      : `Da versare entro il ${quando} con modello F24.`;
  const coda =
    voce.regoleNonRevisionate.length > 0
      ? " Gli importi non sono ancora stati verificati da un commercialista: controllali prima di versare."
      : "";
  return `${apertura} ${righe}. In PrevAI trovi il prospetto F24 già compilato da ricopiare nell'home banking; il versamento lo disponi tu.${coda}`;
}

function escapeHtml(valore: string): string {
  return valore.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailHtml(voce: VoceScadenzario, link: string): string {
  const righe = voce.scadenza.righe
    .map((r) => {
      const codice = r.sezione === "erario" ? `codice tributo ${r.codiceTributo}` : `causale ${r.causale}`;
      return `<tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;color:#374151;">${escapeHtml(r.descrizione)}<br><span style="color:#6b7280;font-size:12px;">${escapeHtml(codice)}</span></td>
        <td style="padding:6px 0;font-size:13px;text-align:right;white-space:nowrap;"><strong>${escapeHtml(fmtEurCents(r.importoCents))}</strong></td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html>
<html lang="${MARKET.locale}"><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h2 style="font-size:18px;color:#111827;margin:0 0 4px;">${escapeHtml(voce.scadenza.etichetta)}</h2>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">${escapeHtml(corpo(voce))}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">${righe}</table>
    <p style="font-size:15px;color:#111827;margin:12px 0 20px;">Totale <strong>${escapeHtml(fmtEurCents(voce.scadenza.importoCents))}</strong></p>
    <p style="margin:0 0 24px;"><a href="${escapeHtml(link)}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Apri lo scadenzario</a></p>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0;">
      PrevAI prepara il prospetto F24: il versamento lo disponi tu dall'home banking o dai servizi telematici dell'Agenzia delle Entrate.
      Puoi disattivare questi promemoria dallo scadenzario, in Fisco.
    </p>
  </div>
</body></html>`;
}

export type EsitoPromemoria = { inApp: number; email: number; whatsapp: number; saltati: number };

/**
 * Invia i promemoria dovuti per un'impresa e segna quelli partiti. Ogni canale
 * è indipendente: se l'email fallisce, la notifica in app resta valida e il
 * promemoria non si ripete, perché ripeterlo ogni notte per colpa di Resend
 * sarebbe peggio che perderlo una volta.
 */
export async function inviaPromemoria(params: {
  userId: string;
  profilo: ProfiloFiscale;
  voci: readonly VoceScadenzario[];
  anno: number;
}): Promise<EsitoPromemoria> {
  const esito: EsitoPromemoria = { inApp: 0, email: 0, whatsapp: 0, saltati: 0 };
  const soglie = normalizzaGiorniPromemoria(params.profilo.promemoriaGiorni);
  const link = `${getBaseUrl()}/dashboard/fisco/scadenzario`;

  for (const voce of params.voci) {
    const dovuto = promemoriaDaInviare(voce, soglie);
    if (!dovuto) {
      esito.saltati++;
      continue;
    }

    await createNotification({
      userId: params.userId,
      type: "scadenza_fiscale",
      title: titolo(voce),
      body: corpo(voce),
      link: "/dashboard/fisco/scadenzario",
    });
    esito.inApp++;

    if (params.profilo.promemoriaEmail) {
      if (await inviaEmail(params.userId, voce, link)) esito.email++;
    }
    if (params.profilo.promemoriaWhatsapp && params.profilo.promemoriaTelefono && whatsappPromemoriaDisponibile()) {
      const inviato = await sendWhatsappTemplate(params.profilo.promemoriaTelefono, TEMPLATE_WHATSAPP, "it", [
        voce.scadenza.etichetta,
        fmtIsoDateLong(voce.scadenza.data),
        fmtEurCents(voce.scadenza.importoCents),
      ]);
      if (inviato) esito.whatsapp++;
    }

    await segna(params.userId, params.anno, voce.scadenza.id, voce.promemoriaInviati, dovuto.chiave);
  }

  return esito;
}

async function segna(userId: string, anno: number, chiave: string, gia: Record<string, string>, nuova: string): Promise<void> {
  await db
    .update(fiscalDeadlinesTable)
    .set({ promemoriaInviati: { ...gia, [nuova]: new Date().toISOString().slice(0, 10) } })
    .where(and(eq(fiscalDeadlinesTable.userId, userId), eq(fiscalDeadlinesTable.anno, anno), eq(fiscalDeadlinesTable.chiave, chiave)));
}

async function inviaEmail(userId: string, voce: VoceScadenzario, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const [utente] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, userId));
  if (!utente?.email) return false;
  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `${MARKET.brand} <no-reply@${MARKET.domain}>`,
      to: [utente.email],
      subject: titolo(voce),
      html: emailHtml(voce, link),
    });
    return true;
  } catch (err) {
    logger.error({ err, userId, scadenza: voce.scadenza.id }, "Promemoria scadenza fiscale non inviato via email");
    return false;
  }
}
