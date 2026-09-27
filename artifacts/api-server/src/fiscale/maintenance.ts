import { db, taxProfilesTable, businessProfilesTable, hasFeature } from "@workspace/db";
import type { LivelloSoglia } from "@workspace/config";
import { eq, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { createNotification } from "../lib/notifications.js";
import { calcoloCorrente } from "./service.js";
import { riconcilia } from "./scadenzario.js";
import { inviaPromemoria } from "./promemoria.js";

// ── A-2: monitor della soglia, una volta al giorno ───────────────────────────
// Gira nel tick del cron. Avvisa quando il livello **peggiora**, mai quando
// migliora e mai due volte per lo stesso livello: la soglia degli 85.000 € si
// attraversa una volta sola, e ricordarlo ogni notte sarebbe rumore che
// insegna a ignorare le notifiche.
//
// L'avviso descrive la conseguenza e si ferma lì. Non dice "fattura a gennaio",
// non dice "conviene uscire": sono scelte con effetti fiscali e patrimoniali
// che spettano a un professionista (AMMINISTRAZIONE-PLAN.md §5).
//
// A-3 ha aggiunto un secondo lavoro nello stesso giro: i promemoria delle
// scadenze. Sta qui e non in un cron suo perché ha bisogno esattamente degli
// stessi due filtri — onboarding finito e add-on acceso — e perché lo
// scadenzario si riconcilia comunque a ogni passaggio.

const GRAVITA: Record<LivelloSoglia, number> = { ok: 0, attenzione: 1, vicino: 2, superata: 3, fuori_regime: 4 };

export type EsitoManutenzioneFiscale = {
  controllati: number;
  avvisi: number;
  /** A-3: promemoria delle scadenze partiti stanotte, per canale. */
  promemoria: { inApp: number; email: number; whatsapp: number };
  errori: number;
};

export async function runFiscalMaintenance(now = new Date()): Promise<EsitoManutenzioneFiscale> {
  const esito: EsitoManutenzioneFiscale = { controllati: 0, avvisi: 0, promemoria: { inApp: 0, email: 0, whatsapp: 0 }, errori: 0 };
  const anno = now.getUTCFullYear();

  // Solo chi ha finito l'onboarding fiscale: su un profilo a metà il calcolo
  // sarebbe un numero inventato con l'aria di essere vero.
  const profili = await db.select().from(taxProfilesTable).where(isNotNull(taxProfilesTable.completatoAt));

  for (const profilo of profili) {
    try {
      const [business] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, profilo.userId));
      if (!hasFeature(business, "fiscal_engine")) continue;
      esito.controllati++;

      // A-3: promemoria delle scadenze. Si guardano due anni d'imposta perché
      // le scadenze dell'anno chiuso cadono in quello dopo (il saldo di giugno,
      // la quarta rata INPS di febbraio, il bollo del quarto trimestre).
      for (const annoImposta of [anno, anno - 1]) {
        try {
          const { voci } = await riconcilia(profilo.userId, annoImposta, now);
          const inviati = await inviaPromemoria({ userId: profilo.userId, profilo, voci, anno: annoImposta });
          esito.promemoria.inApp += inviati.inApp;
          esito.promemoria.email += inviati.email;
          esito.promemoria.whatsapp += inviati.whatsapp;
        } catch (err) {
          esito.errori++;
          logger.warn({ err, userId: profilo.userId, annoImposta }, "Promemoria delle scadenze fiscali non inviati");
        }
      }

      const { calcolo } = await calcoloCorrente(profilo.userId, anno);
      const livello = calcolo.soglia.livello;
      const precedente = profilo.sogliaLivelloNotificato ?? "ok";
      if (GRAVITA[livello] <= GRAVITA[precedente as LivelloSoglia]) continue;
      if (livello === "ok") continue;

      await createNotification({
        userId: profilo.userId,
        type: "soglia_forfettario",
        title: titoloAvviso(livello, calcolo.soglia.maturatoCents),
        body: calcolo.soglia.conseguenza,
        link: "/dashboard/fisco",
      });
      await db
        .update(taxProfilesTable)
        .set({ sogliaLivelloNotificato: livello, sogliaNotificataAt: now })
        .where(eq(taxProfilesTable.userId, profilo.userId));
      esito.avvisi++;
    } catch (err) {
      esito.errori++;
      logger.warn({ err, userId: profilo.userId }, "Monitor soglia forfettario non aggiornato");
    }
  }

  return esito;
}

function titoloAvviso(livello: LivelloSoglia, maturatoCents: number): string {
  const importo = (maturatoCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  switch (livello) {
    case "fuori_regime":
      return `Hai superato i 100.000 €: sei fuori dal regime forfettario da subito (${importo})`;
    case "superata":
      return `Hai superato gli 85.000 €: esci dal forfettario dal 1° gennaio (${importo})`;
    case "vicino":
      return `Con il lavoro già accettato supereresti gli 85.000 € (oggi ${importo})`;
    case "attenzione":
      return `Hai superato i tre quarti della soglia del forfettario (${importo})`;
    case "ok":
    default:
      return `Soglia del forfettario: ${importo}`;
  }
}
