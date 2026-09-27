import { createHash, randomBytes } from "node:crypto";
import {
  db,
  businessProfilesTable,
  fiscalPaymentsTable,
  fiscalYearClosingsTable,
  taxProfilesTable,
  accountantSharesTable,
  accountantShareAccessesTable,
  hasFeature,
  type ChiusuraAnno,
} from "@workspace/db";
import { guidaFaiDaTe, prospettoDichiarazione, calcolaUtileNetto, fmtEurCents, type ProspettoDichiarazione, type UtileNetto } from "@workspace/config";
import { and, desc, eq, sql } from "drizzle-orm";
import { AVVISO_NON_CONSULENZA, ErroreFiscale, VERSIONE_AVVISO, calcoloCorrente, statoRevisione } from "../fiscale/service.js";
import { contribuenteDi } from "../fiscale/scadenzario.js";
import { writeAudit } from "../lib/notifications.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { primaNota, type TotaliPrimaNota, type AvvisoPrimaNota } from "./service.js";
import { riepilogoBanca } from "./banca.js";

// ── A-4: chiusura d'anno e condivisione col commercialista ───────────────────
// Il "pacchetto" dell'anno è tutto ciò che serve per la dichiarazione — il
// prospetto dei righi LM e RR, l'utile netto, la prima nota, i versamenti — ed
// è **lo stesso oggetto** che vede il titolare, che finisce nel PDF e che apre
// il commercialista dal link: tre viste diverse di numeri diversi sarebbero
// tre occasioni di contraddirsi.

export type Pacchetto = {
  anno: number;
  generatoAt: string;
  impresa: { denominazione: string; partitaIva: string; codiceFiscale: string; comune: string; provincia: string };
  profilo: { regime: string; codiceAteco: string; coefficientePercent: number; gestione: string; riduzione: string };
  prospetto: ProspettoDichiarazione;
  utile: UtileNetto;
  primaNota: { totali: TotaliPrimaNota; avvisi: AvvisoPrimaNota[]; voci: number };
  versamenti: { data: string; tipo: string; codiceTributo: string; importoCents: number; riferimento: string }[];
  banca: Awaited<ReturnType<typeof riepilogoBanca>>;
  passiMancanti: string[];
  revisione: ReturnType<typeof statoRevisione>;
  avviso: { testo: string; versione: string };
};

export async function pacchettoAnno(userId: string, anno: number): Promise<Pacchetto> {
  const [cc, nota, versamenti, banca] = await Promise.all([
    calcoloCorrente(userId, anno),
    primaNota(userId, anno),
    db
      .select()
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, userId), eq(fiscalPaymentsTable.anno, anno)))
      .orderBy(fiscalPaymentsTable.data),
    riepilogoBanca(userId, anno),
  ]);
  const { calcolo, dati, profilo, passiMancanti } = cc;
  const impresa = await contribuenteDi(userId, profilo);

  // Nel quadro LM vanno solo gli acconti dell'anno: il saldo dell'anno prima
  // è registrato con lo stesso "anno" di competenza ma non è un acconto.
  const accontiVersatiCents = versamenti.filter((v) => v.tipo === "imposta_acconto").reduce((s, v) => s + v.importoCents, 0);

  const prospetto = prospettoDichiarazione({
    ingresso: {
      anno,
      codiceAteco: profilo.codiceAteco,
      incassatiCents: dati.incassatiCents,
      contributiVersatiCents: dati.contributiVersatiCents,
      gestione: profilo.gestione,
    },
    calcolo,
    accontiVersatiCents,
  });
  const utile = calcolaUtileNetto({
    anno,
    incassiCents: nota.totali.incassiCents,
    altriRicaviCents: nota.totali.altriRicaviCents,
    costiCents: nota.totali.costiCents,
    calcolo,
  });

  return {
    anno,
    generatoAt: new Date().toISOString(),
    impresa: {
      denominazione: impresa.denominazione,
      partitaIva: impresa.partitaIva,
      codiceFiscale: impresa.codiceFiscale,
      comune: impresa.comune,
      provincia: impresa.provincia,
    },
    profilo: {
      regime: profilo.regime,
      codiceAteco: profilo.codiceAteco,
      coefficientePercent: calcolo.coefficientePercent,
      gestione: profilo.gestione,
      riduzione: profilo.riduzione,
    },
    prospetto,
    utile,
    primaNota: { totali: nota.totali, avvisi: nota.avvisi, voci: nota.voci.length },
    versamenti: versamenti.map((v) => ({
      data: v.data.toISOString().slice(0, 10),
      tipo: v.tipo,
      codiceTributo: v.codiceTributo,
      importoCents: v.importoCents,
      riferimento: v.riferimento,
    })),
    banca,
    passiMancanti,
    revisione: statoRevisione(anno),
    avviso: { testo: AVVISO_NON_CONSULENZA, versione: VERSIONE_AVVISO },
  };
}

// ── Chiusura ─────────────────────────────────────────────────────────────────

/** I numeri che si confrontano fra la fotografia e oggi. Pochi e leggibili. */
function numeriChiave(p: Pick<Pacchetto, "prospetto" | "utile">) {
  const rigo = (descr: string) => p.prospetto.righi.find((r) => r.descrizione.startsWith(descr))?.importoCents ?? 0;
  return {
    ricavi: { etichetta: "Ricavi incassati (LM22)", cents: rigo("Ricavi o compensi incassati") },
    contributiDedotti: { etichetta: "Contributi dedotti (LM35)", cents: rigo("Contributi previdenziali versati") },
    imposta: { etichetta: "Imposta sostitutiva (LM39)", cents: p.utile.impostaCents },
    saldo: { etichetta: "Saldo d'imposta dopo gli acconti", cents: p.prospetto.saldoCents },
    costi: { etichetta: "Costi pagati", cents: p.utile.costiCents },
    utile: { etichetta: "Utile netto dopo le tasse", cents: p.utile.utileNettoCents },
  };
}

export type Differenza = { voce: string; alloraCents: number; oggiCents: number };

function differenze(fotografia: Record<string, unknown>, oggi: Pacchetto): Differenza[] {
  const allora = fotografia.numeri as ReturnType<typeof numeriChiave> | undefined;
  if (!allora) return [];
  const adesso = numeriChiave(oggi);
  return (Object.keys(adesso) as (keyof typeof adesso)[])
    .filter((k) => allora[k] && allora[k].cents !== adesso[k].cents)
    .map((k) => ({ voce: adesso[k].etichetta, alloraCents: allora[k].cents, oggiCents: adesso[k].cents }));
}

function impronta(oggetto: unknown): string {
  return createHash("sha256").update(JSON.stringify(oggetto)).digest("hex");
}

export function serializzaChiusura(c: ChiusuraAnno | undefined) {
  if (!c) return null;
  return {
    anno: c.anno,
    stato: c.stato,
    versione: c.versione,
    chiusoAt: c.chiusoAt.toISOString(),
    riapertoAt: c.riapertoAt?.toISOString() ?? null,
    impronta: c.impronta,
    regoleRevisionate: c.regoleRevisionate,
    riportatoAt: c.riportatoAt?.toISOString() ?? null,
  };
}

export async function chiusuraDi(userId: string, anno: number): Promise<ChiusuraAnno | undefined> {
  const [c] = await db.select().from(fiscalYearClosingsTable).where(and(eq(fiscalYearClosingsTable.userId, userId), eq(fiscalYearClosingsTable.anno, anno)));
  return c;
}

export async function statoChiusura(userId: string, anno: number, pacchetto?: Pacchetto) {
  const c = await chiusuraDi(userId, anno);
  const annoCorrente = new Date().getUTCFullYear();
  return {
    chiusura: serializzaChiusura(c),
    chiudibile: anno < annoCorrente,
    differenze: c && c.stato === "chiuso" && pacchetto ? differenze(c.fotografia, pacchetto) : [],
  };
}

/**
 * Chiude l'anno: fotografia firmata con un'impronta, nessun dato bloccato.
 * `riporta` copia ricavi e imposta nel profilo fiscale come "anno precedente",
 * che è ciò su cui il motore calcola acconti e permanenza nel regime dell'anno
 * dopo (F1, F12). Si fa solo per l'anno appena finito: riportare il 2024 nel
 * 2026 sovrascriverebbe il dato giusto con uno vecchio.
 */
export async function chiudiAnno(params: { userId: string; anno: number; riporta: boolean; ip?: string | null }) {
  const { userId, anno } = params;
  const annoCorrente = new Date().getUTCFullYear();
  if (anno >= annoCorrente) throw new ErroreFiscale("anno_aperto", "Un anno si chiude quando è finito: il " + anno + " è ancora in corso.");
  const pacchetto = await pacchettoAnno(userId, anno);
  if (pacchetto.profilo.regime !== "forfettario") {
    throw new ErroreFiscale("regime_non_gestito", "La chiusura d'anno di PrevAI vale per il regime forfettario: in un altro regime i numeri del prospetto non sono quelli giusti.");
  }
  if (pacchetto.passiMancanti.length > 0) {
    throw new ErroreFiscale("onboarding_incompleto", "Completa prima il profilo fiscale nella pagina Fisco: senza, il prospetto è parziale.");
  }

  const fotografia = {
    anno,
    generatoAt: pacchetto.generatoAt,
    impresa: pacchetto.impresa,
    profilo: pacchetto.profilo,
    prospetto: pacchetto.prospetto,
    utile: { ...pacchetto.utile, spiegazioni: undefined },
    totali: pacchetto.primaNota.totali,
    versamenti: pacchetto.versamenti,
    numeri: numeriChiave(pacchetto),
    revisionato: pacchetto.revisione.revisionato,
  };
  const firma = impronta(fotografia);
  const esistente = await chiusuraDi(userId, anno);
  const valori = {
    stato: "chiuso" as const,
    chiusoAt: new Date(),
    riapertoAt: null,
    fotografia: fotografia as unknown as Record<string, unknown>,
    impronta: firma,
    regoleRevisionate: pacchetto.revisione.revisionato,
  };
  if (esistente) {
    await db
      .update(fiscalYearClosingsTable)
      .set({ ...valori, versione: esistente.versione + 1 })
      .where(and(eq(fiscalYearClosingsTable.userId, userId), eq(fiscalYearClosingsTable.anno, anno)));
  } else {
    await db.insert(fiscalYearClosingsTable).values({ userId, anno, ...valori });
  }

  let riportato = false;
  if (params.riporta && anno === annoCorrente - 1) {
    const ricavi = pacchetto.prospetto.righi.find((r) => r.descrizione.startsWith("Ricavi o compensi incassati"))?.importoCents ?? 0;
    await db
      .update(taxProfilesTable)
      .set({ ricaviAnnoPrecedenteCents: ricavi, impostaAnnoPrecedenteCents: pacchetto.utile.impostaCents })
      .where(eq(taxProfilesTable.userId, userId));
    await db
      .update(fiscalYearClosingsTable)
      .set({ riportatoAt: new Date() })
      .where(and(eq(fiscalYearClosingsTable.userId, userId), eq(fiscalYearClosingsTable.anno, anno)));
    riportato = true;
  }

  await writeAudit({
    userId,
    actorType: "user",
    actorId: userId,
    entityType: "fiscal_year",
    entityId: String(anno),
    action: "closed",
    diff: { impronta: firma, versione: (esistente?.versione ?? 0) + 1, riportato, regoleRevisionate: pacchetto.revisione.revisionato },
    ip: params.ip,
  });
  return { chiusura: serializzaChiusura(await chiusuraDi(userId, anno)), riportato };
}

export async function riapriAnno(userId: string, anno: number, ip?: string | null) {
  const c = await chiusuraDi(userId, anno);
  if (!c || c.stato !== "chiuso") throw new ErroreFiscale("non_chiuso", "Questo anno non è chiuso.");
  await db
    .update(fiscalYearClosingsTable)
    .set({ stato: "riaperto", riapertoAt: new Date() })
    .where(and(eq(fiscalYearClosingsTable.userId, userId), eq(fiscalYearClosingsTable.anno, anno)));
  await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "fiscal_year", entityId: String(anno), action: "reopened", diff: { versione: c.versione }, ip });
}

// ── Condivisione col commercialista ──────────────────────────────────────────

export const DURATE_CONDIVISIONE = [7, 30, 90] as const;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function urlCondivisione(token: string): string {
  return `${getBaseUrl()}/commercialista/${token}`;
}

export async function creaCondivisione(params: { userId: string; anno: number; destinatario: string; email?: string; giorni: number; ip?: string | null }) {
  if (!(DURATE_CONDIVISIONE as readonly number[]).includes(params.giorni)) throw new ErroreFiscale("durata_non_valida", "Un link dura 7, 30 o 90 giorni.");
  if (params.destinatario.trim() === "") throw new ErroreFiscale("destinatario_mancante", "Scrivi a chi lo mandi: serve a riconoscere il link nell'elenco e nel registro degli accessi.");
  const token = randomBytes(32).toString("base64url");
  const [riga] = await db
    .insert(accountantSharesTable)
    .values({
      userId: params.userId,
      tokenHash: hashToken(token),
      destinatario: params.destinatario.trim().slice(0, 120),
      email: (params.email ?? "").trim().slice(0, 200),
      anno: params.anno,
      scadeAt: new Date(Date.now() + params.giorni * 86_400_000),
    })
    .returning();
  await writeAudit({
    userId: params.userId,
    actorType: "user",
    actorId: params.userId,
    entityType: "accountant_share",
    entityId: riga!.id,
    action: "created",
    diff: { anno: params.anno, destinatario: riga!.destinatario, giorni: params.giorni },
    ip: params.ip,
  });
  // Il token esce **solo qui**: nel database c'è l'hash, e un link perso si
  // revoca e se ne crea un altro.
  return { id: riga!.id, url: urlCondivisione(token), scadeAt: riga!.scadeAt.toISOString() };
}

export async function elencoCondivisioni(userId: string) {
  const righe = await db.select().from(accountantSharesTable).where(eq(accountantSharesTable.userId, userId)).orderBy(desc(accountantSharesTable.createdAt)).limit(50);
  const ora = Date.now();
  return righe.map((r) => ({
    id: r.id,
    destinatario: r.destinatario,
    email: r.email,
    anno: r.anno,
    scadeAt: r.scadeAt.toISOString(),
    revocatoAt: r.revocatoAt?.toISOString() ?? null,
    attivo: !r.revocatoAt && r.scadeAt.getTime() > ora,
    accessi: r.accessi,
    ultimoAccessoAt: r.ultimoAccessoAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function accessiCondivisione(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroreFiscale("not_found", "Link non trovato.");
  const [share] = await db.select().from(accountantSharesTable).where(and(eq(accountantSharesTable.id, id), eq(accountantSharesTable.userId, userId)));
  if (!share) throw new ErroreFiscale("not_found", "Link non trovato.");
  const righe = await db.select().from(accountantShareAccessesTable).where(eq(accountantShareAccessesTable.shareId, id)).orderBy(desc(accountantShareAccessesTable.at)).limit(200);
  return righe.map((r) => ({ at: r.at.toISOString(), risorsa: r.risorsa, ip: r.ip, userAgent: r.userAgent }));
}

export async function revocaCondivisione(userId: string, id: string, ip?: string | null): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroreFiscale("not_found", "Link non trovato.");
  const aggiornati = await db
    .update(accountantSharesTable)
    .set({ revocatoAt: new Date() })
    .where(and(eq(accountantSharesTable.id, id), eq(accountantSharesTable.userId, userId)))
    .returning({ id: accountantSharesTable.id });
  if (aggiornati.length === 0) throw new ErroreFiscale("not_found", "Link non trovato.");
  await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "accountant_share", entityId: id, action: "revoked", ip });
}

/**
 * Risolve un link del commercialista e registra l'accesso. `null` per un
 * token sconosciuto, revocato, scaduto, o di un'impresa che nel frattempo ha
 * spento il modulo: in tutti i casi la risposta è la stessa, per non dire a
 * chi prova token a caso quale esiste.
 */
export async function apriCondivisione(token: string, risorsa: string, meta: { ip?: string | null; userAgent?: string | null }) {
  if (!token || token.length < 30 || token.length > 100) return null;
  const [share] = await db.select().from(accountantSharesTable).where(eq(accountantSharesTable.tokenHash, hashToken(token)));
  if (!share || share.revocatoAt || share.scadeAt.getTime() <= Date.now()) return null;
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, share.userId));
  if (!hasFeature(profile, "fiscal_engine") || !hasFeature(profile, "admin_suite")) return null;
  await db.insert(accountantShareAccessesTable).values({ shareId: share.id, risorsa, ip: meta.ip ?? null, userAgent: (meta.userAgent ?? "").slice(0, 300) || null });
  await db
    .update(accountantSharesTable)
    .set({ accessi: sql`${accountantSharesTable.accessi} + 1`, ultimoAccessoAt: new Date() })
    .where(eq(accountantSharesTable.id, share.id));
  return share;
}

export function guida(anno: number) {
  return guidaFaiDaTe(anno);
}

export function riassuntoSaldo(p: ProspettoDichiarazione): string {
  return p.saldoCents >= 0 ? `Imposta a debito: ${fmtEurCents(p.saldoCents)}` : `Imposta a credito: ${fmtEurCents(-p.saldoCents)}`;
}
