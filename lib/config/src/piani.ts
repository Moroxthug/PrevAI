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
// prezzi IVA inclusa, annuale = dieci mensilità.
//
// PREZZI-2 (2026-11-04): quattro gradini, uno per fase dell'impresa, invece di
// moduli venduti a parte. Gli id interni restano quelli di prima (abbonamenti
// Stripe, webhook e dati non cambiano), cambiano nomi e importi:
//   monthly_starter → Preventivi 9,90 € (l'ingresso per chi è scettico)
//   monthly_clienti → Clienti 24 € (nuovo: preventivi illimitati, listino, contratti, contatti)
//   monthly_pro     → Cantieri 49 € (cantieri, costi, fatture, squadra)
//   monthly_elite   → Impresa 89 € (tutto)
// I 10 preventivi dell'ingresso vengono dai dati di produzione: nei sei mesi
// fino a novembre 2026 solo 2 utenti su 27 li hanno superati in un mese.

import { OFFERTA_AMMINISTRAZIONE, type IntervalloAddon } from "./offerta";

export const PIANI_IN_ABBONAMENTO = ["monthly_starter", "monthly_clienti", "monthly_pro", "monthly_elite"] as const;
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
  monthly_starter: { nome: "Preventivi", mensileCents: 990, annualeCents: 9900, preventiviMese: 10, utenti: 1 },
  monthly_clienti: { nome: "Clienti", mensileCents: 2400, annualeCents: 24000, preventiviMese: null, utenti: 1 },
  monthly_pro: { nome: "Cantieri", mensileCents: 4900, annualeCents: 49000, preventiviMese: null, utenti: 3 },
  monthly_elite: { nome: "Impresa", mensileCents: 8900, annualeCents: 89000, preventiviMese: null, utenti: 6 },
};

/** A chi serve ogni piano, in una riga: pagine prezzi, impostazioni, email. */
export const PER_CHI_PIANO: Record<PianoInAbbonamento, string> = {
  monthly_starter: "Per chi vuole provare: i preventivi e basta",
  monthly_clienti: "Per chi vuole prendere più lavori",
  monthly_pro: "Per chi gestisce i lavori dall'inizio alla fine",
  monthly_elite: "Per chi ha una squadra",
};

/**
 * Cosa include ogni piano, nell'ordine in cui lo mostrano landing, impostazioni
 * ed email di benvenuto. Coincide con PLAN_FEATURES di lib/db schema/plans.ts
 * (le funzioni) e con PREZZI_PIANI (numeri di preventivi e utenti).
 */
export const VOCI_PIANI: Record<PianoInAbbonamento, readonly string[]> = {
  monthly_starter: [
    testoPreventivi("monthly_starter"),
    "Preventivo scritto dall'IA, a voce o a parole",
    "Invio per email e accettazione dal telefono",
    "PDF con il tuo logo e la riga «Fatto con prevai.it»",
    "1 utente · disdici quando vuoi",
  ],
  monthly_clienti: [
    "Preventivi illimitati, PDF senza la riga PrevAI",
    "Listino prezzi e controllo dei prezzi del preventivo",
    "Contratti con firma del cliente",
    "Contatti da Facebook e Instagram, email dal tuo Gmail",
    "WhatsApp: 100 messaggi al mese",
  ],
  monthly_pro: [
    "Tutto il piano Clienti",
    "Cantieri con fasi, date, pagamenti e budget dal preventivo",
    "Costi e scontrini, fatture e solleciti",
    "Squadra, ore degli operai e calendario",
    `${PREZZI_PIANI.monthly_pro.utenti} utenti inclusi`,
  ],
  monthly_elite: [
    "Tutto il piano Cantieri",
    "Assistente IA dei cantieri e analisi dei margini",
    "Pagamenti con carta sulle fatture",
    "API e collegamenti con Zapier e Make",
    `${PREZZI_PIANI.monthly_elite.utenti} utenti inclusi · ${OFFERTA_AMMINISTRAZIONE.nome} a ${formatPrezzo(OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents)} al mese`,
  ],
};

/** Il piano da proporre a chi ne ha già uno: il gradino successivo, null in cima. */
export function pianoSuccessivo(piano: string | null | undefined): PianoInAbbonamento | null {
  const i = (PIANI_IN_ABBONAMENTO as readonly string[]).indexOf(piano ?? "");
  if (i < 0) return PIANI_IN_ABBONAMENTO[0];
  return PIANI_IN_ABBONAMENTO[i + 1] ?? null;
}

/**
 * I piani sopra l'ingresso: PDF senza la riga PrevAI, tutti i modelli di PDF,
 * capitolato, preventivi da WhatsApp. Prima di PREZZI-2 era "Pro o Elite".
 */
export function pianoOltreIngresso(piano: string | null | undefined): boolean {
  return piano === "monthly_clienti" || piano === "monthly_pro" || piano === "monthly_elite";
}

/** Preventivi via WhatsApp al mese nei piani sotto Impresa (null = senza limite). */
export function limitePreventiviWhatsapp(piano: string | null | undefined): number | null {
  return piano === "monthly_clienti" || piano === "monthly_pro" ? 20 : null;
}

/** Foto del cantiere che l'IA legge per preventivo (0 senza abbonamento attivo). */
export function fotoPerPreventivo(piano: string | null | undefined): number {
  if (piano === "monthly_elite") return 5;
  if (piano === "monthly_clienti" || piano === "monthly_pro") return 3;
  if (piano === "monthly_starter") return 1;
  return 0;
}

/** Il piano dal nome commerciale ("Cantieri" → monthly_pro), null se non è un piano. */
export function pianoDaNome(nome: string | null | undefined): PianoInAbbonamento | null {
  const n = (nome ?? "").trim().toLowerCase();
  return PIANI_IN_ABBONAMENTO.find((p) => PREZZI_PIANI[p].nome.toLowerCase() === n) ?? null;
}

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

/**
 * TEAM-1: il posto in più oltre a quelli inclusi nel piano. **Il prezzo non
 * c'è: decide il titolare (D20).** Finché `acquistabile` è false l'app non
 * vende posti: la pagina Squadra dice «posti extra in arrivo» e `extra_seats`
 * lo scrive solo il personale (RUNBOOKS §38). Quando D20 è chiusa si
 * compilano i due importi, si crea il Price su Stripe e si accende il flag.
 */
export const POSTO_EXTRA: { acquistabile: boolean; mensileCents: number | null; annualeCents: number | null } = {
  acquistabile: false,
  mensileCents: null,
  annualeCents: null,
};
