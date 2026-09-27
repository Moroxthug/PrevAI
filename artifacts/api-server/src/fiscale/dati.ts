import {
  db,
  invoicesTable,
  invoicePaymentsTable,
  quotesTable,
  fiscalPaymentsTable,
  bolloPeriodsTable,
  OPEN_INVOICE_STATUSES,
} from "@workspace/db";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";

// ── A-2: i numeri dell'anno, presi dove già stanno ───────────────────────────
// Il motore di calcolo è puro e non sa nulla del database: questo modulo gli
// prepara l'ingresso leggendo le tabelle che il prodotto ha già. Niente si
// duplica e niente si ricopia in tabelle "fiscali": un secondo posto dove
// tenere gli incassi sarebbe un secondo posto dove sbagliarli.
//
// Criterio di cassa, sempre: conta la data dell'**incasso**, non quella della
// fattura. È la differenza che sorprende di più chi arriva dal regime
// ordinario, e il motivo per cui una fattura di dicembre incassata a gennaio
// sposta l'imposta di un anno intero.

export type DatiAnno = {
  anno: number;
  /** Incassato davvero nell'anno (criterio di cassa). */
  incassatiCents: number;
  /** Emesso e non ancora incassato: non fa imposta, ma pesa sulla soglia. */
  fatturatoNonIncassatoCents: number;
  /** Accettato e non ancora fatturato: la parte "pipeline" del monitor soglia. */
  pipelineCents: number;
  /** Contributi previdenziali versati nell'anno (deducibili per cassa). */
  contributiVersatiCents: number;
  /** Acconti d'imposta già versati per l'anno. */
  accontiVersatiCents: number;
  /** Bollo virtuale maturato sulle fatture elettroniche dell'anno (A-1). */
  bolloCents: number;
  /** Quante fatture hanno prodotto gli incassi: serve a spiegare il numero. */
  incassiConteggio: number;
};

function estremi(anno: number): { da: Date; a: Date } {
  return { da: new Date(Date.UTC(anno, 0, 1)), a: new Date(Date.UTC(anno + 1, 0, 1)) };
}

export async function datiAnno(userId: string, anno: number): Promise<DatiAnno> {
  const { da, a } = estremi(anno);

  const [pagamenti, fatture, preventivi, versamenti, bollo] = await Promise.all([
    // Le "righe di pagamento" generate da una nota di credito non sono un
    // incasso: sono uno storno. Stessa regola di analytics/math.ts.
    db
      .select({ importo: invoicePaymentsTable.amountCents, creditNoteId: invoicePaymentsTable.creditNoteId })
      .from(invoicePaymentsTable)
      .where(and(eq(invoicePaymentsTable.userId, userId), gte(invoicePaymentsTable.date, da), lt(invoicePaymentsTable.date, a))),
    db
      .select({
        status: invoicesTable.status,
        totalCents: invoicesTable.totalCents,
        paidCents: invoicesTable.paidCents,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), gte(invoicesTable.issueDate, da), lt(invoicesTable.issueDate, a))),
    db
      .select({ totale: quotesTable.totale })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          eq(quotesTable.status, "accepted"),
          gte(quotesTable.acceptedAt, da),
          lt(quotesTable.acceptedAt, a),
          isNull(quotesTable.archivedAt),
        ),
      ),
    db
      .select({ tipo: fiscalPaymentsTable.tipo, importo: fiscalPaymentsTable.importoCents })
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, userId), eq(fiscalPaymentsTable.anno, anno))),
    db.select({ importo: bolloPeriodsTable.importoCents }).from(bolloPeriodsTable).where(and(eq(bolloPeriodsTable.userId, userId), eq(bolloPeriodsTable.anno, anno))),
  ]);

  const incassi = pagamenti.filter((p) => !p.creditNoteId);
  const incassatiCents = incassi.reduce((s, p) => s + p.importo, 0);

  const aperte = fatture.filter((f) => (OPEN_INVOICE_STATUSES as readonly string[]).includes(f.status));
  const fatturatoNonIncassatoCents = aperte.reduce((s, f) => s + Math.max(0, f.totalCents - f.paidCents), 0);

  // Pipeline = lavoro accettato meno quanto è già stato fatturato nell'anno.
  // È una stima per differenza e non un aggancio preventivo→fattura: quel
  // legame passa da cantieri e contratti e non esiste per i lavori entrati a
  // mano. Sovrastimare qui è il verso giusto dell'errore, perché il monitor
  // della soglia deve avvisare prima, non dopo.
  const accettatoCents = preventivi.reduce((s, q) => s + Math.round(Number(q.totale ?? 0) * 100), 0);
  const fatturatoCents = fatture.filter((f) => f.status !== "void").reduce((s, f) => s + Math.max(0, f.totalCents), 0);
  const pipelineCents = Math.max(0, accettatoCents - fatturatoCents);

  const contributiVersatiCents = versamenti.filter((v) => v.tipo === "contributi_inps").reduce((s, v) => s + v.importo, 0);
  const accontiVersatiCents = versamenti
    .filter((v) => v.tipo === "imposta_acconto" || v.tipo === "imposta_saldo")
    .reduce((s, v) => s + v.importo, 0);

  return {
    anno,
    incassatiCents,
    fatturatoNonIncassatoCents,
    pipelineCents,
    contributiVersatiCents,
    accontiVersatiCents,
    bolloCents: bollo.reduce((s, b) => s + b.importo, 0),
    incassiConteggio: incassi.length,
  };
}

/** Imposta sostitutiva dell'anno precedente, se già registrata come versamento a saldo. */
export async function impostaVersataNelAnno(userId: string, anno: number): Promise<number> {
  const righe = await db
    .select({ importo: fiscalPaymentsTable.importoCents })
    .from(fiscalPaymentsTable)
    .where(
      and(
        eq(fiscalPaymentsTable.userId, userId),
        eq(fiscalPaymentsTable.anno, anno),
        inArray(fiscalPaymentsTable.tipo, ["imposta_saldo", "imposta_acconto"]),
      ),
    );
  return righe.reduce((s, r) => s + r.importo, 0);
}
