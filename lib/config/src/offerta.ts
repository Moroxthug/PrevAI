// @workspace/config/offerta — l'add-on Amministrazione come prodotto in
// vendita (A-5): nome, prezzi, varianti del test di prezzo, cosa è gratis e
// cosa no, e soprattutto **quando** può essere mostrato e venduto.
//
// Nome e prezzi sono ipotesi finché il titolare non chiude D5: stanno tutti
// qui, in un punto solo, e nessuna schermata ne ha una copia. Lo stato di
// lancio non si imposta a mano e basta: `statoOfferta()` lo **calcola** dai
// prerequisiti (D5, D6, D8), quindi chiedere "vendita" con D6 aperta produce
// comunque "interesse" — la stessa idea del motore fiscale, dove una regola
// non revisionata non si può presentare come verificata.
//
// Funzioni pure, nessuna data di sistema letta di nascosto: l'anno delle regole
// arriva dall'ingresso, così i test sono riproducibili.

import { motoreRevisionato, regoleDiAnno } from "./fiscale/regole/index";

/**
 * - `bozza`: niente è visibile agli utenti. La landing esiste ma è noindex e
 *   fuori dalla sitemap, la voce di menu non compare, il checkout risponde 409.
 * - `interesse`: landing pubblica e indicizzata, paywall visibile in app con il
 *   prezzo della variante, bottone "avvisami" che registra l'interesse. È il
 *   test di prezzo prima del lancio (AMMINISTRAZIONE-PLAN §9.2 punto c).
 * - `vendita`: checkout Stripe attivo.
 */
export const STATI_OFFERTA = ["bozza", "interesse", "vendita"] as const;
export type StatoOfferta = (typeof STATI_OFFERTA)[number];

export const INTERVALLI_ADDON = ["mensile", "annuale"] as const;
export type IntervalloAddon = (typeof INTERVALLI_ADDON)[number];

export type VariantePrezzo = {
  /** Una lettera: finisce nelle lookup key di Stripe e nei parametri `?v=` delle campagne. */
  id: string;
  mensileCents: number;
  annualeCents: number;
};

/** Le decisioni del titolare da cui dipende la messa in vendita. */
export type DecisioneOfferta = "D5" | "D6" | "D8";

export type Prerequisito = {
  id: DecisioneOfferta;
  chiuso: boolean;
  /** Cosa manca, in una frase che si può mostrare a chi prova la pagina in bozza. */
  testo: string;
  /** Lo stato più alto che questa decisione, finché è aperta, impedisce di raggiungere. */
  blocca: Exclude<StatoOfferta, "bozza">;
};

export const OFFERTA_AMMINISTRAZIONE = {
  id: "amministrazione",
  /** D5: nome di lavoro. Cambiarlo qui lo cambia ovunque, landing compresa. */
  nome: "PrevAI Amministrazione",
  /**
   * Lo stato che si vorrebbe. Quello effettivo è `statoOfferta().effettivo`:
   * non supera mai ciò che i prerequisiti consentono.
   */
  statoRichiesto: "bozza" as StatoOfferta,
  /**
   * Decisioni chiuse a mano, perché non si possono dedurre dal codice.
   * D6 non è qui: si deduce dalle regole del motore (tutte revisionate o no).
   */
  decisioni: {
    /** Nome e prezzi confermati dal titolare (anche solo come ipotesi da testare). */
    D5: false,
    /** Contratto, DPA e manuale di conservazione firmati con l'intermediario SdI. */
    D8: false,
  },
  /**
   * AMMINISTRAZIONE-PLAN §9.2 punto (a): i forfettari non detraggono l'IVA, e
   * i concorrenti comunicano prezzi IVA inclusa. La tabella del piano dice
   * "+IVA": è una delle due cose da decidere con D5. Finché è false, ogni
   * prezzo mostrato porta "+ IVA".
   */
  ivaInclusa: false,
  /**
   * Varianti del test di prezzo. La prima è quella del piano (12 €/mese,
   * 120 €/anno) e la predefinita; le altre due stanno una sotto e una sopra.
   * L'annuale vale sempre dieci mensilità: due mesi gratis, come nel piano.
   */
  varianti: [
    { id: "a", mensileCents: 1200, annualeCents: 12000 },
    { id: "b", mensileCents: 900, annualeCents: 9000 },
    { id: "c", mensileCents: 1500, annualeCents: 15000 },
  ] as readonly VariantePrezzo[],
  /** Bundle "Impresa completa": con il piano Elite l'add-on costa 5 €/mese (solo mensile). */
  bundleEliteMensileCents: 500,
} as const;

// ── Cosa è gratis e cosa si paga ─────────────────────────────────────────────
// AMMINISTRAZIONE-PLAN §9.1: "gratis ciò che crea dipendenza, a pagamento
// l'esecuzione". Le chiavi sono le feature di `@workspace/db` schema/plans.ts
// (qui come stringhe: config non dipende da db).

/** Gratis in ogni piano, ma solo dopo il lancio **e** la revisione del motore (D6). */
export const FEATURE_GRATUITE_AMMINISTRAZIONE = ["fiscal_engine"] as const;
/** Ciò che l'add-on sblocca: tutto il modulo. */
export const FEATURE_ADDON_AMMINISTRAZIONE = ["sdi_invoicing", "fiscal_engine", "admin_suite"] as const;

export type VoceOfferta = { titolo: string; dettaglio: string; gratuita: boolean };

/** Le voci che landing, paywall e fatturazione mostrano, nello stesso ordine. */
export const VOCI_OFFERTA: readonly VoceOfferta[] = [
  { titolo: "Calcolo di imposta e contributi", dettaglio: "Quanto pagherai sul lavoro incassato, con la formula di ogni numero", gratuita: true },
  { titolo: "Quanto mettere via ogni mese", dettaglio: "Una cifra sola, aggiornata a ogni incasso", gratuita: true },
  { titolo: "Monitor della soglia degli 85.000 €", dettaglio: "Contando anche i preventivi accettati e non ancora fatturati", gratuita: true },
  { titolo: "Scadenzario fiscale", dettaglio: "Imposta, contributi INPS, bollo e dichiarazione in un calendario solo, con promemoria", gratuita: true },
  { titolo: "Fatture elettroniche via SdI", dettaglio: "Dalla fattura di PrevAI allo SdI, con ricevute, conservazione e ciclo passivo", gratuita: false },
  { titolo: "F24 precompilati", dettaglio: "Prospetto pronto da ricopiare nell'home banking, bollo trimestrale compreso", gratuita: false },
  { titolo: "Prima nota ed estratto conto", dettaglio: "Incassi, costi e versamenti in un registro solo, con import CSV/OFX della banca", gratuita: false },
  { titolo: "Chiusura d'anno", dettaglio: "Prospetto per la dichiarazione, PDF e CSV, link in sola lettura per il commercialista", gratuita: false },
];

// ── Stato effettivo ──────────────────────────────────────────────────────────

const ORDINE: Record<StatoOfferta, number> = { bozza: 0, interesse: 1, vendita: 2 };

export type IngressoStatoOfferta = {
  /** Anno d'imposta di cui contano le regole (di solito quello corrente). */
  anno: number;
  /** Per i test: sostituiscono i valori della configurazione. */
  statoRichiesto?: StatoOfferta;
  decisioni?: Partial<Record<"D5" | "D8", boolean>>;
  motoreRevisionato?: boolean;
};

export type StatoOffertaCalcolato = {
  richiesto: StatoOfferta;
  effettivo: StatoOfferta;
  /** Il livello gratuito (calcolo, soglia, scadenzario per tutti) è acceso. */
  gratuitoAttivo: boolean;
  prerequisiti: readonly Prerequisito[];
  /**
   * Tutti i prerequisiti ancora aperti, in ordine: cosa manca per arrivare
   * fino alla vendita. Chi prova l'offerta in bozza vede questo elenco.
   */
  mancanti: readonly Prerequisito[];
};

export function prerequisitiOfferta(ingresso: IngressoStatoOfferta): readonly Prerequisito[] {
  const d5 = ingresso.decisioni?.D5 ?? OFFERTA_AMMINISTRAZIONE.decisioni.D5;
  const d8 = ingresso.decisioni?.D8 ?? OFFERTA_AMMINISTRAZIONE.decisioni.D8;
  const d6 = ingresso.motoreRevisionato ?? motoreRevisionato(regoleDiAnno(ingresso.anno));
  return [
    { id: "D5", chiuso: d5, blocca: "interesse", testo: "Nome del modulo e prezzi non ancora confermati dal titolare (D5)." },
    { id: "D6", chiuso: d6, blocca: "vendita", testo: "Regole fiscali non ancora revisionate da un commercialista (D6)." },
    { id: "D8", chiuso: d8, blocca: "vendita", testo: "Contratto con l'intermediario SdI non ancora firmato (D8)." },
  ];
}

export function statoOfferta(ingresso: IngressoStatoOfferta): StatoOffertaCalcolato {
  const richiesto = ingresso.statoRichiesto ?? OFFERTA_AMMINISTRAZIONE.statoRichiesto;
  const prerequisiti = prerequisitiOfferta(ingresso);
  const aperti = prerequisiti.filter((p) => !p.chiuso);

  // Lo stato più alto consentito: il primo livello bloccato da un prerequisito aperto, meno uno.
  let massimo: StatoOfferta = "vendita";
  for (const p of aperti) {
    const sotto = STATI_OFFERTA[ORDINE[p.blocca] - 1] ?? "bozza";
    if (ORDINE[sotto] < ORDINE[massimo]) massimo = sotto;
  }
  const effettivo = ORDINE[richiesto] <= ORDINE[massimo] ? richiesto : massimo;
  const mancanti = aperti;

  // Il livello gratuito regala i numeri del motore a ogni utente: va acceso
  // solo quando sono verificati (D6) e l'offerta è pubblica (≥ interesse).
  const d6 = prerequisiti.find((p) => p.id === "D6")?.chiuso ?? false;
  const gratuitoAttivo = d6 && ORDINE[effettivo] >= ORDINE.interesse;

  return { richiesto, effettivo, gratuitoAttivo, prerequisiti, mancanti };
}

/**
 * Gli articoli SEO sulle tasse del forfettario (blog) citano soglie, aliquote
 * e un esempio calcolato dal motore: escono con il livello gratuito, cioè a
 * offerta pubblica e con le regole revisionate (D6). Prima sarebbero numeri
 * non verificati in una pagina indicizzata.
 */
export function contenutiFiscaliPubblicabili(anno: number): boolean {
  return statoOfferta({ anno }).gratuitoAttivo;
}

export function offertaAlmeno(stato: StatoOfferta, soglia: StatoOfferta): boolean {
  return ORDINE[stato] >= ORDINE[soglia];
}

// ── Varianti e prezzi ────────────────────────────────────────────────────────

export function variantePredefinita(): VariantePrezzo {
  return OFFERTA_AMMINISTRAZIONE.varianti[0]!;
}

export function varianteDaId(id: string | null | undefined): VariantePrezzo | null {
  if (!id) return null;
  const pulito = id.trim().toLowerCase();
  return OFFERTA_AMMINISTRAZIONE.varianti.find((v) => v.id === pulito) ?? null;
}

/**
 * Variante stabile per un utente, senza cookie: FNV-1a dell'id modulo il
 * numero di varianti. Lo stesso utente vede lo stesso prezzo su ogni
 * dispositivo, e non serve chiedergli il consenso per un identificatore in
 * più nel browser.
 */
export function varianteDiUtente(userId: string): VariantePrezzo {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const varianti = OFFERTA_AMMINISTRAZIONE.varianti;
  return varianti[h % varianti.length]!;
}

export function prezzoCents(variante: VariantePrezzo, intervallo: IntervalloAddon, conElite = false): number {
  if (conElite && intervallo === "mensile") return OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents;
  return intervallo === "mensile" ? variante.mensileCents : variante.annualeCents;
}

/**
 * Lookup key del prezzo su Stripe. I prezzi non stanno in variabili
 * d'ambiente: il titolare li crea nella dashboard di Stripe con queste chiavi
 * (RUNBOOKS §10) e il checkout li cerca per chiave, controllando che
 * l'importo coincida con quello mostrato qui.
 */
export function lookupKeyStripe(variante: VariantePrezzo, intervallo: IntervalloAddon, conElite = false): string {
  if (conElite && intervallo === "mensile") return "amministrazione_bundle_elite_mensile";
  return `amministrazione_${variante.id}_${intervallo}`;
}

export const PREFISSO_LOOKUP_ADDON = "amministrazione_";

/** Tutte le lookup key che il titolare deve creare su Stripe prima di passare a `vendita`. */
export function lookupKeysAttese(): { chiave: string; importoCents: number; intervallo: IntervalloAddon }[] {
  const righe: { chiave: string; importoCents: number; intervallo: IntervalloAddon }[] = [];
  for (const v of OFFERTA_AMMINISTRAZIONE.varianti) {
    for (const i of INTERVALLI_ADDON) righe.push({ chiave: lookupKeyStripe(v, i), importoCents: prezzoCents(v, i), intervallo: i });
  }
  righe.push({ chiave: lookupKeyStripe(variantePredefinita(), "mensile", true), importoCents: OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents, intervallo: "mensile" });
  return righe;
}

/** "12 €" / "9,50 €": i prezzi interi senza decimali, come sui listini. */
export function formatPrezzoOfferta(cents: number): string {
  const euro = cents / 100;
  const testo = Number.isInteger(euro)
    ? String(euro)
    : euro.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${testo} €`;
}

export function etichettaIva(): string {
  return OFFERTA_AMMINISTRAZIONE.ivaInclusa ? "IVA inclusa" : "+ IVA";
}
