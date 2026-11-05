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
// PREZZI-2 (2026-11-04/05): quattro gradini, uno per fase dell'impresa, invece di
// moduli venduti a parte. Gli id interni restano quelli di prima (abbonamenti
// Stripe, webhook e dati non cambiano), cambiano nomi e importi:
//   monthly_starter → Artigiano 9,90 € (25 preventivi, 30 con i vecchi preventivi caricati)
//   monthly_clienti → Mastro 24 € (preventivi illimitati, contratti, contatti, WhatsApp)
//   monthly_pro     → Capomastro 49 € (cantieri, costi, fatture, squadra)
//   monthly_elite   → Su misura: nessun prezzo pubblico, ci si parla (`suRichiesta`)
// Il marchio PrevAI sul PDF resta solo sul piano gratuito: nessun piano e nessun
// acquisto singolo lo porta. L'importo di Su misura serve solo a tetto IA e MRR.

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
  /** Nessun prezzo pubblico e nessun checkout: si chiede un contatto. */
  suRichiesta?: boolean;
};

/** Tutti i prezzi dei piani sono IVA inclusa (D5): i forfettari non la detraggono. */
export const PREZZI_IVA_INCLUSA = true;

export const PREZZI_PIANI: Record<PianoInAbbonamento, PrezzoPiano> = {
  monthly_starter: { nome: "Artigiano", mensileCents: 990, annualeCents: 9900, preventiviMese: 25, utenti: 1 },
  monthly_clienti: { nome: "Mastro", mensileCents: 2400, annualeCents: 24000, preventiviMese: null, utenti: 1 },
  monthly_pro: { nome: "Capomastro", mensileCents: 4900, annualeCents: 49000, preventiviMese: null, utenti: 3 },
  monthly_elite: { nome: "Su misura", mensileCents: 8900, annualeCents: 89000, preventiviMese: null, utenti: 6, suRichiesta: true },
};

/**
 * Il regalo del piano d'ingresso: chi carica almeno `soglia` vecchi preventivi
 * verificati riceve `omaggio` preventivi in più ogni mese (25 → 30). Verificato =
 * confermato dall'impresa, letto dall'IA senza dubbi, con voci e totale, e non
 * doppione (api-server quotes/quota.ts).
 */
export const BONUS_VECCHI_PREVENTIVI = { soglia: 10, omaggio: 5 } as const;

/** Dove va chi vuole il piano su richiesta. */
export const CONTATTO_SU_MISURA = "/contatti/?piano=su-misura";
export const CTA_SU_MISURA = "Parliamone";

/** A chi serve ogni piano, in una riga: pagine prezzi, impostazioni, email. */
export const PER_CHI_PIANO: Record<PianoInAbbonamento, string> = {
  monthly_starter: "Per chi lavora da solo e vuole preventivi giusti",
  monthly_clienti: "Per chi vuole prendere più lavori",
  monthly_pro: "Per chi gestisce i lavori dall'inizio alla fine",
  monthly_elite: "Per le imprese con più squadre e cantieri",
};

/**
 * Cosa include ogni piano, nell'ordine in cui lo mostrano landing, impostazioni
 * ed email di benvenuto. Coincide con PLAN_FEATURES di lib/db schema/plans.ts
 * (le funzioni) e con PREZZI_PIANI (numeri di preventivi e utenti).
 */
export const VOCI_PIANI: Record<PianoInAbbonamento, readonly string[]> = {
  monthly_starter: [
    `${PREZZI_PIANI.monthly_starter.preventiviMese} preventivi al mese, ${(PREZZI_PIANI.monthly_starter.preventiviMese ?? 0) + BONUS_VECCHI_PREVENTIVI.omaggio} se carichi ${BONUS_VECCHI_PREVENTIVI.soglia} vecchi preventivi`,
    "PDF puliti col tuo logo, senza marchio PrevAI, tutti i modelli",
    "Listino prezzi: l'IA usa i tuoi prezzi",
    "Vecchi preventivi: l'IA impara come lavori",
    "Invio per email e accettazione dal telefono",
  ],
  monthly_clienti: [
    "Tutto il piano Artigiano, con preventivi illimitati",
    "Contratti con firma del cliente",
    "Contatti da Facebook e Instagram, email dal tuo Gmail",
    "WhatsApp: 100 messaggi al mese",
    "5 foto per preventivo",
  ],
  monthly_pro: [
    "Tutto il piano Mastro",
    "Cantieri con fasi, date, pagamenti e budget dal preventivo",
    "Costi e scontrini, fatture e solleciti",
    "Squadra, ore degli operai e calendario",
    `${PREZZI_PIANI.monthly_pro.utenti} utenti inclusi`,
  ],
  monthly_elite: [
    "Tutto il piano Capomastro",
    "Assistente IA dei cantieri e analisi dei margini",
    "Pagamenti con carta sulle fatture",
    "API e collegamenti con Zapier e Make",
    `Da ${PREZZI_PIANI.monthly_elite.utenti} utenti in su · ${OFFERTA_AMMINISTRAZIONE.nome} a ${formatPrezzo(OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents)} al mese`,
  ],
};

/** Il piano da proporre a chi ne ha già uno: il gradino successivo, null in cima. */
export function pianoSuccessivo(piano: string | null | undefined): PianoInAbbonamento | null {
  const i = (PIANI_IN_ABBONAMENTO as readonly string[]).indexOf(piano ?? "");
  if (i < 0) return PIANI_IN_ABBONAMENTO[0];
  return PIANI_IN_ABBONAMENTO[i + 1] ?? null;
}

/** Un abbonamento vero: PDF senza marchio PrevAI, tutti i modelli, capitolato, listino. */
export function pianoPagante(piano: string | null | undefined): boolean {
  return !!piano && (PIANI_IN_ABBONAMENTO as readonly string[]).includes(piano);
}

/** I piani sopra l'ingresso: bot WhatsApp e tutto ciò che è legato ai messaggi. */
export function pianoOltreIngresso(piano: string | null | undefined): boolean {
  return piano === "monthly_clienti" || piano === "monthly_pro" || piano === "monthly_elite";
}

/** Preventivi via WhatsApp al mese nei piani sotto Impresa (null = senza limite). */
export function limitePreventiviWhatsapp(piano: string | null | undefined): number | null {
  return piano === "monthly_clienti" || piano === "monthly_pro" ? 20 : null;
}

/** Foto del cantiere che l'IA legge per preventivo (0 senza abbonamento attivo). */
export function fotoPerPreventivo(piano: string | null | undefined): number {
  if (piano === "monthly_starter") return 3;
  return pianoOltreIngresso(piano) ? 5 : 0;
}

/** Il piano dal nome commerciale ("Cantieri" → monthly_pro), null se non è un piano. */
export function pianoDaNome(nome: string | null | undefined): PianoInAbbonamento | null {
  const n = (nome ?? "").trim().toLowerCase();
  return PIANI_IN_ABBONAMENTO.find((p) => PREZZI_PIANI[p].nome.toLowerCase() === n) ?? null;
}

/** Senza abbonamento: sempre senza marchio. Il pacchetto dà crediti, spesi uno per preventivo. */
export const PREVENTIVI_SINGOLI = {
  oneshot_clean: { nome: "Preventivo singolo", cents: 199, crediti: 0, lookupKey: "preventivo_singolo" },
  pack_5: { nome: "Pacchetto 5 preventivi", cents: 399, crediti: 5, lookupKey: "pacchetto_5_preventivi" },
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
  return PIANI_IN_ABBONAMENTO.filter((p) => !PREZZI_PIANI[p].suRichiesta).flatMap((p) =>
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
