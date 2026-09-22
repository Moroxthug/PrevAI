// A-1: client del modulo Fatture SDI. Stesso schema minimale degli altri
// (security-api.ts, usage-api.ts): fetch a mano, niente generatori.
// Le credenziali dell'intermediario si possono scrivere ma non rileggere: il
// server risponde solo `credenzialiPresenti`.

export type StatoSdi =
  | "bozza"
  | "pronta"
  | "inviata"
  | "consegnata"
  | "mancata_consegna"
  | "scartata"
  | "accettata"
  | "rifiutata"
  | "decorrenza_termini"
  | "annullata";

export type RequisitoDto = { campo: string; messaggio: string };

export type SdiSettingsDto = {
  provider: "simulato" | "openapi" | "acube";
  stato: "non_configurato" | "in_configurazione" | "attivo" | "sospeso";
  regimeFiscale: string;
  ambiente: "sandbox" | "produzione";
  codiceDestinatarioRicezione: string | null;
  pecRicezione: string | null;
  cicloPassivoAttivo: boolean;
  cicloPassivoAttivatoAt: string | null;
  delegaFirmataAt: string | null;
  delegaRiferimento: string | null;
  conservazioneAttiva: boolean;
  onboarding: Record<string, { doneAt: string } | undefined>;
  ultimoErrore: string | null;
  credenzialiPresenti: boolean;
  webhookSegretoPresente: boolean;
  requisitiMancanti: RequisitoDto[];
  codiceDestinatarioIntermediario: string | null;
};

export type TrasmissioneDto = {
  id: string;
  invoiceId: string;
  stato: StatoSdi;
  statoLabel: string;
  tipoDocumento: string;
  formatoTrasmissione: string;
  progressivoInvio: string;
  fileName: string;
  identificativoSdi: string | null;
  codiceDestinatario: string | null;
  pecDestinatario: string | null;
  provider: string;
  ambiente: "sandbox" | "produzione";
  bolloVirtuale: boolean;
  bolloCents: number;
  totaleCents: number;
  erroreCodice: string | null;
  erroreMessaggio: string | null;
  conservazione: "non_richiesta" | "in_corso" | "conservata" | "errore";
  conservazioneAt: string | null;
  inviataAt: string | null;
  consegnataAt: string | null;
  ultimoEventoAt: string | null;
  createdAt: string;
};

export type EventoSdiDto = { id: string; tipo: string; stato: StatoSdi | null; messaggio: string; ricevutoAt: string };

export type ProblemaDto = { campo: string; messaggio: string; codiceSdi?: string };
export type ValidazioneDto = { ok: boolean; errori: ProblemaDto[]; avvisi: ProblemaDto[] };

export type AnteprimaDto = {
  fileName: string;
  xml: string;
  validazione: ValidazioneDto;
  destinatario: { codice: string; pec: string | null; formato: string };
  bolloCents: number;
  totaleCents: number;
};

export type PassivaDto = {
  id: string;
  numero: string;
  data: string | null;
  tipoDocumento: string;
  fornitoreNome: string;
  fornitorePartitaIva: string | null;
  imponibileCents: number;
  ivaCents: number;
  totaleCents: number;
  valuta: string;
  righe: { descrizione: string; quantita: number | null; prezzoUnitarioCents: number | null; totaleCents: number }[];
  stato: "nuova" | "collegata" | "ignorata";
  projectId: string | null;
  costEntryId: string | null;
  fileName: string;
  xmlDisponibile: boolean;
  ricevutaAt: string;
};

export type PeriodoBolloDto = {
  trimestre: number;
  documenti: number;
  importoCents: number;
  stato: "aperto" | "da_versare" | "versato" | "non_dovuto";
  codiceTributo: string;
  scadenza: string | null;
  versatoAt: string | null;
  riferimentoVersamento: string;
};

export type F24Dto = {
  anno: number;
  trimestre: number;
  sezione: string;
  codiceTributo: string;
  annoRiferimento: number;
  importoCents: number;
  documenti: number;
  scadenza: string;
  contribuente: { denominazione: string; codiceFiscale: string | null; partitaIva: string | null };
  righe: { etichetta: string; valore: string }[];
  avviso: string;
};

export type PassoOnboardingDto = { id: string; titolo: string; testo: string };

export class ErroreApiSdi extends Error {
  constructor(
    message: string,
    readonly codice: string,
    readonly dettagli: ProblemaDto[] | null,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string; dettagli?: ProblemaDto[] | null };
  if (!res.ok) throw new ErroreApiSdi(body.message || body.error || `Richiesta fallita (${res.status})`, body.error ?? "ERRORE", body.dettagli ?? null);
  return body;
}

export type PatchSdiSettings = Partial<{
  provider: SdiSettingsDto["provider"];
  regimeFiscale: string;
  ambiente: "sandbox" | "produzione";
  conservazioneAttiva: boolean;
  codiceDestinatarioRicezione: string | null;
  pecRicezione: string | null;
  providerAccountId: string | null;
  providerApiKey: string | null;
  webhookSecret: string | null;
  cicloPassivoAttivo: boolean;
  delegaFirmata: boolean;
  delegaRiferimento: string | null;
  completa: string[];
}>;

export const sdiApi = {
  settings: () => req<{ settings: SdiSettingsDto; regimi: Record<string, string>; providers: string[]; passi: string[] }>("/api/sdi/settings"),
  updateSettings: (patch: PatchSdiSettings) => req<{ settings: SdiSettingsDto }>("/api/sdi/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  onboarding: () =>
    req<{
      stato: SdiSettingsDto["stato"];
      completati: Record<string, { doneAt: string } | undefined>;
      requisitiMancanti: RequisitoDto[];
      codiceDestinatarioIntermediario: string | null;
      cicloPassivoAttivo: boolean;
      passi: PassoOnboardingDto[];
    }>("/api/sdi/onboarding"),

  statoFattura: (invoiceId: string) => req<{ corrente: TrasmissioneDto | null; storico: TrasmissioneDto[]; eventi: EventoSdiDto[] }>(`/api/invoices/${invoiceId}/sdi`),
  anteprima: (invoiceId: string) => req<AnteprimaDto>(`/api/invoices/${invoiceId}/sdi/anteprima`),
  invia: (invoiceId: string, forza = false) => req<{ trasmissione: TrasmissioneDto; avvisi: ProblemaDto[] }>(`/api/invoices/${invoiceId}/sdi/invia`, { method: "POST", body: JSON.stringify({ forza }) }),
  aggiorna: (trasmissioneId: string) => req<{ trasmissione: TrasmissioneDto }>(`/api/sdi/transmissions/${trasmissioneId}/aggiorna`, { method: "POST" }),
  xmlUrl: (trasmissioneId: string) => `/api/sdi/transmissions/${trasmissioneId}/xml`,

  passive: (stato?: PassivaDto["stato"]) => req<{ fatture: PassivaDto[] }>(`/api/sdi/passive${stato ? `?stato=${stato}` : ""}`),
  sincronizzaPassive: () => req<{ scaricate: number; nuove: number; saltate: number }>("/api/sdi/passive/sincronizza", { method: "POST" }),
  collegaPassiva: (id: string, body: { projectId: string; category?: string; milestoneId?: string | null }) => req<{ fattura: PassivaDto }>(`/api/sdi/passive/${id}/collega`, { method: "POST", body: JSON.stringify(body) }),
  ignoraPassiva: (id: string) => req<{ fattura: PassivaDto }>(`/api/sdi/passive/${id}/ignora`, { method: "POST" }),
  xmlPassivaUrl: (id: string) => `/api/sdi/passive/${id}/xml`,

  bollo: (anno: number) => req<{ anno: number; periodi: PeriodoBolloDto[] }>(`/api/sdi/bollo?anno=${anno}`),
  f24: (anno: number, trimestre: number) => req<F24Dto>(`/api/sdi/bollo/${anno}/${trimestre}/f24`),
  segnaVersato: (anno: number, trimestre: number, versato: boolean, riferimento?: string) =>
    req<{ periodo: { trimestre: number; stato: string; versatoAt: string | null; riferimentoVersamento: string } }>(`/api/sdi/bollo/${anno}/${trimestre}/versato`, {
      method: "POST",
      body: JSON.stringify({ versato, riferimento }),
    }),
};

/** Colore del badge di stato: verde = emessa, rosso = da correggere. */
export function toneStatoSdi(stato: StatoSdi): "ok" | "attesa" | "errore" {
  if (stato === "consegnata" || stato === "accettata" || stato === "decorrenza_termini" || stato === "mancata_consegna") return "ok";
  if (stato === "scartata" || stato === "rifiutata" || stato === "annullata") return "errore";
  return "attesa";
}
