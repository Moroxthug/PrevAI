// PREZZI-2: quanti preventivi restano nel mese, in un punto solo (generatore, manuale, Piano e fatturazione,
// app), e i crediti del pacchetto. I preventivi importati non consumano la quota: sono lavori di ieri.
import { db, businessProfilesTable, preventiviCreditiAcquistiTable, quoteImportCandidatesTable, quotesTable, type ImportedQuoteExtraction } from "@workspace/db";
import { BONUS_VECCHI_PREVENTIVI } from "@workspace/config";
import { and, eq, gt, sql } from "drizzle-orm";

/**
 * I vecchi preventivi che contano per il bonus: confermati dall'impresa, letti dall'IA senza dubbi, con voci e
 * totale. Lo stesso cliente con lo stesso totale conta una volta sola, così un file caricato due volte non vale doppio.
 */
export function contaVerificati(extractions: ImportedQuoteExtraction[]): number {
  const visti = new Set<string>();
  for (const e of extractions) {
    if (e.confidence === "low" || !e.items?.length || !e.total || e.total <= 0) continue;
    visti.add(`${(e.clientName ?? "").trim().toLowerCase()}|${e.total}`);
  }
  return visti.size;
}

async function vecchiPreventiviVerificati(userId: string): Promise<number> {
  const rows = await db
    .select({ extraction: quoteImportCandidatesTable.extraction })
    .from(quoteImportCandidatesTable)
    .where(and(eq(quoteImportCandidatesTable.userId, userId), eq(quoteImportCandidatesTable.status, "confirmed")));
  return contaVerificati(rows.map((r) => r.extraction));
}

export type QuotaPreventivi = { usati: number; limite: number; bonus: number; verificati: number; resetDate: Date };

/** La quota del mese; null quando il piano non ha limite. Il bonus vale solo sul piano d'ingresso. */
export async function quotaPreventivi(userId: string, plan: { id: string; quotaPerMonth: number | null } | null | undefined, now = new Date()): Promise<QuotaPreventivi | null> {
  if (plan?.quotaPerMonth == null) return null;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [conteggio, verificati] = await Promise.all([
    db
      .select({ usati: sql<number>`count(*)::int` })
      .from(quotesTable)
      .where(sql`${quotesTable.userId} = ${userId} AND ${quotesTable.createdAt} >= ${monthStart.toISOString()} AND ${quotesTable.createdAt} < ${nextMonth.toISOString()} AND coalesce(${quotesTable.source}, '') <> 'import'`),
    plan.id === "monthly_starter" ? vecchiPreventiviVerificati(userId) : Promise.resolve(0),
  ]);
  const usati = conteggio[0]?.usati ?? 0;
  const bonus = verificati >= BONUS_VECCHI_PREVENTIVI.soglia ? BONUS_VECCHI_PREVENTIVI.omaggio : 0;
  return { usati, limite: plan.quotaPerMonth + bonus, bonus, verificati, resetDate: nextMonth };
}

/** Accredita un pacchetto una volta sola per sessione Stripe (il webhook può arrivare due volte). */
export async function accreditaPacchetto(sessionId: string, userId: string, crediti: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const nuovo = await tx
      .insert(preventiviCreditiAcquistiTable)
      .values({ stripeSessionId: sessionId, userId, crediti })
      .onConflictDoNothing()
      .returning({ id: preventiviCreditiAcquistiTable.stripeSessionId });
    if (nuovo.length === 0) return false;
    await tx
      .insert(businessProfilesTable)
      .values({ userId, preventiviCrediti: crediti })
      .onConflictDoUpdate({ target: businessProfilesTable.userId, set: { preventiviCrediti: sql`${businessProfilesTable.preventiviCrediti} + ${crediti}` } });
    return true;
  });
}

/** Spende un credito, se c'è. Atomico: due invii nello stesso istante non usano lo stesso credito. */
export async function usaCredito(userId: string): Promise<boolean> {
  const rows = await db
    .update(businessProfilesTable)
    .set({ preventiviCrediti: sql`${businessProfilesTable.preventiviCrediti} - 1` })
    .where(and(eq(businessProfilesTable.userId, userId), gt(businessProfilesTable.preventiviCrediti, 0)))
    .returning({ id: businessProfilesTable.userId });
  return rows.length > 0;
}

/** I vecchi preventivi caricati, come riferimento di prezzo per l'IA. */
export function buildImportedPricesContext(quotes: { items: unknown }[]): string {
  const voci = new Map<string, string>();
  for (const q of quotes) {
    if (!Array.isArray(q.items)) continue;
    for (const it of q.items as { descrizione?: string; unita?: string; prezzoUnitario?: number | string }[]) {
      const prezzo = Number(it.prezzoUnitario);
      const nome = it.descrizione?.trim();
      if (!nome || !(prezzo > 0)) continue;
      const chiave = nome.toLowerCase();
      if (!voci.has(chiave) && voci.size < 60) voci.set(chiave, `- ${nome.slice(0, 90)} (${it.unita ?? "pz"}): ${prezzo}€/unità`);
    }
  }
  if (voci.size === 0) return "";
  return `PREZZI DEI VECCHI PREVENTIVI DI QUESTA IMPRESA (caricati da lei: per lavori simili parti da questi prezzi, più affidabili delle medie di mercato; il listino, se c'è, viene prima):\n${[...voci.values()].join("\n")}`;
}
