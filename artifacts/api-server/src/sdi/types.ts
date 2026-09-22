import type {
  CondizioniPagamento,
  EsigibilitaIva,
  ModalitaPagamento,
  Natura,
  RegimeFiscale,
  TipoDocumento,
} from "@workspace/db";

// ── A-1: modello dati della fattura elettronica ──────────────────────────────
// Un oggetto piatto, senza dipendenze dal DB: `mapper.ts` lo costruisce da una
// riga di `invoices`, `xml.ts` lo serializza, `validate.ts` lo controlla e i
// test lo scrivono a mano. Tutti gli importi sono in centesimi interi, come
// nel resto del motore fatture (v2 Phase 4).

export type FormatoTrasmissione = "FPR12" | "FPA12";

export type SedeFatturaPa = {
  indirizzo: string;
  numeroCivico?: string | null;
  cap: string;
  comune: string;
  /** Sigla di due lettere; assente per l'estero. */
  provincia?: string | null;
  /** ISO 3166-1 alpha-2. */
  nazione: string;
};

export type AnagraficaFatturaPa = {
  /** Impresa o ditta: ragione sociale. In alternativa nome + cognome. */
  denominazione?: string | null;
  nome?: string | null;
  cognome?: string | null;
};

export type CedenteFatturaPa = {
  partitaIva: string;
  /** `IdPaese` dell'IdFiscaleIVA. */
  paese: string;
  codiceFiscale?: string | null;
  anagrafica: AnagraficaFatturaPa;
  regimeFiscale: RegimeFiscale;
  sede: SedeFatturaPa;
  /** Iscrizione al Registro Imprese: ufficio (sigla provincia) e numero REA. */
  rea?: { ufficio: string; numero: string } | null;
  email?: string | null;
  telefono?: string | null;
};

export type CessionarioFatturaPa = {
  /** Impresa: P. IVA. Privato: assente. */
  partitaIva?: string | null;
  paese?: string | null;
  /** Privato: C.F. obbligatorio. Impresa: facoltativo. */
  codiceFiscale?: string | null;
  anagrafica: AnagraficaFatturaPa;
  sede: SedeFatturaPa;
};

export type RigaFatturaPa = {
  numero: number;
  descrizione: string;
  /** Assente quando quantità × prezzo non torna esattamente: resta solo il totale. */
  quantita?: number | null;
  prezzoUnitarioCents: number;
  prezzoTotaleCents: number;
  aliquota: number;
  natura?: Natura | null;
};

export type RiepilogoFatturaPa = {
  aliquota: number;
  natura?: Natura | null;
  imponibileCents: number;
  impostaCents: number;
  esigibilita: EsigibilitaIva;
  riferimentoNormativo?: string | null;
};

export type PagamentoFatturaPa = {
  condizioni: CondizioniPagamento;
  modalita: ModalitaPagamento;
  /** `AAAA-MM-GG`. */
  scadenza?: string | null;
  importoCents: number;
  iban?: string | null;
};

export type FatturaCollegata = {
  numero: string;
  /** `AAAA-MM-GG`. */
  data?: string | null;
};

export type FatturaPaInput = {
  formatoTrasmissione: FormatoTrasmissione;
  /** Identificativo del trasmittente: PrevAI trasmette per conto del cedente, quindi è la P. IVA del cedente. */
  trasmittente: { paese: string; codice: string };
  progressivoInvio: string;
  codiceDestinatario: string;
  pecDestinatario?: string | null;
  cedente: CedenteFatturaPa;
  cessionario: CessionarioFatturaPa;
  tipoDocumento: TipoDocumento;
  divisa: string;
  /** `AAAA-MM-GG`. */
  data: string;
  numero: string;
  /** Bollo virtuale assolto dall'emittente (DPR 642/1972): € 2 sui documenti senza IVA oltre € 77,47. */
  bolloVirtualeCents?: number | null;
  totaleDocumentoCents: number;
  causale?: string[] | null;
  righe: RigaFatturaPa[];
  riepilogo: RiepilogoFatturaPa[];
  pagamento?: PagamentoFatturaPa | null;
  /** Note di credito: la fattura che correggono. */
  fattureCollegate?: FatturaCollegata[] | null;
  /** Appalti pubblici: CIG/CUP, obbligatori quando l'ente li ha comunicati. */
  cig?: string | null;
  cup?: string | null;
};
