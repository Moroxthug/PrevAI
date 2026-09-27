import { db, sdiSettingsTable, bolloPeriodsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { createNotification } from "../lib/notifications.js";
import { sincronizzaStato, trasmissioniDaSincronizzare } from "./service.js";
import { sincronizzaPassive } from "./passive.js";
import { periodiBollo, ricalcolaTrimestre, trimestreDi } from "./bollo.js";

// ── A-1: manutenzione quotidiana del modulo SDI ──────────────────────────────
// Gira dentro il tick del cron (routes/cron.ts). Tre lavori, tutti a prova di
// errore singolo: un'impresa che fallisce non deve fermare le altre.
//   1. stati delle trasmissioni ancora in volo (rete di sicurezza: la via
//      normale è il webhook, ma un webhook perso non deve costare una fattura);
//   2. fatture di acquisto per chi ha aderito al ciclo passivo;
//   3. bollo virtuale: ricalcolo del trimestre e promemoria alla scadenza.

const GIORNI_PROMEMORIA_BOLLO = 15;

export type EsitoManutenzioneSdi = { trasmissioni: number; passive: number; bollo: number; errori: number };

export async function runSdiMaintenance(now = new Date()): Promise<EsitoManutenzioneSdi> {
  const esito: EsitoManutenzioneSdi = { trasmissioni: 0, passive: 0, bollo: 0, errori: 0 };

  for (const trasmissione of await trasmissioniDaSincronizzare()) {
    try {
      await sincronizzaStato(trasmissione);
      esito.trasmissioni++;
    } catch (err) {
      esito.errori++;
      logger.warn({ err, eInvoiceId: trasmissione.id }, "Stato SdI non sincronizzato");
    }
  }

  const attive = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.stato, "attivo"));
  for (const settings of attive) {
    if (settings.cicloPassivoAttivo) {
      try {
        const passive = await sincronizzaPassive({ userId: settings.userId });
        esito.passive += passive.nuove;
      } catch (err) {
        esito.errori++;
        logger.warn({ err, userId: settings.userId }, "Fatture passive non sincronizzate");
      }
    }
    try {
      await ricalcolaTrimestre(settings.userId, now.getUTCFullYear(), trimestreDi(now));
      esito.bollo += await promemoriaBollo(settings.userId, now);
    } catch (err) {
      esito.errori++;
      logger.warn({ err, userId: settings.userId }, "Bollo non aggiornato");
    }
  }
  return esito;
}

/** Avvisa una sola volta per trimestre, quando la scadenza è vicina. */
async function promemoriaBollo(userId: string, now: Date): Promise<number> {
  const periodi = await periodiBollo(userId, now.getUTCFullYear());
  // Il quarto trimestre si versa a febbraio: guardiamo anche l'anno scorso.
  periodi.push(...(await periodiBollo(userId, now.getUTCFullYear() - 1)).filter((p) => p.trimestre === 4));
  let inviati = 0;
  for (const p of periodi) {
    if (p.stato !== "aperto" || p.importoCents <= 0 || !p.scadenza) continue;
    const giorni = Math.ceil((p.scadenza.getTime() - now.getTime()) / 86_400_000);
    if (giorni > GIORNI_PROMEMORIA_BOLLO || giorni < -30) continue;
    if (p.note.startsWith("promemoria:")) continue;
    await createNotification({
      userId,
      type: "bollo_scadenza",
      title: `Imposta di bollo ${p.trimestre}° trimestre ${p.anno}: ${(p.importoCents / 100).toFixed(2)} €`,
      body:
        giorni >= 0
          ? `Da versare entro il ${p.scadenza.toLocaleDateString("it-IT")} con F24, codice tributo ${p.codiceTributo}. In PrevAI trovi l'F24 già compilato da ricopiare nell'home banking.`
          : `La scadenza del ${p.scadenza.toLocaleDateString("it-IT")} è passata: versa il prima possibile con F24, codice tributo ${p.codiceTributo}.`,
      link: "/dashboard/invoices",
    });
    await db
      .update(bolloPeriodsTable)
      .set({ note: `promemoria:${now.toISOString().slice(0, 10)}` })
      .where(and(eq(bolloPeriodsTable.userId, userId), eq(bolloPeriodsTable.anno, p.anno), eq(bolloPeriodsTable.trimestre, p.trimestre)));
    inviati++;
  }
  return inviati;
}
