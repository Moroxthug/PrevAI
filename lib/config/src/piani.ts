// @workspace/config/piani — prezzi e limiti dei piani PrevAI, in un punto solo.
//
// Prima di A-5 lo stesso prezzo era scritto in sei posti che non si
// parlavano (backend 19/49/59, pagina Fatturazione "29 € / 79 €", paywall del
// preventivo "$49/$59", landing di settore "$19/$13", testi SEO "29 €/mese con
// 20 preventivi"). Adesso server, dashboard, landing ed email leggono da qui.
//
// Il prezzo che conta davvero è quello del Price su Stripe: il checkout lo
// confronta con questi importi e rifiuta di partire se non coincidono
// (api-server routes/payments.ts). Decisione del titolare 2026-09-23 (D5):
// prezzi IVA inclusa, Elite a 79 €, annuale = dieci mensilità.

import type { IntervalloAddon } from "./offerta";

export const PIANI_IN_ABBONAMENTO = ["monthly_starter", "monthly_pro", "monthly_elite"] as const;
export type PianoInAbbonamento = (typeof PIANI_IN_ABBONAMENTO)[number];

export type PrezzoPiano = {
  nome: string;
  mensileCents: number;
  annualeCents: number;
  /** Preventivi inclusi al mese; `null` = illimitati. È il limite che il server applica. */
  preventiviMese: number | null;
  /** Utenti inclusi (vedi SEATS_INCLUDED in lib/db schema/plans.ts). */
  utenti: number;
};

/** Tutti i prezzi dei piani sono IVA inclusa (D5): i forfettari non la detraggono. */
export const PREZZI_IVA_INCLUSA = true;

export const PREZZI_PIANI: Record<PianoInAbbonamento, PrezzoPiano> = {
  monthly_starter: { nome: "Starter", mensileCents: 1900, annualeCents: 19000, preventiviMese: 10, utenti: 1 },
  monthly_pro: { nome: "Pro", mensileCents: 4900, annualeCents: 49000, preventiviMese: 60, utenti: 2 },
  monthly_elite: { nome: "Elite", mensileCents: 7900, annualeCents: 79000, preventiviMese: null, utenti: 5 },
};

export const PREVENTIVI_SINGOLI = {
  oneshot_watermark: { nome: "Singolo con filigrana", cents: 300 },
  oneshot_clean: { nome: "Singolo pulito", cents: 900 },
} as const;

export function prezzoPianoCents(piano: PianoInAbbonamento, intervallo: IntervalloAddon): number {
  const p = PREZZI_PIANI[piano];
  return intervallo === "annuale" ? p.annualeCents : p.mensileCents;
}

/** Lookup key del Price su Stripe: `piano_elite_annuale`. */
export function lookupKeyPiano(piano: PianoInAbbonamento, intervallo: IntervalloAddon): string {
  return `piano_${piano.replace("monthly_", "")}_${intervallo}`;
}

export const PREFISSO_LOOKUP_PIANO = "piano_";

/** Da lookup key a piano (per il webhook); null se non è un piano. */
export function pianoDaLookupKey(chiave: string | null | undefined): PianoInAbbonamento | null {
  if (!chiave?.startsWith(PREFISSO_LOOKUP_PIANO)) return null;
  const nome = chiave.slice(PREFISSO_LOOKUP_PIANO.length).replace(/_(mensile|annuale)$/, "");
  const piano = `monthly_${nome}`;
  return (PIANI_IN_ABBONAMENTO as readonly string[]).includes(piano) ? (piano as PianoInAbbonamento) : null;
}

export function lookupKeysPianiAttese(): { chiave: string; importoCents: number; intervallo: IntervalloAddon }[] {
  return PIANI_IN_ABBONAMENTO.flatMap((p) =>
    (["mensile", "annuale"] as const).map((i) => ({ chiave: lookupKeyPiano(p, i), importoCents: prezzoPianoCents(p, i), intervallo: i })),
  );
}

/** "19 €" / "14,90 €". */
export function formatPrezzo(cents: number): string {
  const euro = cents / 100;
  const testo = Number.isInteger(euro) ? String(euro) : euro.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${testo} €`;
}

/** "10 preventivi al mese" / "Preventivi illimitati". */
export function testoPreventivi(piano: PianoInAbbonamento): string {
  const n = PREZZI_PIANI[piano].preventiviMese;
  return n === null ? "Preventivi illimitati" : `${n} preventivi al mese`;
}
