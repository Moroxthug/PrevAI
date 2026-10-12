import { and, eq, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import {
  db,
  bankImportsTable,
  bankMovementsTable,
  costEntriesTable,
  eInvoicesTable,
  invoicePaymentsTable,
  invoicesTable,
  monthClosesTable,
  projectsTable,
  timeEntriesTable,
  type MonthClose,
  type MonthCloseSnapshot,
} from "@workspace/db";
import { writeAudit } from "../lib/notifications.js";
import { ErroreFiscale } from "../fiscale/service.js";

// ── POCKET-4 (riga 61, QuoteAI 127.1): la chiusura del mese di «Libri» ───────
// Non è una chiusura contabile: è l'elenco di ciò che in PrevAI non è ancora a posto nel mese, ognuno con
// un conteggio, un importo e le prime righe. Così «i libri di agosto sono a posto» si può verificare, e un
// mese chiuso dice se dopo è comparso altro. L'anno si chiude a parte (chiusura.ts).

export type VoceMese = "bank_unmatched" | "payments_unbanked" | "costs_pending" | "sdi_open" | "invoices_draft" | "time_unapproved";
export type RigaMese = { id: string; label: string; date: string; cents: number };
export type VoceControllo = { key: VoceMese; applies: boolean; count: number; cents: number; rows: RigaMese[] };

const MESE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMese = (s: string) => MESE.test(s);
const MAX_RIGHE = 25;
const FUSO = "Europe/Rome";

/** Il giorno `AAAA-MM-GG` di un istante secondo l'ora italiana. */
function giornoItalia(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p;
}

export function estremiMese(mese: string) {
  const [y, m] = mese.split("-").map(Number) as [number, number];
  const primo = `${mese}-01`;
  const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  // Un giorno in più per lato in SQL; il giorno giusto lo decide giornoItalia().
  return { primo, ultimo, da: new Date(Date.UTC(y, m - 1, 0)), a: new Date(Date.UTC(y, m, 2)) };
}

export function oggiItalia(): string {
  return giornoItalia(new Date());
}

export async function controlloMese(userId: string, mese: string) {
  const { primo, ultimo, da, a } = estremiMese(mese);
  const nelMese = (d: Date) => {
    const g = giornoItalia(d);
    return g >= primo && g <= ultimo;
  };
  const voce = (key: VoceMese, applies: boolean, rows: RigaMese[]): VoceControllo => ({
    key,
    applies,
    count: rows.length,
    cents: rows.reduce((s, r) => s + Math.abs(r.cents), 0),
    rows: rows.slice(0, MAX_RIGHE),
  });

  const [haEstratti] = await db.select({ id: bankImportsTable.id }).from(bankImportsTable).where(eq(bankImportsTable.userId, userId)).limit(1);
  const conBanca = !!haEstratti;

  // Estratto conto: movimenti del mese da abbinare.
  const movimenti = conBanca
    ? (await db.select().from(bankMovementsTable).where(and(eq(bankMovementsTable.userId, userId), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a)))).filter((m) => nelMese(m.data))
    : [];
  const bankUnmatched = movimenti
    .filter((m) => m.stato === "da_abbinare")
    .map((m) => ({ id: m.id, label: m.descrizione || m.controparte, date: m.data.toISOString(), cents: m.importoCents }));

  // Incassi (non in contanti) che nell'estratto non si vedono ancora.
  const incassi = (
    await db
      .select({ id: invoicePaymentsTable.id, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, number: invoicesTable.number })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(and(eq(invoicePaymentsTable.userId, userId), isNull(invoicePaymentsTable.creditNoteId), gte(invoicePaymentsTable.date, da), lt(invoicePaymentsTable.date, a)))
  ).filter((p) => nelMese(p.date));
  const inBanca = new Set(
    incassi.length
      ? (
          await db
            .select({ id: bankMovementsTable.abbinamentoId })
            .from(bankMovementsTable)
            .where(and(eq(bankMovementsTable.userId, userId), eq(bankMovementsTable.abbinamentoTipo, "incasso"), inArray(bankMovementsTable.abbinamentoId, incassi.map((p) => p.id))))
        ).map((r) => r.id)
      : [],
  );
  const paymentsUnbanked = conBanca
    ? incassi.filter((p) => p.method !== "cash" && !inBanca.has(p.id)).map((p) => ({ id: p.id, label: p.number, date: p.date.toISOString(), cents: p.amountCents }))
    : [];

  // Costi da rivedere (scontrini letti dall'IA e non ancora confermati).
  const costiPending = (
    await db
      .select({ id: costEntriesTable.id, date: costEntriesTable.date, vendor: costEntriesTable.vendor, description: costEntriesTable.description, totalCents: costEntriesTable.totalCents })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "pending_review"), gte(costEntriesTable.date, da), lt(costEntriesTable.date, a)))
  )
    .filter((c) => nelMese(c.date))
    .map((c) => ({ id: c.id, label: c.vendor || c.description, date: c.date.toISOString(), cents: c.totalCents }));

  // Fatture (serie FT-) emesse nel mese senza una consegna riuscita allo SdI: mai partite, scartate o rifiutate.
  const [haFiscali] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.fiscale, true))).limit(1);
  const fiscali = haFiscali
    ? (
        await db
          .select({ id: invoicesTable.id, number: invoicesTable.number, issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents })
          .from(invoicesTable)
          .where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.fiscale, true), ne(invoicesTable.status, "draft"), ne(invoicesTable.status, "void"), gte(invoicesTable.issueDate, da), lt(invoicesTable.issueDate, a)))
      ).filter((i) => nelMese(i.issueDate))
    : [];
  const statoSdi = new Map<string, string>();
  if (fiscali.length) {
    const righe = await db
      .select({ invoiceId: eInvoicesTable.invoiceId, stato: eInvoicesTable.stato })
      .from(eInvoicesTable)
      .where(and(eq(eInvoicesTable.userId, userId), inArray(eInvoicesTable.invoiceId, fiscali.map((i) => i.id))));
    // Se una fattura ha più trasmissioni (scarto e rinvio) conta la migliore.
    const ok = new Set(["inviata", "consegnata", "mancata_consegna", "accettata", "decorrenza_termini"]);
    for (const r of righe) if (ok.has(r.stato) || !statoSdi.has(r.invoiceId)) statoSdi.set(r.invoiceId, r.stato);
  }
  const sdiOpen = fiscali
    .filter((i) => {
      const s = statoSdi.get(i.id);
      return !s || ["bozza", "pronta", "scartata", "rifiutata"].includes(s);
    })
    .map((i) => ({ id: i.id, label: i.number, date: i.issueDate.toISOString(), cents: i.totalCents }));

  // Bozze create nel mese e mai inviate (pro-forma e fatture).
  const bozze = (
    await db
      .select({ id: invoicesTable.id, number: invoicesTable.number, createdAt: invoicesTable.createdAt, totalCents: invoicesTable.totalCents })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), eq(invoicesTable.status, "draft"), gte(invoicesTable.createdAt, da), lt(invoicesTable.createdAt, a)))
  )
    .filter((i) => nelMese(i.createdAt))
    .map((i) => ({ id: i.id, label: i.number, date: i.createdAt.toISOString(), cents: i.totalCents }));

  // Ore non approvate: costo del lavoro che ancora non esiste.
  const ore = (
    await db
      .select({ id: timeEntriesTable.id, date: timeEntriesTable.date, hours: timeEntriesTable.hours, progetto: projectsTable.name })
      .from(timeEntriesTable)
      .leftJoin(projectsTable, eq(projectsTable.id, timeEntriesTable.projectId))
      .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted"), gte(timeEntriesTable.date, da), lt(timeEntriesTable.date, a)))
  )
    .filter((e) => {
      const g = e.date.toISOString().slice(0, 10); // le ore sono salvate col loro giorno a mezzanotte UTC
      return g >= primo && g <= ultimo;
    })
    .map((e) => ({ id: e.id, label: `${e.progetto ?? ""} · ${Number(e.hours)} h`, date: e.date.toISOString(), cents: 0 }));

  const voci: VoceControllo[] = [
    voce("bank_unmatched", conBanca, bankUnmatched),
    voce("payments_unbanked", conBanca, paymentsUnbanked),
    voce("costs_pending", true, costiPending),
    voce("sdi_open", !!haFiscali, sdiOpen),
    voce("invoices_draft", true, bozze),
    voce("time_unapproved", true, ore),
  ];

  const [chiuso] = await db.select().from(monthClosesTable).where(and(eq(monthClosesTable.userId, userId), eq(monthClosesTable.month, mese)));
  const chiusi = await db.select({ month: monthClosesTable.month }).from(monthClosesTable).where(eq(monthClosesTable.userId, userId));
  return {
    month: mese,
    first: primo,
    last: ultimo,
    bankFeed: conBanca,
    items: voci,
    open: voci.filter((v) => v.applies && v.count > 0).length,
    closed: chiuso ? serializzaMese(chiuso) : null,
    // Dopo la chiusura è comparso altro: più elementi aperti di quanti ce n'erano.
    changedSinceClose: chiuso ? voci.filter((v) => v.applies && v.count > (chiuso.snapshot[v.key]?.count ?? 0)).map((v) => v.key) : [],
    closedMonths: chiusi.map((c) => c.month),
  };
}

function fotografiaMese(voci: readonly VoceControllo[]): MonthCloseSnapshot {
  return Object.fromEntries(voci.map((v) => [v.key, { count: v.count, cents: v.cents }]));
}

function serializzaMese(c: MonthClose) {
  return { month: c.month, closedAt: c.closedAt.toISOString(), closedByName: c.closedByName, note: c.note, snapshot: c.snapshot };
}

export async function panoramicaLibri(userId: string) {
  const [ultimo] = await db
    .select({ conto: bankImportsTable.conto, createdAt: bankImportsTable.createdAt })
    .from(bankImportsTable)
    .where(eq(bankImportsTable.userId, userId))
    .orderBy(sql`${bankImportsTable.createdAt} desc`)
    .limit(1);
  return {
    today: oggiItalia(),
    bank: { connected: !!ultimo, account: ultimo?.conto || null, lastImportAt: ultimo?.createdAt.toISOString() ?? null },
  };
}

export async function chiudiMese(params: { userId: string; month: string; note: string; actorName: string; ip?: string | null }) {
  const { userId, month } = params;
  if (!isMese(month)) throw new ErroreFiscale("mese_non_valido", "Mese non valido.");
  if (month >= oggiItalia().slice(0, 7)) throw new ErroreFiscale("mese_aperto", "Un mese si chiude quando è finito.");
  const controllo = await controlloMese(userId, month);
  if (controllo.closed) throw new ErroreFiscale("gia_chiuso", "Questo mese è già chiuso.");
  const fotografia = fotografiaMese(controllo.items);
  await db
    .insert(monthClosesTable)
    .values({ userId, month, closedByName: params.actorName.slice(0, 120) || null, note: params.note.slice(0, 500), snapshot: fotografia })
    .onConflictDoNothing();
  await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "books_month", entityId: month, action: "closed", diff: { fotografia }, ip: params.ip });
  const [c] = await db.select().from(monthClosesTable).where(and(eq(monthClosesTable.userId, userId), eq(monthClosesTable.month, month)));
  return serializzaMese(c!);
}

export async function riapriMese(userId: string, month: string, ip?: string | null) {
  if (!isMese(month)) throw new ErroreFiscale("mese_non_valido", "Mese non valido.");
  const eliminati = await db.delete(monthClosesTable).where(and(eq(monthClosesTable.userId, userId), eq(monthClosesTable.month, month))).returning({ month: monthClosesTable.month });
  if (eliminati.length === 0) throw new ErroreFiscale("non_chiuso", "Questo mese non è chiuso.");
  await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "books_month", entityId: month, action: "reopened", diff: {}, ip });
}
