// A-2: client del motore fiscale forfettario. Stesso schema minimale degli
// altri (sdi-api.ts, security-api.ts): fetch a mano, niente generatori.
//
// Un dettaglio che non è un dettaglio: ogni risposta di calcolo porta con sé
// `revisione`, cioè se le regole usate sono state confermate da un
// commercialista. L'interfaccia lo mostra sempre. Un numero fiscale senza il
// suo grado di affidabilità è peggio di nessun numero.

export type GestionePrevidenziale = "artigiani" | "commercianti" | "gestione_separata" | "cassa_professionale" | "nessuna";
export type RiduzioneContributiva = "nessuna" | "forfettari_35" | "nuovi_iscritti_50";
export type LivelloSoglia = "ok" | "attenzione" | "vicino" | "superata" | "fuori_regime";
export type StatoRevisione = "non_revisionata" | "confermata" | "con_condizione" | "corretta";
export type TipoVersamento = "contributi_inps" | "imposta_saldo" | "imposta_acconto" | "bollo" | "altro";

export type ProfiloFiscaleDto = {
  regime: "forfettario" | "altro";
  codiceAteco: string;
  coefficientePercent: number;
  coefficienteEffettivo: number;
  coefficienteDescrizione: string;
  coefficienteRiconosciuto: boolean;
  gestione: GestionePrevidenziale;
  riduzione: RiduzioneContributiva;
  annoInizioAttivita: number | null;
  requisitiStartup: boolean;
  ricaviAnnoPrecedenteCents: number;
  speseLavoroCents: number;
  redditoDipendenteCents: number;
  impostaAnnoPrecedenteCents: number;
  margineSicurezzaPercent: number;
  // A-3
  matricolaInps: string;
  sedeInps: string;
  promemoriaEmail: boolean;
  promemoriaWhatsapp: boolean;
  promemoriaTelefono: string;
  promemoriaGiorni: number[];
  onboarding: Record<string, { doneAt: string } | undefined>;
  completatoAt: string | null;
  avvisoAccettato: boolean;
  passiMancanti: string[];
  passi: readonly string[];
};

export type SpiegazioneDto = {
  id: string;
  titolo: string;
  formula: string;
  passaggi: { etichetta: string; valore: string }[];
  risultatoCents: number;
  regole: string[];
  fonte: string;
};

export type MonitorSogliaDto = {
  livello: LivelloSoglia;
  maturatoCents: number;
  proiezioneCents: number;
  sogliaCents: number;
  sogliaUscitaImmediataCents: number;
  margineCents: number;
  percentuale: number;
  conseguenza: string;
};

export type CategoriaScadenza = "imposta" | "contributi" | "bollo" | "dichiarazione";
export type StatoScadenza = "aperta" | "versata" | "non_dovuta";

/** Una riga del modello F24: il modello ha una riga per tributo, non per scadenza. */
export type RigaF24Dto = {
  sezione: "erario" | "inps";
  codiceTributo?: string;
  causale?: string;
  descrizione: string;
  annoRiferimento: number;
  periodoDa?: string;
  periodoA?: string;
  importoCents: number;
  regole: string[];
};

export type ScadenzaDto = {
  id: string;
  etichetta: string;
  data: string;
  importoCents: number;
  categoria: CategoriaScadenza;
  descrizione: string;
  righe: RigaF24Dto[];
  regole: string[];
};

export type CalcoloDto = {
  anno: number;
  annoRegole: number;
  revisionato: boolean;
  regoleNonRevisionate: string[];
  coefficientePercent: number;
  aliquotaPercent: number;
  startupAttiva: boolean;
  imponibileCents: number;
  impostaCents: number;
  contributi: {
    redditoCents: number;
    fissiCents: number;
    eccedenzaCents: number;
    maternitaCents: number;
    scontoCents: number;
    totaleCents: number;
    versatiCents: number;
    residuoCents: number;
  };
  bolloCents: number;
  totaleDovutoCents: number;
  daMettereViaCents: number;
  daMettereViaMensileCents: number;
  percentualeSuIncassi: number;
  soglia: MonitorSogliaDto;
  scadenze: ScadenzaDto[];
  spiegazioni: SpiegazioneDto[];
};

export type DatiAnnoDto = {
  anno: number;
  incassatiCents: number;
  fatturatoNonIncassatoCents: number;
  pipelineCents: number;
  contributiVersatiCents: number;
  accontiVersatiCents: number;
  bolloCents: number;
  incassiConteggio: number;
};

export type RegolaDto = { id: string; titolo: string; fonte: string; stato: StatoRevisione; da: string | null; il: string | null; nota: string | null };
export type RevisioneDto = { annoRegole: number; revisionato: boolean; regole: RegolaDto[] };
export type RequisitoFiscaleDto = { id: string; etichetta: string; rispettato: boolean; dettaglio: string };

export type RispostaCalcolo = {
  anno: number;
  calcolo: CalcoloDto;
  dati: DatiAnnoDto;
  passiMancanti: string[];
  requisiti: RequisitoFiscaleDto[];
  revisione: RevisioneDto;
  avviso: { testo: string; versione: string };
};

export type SimulazioneDto = {
  importoCents: number;
  deltaImpostaCents: number;
  deltaContributiCents: number;
  nettoCents: number;
  nettoPercent: number;
  cambiaLaSoglia: boolean;
  avviso: string | null;
  sogliaPrima: MonitorSogliaDto;
  sogliaDopo: MonitorSogliaDto;
};

// ── A-3: scadenzario, F24 precompilati, promemoria ───────────────────────────

export type VoceScadenzarioDto = {
  scadenza: ScadenzaDto;
  stato: StatoScadenza;
  giorniAllaScadenza: number;
  scaduta: boolean;
  versataAt: string | null;
  quietanza: { url: string; nome: string; caricataAt: string } | null;
  promemoriaInviati: Record<string, string>;
  versatoCents: number;
  regoleNonRevisionate: string[];
};

export type PreferenzePromemoriaDto = {
  email: boolean;
  whatsapp: boolean;
  telefono: string;
  giorni: number[];
  /** false finché non esiste un template Meta approvato: il canale resta spento. */
  whatsappDisponibile: boolean;
};

export type ScadenzarioDto = {
  anno: number;
  voci: VoceScadenzarioDto[];
  prossima: VoceScadenzarioDto | null;
  totaleApertoCents: number;
  scaduteCents: number;
  revisionato: boolean;
  promemoria: PreferenzePromemoriaDto;
  revisione: RevisioneDto;
  avviso: { testo: string; versione: string };
};

export type CampoF24Dto = { etichetta: string; valore: string; mancante?: boolean };
export type SezioneProspettoDto = { sezione: "erario" | "inps"; titolo: string; colonne: string[]; righe: string[][]; totaleCents: number };

export type ProspettoF24Dto = {
  scadenzaId: string;
  titolo: string;
  categoria: CategoriaScadenza;
  scadenza: string;
  contribuente: CampoF24Dto[];
  sezioni: SezioneProspettoDto[];
  totaleCents: number;
  campiMancanti: string[];
  regole: string[];
  avvertenze: string[];
};

export type VersamentoDto = {
  id: string;
  anno: number;
  tipo: TipoVersamento;
  data: string;
  importoCents: number;
  codiceTributo: string;
  riferimento: string;
  note: string;
  origine: "manuale" | "bollo" | "importato";
};

export class ErroreApiFiscale extends Error {
  constructor(
    message: string,
    readonly codice: string,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new ErroreApiFiscale(body.message || body.error || `Richiesta fallita (${res.status})`, body.error ?? "ERRORE");
  return body;
}

export type PatchProfiloFiscale = Partial<{
  regime: "forfettario" | "altro";
  codiceAteco: string;
  coefficientePercent: number;
  gestione: GestionePrevidenziale;
  riduzione: RiduzioneContributiva;
  annoInizioAttivita: number | null;
  requisitiStartup: boolean;
  ricaviAnnoPrecedenteCents: number;
  speseLavoroCents: number;
  redditoDipendenteCents: number;
  impostaAnnoPrecedenteCents: number;
  margineSicurezzaPercent: number;
  accettaAvviso: boolean;
  passoCompletato: string;
  matricolaInps: string;
  sedeInps: string;
  promemoriaEmail: boolean;
  promemoriaWhatsapp: boolean;
  promemoriaTelefono: string;
  promemoriaGiorni: number[];
}>;

export const fiscaleApi = {
  profilo: () =>
    req<{
      profilo: ProfiloFiscaleDto;
      avviso: { testo: string; versione: string };
      opzioni: {
        regimi: readonly string[];
        gestioni: readonly GestionePrevidenziale[];
        riduzioni: readonly RiduzioneContributiva[];
        passi: readonly string[];
        mestieri: { codice: string; mestiere: string }[];
        anniRegole: number[];
        whatsappDisponibile: boolean;
      };
    }>("/api/fiscale/profilo"),
  aggiornaProfilo: (patch: PatchProfiloFiscale) => req<{ profilo: ProfiloFiscaleDto }>("/api/fiscale/profilo", { method: "PATCH", body: JSON.stringify(patch) }),
  ateco: (codice: string) => req<{ codice: string; coefficientePercent: number; descrizione: string; riconosciuto: boolean }>(`/api/fiscale/ateco?codice=${encodeURIComponent(codice)}`),

  calcolo: (anno: number) => req<RispostaCalcolo>(`/api/fiscale/calcolo?anno=${anno}`),
  regole: (anno: number) => req<RevisioneDto & { anniDisponibili: number[] }>(`/api/fiscale/regole?anno=${anno}`),
  simula: (importoCents: number, anno?: number) => req<SimulazioneDto>("/api/fiscale/simula", { method: "POST", body: JSON.stringify({ importoCents, anno }) }),

  versamenti: (anno: number) => req<{ anno: number; versamenti: VersamentoDto[]; tipi: readonly TipoVersamento[] }>(`/api/fiscale/versamenti?anno=${anno}`),
  registraVersamento: (body: { anno: number; tipo: TipoVersamento; data: string; importoCents: number; codiceTributo?: string; riferimento?: string; note?: string }) =>
    req<{ id: string }>("/api/fiscale/versamenti", { method: "POST", body: JSON.stringify(body) }),
  eliminaVersamento: (id: string) => req<void>(`/api/fiscale/versamenti/${id}`, { method: "DELETE" }),

  // A-3
  scadenzario: (anno: number) => req<ScadenzarioDto>(`/api/fiscale/scadenzario?anno=${anno}`),
  segnaVersata: (chiave: string, body: { anno: number; data: string; importoCents?: number; riferimento?: string; note?: string }) =>
    req<{ scadenza: string; versamenti: number; importoCents: number }>(`/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/versata`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  riapriScadenza: (chiave: string, anno: number) =>
    req<void>(`/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/riapri?anno=${anno}`, { method: "POST" }),
  f24: (chiave: string, anno: number) =>
    req<{ anno: number; prospetto: ProspettoF24Dto; revisione: RevisioneDto }>(`/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/f24?anno=${anno}`),
  urlF24Pdf: (chiave: string, anno: number) => `/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/f24.pdf?anno=${anno}`,
  caricaQuietanza: async (chiave: string, anno: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("anno", String(anno));
    const res = await fetch(`/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/quietanza`, { method: "POST", credentials: "include", body: fd });
    const body = (await res.json().catch(() => ({}))) as { nome?: string; error?: string; message?: string };
    if (!res.ok) throw new ErroreApiFiscale(body.message || body.error || `Caricamento fallito (${res.status})`, body.error ?? "ERRORE");
    return body;
  },
  urlQuietanza: (chiave: string, anno: number) => `/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/quietanza/file?anno=${anno}`,
  rimuoviQuietanza: (chiave: string, anno: number) =>
    req<void>(`/api/fiscale/scadenzario/${encodeURIComponent(chiave)}/quietanza?anno=${anno}`, { method: "DELETE" }),
};

export const ETICHETTE_CATEGORIA: Record<CategoriaScadenza, string> = {
  imposta: "Imposta sostitutiva",
  contributi: "Contributi INPS",
  bollo: "Imposta di bollo",
  dichiarazione: "Dichiarazione",
};

/** Colore del semaforo della soglia. */
export function toneSoglia(livello: LivelloSoglia): "ok" | "attesa" | "errore" {
  if (livello === "superata" || livello === "fuori_regime") return "errore";
  if (livello === "vicino" || livello === "attenzione") return "attesa";
  return "ok";
}

export const ETICHETTE_VERSAMENTO: Record<TipoVersamento, string> = {
  contributi_inps: "Contributi INPS",
  imposta_saldo: "Imposta sostitutiva — saldo",
  imposta_acconto: "Imposta sostitutiva — acconto",
  bollo: "Imposta di bollo",
  altro: "Altro",
};

export const ETICHETTE_GESTIONE: Record<GestionePrevidenziale, string> = {
  artigiani: "INPS Artigiani",
  commercianti: "INPS Commercianti",
  gestione_separata: "INPS Gestione separata",
  cassa_professionale: "Cassa professionale",
  nessuna: "Non lo so ancora",
};

export const ETICHETTE_RIDUZIONE: Record<RiduzioneContributiva, string> = {
  nessuna: "Nessuna riduzione",
  forfettari_35: "Riduzione 35 % per forfettari",
  nuovi_iscritti_50: "Riduzione 50 % per i primi 36 mesi (nuovi iscritti)",
};

// ── A-4: prima nota, estratto conto, chiusura d'anno, commercialista ─────────

export type FonteVoce = "incasso" | "costo" | "versamento" | "movimento";
export type TipoMovimento = "entrata" | "uscita";
export type CategoriaMovimento =
  | "altri_ricavi"
  | "spese_generali"
  | "commissioni_bancarie"
  | "affitto_utenze"
  | "veicoli_carburante"
  | "assicurazioni"
  | "altre_imposte"
  | "prelievo_titolare"
  | "apporto_titolare"
  | "giroconto"
  | "altro";

export type VocePrimaNotaDto = {
  chiave: string;
  fonte: FonteVoce;
  id: string;
  data: string;
  tipo: TipoMovimento;
  importoCents: number;
  descrizione: string;
  controparte: string;
  categoria: string;
  incideSulUtile: boolean;
  inBanca: boolean;
  collegamento: { tipo: "fattura" | "cantiere"; id: string; etichetta: string } | null;
};

export type TotaliPrimaNotaDto = {
  entrateCents: number;
  usciteCents: number;
  saldoCents: number;
  incassiCents: number;
  altriRicaviCents: number;
  costiCents: number;
  versamentiCents: number;
  movimentiNeutriCents: number;
  mesi: { mese: number; entrateCents: number; usciteCents: number }[];
};

export type AvvisoPrimaNotaDto = { id: string; testo: string; conteggio: number; importoCents?: number; link?: string };

export type PrimaNotaDto = {
  anno: number;
  voci: VocePrimaNotaDto[];
  totali: TotaliPrimaNotaDto;
  avvisi: AvvisoPrimaNotaDto[];
  categorie: { id: CategoriaMovimento; etichetta: string; neutra: boolean }[];
};

export type UtileNettoDto = {
  anno: number;
  ricaviCents: number;
  costiCents: number;
  margineCents: number;
  impostaCents: number;
  contributiCents: number;
  bolloCents: number;
  caricoFiscaleCents: number;
  utileNettoCents: number;
  utileSuRicaviPercent: number;
  costiPresuntiCents: number;
  scartoCostiCents: number;
  revisionato: boolean;
  regoleNonRevisionate: string[];
  spiegazioni: SpiegazioneDto[];
  passiMancanti: string[];
};

export type StatoMovimentoBanca = "da_abbinare" | "abbinato" | "ignorato";
export type CategoriaCosto = "materials" | "labour" | "subcontractor" | "permits_fees" | "equipment" | "misc";

export type SuggerimentoDto =
  | { azione: "abbina"; tipo: FonteVoce; id: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_incasso"; invoiceId: string; etichetta: string; certezza: "alta" | "media" }
  | { azione: "registra_costo"; etichetta: string; categoria: CategoriaCosto }
  | { azione: "registra_movimento"; etichetta: string; categoria: CategoriaMovimento }
  | { azione: "scadenzario"; etichetta: string };

export type MovimentoBancaDto = {
  id: string;
  importId: string;
  data: string;
  dataValuta: string | null;
  importoCents: number;
  descrizione: string;
  controparte: string;
  riferimento: string;
  stato: StatoMovimentoBanca;
  abbinamento: { tipo: FonteVoce; id: string } | null;
  suggerimenti: SuggerimentoDto[];
};

type ConteggioBanca = { n: number; entrate: number; uscite: number };

export type BancaDto = {
  anno: number;
  movimenti: MovimentoBancaDto[];
  riepilogo: { daAbbinare: ConteggioBanca; abbinati: ConteggioBanca; ignorati: ConteggioBanca };
  estratti: {
    id: string;
    formato: "csv" | "ofx";
    nomeFile: string;
    conto: string;
    righeLette: number;
    righeNuove: number;
    righeDuplicate: number;
    righeScartate: number;
    createdAt: string;
  }[];
  categorieCosto: CategoriaCosto[];
};

export type EsitoImportDto = {
  importId: string;
  formato: "csv" | "ofx";
  lette: number;
  nuove: number;
  duplicate: number;
  scartate: { riga: number; motivo: string; testo: string }[];
  colonne: Record<string, string>;
  giaCaricato: boolean;
  periodo: { da: string; a: string } | null;
};

export type RigoDichiarazioneDto = { quadro: "LM" | "RR"; rigo: string; descrizione: string; valore: string; importoCents?: number; nota?: string };

export type ProspettoDichiarazioneDto = {
  anno: number;
  annoPresentazione: number;
  termineInvio: string;
  righi: RigoDichiarazioneDto[];
  saldoCents: number;
  revisionato: boolean;
  regole: string[];
  regoleNonRevisionate: string[];
  avvertenze: string[];
};

export type PacchettoDto = {
  anno: number;
  generatoAt: string;
  impresa: { denominazione: string; partitaIva: string; codiceFiscale: string; comune: string; provincia: string };
  profilo: { regime: string; codiceAteco: string; coefficientePercent: number; gestione: string; riduzione: string };
  prospetto: ProspettoDichiarazioneDto;
  utile: Omit<UtileNettoDto, "passiMancanti">;
  primaNota: { totali: TotaliPrimaNotaDto; avvisi: AvvisoPrimaNotaDto[]; voci: number };
  versamenti: { data: string; tipo: TipoVersamento; codiceTributo: string; importoCents: number; riferimento: string }[];
  banca: BancaDto["riepilogo"];
  passiMancanti: string[];
  revisione: RevisioneDto;
  avviso: { testo: string; versione: string };
};

export type ChiusuraDto = {
  anno: number;
  stato: "chiuso" | "riaperto";
  versione: number;
  chiusoAt: string;
  riapertoAt: string | null;
  impronta: string;
  regoleRevisionate: boolean;
  riportatoAt: string | null;
};

export type PassoGuidaDto = { titolo: string; testo: string };

export type RispostaChiusura = {
  pacchetto: PacchettoDto;
  chiusura: ChiusuraDto | null;
  chiudibile: boolean;
  differenze: { voce: string; alloraCents: number; oggiCents: number }[];
  guida: PassoGuidaDto[];
};

export type CondivisioneDto = {
  id: string;
  destinatario: string;
  email: string;
  anno: number;
  scadeAt: string;
  revocatoAt: string | null;
  attivo: boolean;
  accessi: number;
  ultimoAccessoAt: string | null;
  createdAt: string;
};

export type PacchettoPubblicoDto = {
  destinatario: string;
  scadeAt: string;
  pacchetto: PacchettoDto;
  voci: VocePrimaNotaDto[];
  chiusura: ChiusuraDto | null;
  guida: PassoGuidaDto[];
};

export type AzioneBanca = "abbina" | "incasso" | "costo" | "movimento" | "ignora" | "scollega";

export const primaNotaApi = {
  primaNota: (anno: number) => req<PrimaNotaDto>(`/api/fiscale/prima-nota?anno=${anno}`),
  urlCsv: (anno: number) => `/api/fiscale/prima-nota.csv?anno=${anno}`,
  creaMovimento: (body: { data: string; tipo: TipoMovimento; categoria: CategoriaMovimento; importoCents: number; descrizione?: string; controparte?: string }) =>
    req<{ id: string }>("/api/fiscale/prima-nota/movimenti", { method: "POST", body: JSON.stringify(body) }),
  eliminaMovimento: (id: string) => req<void>(`/api/fiscale/prima-nota/movimenti/${id}`, { method: "DELETE" }),
  utile: (anno: number) => req<{ anno: number; utile: UtileNettoDto; revisione: RevisioneDto }>(`/api/fiscale/utile?anno=${anno}`),

  banca: (anno: number, stato?: StatoMovimentoBanca) => req<BancaDto>(`/api/fiscale/banca?anno=${anno}${stato ? `&stato=${stato}` : ""}`),
  importa: async (file: File, conto: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("conto", conto);
    const res = await fetch("/api/fiscale/banca/import", { method: "POST", credentials: "include", body: fd });
    const body = (await res.json().catch(() => ({}))) as EsitoImportDto & { error?: string; message?: string };
    if (!res.ok) throw new ErroreApiFiscale(body.message || body.error || `Caricamento fallito (${res.status})`, body.error ?? "ERRORE");
    return body;
  },
  eliminaImport: (id: string) => req<void>(`/api/fiscale/banca/import/${id}`, { method: "DELETE" }),
  abbinaSicuri: (anno: number) => req<{ abbinati: number }>("/api/fiscale/banca/abbina-sicuri", { method: "POST", body: JSON.stringify({ anno }) }),
  azione: (id: string, azione: AzioneBanca, body?: unknown) =>
    req<unknown>(`/api/fiscale/banca/movimenti/${id}/${azione}`, { method: "POST", body: JSON.stringify(body ?? {}) }),

  chiusura: (anno: number) => req<RispostaChiusura>(`/api/fiscale/chiusura?anno=${anno}`),
  urlPacchettoPdf: (anno: number) => `/api/fiscale/chiusura/pacchetto.pdf?anno=${anno}`,
  chiudi: (anno: number, riporta: boolean) =>
    req<{ chiusura: ChiusuraDto; riportato: boolean }>("/api/fiscale/chiusura/chiudi", { method: "POST", body: JSON.stringify({ anno, riporta }) }),
  riapri: (anno: number) => req<void>("/api/fiscale/chiusura/riapri", { method: "POST", body: JSON.stringify({ anno }) }),

  condivisioni: () => req<{ condivisioni: CondivisioneDto[]; durate: number[] }>("/api/fiscale/condivisioni"),
  creaCondivisione: (body: { anno: number; destinatario: string; email?: string; giorni: number }) =>
    req<{ id: string; url: string; scadeAt: string }>("/api/fiscale/condivisioni", { method: "POST", body: JSON.stringify(body) }),
  revocaCondivisione: (id: string) => req<void>(`/api/fiscale/condivisioni/${id}`, { method: "DELETE" }),
  accessi: (id: string) =>
    req<{ accessi: { at: string; risorsa: string; ip: string | null; userAgent: string | null }[] }>(`/api/fiscale/condivisioni/${id}/accessi`),

  pubblico: (token: string) => req<PacchettoPubblicoDto>(`/api/commercialista/${encodeURIComponent(token)}`),
  urlPubblicoCsv: (token: string) => `/api/commercialista/${encodeURIComponent(token)}/prima-nota.csv`,
  urlPubblicoPdf: (token: string) => `/api/commercialista/${encodeURIComponent(token)}/pacchetto.pdf`,
};

export const ETICHETTE_COSTO: Record<CategoriaCosto, string> = {
  materials: "Materiali",
  labour: "Manodopera",
  subcontractor: "Subappalti",
  permits_fees: "Permessi e oneri",
  equipment: "Attrezzature",
  misc: "Varie",
};

export const MESI_BREVI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
