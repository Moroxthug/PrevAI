import { db, bolloPeriodsTable, eInvoicesTable, invoicesTable, businessProfilesTable, BOLLO, type BolloPeriod, type EInvoice } from "@workspace/db";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

// ── A-1: imposta di bollo virtuale ───────────────────────────────────────────
// € 2 su ogni fattura **senza IVA** sopra € 77,47 (DPR 642/1972, art. 13 della
// Tariffa): è il caso normale del forfettario, quindi praticamente su tutte.
// Si assolve in modo virtuale (niente marca da incollare) e si versa a
// trimestre con F24, codici tributo 2521-2524 (Ris. AdE 42/E del 2019).
//
// Il totale del trimestre non si incrementa a mano: si **ricalcola** dalle
// trasmissioni, così uno scarto successivo non lascia due euro di troppo nel
// conteggio. Il documento che entra nel calcolo è quello effettivamente
// emesso: trasmesso e non scartato.

export const CODICI_TRIBUTO_BOLLO: Record<number, string> = { 1: "2521", 2: "2522", 3: "2523", 4: "2524" };

/** Scadenze di versamento (DM 4/12/2020): il quarto trimestre slitta all'anno dopo. */
const SCADENZE: Record<number, { mese: number; giorno: number; annoSuccessivo?: boolean }> = {
  1: { mese: 5, giorno: 31 },
  2: { mese: 9, giorno: 30 },
  3: { mese: 11, giorno: 30 },
  4: { mese: 2, giorno: 28, annoSuccessivo: true },
};

/**
 * Se il bollo del primo trimestre non supera € 5.000 si può versare insieme
 * al secondo; se primo + secondo restano sotto € 5.000, entro il 30 novembre.
 * È una facoltà, non un obbligo: la mostriamo come suggerimento.
 */
export const SOGLIA_RINVIO_CENTS = 500_000;

export function trimestreDi(data: Date): number {
  return Math.floor(data.getUTCMonth() / 3) + 1;
}

export function scadenzaBollo(anno: number, trimestre: number): Date {
  const s = SCADENZE[trimestre] ?? SCADENZE[4];
  return new Date(Date.UTC(anno + (s.annoSuccessivo ? 1 : 0), s.mese - 1, s.giorno, 12, 0, 0));
}

function estremiTrimestre(anno: number, trimestre: number): { da: Date; a: Date } {
  const da = new Date(Date.UTC(anno, (trimestre - 1) * 3, 1));
  const a = new Date(Date.UTC(trimestre === 4 ? anno + 1 : anno, trimestre === 4 ? 0 : trimestre * 3, 1));
  return { da, a };
}

/** Stati in cui il documento è (o sarà) validamente emesso: lo scarto è escluso. */
const STATI_CONTATI = ["inviata", "consegnata", "mancata_consegna", "accettata", "decorrenza_termini"] as const;

/**
 * Ricalcola un trimestre dalle trasmissioni e lo salva. Un trimestre già
 * segnato come versato conserva lo stato: si aggiornano solo i numeri, e
 * l'eventuale differenza la vede l'utente nel pannello.
 */
export async function ricalcolaTrimestre(userId: string, anno: number, trimestre: number): Promise<BolloPeriod> {
  const { da, a } = estremiTrimestre(anno, trimestre);
  const righe = await db
    .select({ bolloCents: eInvoicesTable.bolloCents })
    .from(eInvoicesTable)
    .innerJoin(invoicesTable, eq(invoicesTable.id, eInvoicesTable.invoiceId))
    .where(
      and(
        eq(eInvoicesTable.userId, userId),
        eq(eInvoicesTable.bolloVirtuale, true),
        eq(eInvoicesTable.ambiente, "produzione"),
        inArray(eInvoicesTable.stato, [...STATI_CONTATI]),
        gte(invoicesTable.issueDate, da),
        lt(invoicesTable.issueDate, a),
      ),
    );
  const documenti = righe.length;
  const importoCents = righe.reduce((s, r) => s + r.bolloCents, 0);

  const [riga] = await db
    .insert(bolloPeriodsTable)
    .values({
      userId,
      anno,
      trimestre,
      documenti,
      importoCents,
      stato: documenti === 0 ? "non_dovuto" : "aperto",
      codiceTributo: CODICI_TRIBUTO_BOLLO[trimestre] ?? "",
      scadenza: scadenzaBollo(anno, trimestre),
    })
    .onConflictDoUpdate({
      target: [bolloPeriodsTable.userId, bolloPeriodsTable.anno, bolloPeriodsTable.trimestre],
      set: {
        documenti,
        importoCents,
        codiceTributo: CODICI_TRIBUTO_BOLLO[trimestre] ?? "",
        scadenza: scadenzaBollo(anno, trimestre),
      },
    })
    .returning();
  return riga!;
}

/** Chiamata dopo ogni trasmissione: tiene il trimestre in corso allineato. */
export async function registraBolloDocumento(eInvoice: EInvoice): Promise<void> {
  if (!eInvoice.bolloVirtuale || eInvoice.ambiente !== "produzione") return;
  const [fattura] = await db.select({ issueDate: invoicesTable.issueDate }).from(invoicesTable).where(eq(invoicesTable.id, eInvoice.invoiceId));
  const data = fattura?.issueDate ?? new Date();
  await ricalcolaTrimestre(eInvoice.userId, data.getUTCFullYear(), trimestreDi(data));
}

export async function periodiBollo(userId: string, anno: number): Promise<BolloPeriod[]> {
  const righe = await db.select().from(bolloPeriodsTable).where(and(eq(bolloPeriodsTable.userId, userId), eq(bolloPeriodsTable.anno, anno)));
  const per = new Map(righe.map((r) => [r.trimestre, r]));
  // I trimestri mancanti si mostrano comunque, a zero: il calendario non ha buchi.
  return [1, 2, 3, 4].map(
    (t) =>
      per.get(t) ?? {
        userId,
        anno,
        trimestre: t,
        documenti: 0,
        importoCents: 0,
        stato: "non_dovuto" as const,
        codiceTributo: CODICI_TRIBUTO_BOLLO[t] ?? "",
        scadenza: scadenzaBollo(anno, t),
        versatoAt: null,
        riferimentoVersamento: "",
        note: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
  );
}

export async function segnaVersato(params: { userId: string; anno: number; trimestre: number; versato: boolean; riferimento?: string }): Promise<BolloPeriod> {
  const attuale = await ricalcolaTrimestre(params.userId, params.anno, params.trimestre);
  const [riga] = await db
    .update(bolloPeriodsTable)
    .set({
      stato: params.versato ? "versato" : attuale.documenti === 0 ? "non_dovuto" : "aperto",
      versatoAt: params.versato ? new Date() : null,
      riferimentoVersamento: params.versato ? (params.riferimento ?? "") : "",
    })
    .where(and(eq(bolloPeriodsTable.userId, params.userId), eq(bolloPeriodsTable.anno, params.anno), eq(bolloPeriodsTable.trimestre, params.trimestre)))
    .returning();
  return riga!;
}

export type F24Bollo = {
  anno: number;
  trimestre: number;
  /** Sezione "Erario" del modello F24. */
  sezione: "Erario";
  codiceTributo: string;
  /** Il campo "anno di riferimento" del modello. */
  annoRiferimento: number;
  importoCents: number;
  documenti: number;
  scadenza: string;
  contribuente: { denominazione: string; codiceFiscale: string | null; partitaIva: string | null };
  /** Righe pronte da ricopiare nell'home banking. */
  righe: { etichetta: string; valore: string }[];
  avviso: string;
};

/**
 * F24 **precompilato**, non pagato: il contribuente lo compila e lo versa da
 * sé (home banking o Fisconline). PrevAI non esegue pagamenti — è la regola
 * che tiene il modulo fuori dall'art. 348 c.p. e dall'art. 22 GDPR
 * (AMMINISTRAZIONE-PLAN.md §5 e §7).
 */
export async function f24Bollo(params: { userId: string; anno: number; trimestre: number }): Promise<F24Bollo> {
  const periodo = await ricalcolaTrimestre(params.userId, params.anno, params.trimestre);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const codiceTributo = CODICI_TRIBUTO_BOLLO[params.trimestre] ?? "";
  const scadenza = scadenzaBollo(params.anno, params.trimestre).toISOString().slice(0, 10);
  const euro = (periodo.importoCents / 100).toFixed(2);
  return {
    anno: params.anno,
    trimestre: params.trimestre,
    sezione: "Erario",
    codiceTributo,
    annoRiferimento: params.anno,
    importoCents: periodo.importoCents,
    documenti: periodo.documenti,
    scadenza,
    contribuente: {
      denominazione: profile?.companyName ?? "",
      codiceFiscale: profile?.codiceFiscale ?? null,
      partitaIva: profile?.vatNumber ?? null,
    },
    righe: [
      { etichetta: "Sezione", valore: "Erario" },
      { etichetta: "Codice tributo", valore: codiceTributo },
      { etichetta: "Rateazione/mese rif.", valore: "" },
      { etichetta: "Anno di riferimento", valore: String(params.anno) },
      { etichetta: "Importo a debito", valore: `${euro} €` },
      { etichetta: "Documenti con bollo", valore: `${periodo.documenti} × ${BOLLO.importo.toFixed(2)} €` },
      { etichetta: "Versare entro", valore: scadenza },
    ],
    avviso:
      periodo.importoCents === 0
        ? "Nessuna fattura con bollo in questo trimestre: non c'è niente da versare."
        : "Importo calcolato sulle fatture elettroniche emesse nel trimestre. Verifica sempre il prospetto dell'Agenzia delle Entrate (portale Fatture e Corrispettivi), che è quello che fa fede: l'AdE può aver rilevato altri documenti soggetti a bollo.",
  };
}

/** Trimestri chiusi e ancora da versare: li guarda il cron per il promemoria. */
export async function trimestriDaVersare(userId: string, oggi = new Date()): Promise<BolloPeriod[]> {
  const righe = await db.select().from(bolloPeriodsTable).where(and(eq(bolloPeriodsTable.userId, userId), eq(bolloPeriodsTable.stato, "aperto")));
  return righe.filter((r) => r.importoCents > 0 && r.scadenza !== null && r.scadenza.getTime() > oggi.getTime() - 365 * 86_400_000);
}
