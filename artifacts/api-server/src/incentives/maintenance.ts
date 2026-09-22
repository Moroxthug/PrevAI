import { db, incentivesCatalogTable } from "@workspace/db";
import { ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { closeExpiredIncentives, ensureDefaultIncentives } from "./seed.js";
import { runIncentivesVerification } from "./verification.js";

// ── Controllo giornaliero del catalogo (cron) ────────────────────────────────
// È il "Daily AI Incentive Agent" di v1 montato sul tick cron di QuoteAI
// (`/api/cron/tick`, un giro al giorno) invece del setInterval nel processo:
// 1) chiude i bandi con scadenza superata; 2) ri-verifica i bandi aperti
// leggendo la pagina ufficiale e chiedendo al modello se sono ancora attivi
// o in esaurimento. Non scopre bandi nuovi (troppo inaffidabile senza
// supervisione) e non tocca mai `humanVerified`: quello lo mette solo una
// persona. Senza AI raggiungibile (e2e) aggiorna solo il timestamp.
export async function runIncentivesFreshnessCheck(): Promise<{ checked: number; closed: number; sourcesFetched: number; summary: string }> {
  const closed = await closeExpiredIncentives();
  await ensureDefaultIncentives();
  const open = await db.select().from(incentivesCatalogTable).where(ne(incentivesCatalogTable.stato, "closed"));
  if (open.length === 0) return { checked: 0, closed, sourcesFetched: 0, summary: "Nessun bando attivo da verificare." };
  try {
    const outcome = await runIncentivesVerification(open);
    return { checked: outcome.updatedCount, closed, sourcesFetched: outcome.sourcesFetched, summary: outcome.summary };
  } catch (err) {
    logger.error({ err }, "Incentives verification failed");
    return { checked: 0, closed, sourcesFetched: 0, summary: "Verifica non riuscita (vedi log)." };
  }
}
