import {
  db,
  invoicesTable,
  invoicePaymentsTable,
  costEntriesTable,
  projectsTable,
  fiscalPaymentsTable,
  primaNotaMovimentiTable,
  bankMovementsTable,
  supplierEInvoicesTable,
  type CategoriaMovimento,
  type TipoMovimento,
  type TipoAbbinamento,
} from "@workspace/db";
import { calcolaUtileNetto, type UtileNetto } from "@workspace/config";
import { and, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from "drizzle-orm";
import { calcoloCorrente } from "../fiscale/service.js";
import { ErroreFiscale } from "../fiscale/service.js";

// ── A-4: la prima nota ───────────────────────────────────────────────────────
// Un registro solo di tutto il denaro che entra ed esce, costruito **leggendo**
// le tabelle che il prodotto ha già: gli incassi dalle fatture, i costi dai
// cantieri e dagli scontrini, i versamenti dallo scadenzario. L'unica tabella
// nuova tiene i movimenti che non avevano un posto (commissioni, prelievi,
// un rimborso). Se la prima nota ricopiasse gli incassi, un incasso corretto
// in fattura resterebbe sbagliato qui.
//
// Criterio di cassa come nel motore fiscale: conta la data in cui il denaro si
// è mosso, non quella del documento.

export type FonteVoce = TipoAbbinamento; // incasso | costo | versamento | movimento

export type VocePrimaNota = {
  /** `fonte:id`: unico nella prima nota, stabile fra una lettura e l'altra. */
  chiave: string;
  fonte: FonteVoce;
  id: string;
  /** `YYYY-MM-DD`. */
  data: string;
  tipo: TipoMovimento;
  /** Sempre positivo: il verso lo dice `tipo`. */
  importoCents: number;
  descrizione: string;
  controparte: string;
  /** Etichetta della categoria, già in italiano. */
  categoria: string;
  /**
   * Conta nel calcolo dell'utile? Un versamento d'imposta no (l'utile sottrae
   * già il carico fiscale di competenza dell'anno, contarlo due volte sarebbe
   * un errore), un prelievo del titolare no (è denaro dell'impresa che passa
   * al titolare, non un costo).
   */
  incideSulUtile: boolean;
  /** Abbinata a un movimento dell'estratto conto. */
  inBanca: boolean;
  collegamento: { tipo: "fattura" | "cantiere"; id: string; etichetta: string } | null;
};

export type TotaliPrimaNota = {
  entrateCents: number;
  usciteCents: number;
  /** Entrate − uscite: il saldo di cassa dell'anno, non il saldo del conto. */
  saldoCents: number;
  incassiCents: number;
  altriRicaviCents: number;
  costiCents: number;
  versamentiCents: number;
  /** Prelievi, apporti, giroconti: si muovono ma non sono né ricavi né costi. */
  movimentiNeutriCents: number;
  mesi: { mese: number; entrateCents: number; usciteCents: number }[];
};

export type AvvisoPrimaNota = { id: string; testo: string; conteggio: number; importoCents?: number; link?: string };

export const ETICHETTE_CATEGORIA: Record<CategoriaMovimento, string> = {
  altri_ricavi: "Altri ricavi",
  spese_generali: "Spese generali",
  commissioni_bancarie: "Commissioni bancarie",
  affitto_utenze: "Affitto e utenze",
  veicoli_carburante: "Veicoli e carburante",
  assicurazioni: "Assicurazioni",
  altre_imposte: "Altre imposte e tasse",
  prelievo_titolare: "Prelievo del titolare",
  apporto_titolare: "Apporto del titolare",
  giroconto: "Giroconto fra conti propri",
  altro: "Altro",
};

/** Le categorie che spostano denaro senza essere un ricavo o un costo. */
export const CATEGORIE_NEUTRE: readonly CategoriaMovimento[] = ["prelievo_titolare", "apporto_titolare", "giroconto"];

const ETICHETTE_COSTO: Record<string, string> = {
  materials: "Materiali",
  labour: "Manodopera",
  subcontractor: "Subappalti",
  permits_fees: "Permessi e oneri",
  equipment: "Attrezzature",
  misc: "Varie",
};

const ETICHETTE_VERSAMENTO: Record<string, string> = {
  contributi_inps: "Contributi INPS",
  imposta_saldo: "Imposta sostitutiva — saldo",
  imposta_acconto: "Imposta sostitutiva — acconto",
  bollo: "Imposta di bollo",
  altro: "Versamento",
};

/**
 * Costi che **non** sono uscite di cassa: le ore approvate e l'uso delle
 * attrezzature sono allocazioni interne ai cantieri per misurarne il margine.
 * La paga vera del collaboratore esce dal conto un'altra volta, e contarla due
 * volte gonfierebbe i costi.
 */
const FONTI_COSTO_INTERNE = ["time_entry", "equipment"] as const;

export function estremiAnno(anno: number): { da: Date; a: Date } {
  return { da: new Date(Date.UTC(anno, 0, 1)), a: new Date(Date.UTC(anno + 1, 0, 1)) };
}

const giorno = (d: Date) => d.toISOString().slice(0, 10);

/** Record già abbinati a un movimento bancario, per fonte. */
export async function abbinatiInBanca(userId: string): Promise<Map<FonteVoce, Set<string>>> {
  const righe = await db
    .select({ tipo: bankMovementsTable.abbinamentoTipo, id: bankMovementsTable.abbinamentoId })
    .from(bankMovementsTable)
    .where(and(eq(bankMovementsTable.userId, userId), eq(bankMovementsTable.stato, "abbinato"), isNotNull(bankMovementsTable.abbinamentoId)));
  const mappa = new Map<FonteVoce, Set<string>>();
  for (const r of righe) {
    if (!r.tipo || !r.id) continue;
    if (!mappa.has(r.tipo)) mappa.set(r.tipo, new Set());
    mappa.get(r.tipo)!.add(r.id);
  }
  return mappa;
}

export async function primaNota(userId: string, anno: number): Promise<{ anno: number; voci: VocePrimaNota[]; totali: TotaliPrimaNota; avvisi: AvvisoPrimaNota[] }> {
  const { da, a } = estremiAnno(anno);

  const [incassi, costi, versamenti, manuali, inBanca, costiDaConfermare, passive, bancaAperta] = await Promise.all([
    db
      .select({
        id: invoicePaymentsTable.id,
        data: invoicePaymentsTable.date,
        importo: invoicePaymentsTable.amountCents,
        riferimento: invoicePaymentsTable.reference,
        invoiceId: invoicesTable.id,
        numero: invoicesTable.number,
        cliente: invoicesTable.customer,
      })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(
        and(
          eq(invoicePaymentsTable.userId, userId),
          // Le righe generate da una nota di credito sono uno storno, non un
          // incasso: stessa regola di `fiscale/dati.ts`.
          isNull(invoicePaymentsTable.creditNoteId),
          gte(invoicePaymentsTable.date, da),
          lt(invoicePaymentsTable.date, a),
        ),
      ),
    db
      .select({
        id: costEntriesTable.id,
        data: costEntriesTable.date,
        importo: costEntriesTable.totalCents,
        categoria: costEntriesTable.category,
        fornitore: costEntriesTable.vendor,
        descrizione: costEntriesTable.description,
        projectId: costEntriesTable.projectId,
        cantiere: projectsTable.name,
      })
      .from(costEntriesTable)
      .leftJoin(projectsTable, eq(projectsTable.id, costEntriesTable.projectId))
      .where(
        and(
          eq(costEntriesTable.userId, userId),
          eq(costEntriesTable.status, "confirmed"),
          notInArray(costEntriesTable.source, [...FONTI_COSTO_INTERNE]),
          gte(costEntriesTable.date, da),
          lt(costEntriesTable.date, a),
        ),
      ),
    db
      .select()
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, userId), gte(fiscalPaymentsTable.data, da), lt(fiscalPaymentsTable.data, a))),
    db
      .select()
      .from(primaNotaMovimentiTable)
      .where(and(eq(primaNotaMovimentiTable.userId, userId), gte(primaNotaMovimentiTable.data, da), lt(primaNotaMovimentiTable.data, a))),
    abbinatiInBanca(userId),
    db
      .select({ n: sql<number>`count(*)::int`, totale: sql<number>`coalesce(sum(${costEntriesTable.totalCents}),0)::int` })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "pending_review"), gte(costEntriesTable.date, da), lt(costEntriesTable.date, a))),
    db
      .select({ n: sql<number>`count(*)::int`, totale: sql<number>`coalesce(sum(${supplierEInvoicesTable.totaleCents}),0)::int` })
      .from(supplierEInvoicesTable)
      .where(and(eq(supplierEInvoicesTable.userId, userId), eq(supplierEInvoicesTable.stato, "nuova"), gte(supplierEInvoicesTable.data, da), lt(supplierEInvoicesTable.data, a))),
    db
      .select({ n: sql<number>`count(*)::int`, totale: sql<number>`coalesce(sum(abs(${bankMovementsTable.importoCents})),0)::int` })
      .from(bankMovementsTable)
      .where(and(eq(bankMovementsTable.userId, userId), eq(bankMovementsTable.stato, "da_abbinare"), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a))),
  ]);

  const nb = (fonte: FonteVoce, id: string) => inBanca.get(fonte)?.has(id) ?? false;
  const voci: VocePrimaNota[] = [];

  for (const r of incassi) {
    voci.push({
      chiave: `incasso:${r.id}`,
      fonte: "incasso",
      id: r.id,
      data: giorno(r.data),
      tipo: "entrata",
      importoCents: r.importo,
      descrizione: `Incasso fattura ${r.numero}`,
      controparte: r.cliente?.name ?? "",
      categoria: "Incassi",
      incideSulUtile: true,
      inBanca: nb("incasso", r.id),
      collegamento: { tipo: "fattura", id: r.invoiceId, etichetta: r.numero },
    });
  }
  for (const r of costi) {
    voci.push({
      chiave: `costo:${r.id}`,
      fonte: "costo",
      id: r.id,
      data: giorno(r.data),
      tipo: "uscita",
      importoCents: Math.abs(r.importo),
      descrizione: r.descrizione || r.fornitore || "Costo",
      controparte: r.fornitore,
      categoria: ETICHETTE_COSTO[r.categoria] ?? "Costi",
      incideSulUtile: true,
      inBanca: nb("costo", r.id),
      collegamento: r.projectId ? { tipo: "cantiere", id: r.projectId, etichetta: r.cantiere ?? "Cantiere" } : null,
    });
  }
  for (const r of versamenti) {
    voci.push({
      chiave: `versamento:${r.id}`,
      fonte: "versamento",
      id: r.id,
      data: giorno(r.data),
      tipo: "uscita",
      importoCents: r.importoCents,
      descrizione: `${ETICHETTE_VERSAMENTO[r.tipo] ?? "Versamento"} ${r.anno}${r.codiceTributo ? ` (${r.codiceTributo})` : ""}`,
      controparte: "F24",
      categoria: "Tasse e contributi",
      incideSulUtile: false,
      inBanca: nb("versamento", r.id),
      collegamento: null,
    });
  }
  for (const r of manuali) {
    voci.push({
      chiave: `movimento:${r.id}`,
      fonte: "movimento",
      id: r.id,
      data: giorno(r.data),
      tipo: r.tipo,
      importoCents: r.importoCents,
      descrizione: r.descrizione || ETICHETTE_CATEGORIA[r.categoria],
      controparte: r.controparte,
      categoria: ETICHETTE_CATEGORIA[r.categoria],
      incideSulUtile: !CATEGORIE_NEUTRE.includes(r.categoria),
      inBanca: nb("movimento", r.id) || r.bankMovementId !== null,
      collegamento: null,
    });
  }

  voci.sort((x, y) => x.data.localeCompare(y.data) || (x.tipo === y.tipo ? 0 : x.tipo === "entrata" ? -1 : 1));

  const totali: TotaliPrimaNota = {
    entrateCents: 0,
    usciteCents: 0,
    saldoCents: 0,
    incassiCents: 0,
    altriRicaviCents: 0,
    costiCents: 0,
    versamentiCents: 0,
    movimentiNeutriCents: 0,
    mesi: Array.from({ length: 12 }, (_, i) => ({ mese: i + 1, entrateCents: 0, usciteCents: 0 })),
  };
  for (const v of voci) {
    const mese = totali.mesi[Number(v.data.slice(5, 7)) - 1]!;
    if (v.tipo === "entrata") {
      totali.entrateCents += v.importoCents;
      mese.entrateCents += v.importoCents;
    } else {
      totali.usciteCents += v.importoCents;
      mese.usciteCents += v.importoCents;
    }
    if (v.fonte === "incasso") totali.incassiCents += v.importoCents;
    else if (v.fonte === "versamento") totali.versamentiCents += v.importoCents;
    else if (!v.incideSulUtile) totali.movimentiNeutriCents += v.importoCents;
    else if (v.tipo === "entrata") totali.altriRicaviCents += v.importoCents;
    else totali.costiCents += v.importoCents;
  }
  totali.saldoCents = totali.entrateCents - totali.usciteCents;

  const avvisi: AvvisoPrimaNota[] = [];
  const [daConfermare] = costiDaConfermare;
  if (daConfermare && daConfermare.n > 0) {
    avvisi.push({
      id: "costi_da_confermare",
      testo: `${daConfermare.n} ${daConfermare.n === 1 ? "scontrino letto dall'IA aspetta" : "scontrini letti dall'IA aspettano"} la tua conferma: finché non li confermi non sono in prima nota.`,
      conteggio: daConfermare.n,
      importoCents: daConfermare.totale,
      link: "/dashboard/jobs",
    });
  }
  const [nuove] = passive;
  if (nuove && nuove.n > 0) {
    avvisi.push({
      id: "passive_non_registrate",
      testo: `${nuove.n} ${nuove.n === 1 ? "fattura di acquisto ricevuta non è ancora registrata" : "fatture di acquisto ricevute non sono ancora registrate"} come costo.`,
      conteggio: nuove.n,
      importoCents: nuove.totale,
      link: "/dashboard/amministrazione",
    });
  }
  const [aperti] = bancaAperta;
  if (aperti && aperti.n > 0) {
    avvisi.push({
      id: "banca_da_abbinare",
      testo: `${aperti.n} ${aperti.n === 1 ? "movimento dell'estratto conto non è ancora abbinato" : "movimenti dell'estratto conto non sono ancora abbinati"}: finché restano aperti, la prima nota può non essere completa.`,
      conteggio: aperti.n,
      importoCents: aperti.totale,
    });
  }

  return { anno, voci, totali, avvisi };
}

export async function utileNettoAnno(userId: string, anno: number): Promise<UtileNetto & { passiMancanti: string[] }> {
  const [{ totali }, { calcolo, passiMancanti }] = await Promise.all([primaNota(userId, anno), calcoloCorrente(userId, anno)]);
  return {
    ...calcolaUtileNetto({
      anno,
      incassiCents: totali.incassiCents,
      altriRicaviCents: totali.altriRicaviCents,
      costiCents: totali.costiCents,
      calcolo,
    }),
    passiMancanti,
  };
}

// ── Movimenti manuali ────────────────────────────────────────────────────────

export async function creaMovimento(params: {
  userId: string;
  data: Date;
  tipo: TipoMovimento;
  categoria: CategoriaMovimento;
  importoCents: number;
  descrizione?: string;
  controparte?: string;
  bankMovementId?: string | null;
}) {
  if (params.importoCents <= 0) throw new ErroreFiscale("importo_non_valido", "L'importo dev'essere maggiore di zero: il verso lo dice «entrata» o «uscita».");
  if (params.categoria === "altri_ricavi" && params.tipo !== "entrata") {
    throw new ErroreFiscale("categoria_non_valida", "«Altri ricavi» è una categoria di entrata.");
  }
  if (params.categoria === "apporto_titolare" && params.tipo !== "entrata") {
    throw new ErroreFiscale("categoria_non_valida", "Un apporto del titolare è un'entrata.");
  }
  if (params.categoria === "prelievo_titolare" && params.tipo !== "uscita") {
    throw new ErroreFiscale("categoria_non_valida", "Un prelievo del titolare è un'uscita.");
  }
  const [riga] = await db
    .insert(primaNotaMovimentiTable)
    .values({
      userId: params.userId,
      data: params.data,
      tipo: params.tipo,
      categoria: params.categoria,
      importoCents: Math.round(params.importoCents),
      descrizione: (params.descrizione ?? "").slice(0, 500),
      controparte: (params.controparte ?? "").slice(0, 200),
      bankMovementId: params.bankMovementId ?? null,
    })
    .returning();
  return riga!;
}

/**
 * Elimina un movimento manuale. Se era nato dall'estratto conto, il movimento
 * bancario torna da abbinare: altrimenti resterebbe "abbinato" a una riga che
 * non esiste più, e la prima nota avrebbe un buco che nessuno vede.
 */
export async function eliminaMovimento(userId: string, id: string): Promise<void> {
  const eliminati = await db
    .delete(primaNotaMovimentiTable)
    .where(and(eq(primaNotaMovimentiTable.id, id), eq(primaNotaMovimentiTable.userId, userId)))
    .returning({ id: primaNotaMovimentiTable.id });
  if (eliminati.length === 0) throw new ErroreFiscale("not_found", "Movimento non trovato.");
  await db
    .update(bankMovementsTable)
    .set({ stato: "da_abbinare", abbinamentoTipo: null, abbinamentoId: null, abbinatoAt: null })
    .where(and(eq(bankMovementsTable.userId, userId), eq(bankMovementsTable.abbinamentoTipo, "movimento"), eq(bankMovementsTable.abbinamentoId, id)));
}

/** Righe per il CSV: separatore `;` e virgola decimale, come le vuole Excel in italiano. */
export function primaNotaCsv(voci: readonly VocePrimaNota[]): string {
  const cella = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const righe = [
    ["Data", "Tipo", "Categoria", "Descrizione", "Controparte", "Entrata", "Uscita", "Conta nell'utile", "Abbinata in banca", "Collegamento"].join(";"),
    ...voci.map((v) =>
      [
        v.data.split("-").reverse().join("/"),
        v.tipo === "entrata" ? "Entrata" : "Uscita",
        v.categoria,
        v.descrizione,
        v.controparte,
        v.tipo === "entrata" ? euro(v.importoCents) : "",
        v.tipo === "uscita" ? euro(v.importoCents) : "",
        v.incideSulUtile ? "sì" : "no",
        v.inBanca ? "sì" : "no",
        v.collegamento ? `${v.collegamento.tipo === "fattura" ? "Fattura" : "Cantiere"} ${v.collegamento.etichetta}` : "",
      ]
        .map((x) => cella(String(x)))
        .join(";"),
    ),
  ];
  // BOM iniziale: senza, Excel apre il file come Windows-1252 e rovina gli accenti.
  return String.fromCharCode(0xfeff) + righe.join("\r\n") + "\r\n";
}

/** Record della prima nota per id, per verificare un abbinamento. */
export async function recordDiFonte(userId: string, fonte: FonteVoce, id: string): Promise<{ data: Date; importoCents: number; tipo: TipoMovimento } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  switch (fonte) {
    case "incasso": {
      const [r] = await db
        .select({ data: invoicePaymentsTable.date, importo: invoicePaymentsTable.amountCents, nota: invoicePaymentsTable.creditNoteId })
        .from(invoicePaymentsTable)
        .where(and(eq(invoicePaymentsTable.id, id), eq(invoicePaymentsTable.userId, userId)));
      return r && !r.nota ? { data: r.data, importoCents: r.importo, tipo: "entrata" } : null;
    }
    case "costo": {
      const [r] = await db
        .select({ data: costEntriesTable.date, importo: costEntriesTable.totalCents })
        .from(costEntriesTable)
        .where(and(eq(costEntriesTable.id, id), eq(costEntriesTable.userId, userId), inArray(costEntriesTable.status, ["confirmed"])));
      return r ? { data: r.data, importoCents: Math.abs(r.importo), tipo: "uscita" } : null;
    }
    case "versamento": {
      const [r] = await db
        .select({ data: fiscalPaymentsTable.data, importo: fiscalPaymentsTable.importoCents })
        .from(fiscalPaymentsTable)
        .where(and(eq(fiscalPaymentsTable.id, id), eq(fiscalPaymentsTable.userId, userId)));
      return r ? { data: r.data, importoCents: r.importo, tipo: "uscita" } : null;
    }
    case "movimento": {
      const [r] = await db
        .select()
        .from(primaNotaMovimentiTable)
        .where(and(eq(primaNotaMovimentiTable.id, id), eq(primaNotaMovimentiTable.userId, userId)));
      return r ? { data: r.data, importoCents: r.importoCents, tipo: r.tipo } : null;
    }
  }
}
