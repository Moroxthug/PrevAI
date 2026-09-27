import type { SdiProvider, StatoSdi, TipoDocumento } from "@workspace/db";

// ── A-1: interfaccia unica verso l'intermediario SdI ─────────────────────────
// PrevAI non è accreditata presso l'Agenzia delle Entrate: firma e trasmette
// un intermediario. Il rischio è il lock-in (AMMINISTRAZIONE-PLAN.md §11), e
// si tiene lontano così: tutto il resto del codice conosce solo questa
// interfaccia, l'XML e le ricevute restano anche nel nostro storage, e
// cambiare fornitore significa scrivere un file in `providers/`.

export type Ambiente = "sandbox" | "produzione";

export type EsitoInvio = {
  /** Identificativo del documento presso l'intermediario. */
  providerDocumentId: string;
  /** Identificativo assegnato dallo SdI, quando è già noto. */
  identificativoSdi?: string | null;
  stato: StatoSdi;
  messaggio?: string | null;
};

export type EventoSdi = {
  /** RC (consegna) · NS (scarto) · MC (mancata consegna) · NE (esito PA) · DT (decorrenza termini) · AT · EC, o un evento proprio dell'intermediario. */
  tipo: string;
  /** Stato in cui porta il documento; null quando è solo informativo. */
  stato: StatoSdi | null;
  messaggio: string;
  /** Chiave di idempotenza: lo stesso evento può arrivare due volte. */
  providerEventId: string | null;
  providerDocumentId: string | null;
  identificativoSdi?: string | null;
  erroreCodice?: string | null;
  ricevutoAt: Date;
  payload: Record<string, unknown>;
};

export type RigaPassiva = { descrizione: string; quantita: number | null; prezzoUnitarioCents: number | null; totaleCents: number };

export type PassivaScaricata = {
  providerDocumentId: string;
  fileName: string;
  /** XML integrale, quando l'intermediario lo restituisce: lo archiviamo noi. */
  xml: string | null;
  fornitoreNome: string;
  fornitorePartitaIva: string | null;
  fornitoreCodiceFiscale: string | null;
  numero: string;
  data: Date | null;
  tipoDocumento: TipoDocumento;
  imponibileCents: number;
  ivaCents: number;
  totaleCents: number;
  valuta: string;
  righe: RigaPassiva[];
};

export type CredenzialiProvider = {
  accountId: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
  ambiente: Ambiente;
};

export interface IntermediarioSdi {
  readonly nome: SdiProvider;
  readonly ambiente: Ambiente;
  /** Vero quando le credenziali ci sono e l'adapter può parlare col fornitore. */
  configurato(): boolean;
  /**
   * Codice destinatario dell'intermediario: è quello che l'impresa registra
   * nel portale "Fatture e Corrispettivi" per farsi recapitare le passive.
   */
  codiceDestinatarioRicezione(): string | null;
  invia(params: { fileName: string; xml: string; conservazione: boolean }): Promise<EsitoInvio>;
  stato(providerDocumentId: string): Promise<{ stato: StatoSdi; eventi: EventoSdi[] }>;
  scaricaPassive(params: { da?: Date | null }): Promise<PassivaScaricata[]>;
  /** Firma/segreto del webhook. Falso = la richiesta non è dell'intermediario. */
  verificaWebhook(params: { corpo: string; intestazioni: Record<string, string | undefined>; segreto: string | null }): boolean;
  /** Traduce il corpo del webhook negli eventi che sappiamo applicare. */
  leggiWebhook(payload: unknown): EventoSdi[];
}

export class ErroreIntermediario extends Error {
  constructor(
    message: string,
    readonly stato?: number,
    readonly corpo?: string,
  ) {
    super(message);
    this.name = "ErroreIntermediario";
  }
}
