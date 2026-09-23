import { createHash } from "node:crypto";
import {
  db,
  bankImportsTable,
  bankMovementsTable,
  invoicesTable,
  invoicePaymentsTable,
  costEntriesTable,
  projectsTable,
  fiscalPaymentsTable,
  primaNotaMovimentiTable,
  OPEN_INVOICE_STATUSES,
  COST_CATEGORIES,
  type BankMovement,
  type CategoriaMovimento,
  type CostCategory,
  type StatoMovimentoBanca,
  type TipoAbbinamento,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { recordPayment } from "../invoices/service.js";
import { writeAudit } from "../lib/notifications.js";
import { ErroreFiscale } from "../fiscale/service.js";
import { decodificaTesto, impronte, leggiEstratto, ErroreEstratto, type RigaScartata } from "./estratto.js";
import { abbinatiInBanca, creaMovimento, recordDiFonte, estremiAnno } from "./service.js";

// ── A-4: estratto conto e riconciliazione ────────────────────────────────────
// L'estratto conto **non è una seconda contabilità**: è un elenco di cose
// successe sul conto da ricondurre, una per una, a ciò che PrevAI già sa.
// Ogni movimento bancario finisce in uno di tre modi:
//
//   - abbinato a una riga che esiste già (l'incasso registrato in fattura, lo
//     scontrino del cantiere, l'F24 segnato versato nello scadenzario);
//   - abbinato a una riga **creata ora** nelle tabelle di sempre (un incasso
//     sulla fattura giusta, un costo, un movimento manuale) — mai in una
//     tabella parallela;
//   - ignorato, perché non va in prima nota (un giroconto fra conti propri).
//
// Nulla si abbina da solo senza che l'utente lo veda, con un'eccezione
// dichiarata: "abbina i sicuri" collega i movimenti che hanno **una sola**
// corrispondenza già registrata, stesso importo e data vicina — senza creare
// niente. Tutto il resto è un suggerimento con un bottone.

export const MAX_FILE_ESTRATTO = 5 * 1024 * 1024;

const GIORNI_TOLLERANZA_INCASSO = 7;
const GIORNI_TOLLERANZA_USCITA = 10;
const MS_GIORNO = 86_400_000;

function dataIso(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

// ── Import ───────────────────────────────────────────────────────────────────

export type EsitoImport = {
  importId: string;
  formato: "csv" | "ofx";
  lette: number;
  nuove: number;
  duplicate: number;
  scartate: RigaScartata[];
  colonne: Record<string, string>;
  /** Lo stesso file (byte per byte) era già stato caricato. */
  giaCaricato: boolean;
  periodo: { da: string; a: string } | null;
};

export async function importaEstratto(params: { userId: string; buffer: Buffer; nomeFile: string; conto?: string }): Promise<EsitoImport> {
  if (params.buffer.length > MAX_FILE_ESTRATTO) throw new ErroreFiscale("file_troppo_grande", "Il file supera i 5 MB: esporta un periodo più breve.");
  const hash = createHash("sha256").update(params.buffer).digest("hex");

  let lettura;
  try {
    lettura = leggiEstratto(decodificaTesto(params.buffer));
  } catch (err) {
    if (err instanceof ErroreEstratto) throw new ErroreFiscale(err.codice, err.message);
    throw err;
  }

  const [giaVisto] = await db
    .select({ id: bankImportsTable.id })
    .from(bankImportsTable)
    .where(and(eq(bankImportsTable.userId, params.userId), eq(bankImportsTable.fileHash, hash)))
    .limit(1);

  const [imp] = await db
    .insert(bankImportsTable)
    .values({
      userId: params.userId,
      formato: lettura.formato,
      nomeFile: params.nomeFile.slice(0, 200),
      fileHash: hash,
      conto: (params.conto ?? "").trim().slice(0, 100),
      righeLette: lettura.movimenti.length,
      righeScartate: lettura.scartate.length,
      lettura: lettura.colonne,
    })
    .returning();

  const chiavi = impronte(lettura.movimenti);
  let nuove = 0;
  // A blocchi: un estratto di un anno sono qualche migliaio di righe.
  for (let i = 0; i < lettura.movimenti.length; i += 500) {
    const blocco = lettura.movimenti.slice(i, i + 500).map((m, j) => ({
      userId: params.userId,
      importId: imp!.id,
      data: dataIso(m.data),
      dataValuta: m.dataValuta ? dataIso(m.dataValuta) : null,
      importoCents: m.importoCents,
      descrizione: m.descrizione,
      controparte: m.controparte,
      riferimento: m.riferimento,
      impronta: chiavi[i + j]!,
    }));
    const inseriti = await db.insert(bankMovementsTable).values(blocco).onConflictDoNothing().returning({ id: bankMovementsTable.id });
    nuove += inseriti.length;
  }
  const duplicate = lettura.movimenti.length - nuove;
  await db.update(bankImportsTable).set({ righeNuove: nuove, righeDuplicate: duplicate }).where(eq(bankImportsTable.id, imp!.id));

  const date = lettura.movimenti.map((m) => m.data).sort();
  return {
    importId: imp!.id,
    formato: lettura.formato,
    lette: lettura.movimenti.length,
    nuove,
    duplicate,
    scartate: lettura.scartate.slice(0, 50),
    colonne: lettura.colonne,
    giaCaricato: Boolean(giaVisto),
    periodo: date.length > 0 ? { da: date[0]!, a: date.at(-1)! } : null,
  };
}

export async function elencoImport(userId: string) {
  return db.select().from(bankImportsTable).where(eq(bankImportsTable.userId, userId)).orderBy(desc(bankImportsTable.createdAt)).limit(50);
}

/**
 * Si può togliere un estratto caricato per sbaglio, ma non se qualcuno dei suoi
 * movimenti è già abbinato: sparirebbe la prova che quell'incasso è arrivato
 * in banca. Prima si scollega, poi si toglie.
 */
export async function eliminaImport(userId: string, importId: string): Promise<void> {
  const [imp] = await db.select().from(bankImportsTable).where(and(eq(bankImportsTable.id, importId), eq(bankImportsTable.userId, userId)));
  if (!imp) throw new ErroreFiscale("not_found", "Estratto conto non trovato.");
  const [abbinati] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bankMovementsTable)
    .where(and(eq(bankMovementsTable.importId, importId), eq(bankMovementsTable.stato, "abbinato")));
  if ((abbinati?.n ?? 0) > 0) {
    throw new ErroreFiscale("import_con_abbinamenti", `${abbinati!.n} movimenti di questo estratto sono già abbinati: scollegali prima di toglierlo.`);
  }
  await db.delete(bankImportsTable).where(eq(bankImportsTable.id, importId));
}

// ── Suggerimenti ─────────────────────────────────────────────────────────────

export type Suggerimento =
  | { azione: "abbina"; tipo: TipoAbbinamento; id: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_incasso"; invoiceId: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_costo"; etichetta: string; categoria: CostCategory }
  | { azione: "registra_movimento"; etichetta: string; categoria: CategoriaMovimento }
  | { azione: "scadenzario"; etichetta: string };

type Candidato = { tipo: TipoAbbinamento; id: string; data: Date; importoCents: number; etichetta: string };

const vicino = (a: Date, b: Date, giorni: number) => Math.abs(a.getTime() - b.getTime()) <= giorni * MS_GIORNO;

function contiene(descrizione: string, testo: string): boolean {
  if (!testo) return false;
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return norm(descrizione).includes(norm(testo));
}

/**
 * Candidati per l'abbinamento di un gruppo di movimenti, letti una volta sola
 * per l'intervallo di date che coprono. Esclude ciò che è già abbinato a un
 * altro movimento: un incasso arriva in banca una volta.
 */
async function candidatiPer(userId: string, movimenti: readonly BankMovement[]) {
  if (movimenti.length === 0) return { gia: [] as Candidato[], fatture: [] as { id: string; numero: string; cliente: string; saldoCents: number }[] };
  const tempi = movimenti.map((m) => m.data.getTime());
  const da = new Date(Math.min(...tempi) - 15 * MS_GIORNO);
  const a = new Date(Math.max(...tempi) + 15 * MS_GIORNO);
  const [incassi, costi, versamenti, manuali, fatture, gia] = await Promise.all([
    db
      .select({ id: invoicePaymentsTable.id, data: invoicePaymentsTable.date, importo: invoicePaymentsTable.amountCents, numero: invoicesTable.number })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(and(eq(invoicePaymentsTable.userId, userId), isNull(invoicePaymentsTable.creditNoteId), gte(invoicePaymentsTable.date, da), lt(invoicePaymentsTable.date, a))),
    db
      .select({ id: costEntriesTable.id, data: costEntriesTable.date, importo: costEntriesTable.totalCents, fornitore: costEntriesTable.vendor, descrizione: costEntriesTable.description })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "confirmed"), gte(costEntriesTable.date, da), lt(costEntriesTable.date, a))),
    db
      .select({ id: fiscalPaymentsTable.id, data: fiscalPaymentsTable.data, importo: fiscalPaymentsTable.importoCents, tipo: fiscalPaymentsTable.tipo, scadenza: fiscalPaymentsTable.scadenzaChiave })
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, userId), gte(fiscalPaymentsTable.data, da), lt(fiscalPaymentsTable.data, a))),
    db
      .select()
      .from(primaNotaMovimentiTable)
      .where(and(eq(primaNotaMovimentiTable.userId, userId), gte(primaNotaMovimentiTable.data, da), lt(primaNotaMovimentiTable.data, a))),
    db
      .select({ id: invoicesTable.id, numero: invoicesTable.number, cliente: invoicesTable.customer, totale: invoicesTable.totalCents, pagato: invoicesTable.paidCents })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, [...OPEN_INVOICE_STATUSES]), ne(invoicesTable.type, "credit_note"))),
    abbinatiInBanca(userId),
  ]);
  const libero = (tipo: TipoAbbinamento, id: string) => !(gia.get(tipo)?.has(id) ?? false);

  // Un F24 con più righe (saldo + acconto + contributi) è **un** addebito in
  // banca ma più righe in `fiscal_payments`: si confronta la somma per
  // scadenza, e l'abbinamento punta alla prima riga del gruppo.
  const perScadenza = new Map<string, { id: string; data: Date; importo: number }>();
  const versamentiSingoli: Candidato[] = [];
  for (const v of versamenti) {
    if (v.scadenza) {
      const chiave = `${v.scadenza}|${v.data.toISOString().slice(0, 10)}`;
      const g = perScadenza.get(chiave);
      if (g) g.importo += v.importo;
      else perScadenza.set(chiave, { id: v.id, data: v.data, importo: v.importo });
    } else if (libero("versamento", v.id)) {
      versamentiSingoli.push({ tipo: "versamento", id: v.id, data: v.data, importoCents: -v.importo, etichetta: "Versamento F24 già registrato" });
    }
  }

  const candidati: Candidato[] = [
    ...incassi.filter((r) => libero("incasso", r.id)).map((r) => ({ tipo: "incasso" as const, id: r.id, data: r.data, importoCents: r.importo, etichetta: `Incasso già registrato sulla fattura ${r.numero}` })),
    ...costi
      .filter((r) => libero("costo", r.id))
      .map((r) => ({ tipo: "costo" as const, id: r.id, data: r.data, importoCents: -Math.abs(r.importo), etichetta: `Costo già registrato: ${r.descrizione || r.fornitore || "spesa"}` })),
    ...[...perScadenza.values()]
      .filter((g) => libero("versamento", g.id))
      .map((g) => ({ tipo: "versamento" as const, id: g.id, data: g.data, importoCents: -g.importo, etichetta: "F24 già segnato versato nello scadenzario" })),
    ...versamentiSingoli,
    ...manuali
      .filter((r) => libero("movimento", r.id) && r.bankMovementId === null)
      .map((r) => ({ tipo: "movimento" as const, id: r.id, data: r.data, importoCents: r.tipo === "entrata" ? r.importoCents : -r.importoCents, etichetta: `Movimento già registrato: ${r.descrizione || r.categoria}` })),
  ];

  return {
    gia: candidati,
    fatture: fatture.map((f) => ({ id: f.id, numero: f.numero, cliente: f.cliente?.name ?? "", saldoCents: Math.max(0, f.totale - f.pagato) })).filter((f) => f.saldoCents > 0),
  };
}

function suggerisci(m: BankMovement, candidati: Awaited<ReturnType<typeof candidatiPer>>): Suggerimento[] {
  const out: Suggerimento[] = [];
  const tolleranza = m.importoCents > 0 ? GIORNI_TOLLERANZA_INCASSO : GIORNI_TOLLERANZA_USCITA;
  const stessi = candidati.gia.filter((c) => c.importoCents === m.importoCents && vicino(c.data, m.data, tolleranza));
  for (const c of stessi) out.push({ azione: "abbina", tipo: c.tipo, id: c.id, etichetta: c.etichetta, certezza: stessi.length === 1 ? "alta" : "media" });

  const testo = `${m.descrizione} ${m.controparte}`;
  if (m.importoCents > 0) {
    for (const f of candidati.fatture) {
      const numeroCitato = contiene(testo, f.numero);
      if (f.saldoCents === m.importoCents || numeroCitato) {
        out.push({
          azione: "registra_incasso",
          invoiceId: f.id,
          etichetta: `Registra come incasso della fattura ${f.numero}${f.cliente ? ` di ${f.cliente}` : ""}`,
          certezza: numeroCitato && f.saldoCents === m.importoCents ? "alta" : "media",
        });
      }
    }
  } else if (stessi.length === 0) {
    if (/\bF24\b|DELEGA|AGENZIA ENTRATE|\bINPS\b/i.test(testo)) {
      out.push({ azione: "scadenzario", etichetta: "Sembra un F24: segna versata la scadenza nello scadenzario, poi torna qui ad abbinarlo" });
    } else if (/COMMISSION|CANONE|SPESE (TENUTA|CONTO)|IMPOSTA DI BOLLO/i.test(testo)) {
      out.push({ azione: "registra_movimento", etichetta: "Registra come commissione bancaria", categoria: "commissioni_bancarie" });
    } else if (/PRELIEVO|BANCOMAT|ATM/i.test(testo)) {
      out.push({ azione: "registra_movimento", etichetta: "Registra come prelievo del titolare", categoria: "prelievo_titolare" });
    } else if (/CARBURANT|ENI |Q8|ESSO|IP |TAMOIL|TELEPASS|AUTOSTRAD/i.test(testo)) {
      out.push({ azione: "registra_movimento", etichetta: "Registra come spesa per veicoli e carburante", categoria: "veicoli_carburante" });
    } else {
      out.push({ azione: "registra_costo", etichetta: "Registra come costo", categoria: "materials" });
    }
  }
  return out.sort((x, y) => Number("certezza" in y && y.certezza === "alta") - Number("certezza" in x && x.certezza === "alta"));
}

export type MovimentoBancaDto = {
  id: string;
  importId: string;
  data: string;
  dataValuta: string | null;
  importoCents: number;
  descrizione: string;
  controparte: string;
  riferimento: string;
  stato: StatoMovimentoBanca;
  abbinamento: { tipo: TipoAbbinamento; id: string } | null;
  suggerimenti: Suggerimento[];
};

export async function movimentiBanca(userId: string, filtro: { anno: number; stato?: StatoMovimentoBanca }): Promise<MovimentoBancaDto[]> {
  const { da, a } = estremiAnno(filtro.anno);
  const righe = await db
    .select()
    .from(bankMovementsTable)
    .where(and(eq(bankMovementsTable.userId, userId), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a), ...(filtro.stato ? [eq(bankMovementsTable.stato, filtro.stato)] : [])))
    .orderBy(desc(bankMovementsTable.data))
    .limit(1000);
  const aperti = righe.filter((r) => r.stato === "da_abbinare");
  const candidati = await candidatiPer(userId, aperti);
  return righe.map((r) => ({
    id: r.id,
    importId: r.importId,
    data: r.data.toISOString().slice(0, 10),
    dataValuta: r.dataValuta ? r.dataValuta.toISOString().slice(0, 10) : null,
    importoCents: r.importoCents,
    descrizione: r.descrizione,
    controparte: r.controparte,
    riferimento: r.riferimento,
    stato: r.stato,
    abbinamento: r.abbinamentoTipo && r.abbinamentoId ? { tipo: r.abbinamentoTipo, id: r.abbinamentoId } : null,
    suggerimenti: r.stato === "da_abbinare" ? suggerisci(r, candidati) : [],
  }));
}

// ── Azioni ───────────────────────────────────────────────────────────────────

async function movimentoDi(userId: string, id: string): Promise<BankMovement> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroreFiscale("not_found", "Movimento non trovato.");
  const [m] = await db.select().from(bankMovementsTable).where(and(eq(bankMovementsTable.id, id), eq(bankMovementsTable.userId, userId)));
  if (!m) throw new ErroreFiscale("not_found", "Movimento non trovato.");
  return m;
}

function soloDaAbbinare(m: BankMovement): void {
  if (m.stato !== "da_abbinare") throw new ErroreFiscale("gia_gestito", "Questo movimento è già abbinato o ignorato: scollegalo prima.");
}

async function segnaAbbinato(m: BankMovement, tipo: TipoAbbinamento, id: string) {
  await db
    .update(bankMovementsTable)
    .set({ stato: "abbinato", abbinamentoTipo: tipo, abbinamentoId: id, abbinatoAt: new Date() })
    .where(eq(bankMovementsTable.id, m.id));
}

async function importoDelega(userId: string, versamentoId: string): Promise<number> {
  const [v] = await db.select().from(fiscalPaymentsTable).where(and(eq(fiscalPaymentsTable.id, versamentoId), eq(fiscalPaymentsTable.userId, userId)));
  if (!v) return 0;
  if (!v.scadenzaChiave) return v.importoCents;
  const giorno = v.data.toISOString().slice(0, 10);
  const righe = await db
    .select({ importo: fiscalPaymentsTable.importoCents, data: fiscalPaymentsTable.data })
    .from(fiscalPaymentsTable)
    .where(and(eq(fiscalPaymentsTable.userId, userId), eq(fiscalPaymentsTable.scadenzaChiave, v.scadenzaChiave)));
  return righe.filter((r) => r.data.toISOString().slice(0, 10) === giorno).reduce((s, r) => s + r.importo, 0);
}

/** Abbina a una riga che esiste già. Stesso verso, stesso importo: il resto è l'utente a giudicarlo. */
export async function abbina(userId: string, movimentoId: string, tipo: TipoAbbinamento, id: string): Promise<void> {
  const m = await movimentoDi(userId, movimentoId);
  soloDaAbbinare(m);
  const record = await recordDiFonte(userId, tipo, id);
  if (!record) throw new ErroreFiscale("not_found", "La riga da abbinare non esiste.");
  const verso = m.importoCents > 0 ? "entrata" : "uscita";
  if (record.tipo !== verso) throw new ErroreFiscale("verso_diverso", "Un accredito si abbina a un'entrata, un addebito a un'uscita.");
  // Per un F24 la riga puntata è la prima del gruppo e l'importo da
  // confrontare è la somma della delega: tutte le righe della stessa scadenza
  // versate lo stesso giorno.
  const importo = tipo === "versamento" ? await importoDelega(userId, id) : record.importoCents;
  if (importo !== Math.abs(m.importoCents)) {
    throw new ErroreFiscale("importo_diverso", "Gli importi non coincidono: registra la differenza a parte invece di forzare l'abbinamento.");
  }
  const gia = await abbinatiInBanca(userId);
  if (gia.get(tipo)?.has(id)) throw new ErroreFiscale("gia_abbinato", "Questa riga è già abbinata a un altro movimento dell'estratto conto.");
  await segnaAbbinato(m, tipo, id);
}

/** Accredito → incasso sulla fattura, con la funzione di sempre (stato fattura, eventi, audit). */
export async function registraIncasso(userId: string, movimentoId: string, invoiceId: string, ip?: string | null): Promise<{ paymentId: string }> {
  const m = await movimentoDi(userId, movimentoId);
  soloDaAbbinare(m);
  if (m.importoCents <= 0) throw new ErroreFiscale("verso_diverso", "Solo un accredito può essere l'incasso di una fattura.");
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) throw new ErroreFiscale("not_found", "Fattura non trovata.");
  let esito;
  try {
    esito = await recordPayment({
      invoiceId,
      userId,
      amountCents: m.importoCents,
      method: "bank_transfer",
      date: m.data,
      reference: (m.riferimento || m.descrizione).slice(0, 200),
      note: "Registrato dall'estratto conto",
      // Il cliente ha già pagato giorni fa: una ricevuta adesso arriverebbe
      // fuori tempo e senza che il titolare l'abbia decisa.
      sendReceipt: false,
      ip,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Invoice not found") throw new ErroreFiscale("not_found", "Fattura non trovata.");
    throw new ErroreFiscale("incasso_non_registrabile", msg === "Send the invoice before recording a payment" ? "La fattura è ancora in bozza." : "Questa fattura non accetta incassi (annullata o nota di credito).");
  }
  await segnaAbbinato(m, "incasso", esito.payment.id);
  return { paymentId: esito.payment.id };
}

/** Addebito → costo confermato, eventualmente su un cantiere. */
export async function registraCosto(
  userId: string,
  movimentoId: string,
  opzioni: { categoria: CostCategory; projectId?: string | null; descrizione?: string },
): Promise<{ costId: string }> {
  const m = await movimentoDi(userId, movimentoId);
  soloDaAbbinare(m);
  if (m.importoCents >= 0) throw new ErroreFiscale("verso_diverso", "Solo un addebito può essere un costo.");
  if (!(COST_CATEGORIES as readonly string[]).includes(opzioni.categoria)) throw new ErroreFiscale("categoria_non_valida", "Categoria di costo non valida.");
  if (opzioni.projectId) {
    const [p] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, opzioni.projectId), eq(projectsTable.userId, userId)));
    if (!p) throw new ErroreFiscale("not_found", "Cantiere non trovato.");
  }
  const totale = Math.abs(m.importoCents);
  const [costo] = await db
    .insert(costEntriesTable)
    .values({
      userId,
      projectId: opzioni.projectId ?? null,
      category: opzioni.categoria,
      vendor: m.controparte.slice(0, 200),
      description: (opzioni.descrizione?.trim() || m.descrizione).slice(0, 500),
      date: m.data,
      // Il forfettario non detrae l'IVA: per lui l'importo pagato è tutto costo.
      subtotalCents: totale,
      taxCents: 0,
      totalCents: totale,
      status: "confirmed",
      source: "bank_feed",
      createdBy: "user",
      confirmedAt: new Date(),
    })
    .returning({ id: costEntriesTable.id });
  await segnaAbbinato(m, "costo", costo!.id);
  await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "cost_entry", entityId: costo!.id, action: "created_from_bank", diff: { totalCents: totale } });
  return { costId: costo!.id };
}

/** Movimento manuale (commissioni, prelievi, altri ricavi) nato dal movimento bancario. */
export async function registraMovimento(userId: string, movimentoId: string, opzioni: { categoria: CategoriaMovimento; descrizione?: string }): Promise<{ movimentoId: string }> {
  const m = await movimentoDi(userId, movimentoId);
  soloDaAbbinare(m);
  const riga = await creaMovimento({
    userId,
    data: m.data,
    tipo: m.importoCents > 0 ? "entrata" : "uscita",
    categoria: opzioni.categoria,
    importoCents: Math.abs(m.importoCents),
    descrizione: opzioni.descrizione?.trim() || m.descrizione,
    controparte: m.controparte,
    bankMovementId: m.id,
  });
  await segnaAbbinato(m, "movimento", riga.id);
  return { movimentoId: riga.id };
}

export async function ignora(userId: string, movimentoId: string): Promise<void> {
  const m = await movimentoDi(userId, movimentoId);
  soloDaAbbinare(m);
  await db.update(bankMovementsTable).set({ stato: "ignorato" }).where(eq(bankMovementsTable.id, m.id));
}

/**
 * Torna da abbinare. **Non** cancella la riga creata dall'abbinamento (un
 * incasso resta registrato in fattura, un costo resta sul cantiere): toglierla
 * di nascosto cambierebbe fatture e margini senza che l'utente lo veda. Se va
 * tolta, si toglie da dove sta.
 */
export async function scollega(userId: string, movimentoId: string): Promise<void> {
  const m = await movimentoDi(userId, movimentoId);
  if (m.stato === "da_abbinare") return;
  await db
    .update(bankMovementsTable)
    .set({ stato: "da_abbinare", abbinamentoTipo: null, abbinamentoId: null, abbinatoAt: null })
    .where(eq(bankMovementsTable.id, m.id));
}

/**
 * "Abbina i sicuri": solo i movimenti con **una** corrispondenza già
 * registrata e quella corrispondenza non contesa da un altro movimento. Non
 * crea incassi né costi: quelli li decide l'utente.
 */
export async function abbinaSicuri(userId: string, anno: number): Promise<{ abbinati: number }> {
  const movimenti = await movimentiBanca(userId, { anno, stato: "da_abbinare" });
  const proposte = movimenti
    .map((m) => ({ m, s: m.suggerimenti.filter((s): s is Extract<Suggerimento, { azione: "abbina" }> => s.azione === "abbina") }))
    .filter((x) => x.s.length === 1 && x.s[0]!.certezza === "alta");
  const contesi = new Map<string, number>();
  for (const p of proposte) contesi.set(`${p.s[0]!.tipo}:${p.s[0]!.id}`, (contesi.get(`${p.s[0]!.tipo}:${p.s[0]!.id}`) ?? 0) + 1);
  let abbinati = 0;
  for (const p of proposte) {
    const s = p.s[0]!;
    if (contesi.get(`${s.tipo}:${s.id}`) !== 1) continue;
    try {
      await abbina(userId, p.m.id, s.tipo, s.id);
      abbinati++;
    } catch (err) {
      if (!(err instanceof ErroreFiscale)) throw err;
    }
  }
  return { abbinati };
}

export async function riepilogoBanca(userId: string, anno: number) {
  const { da, a } = estremiAnno(anno);
  const righe = await db
    .select({ stato: bankMovementsTable.stato, n: sql<number>`count(*)::int`, entrate: sql<number>`coalesce(sum(greatest(${bankMovementsTable.importoCents},0)),0)::int`, uscite: sql<number>`coalesce(sum(greatest(-${bankMovementsTable.importoCents},0)),0)::int` })
    .from(bankMovementsTable)
    .where(and(eq(bankMovementsTable.userId, userId), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a)))
    .groupBy(bankMovementsTable.stato);
  const per = (s: StatoMovimentoBanca) => righe.find((r) => r.stato === s) ?? { n: 0, entrate: 0, uscite: 0 };
  return { daAbbinare: per("da_abbinare"), abbinati: per("abbinato"), ignorati: per("ignorato") };
}
