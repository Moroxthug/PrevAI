// POCKET-2 (QuoteAI Phase 125): le versioni di un preventivo. Un preventivo che il cliente ha già, una volta
// modificato, diventa la versione successiva: la vecchia resta (quote_versions) e le modifiche vanno nella nuova
// finché il preventivo non è inviato di nuovo.
import type { quotesTable } from "@workspace/db";

type QuoteRow = typeof quotesTable.$inferSelect;

/** Vero quando salvare una modifica deve prima tenere la versione attuale e aprire la successiva. */
export function startsNewVersion(q: Pick<QuoteRow, "sentAt" | "status" | "revisionOpen">): boolean {
  return !!q.sentAt && q.status === "unlocked" && !q.revisionOpen;
}

/** Quello che il cliente poteva vedere di questa versione. */
export function snapshotOf(q: QuoteRow) {
  return {
    numeroPreventivoData: q.numeroPreventivoData,
    titoloPreventivoRiga1: q.titoloPreventivoRiga1,
    titoloPreventivoRiga2: q.titoloPreventivoRiga2,
    descrizioneGenerale: q.descrizioneGenerale,
    clientData: q.clientData,
    capitoli: q.capitoli,
    items: q.items,
    sconto: q.sconto,
    exclusions: q.exclusions,
    condizioniPagamento: q.condizioniPagamento,
    paymentSchedule: q.paymentSchedule,
    note: q.note,
    subtotale: q.subtotale,
    ivaPercentuale: q.ivaPercentuale,
    ivaValore: q.ivaValore,
    totale: q.totale,
    sentAt: q.sentAt,
  };
}
