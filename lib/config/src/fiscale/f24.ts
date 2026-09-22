import { fmtEurCents } from "../format";
import type { CategoriaScadenza, RegolaId, RigaF24, Scadenza, SezioneF24 } from "./types";

// ── A-3: il modello F24 precompilato ─────────────────────────────────────────
// **Precompilato, non pagato.** PrevAI non dispone versamenti e non si collega
// a nessun conto: prepara i campi e li mette a disposizione da ricopiare
// nell'home banking o nei servizi telematici dell'Agenzia. È la stessa linea
// di A-1 e A-2 (AMMINISTRAZIONE-PLAN.md §5 e §7): lo strumento calcola, il
// contribuente dispone.
//
// E non è nemmeno il modello ufficiale. Quello che produciamo è un
// **prospetto**: gli stessi campi, nello stesso ordine, ma su un foglio
// nostro. Stampare un facsimile del modello ministeriale inviterebbe a
// presentarlo com'è allo sportello, e non sarebbe valido.
//
// Questo file è puro: nessun accesso al database, nessuna data di sistema.
// I dati del contribuente arrivano già letti da chi lo chiama.

/** Ciò che l'impresa deve avere per compilare la delega. */
export type Contribuente = {
  denominazione: string;
  codiceFiscale: string;
  partitaIva: string;
  comune: string;
  provincia: string;
  /** Matricola INPS dell'azienda: sta sull'estratto conto contributivo, non la deduciamo. */
  matricolaInps: string;
  /** Codice della sede INPS competente, quattro cifre. */
  sedeInps: string;
};

/** Un campo del prospetto, con il nome che ha sul modello. */
export type CampoF24 = {
  etichetta: string;
  valore: string;
  /** true quando il campo è vuoto e senza di esso la delega non è compilabile. */
  mancante?: boolean;
};

export type SezioneProspetto = {
  sezione: SezioneF24;
  titolo: string;
  /** Intestazioni di colonna, nell'ordine del modello. */
  colonne: readonly string[];
  righe: readonly (readonly string[])[];
  totaleCents: number;
};

export type ProspettoF24 = {
  /** Chiave della scadenza da cui viene: lega il prospetto allo scadenzario. */
  scadenzaId: string;
  titolo: string;
  categoria: CategoriaScadenza;
  /** `YYYY-MM-DD`: il campo "data di versamento" resta da scrivere al contribuente. */
  scadenza: string;
  contribuente: readonly CampoF24[];
  sezioni: readonly SezioneProspetto[];
  totaleCents: number;
  /** Campi obbligatori che mancano: finché ce n'è uno il prospetto è incompleto e lo dice. */
  campiMancanti: readonly string[];
  regole: readonly RegolaId[];
  avvertenze: readonly string[];
};

const AVVERTENZA_STRUMENTO =
  "Questo è un prospetto di PrevAI, non il modello F24 ufficiale: ricopia i campi nell'home banking o nei servizi telematici dell'Agenzia delle Entrate. PrevAI non esegue versamenti.";

const AVVERTENZA_NON_REVISIONATO =
  "I codici tributo e le causali di questo prospetto non sono ancora stati verificati da un commercialista. Controllali prima di versare: un codice sbagliato fa risultare l'imposta non pagata anche se il denaro è uscito.";

function euro(cents: number): string {
  // Il modello vuole l'importo in euro e centesimi senza simbolo: "1234,56".
  return (cents / 100).toFixed(2).replace(".", ",");
}

function campo(etichetta: string, valore: string, obbligatorio: boolean): CampoF24 {
  const vuoto = valore.trim() === "";
  return { etichetta, valore: valore.trim(), ...(obbligatorio && vuoto ? { mancante: true } : {}) };
}

/** Le sezioni del modello toccate dalle righe, nell'ordine in cui compaiono sulla delega. */
function sezioniDi(righe: readonly RigaF24[], contribuente: Contribuente): SezioneProspetto[] {
  const sezioni: SezioneProspetto[] = [];

  const erario = righe.filter((r) => r.sezione === "erario");
  if (erario.length > 0) {
    sezioni.push({
      sezione: "erario",
      titolo: "Sezione Erario",
      colonne: ["Codice tributo", "Rateazione/mese rif.", "Anno di riferimento", "Importo a debito", "Cosa stai versando"],
      righe: erario.map((r) => [r.codiceTributo ?? "", "", String(r.annoRiferimento), euro(r.importoCents), r.descrizione]),
      totaleCents: erario.reduce((s, r) => s + r.importoCents, 0),
    });
  }

  const inps = righe.filter((r) => r.sezione === "inps");
  if (inps.length > 0) {
    sezioni.push({
      sezione: "inps",
      titolo: "Sezione INPS",
      colonne: ["Codice sede", "Causale contributo", "Matricola INPS", "Da mm/aaaa", "A mm/aaaa", "Importo a debito", "Cosa stai versando"],
      righe: inps.map((r) => [
        contribuente.sedeInps,
        r.causale ?? "",
        contribuente.matricolaInps,
        r.periodoDa ?? "",
        r.periodoA ?? "",
        euro(r.importoCents),
        r.descrizione,
      ]),
      totaleCents: inps.reduce((s, r) => s + r.importoCents, 0),
    });
  }

  return sezioni;
}

/**
 * Costruisce il prospetto di una scadenza. `revisionato` viene da chi chiama
 * (lo stato delle regole F17-F19): se è falso, il prospetto porta l'avvertenza
 * in testa, perché un codice tributo sbagliato non si vede fino alla cartella.
 */
export function prospettoF24(scadenza: Scadenza, contribuente: Contribuente, opzioni: { revisionato: boolean }): ProspettoF24 {
  const sezioni = sezioniDi(scadenza.righe, contribuente);
  const serveInps = sezioni.some((s) => s.sezione === "inps");

  const contribuenteCampi: CampoF24[] = [
    campo("Denominazione", contribuente.denominazione, true),
    campo("Codice fiscale", contribuente.codiceFiscale, true),
    campo("Partita IVA", contribuente.partitaIva, false),
    campo("Comune", contribuente.comune, false),
    campo("Provincia", contribuente.provincia, false),
    ...(serveInps
      ? [campo("Codice sede INPS", contribuente.sedeInps, true), campo("Matricola INPS", contribuente.matricolaInps, true)]
      : []),
  ];

  const campiMancanti = contribuenteCampi.filter((c) => c.mancante).map((c) => c.etichetta);
  const regole = [...new Set(scadenza.righe.flatMap((r) => r.regole))];

  const avvertenze = [AVVERTENZA_STRUMENTO];
  if (!opzioni.revisionato) avvertenze.push(AVVERTENZA_NON_REVISIONATO);
  if (campiMancanti.length > 0) {
    avvertenze.push(
      `Mancano dati che il modello richiede: ${campiMancanti.join(", ")}. ${
        serveInps && (campiMancanti.includes("Codice sede INPS") || campiMancanti.includes("Matricola INPS"))
          ? "Codice sede e matricola stanno sul tuo estratto conto contributivo INPS: PrevAI non può dedurli."
          : "Completali nel profilo dell'impresa."
      }`,
    );
  }
  if (scadenza.righe.length === 0) {
    avvertenze.push("Questa scadenza non è un versamento: non c'è nessun F24 da compilare.");
  }

  return {
    scadenzaId: scadenza.id,
    titolo: scadenza.etichetta,
    categoria: scadenza.categoria,
    scadenza: scadenza.data,
    contribuente: contribuenteCampi,
    sezioni,
    totaleCents: scadenza.importoCents,
    campiMancanti,
    regole,
    avvertenze,
  };
}

/** Quanti giorni prima avvisare, di default: uno per organizzarsi, uno per eseguire. */
export const GIORNI_PROMEMORIA_DEFAULT = [15, 3];

/**
 * Soglie di promemoria valide e ordinate, con un tetto: quattro avvisi per
 * scadenza sono già al limite di quello che si può mandare a qualcuno senza
 * insegnargli a ignorarli.
 */
export function normalizzaGiorniPromemoria(grezze: unknown): number[] {
  const lista = Array.isArray(grezze) ? grezze : [];
  const pulite = lista
    // `Number(null)` è 0, e uno zero silenzioso qui vorrebbe dire "avvisami il
    // giorno stesso": i valori non numerici si buttano, non si convertono.
    .filter((g) => typeof g === "number" || (typeof g === "string" && g.trim() !== "" && Number.isFinite(Number(g))))
    .map((g) => Math.trunc(Number(g)))
    .filter((g) => Number.isFinite(g) && g >= 0 && g <= 90);
  const uniche = [...new Set(pulite)].sort((a, b) => b - a).slice(0, 4);
  return uniche.length > 0 ? uniche : [...GIORNI_PROMEMORIA_DEFAULT];
}

/**
 * Riepilogo a parole di una scadenza, per l'email e per la notifica. Una riga
 * per tributo, così chi legge dal telefono sa già cosa troverà nel prospetto.
 */
export function riepilogoScadenza(scadenza: Scadenza): string {
  if (scadenza.righe.length === 0) return scadenza.etichetta;
  return scadenza.righe
    .map((r) => {
      const codice = r.sezione === "erario" ? `codice tributo ${r.codiceTributo}` : `causale ${r.causale}`;
      return `${r.descrizione} (${codice}): ${fmtEurCents(r.importoCents)}`;
    })
    .join(" · ");
}
