/**
 * FatturaPA — codifiche e controlli formali della fattura elettronica
 * (specifiche tecniche AdE v1.9, tracciato `FatturaElettronica` 1.2.2).
 *
 * Vive in `@workspace/config` e non nel server perché servono a tre posti:
 * il generatore XML (api-server/src/sdi), l'onboarding in dashboard (select
 * del regime fiscale, controllo del codice destinatario mentre si digita) e
 * i test. Nessuna dipendenza esterna: solo tabelle e funzioni pure.
 *
 * A-1, AMMINISTRAZIONE-PLAN.md §8 modulo 1.
 */

import type { IvaCode } from "./iva";

// ── Tipo documento (2.1.1.1) ────────────────────────────────────────────────
// Solo i codici che PrevAI può emettere o ricevere. L'elenco completo ha 28
// voci (TD01…TD28): le altre riguardano autofatture, estrazioni da deposito
// IVA e regimi che il target (artigiani forfettari) non incontra.

export const TIPI_DOCUMENTO = {
  TD01: "Fattura",
  TD02: "Acconto / anticipo su fattura",
  TD03: "Acconto / anticipo su parcella",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD06: "Parcella",
  TD24: "Fattura differita (art. 21, c. 4, lett. a)",
  TD25: "Fattura differita (art. 21, c. 4, terzo periodo lett. b)",
} as const;
export type TipoDocumento = keyof typeof TIPI_DOCUMENTO;

// ── Regime fiscale dell'emittente (1.2.1.8) ─────────────────────────────────

export const REGIMI_FISCALI = {
  RF01: "Ordinario",
  RF02: "Contribuenti minimi (art. 1, c. 96-117, L. 244/2007)",
  RF04: "Agricoltura e attività connesse e pesca",
  RF05: "Vendita sali e tabacchi",
  RF06: "Commercio dei fiammiferi",
  RF07: "Editoria",
  RF08: "Gestione servizi telefonia pubblica",
  RF09: "Rivendita documenti di trasporto pubblico e di sosta",
  RF10: "Intrattenimenti e giochi",
  RF11: "Agenzie viaggi e turismo",
  RF12: "Agriturismo",
  RF13: "Vendite a domicilio",
  RF14: "Rivendita beni usati, oggetti d'arte, d'antiquariato o da collezione",
  RF15: "Agenzie di vendita all'asta di oggetti d'arte, antiquariato o da collezione",
  RF16: "IVA per cassa P.A.",
  RF17: "IVA per cassa (art. 32-bis, D.L. 83/2012)",
  RF18: "Altro",
  RF19: "Regime forfettario (art. 1, c. 54-89, L. 190/2014)",
} as const;
export type RegimeFiscale = keyof typeof REGIMI_FISCALI;

/** Il target del modulo Amministrazione: artigiano in regime forfettario. */
export const REGIME_FISCALE_DEFAULT: RegimeFiscale = "RF19";

export function isRegimeFiscale(value: unknown): value is RegimeFiscale {
  return typeof value === "string" && value in REGIMI_FISCALI;
}

/** Nel forfettario non si espone IVA: il documento porta sempre una natura. */
export function regimeSenzaIva(regime: RegimeFiscale): boolean {
  return regime === "RF19" || regime === "RF02";
}

// ── Natura dell'operazione (2.2.2.2) — obbligatoria quando l'aliquota è 0 ───

export const NATURE = {
  N1: "Escluse ex art. 15",
  "N2.1": "Non soggette ad IVA ai sensi degli artt. da 7 a 7-septies",
  "N2.2": "Non soggette — altri casi",
  "N3.1": "Non imponibili — esportazioni",
  "N3.2": "Non imponibili — cessioni intracomunitarie",
  "N3.3": "Non imponibili — cessioni verso San Marino",
  "N3.4": "Non imponibili — operazioni assimilate alle cessioni all'esportazione",
  "N3.5": "Non imponibili — a seguito di dichiarazioni d'intento",
  "N3.6": "Non imponibili — altre operazioni che non concorrono alla formazione del plafond",
  N4: "Esenti",
  N5: "Regime del margine / IVA non esposta in fattura",
  "N6.1": "Inversione contabile — cessione di rottami e altri materiali di recupero",
  "N6.2": "Inversione contabile — cessione di oro e argento puro",
  "N6.3": "Inversione contabile — subappalto nel settore edile",
  "N6.4": "Inversione contabile — cessione di fabbricati",
  "N6.5": "Inversione contabile — cessione di telefoni cellulari",
  "N6.6": "Inversione contabile — cessione di prodotti elettronici",
  "N6.7": "Inversione contabile — prestazioni comparto edile e settori connessi",
  "N6.8": "Inversione contabile — operazioni settore energetico",
  "N6.9": "Inversione contabile — altri casi",
  N7: "IVA assolta in altro stato UE",
} as const;
export type Natura = keyof typeof NATURE;

// ── Esigibilità IVA (2.2.2.7) ───────────────────────────────────────────────
/** I = immediata · D = differita · S = scissione dei pagamenti (split payment). */
export type EsigibilitaIva = "I" | "D" | "S";

// ── Modalità di pagamento (2.4.2.2) ─────────────────────────────────────────

export const MODALITA_PAGAMENTO = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP05: "Bonifico",
  MP08: "Carta di pagamento",
  MP12: "RIBA",
  MP19: "SEPA Direct Debit",
  MP21: "SEPA Direct Debit B2B",
  MP23: "PagoPA",
} as const;
export type ModalitaPagamento = keyof typeof MODALITA_PAGAMENTO;

/** I metodi di `invoice_payments` mappati sul tracciato; sconosciuto → bonifico. */
export function modalitaPagamentoPerMetodo(method: string | null | undefined): ModalitaPagamento {
  switch (method) {
    case "cash":
      return "MP01";
    case "cheque":
      return "MP02";
    case "card":
      return "MP08";
    default:
      return "MP05";
  }
}

/** Condizioni di pagamento (2.4.1): TP01 a rate · TP02 completo · TP03 anticipo. */
export type CondizioniPagamento = "TP01" | "TP02" | "TP03";

// ── Regime IVA PrevAI → tracciato ───────────────────────────────────────────

export type RigaIvaFatturaPa = {
  /** Aliquota in percentuale (0 quando c'è una natura). */
  aliquota: number;
  natura: Natura | null;
  /** 2.2.2.4 — dicitura obbligatoria quando l'aliquota è 0. */
  riferimentoNormativo: string | null;
  esigibilita: EsigibilitaIva;
};

/**
 * Traduce il regime IVA del documento PrevAI (`IvaCode`) in aliquota +
 * natura + riferimento normativo. Il regime fiscale dell'emittente conta:
 * un forfettario non espone mai IVA, quindi un documento IVA22 emesso in
 * RF19 diventa comunque N2.2 (art. 1, c. 54-89, L. 190/2014).
 */
export function rigaIva(code: IvaCode | string | null | undefined, regime: RegimeFiscale = REGIME_FISCALE_DEFAULT): RigaIvaFatturaPa {
  if (regimeSenzaIva(regime)) {
    return {
      aliquota: 0,
      natura: "N2.2",
      riferimentoNormativo:
        regime === "RF19"
          ? "Operazione non soggetta a IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014 — regime forfettario"
          : "Operazione non soggetta a IVA ai sensi dell'art. 1, commi 96-117, L. 244/2007 — regime dei minimi",
      esigibilita: "I",
    };
  }
  switch (code) {
    case "IVA22":
      return { aliquota: 22, natura: null, riferimentoNormativo: null, esigibilita: "I" };
    case "IVA10":
      return { aliquota: 10, natura: null, riferimentoNormativo: null, esigibilita: "I" };
    case "IVA4":
      return { aliquota: 4, natura: null, riferimentoNormativo: null, esigibilita: "I" };
    case "RC":
      return {
        aliquota: 0,
        natura: "N6.7",
        riferimentoNormativo: "Inversione contabile ai sensi dell'art. 17, comma 6, lett. a-ter), DPR 633/1972",
        esigibilita: "I",
      };
    case "SP":
      return { aliquota: 22, natura: null, riferimentoNormativo: null, esigibilita: "S" };
    case "ESENTE":
      return { aliquota: 0, natura: "N4", riferimentoNormativo: "Operazione esente ai sensi dell'art. 10 DPR 633/1972", esigibilita: "I" };
    default:
      return { aliquota: 22, natura: null, riferimentoNormativo: null, esigibilita: "I" };
  }
}

// ── Codice destinatario / PEC (1.1.4, 1.1.6) ────────────────────────────────

/** Privato o soggetto senza canale telematico: sette zeri, fattura leggibile solo nel cassetto fiscale. */
export const CODICE_DESTINATARIO_PRIVATO = "0000000";
/** Cliente estero: sette X. */
export const CODICE_DESTINATARIO_ESTERO = "XXXXXXX";

/** 7 caratteri alfanumerici (privati e imprese) o 6 (Pubblica Amministrazione, IPA). */
export function validaCodiceDestinatario(value: string | null | undefined): boolean {
  const v = (value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(v) || /^[A-Z0-9]{7}$/.test(v);
}

export function isCodiceDestinatarioPa(value: string | null | undefined): boolean {
  return /^[A-Z0-9]{6}$/.test((value ?? "").trim().toUpperCase());
}

const PEC_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function validaPec(value: string | null | undefined): boolean {
  return PEC_RE.test((value ?? "").trim());
}

// ── Partita IVA e codice fiscale ────────────────────────────────────────────

export function normalizzaPartitaIva(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^IT/, "");
}

/**
 * Partita IVA italiana: 11 cifre con carattere di controllo (D.M. 23/12/1976,
 * algoritmo di Luhn sui pari). Non verifica l'esistenza presso l'Anagrafe.
 */
export function validaPartitaIva(value: string | null | undefined): boolean {
  const piva = normalizzaPartitaIva(value);
  if (!/^[0-9]{11}$/.test(piva)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    const cifra = piva.charCodeAt(i) - 48;
    if (i % 2 === 0) {
      somma += cifra;
    } else {
      const doppio = cifra * 2;
      somma += doppio > 9 ? doppio - 9 : doppio;
    }
  }
  return somma % 10 === 0;
}

const CF_PARI: Record<string, number> = {};
const CF_DISPARI: Record<string, number> = {};
{
  const alfabeto = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Valore dei caratteri in posizione dispari: prima le cifre 0-9, poi A-Z.
  const dispari = [
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21,
    1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
  ];
  for (let i = 0; i < alfabeto.length; i++) {
    const ch = alfabeto[i];
    CF_PARI[ch] = i < 10 ? i : i - 10;
    CF_DISPARI[ch] = dispari[i];
  }
}

/** Le lettere che nel C.F. di persona fisica possono sostituire una cifra (omocodia). */
const CF_OMOCODIA = "LMNPQRSTUV";

export function normalizzaCodiceFiscale(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Codice fiscale: 16 caratteri (persona fisica, con carattere di controllo e
 * omocodia) oppure 11 cifre (società ed enti = partita IVA).
 */
export function validaCodiceFiscale(value: string | null | undefined): boolean {
  const cf = normalizzaCodiceFiscale(value);
  if (/^[0-9]{11}$/.test(cf)) return validaPartitaIva(cf);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i];
    somma += i % 2 === 0 ? CF_DISPARI[ch] : CF_PARI[ch];
  }
  return cf[15] === "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[somma % 26];
}

/** Nel C.F. omocodico le cifre sostituite tornano numeri: serve per confrontare due codici. */
export function codiceFiscaleCanonico(value: string | null | undefined): string {
  const cf = normalizzaCodiceFiscale(value);
  if (cf.length !== 16) return cf;
  const posizioniNumeriche = [6, 7, 9, 10, 12, 13, 14];
  const chars = cf.split("");
  for (const pos of posizioniNumeriche) {
    const idx = CF_OMOCODIA.indexOf(chars[pos]);
    if (idx >= 0) chars[pos] = String(idx);
  }
  return chars.join("");
}

// ── CAP e IBAN ──────────────────────────────────────────────────────────────

export function validaCap(value: string | null | undefined): boolean {
  return /^[0-9]{5}$/.test((value ?? "").trim());
}

export function normalizzaIban(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/\s/g, "");
}

/** IBAN: lunghezza per paese (solo IT/SM/EU generico) e resto 97 = 1 (ISO 13616). */
export function validaIban(value: string | null | undefined): boolean {
  const iban = normalizzaIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("IT") && iban.length !== 27) return false;
  const riordinato = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const ch of riordinato) {
    const valore = ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55);
    for (const cifra of valore) resto = (resto * 10 + (cifra.charCodeAt(0) - 48)) % 97;
  }
  return resto === 1;
}

// ── Nome del file trasmesso (specifiche §1.1) ───────────────────────────────

/**
 * `ITxxxxxxxxxxx_NNNNN.xml`: paese + identificativo del trasmittente +
 * progressivo univoco alfanumerico (max 5 caratteri usati qui, il tracciato
 * ne ammette 10). Il progressivo non deve ripetersi per lo stesso
 * trasmittente: lo componiamo come `<anno a 2 cifre><contatore>`.
 */
export function progressivoInvio(anno: number, contatore: number): string {
  return `${String(anno % 100).padStart(2, "0")}${String(contatore).padStart(5, "0")}`;
}

export function nomeFileFattura(idPaese: string, idCodice: string, progressivo: string): string {
  return `${idPaese.toUpperCase()}${idCodice}_${progressivo}.xml`;
}

// ── Importi e date ──────────────────────────────────────────────────────────

/** Il tracciato vuole il punto come separatore e 2 decimali (8 per i prezzi unitari). */
export function importo(cents: number, decimali = 2): string {
  return (cents / 100).toFixed(decimali);
}

export function quantita(value: number): string {
  return value.toFixed(2);
}

/** `AAAA-MM-GG` in ora italiana: la data della fattura non deve slittare col fuso. */
export function dataFattura(date: Date): string {
  const parti = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const p = (tipo: string) => parti.find((x) => x.type === tipo)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

// ── Stati SdI ───────────────────────────────────────────────────────────────
// Il ciclo di vita di una fattura emessa, come lo raccontano le ricevute SdI:
// RC (consegna), NS (scarto), MC (mancata consegna), NE (esito committente
// PA), DT (decorrenza termini), AT (attestazione di trasmissione).

export const STATI_SDI = [
  "bozza",
  "pronta",
  "inviata",
  "consegnata",
  "mancata_consegna",
  "scartata",
  "accettata",
  "rifiutata",
  "decorrenza_termini",
  "annullata",
] as const;
export type StatoSdi = (typeof STATI_SDI)[number];

/** Stati in cui la fattura è validamente emessa ai fini fiscali. */
export const STATI_SDI_EMESSA: readonly StatoSdi[] = ["consegnata", "mancata_consegna", "accettata", "decorrenza_termini"];
/** Stati che non cambiano più. */
export const STATI_SDI_FINALI: readonly StatoSdi[] = ["consegnata", "mancata_consegna", "scartata", "accettata", "rifiutata", "decorrenza_termini", "annullata"];

export const STATI_SDI_LABEL: Record<StatoSdi, string> = {
  bozza: "Bozza",
  pronta: "Pronta per l'invio",
  inviata: "Inviata allo SdI",
  consegnata: "Consegnata",
  mancata_consegna: "Mancata consegna (depositata nel cassetto fiscale)",
  scartata: "Scartata dallo SdI",
  accettata: "Accettata dal committente",
  rifiutata: "Rifiutata dal committente",
  decorrenza_termini: "Decorrenza termini (accettata per silenzio)",
  annullata: "Annullata",
};

/** Cosa deve fare l'utente, in una riga. */
export const STATI_SDI_AZIONE: Partial<Record<StatoSdi, string>> = {
  scartata: "Correggi i dati segnalati e rinvia entro 5 giorni: la fattura si considera non emessa.",
  mancata_consegna: "Il cliente non ha un canale telematico attivo: avvisalo che trova la fattura nel suo cassetto fiscale.",
  rifiutata: "L'ente ha rifiutato la fattura: correggi e rinvia, oppure emetti una nota di credito.",
};

/**
 * Errori di scarto più frequenti (allegato "Errori" delle specifiche): li
 * mostriamo tradotti perché il messaggio dello SdI è criptico.
 */
export const ERRORI_SDI: Record<string, string> = {
  "00001": "Nome file non valido.",
  "00002": "Nome file duplicato: una fattura con lo stesso progressivo è già stata inviata.",
  "00003": "Le dimensioni del file superano quelle ammesse.",
  "00102": "File non integro (firma non valida).",
  "00200": "File non conforme al formato FatturaPA.",
  "00300": "Partita IVA del cedente/prestatore non valida.",
  "00301": "Codice fiscale del cedente/prestatore non valido.",
  "00302": "Partita IVA del cessionario/committente non valida.",
  "00303": "Codice fiscale del cessionario/committente non valido.",
  "00305": "Codice destinatario non valido.",
  "00306": "Codice destinatario non valido: deve avere 6 caratteri per la PA, 7 per i privati.",
  "00311": "Codice destinatario non presente nell'anagrafica SdI.",
  "00312": "Codice destinatario non attivo.",
  "00313": "PEC del destinatario non valida.",
  "00320": "Partita IVA del cedente/prestatore cessata.",
  "00321": "Partita IVA del cessionario/committente cessata.",
  "00400": "Aliquota IVA non coerente con la natura dell'operazione.",
  "00401": "Natura indicata su una riga con aliquota diversa da zero.",
  "00403": "Data della fattura successiva alla data di ricezione.",
  "00411": "Riga senza aliquota e senza natura.",
  "00413": "Natura non ammessa con questa esigibilità IVA.",
  "00417": "Il cessionario/committente deve avere partita IVA o codice fiscale.",
  "00418": "Data del documento non coerente con il riepilogo.",
  "00419": "Riepilogo IVA mancante per un'aliquota presente nelle righe.",
  "00420": "Importo del riepilogo non coerente con le righe.",
  "00421": "Imposta non coerente con imponibile e aliquota.",
  "00422": "Imponibile non coerente con quantità e prezzo unitario.",
  "00423": "Prezzo totale non coerente con quantità e prezzo unitario.",
  "00424": "Arrotondamento non ammesso.",
  "00427": "Con codice destinatario 0000000 serve la PEC del destinatario.",
  "00428": "Formato trasmissione non coerente con il codice destinatario.",
  "00430": "Tipo documento non compatibile con il regime fiscale dichiarato.",
  "00443": "Il totale documento non corrisponde alla somma di imponibili, imposte e bollo.",
  "00444": "Tipo documento non ammesso per un'autofattura.",
  "00445": "Con natura N6 l'aliquota deve essere zero.",
};

export function descrizioneErroreSdi(codice: string | null | undefined, fallback?: string | null): string {
  const key = (codice ?? "").trim();
  return ERRORI_SDI[key] ?? fallback ?? (key ? `Errore SdI ${key}.` : "Errore non specificato dallo SdI.");
}
