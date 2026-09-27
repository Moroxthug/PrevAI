// A-6: client del servizio col commercialista. Tre lati: l'impresa
// (/api/fiscale/commercialista), il professionista (/api/studio) e lo staff
// (/api/admin/commercialisti). Stesso schema minimale degli altri client:
// fetch a mano, errori con il codice del server.

import type { AzionePratica, Documento, StatoIncarico, StatoPratica, StatoOfferta, ModelloServizio } from "@workspace/config";
import { ErroreApiFiscale, type ChiusuraDto, type PacchettoDto, type PassoGuidaDto, type VocePrimaNotaDto } from "@/lib/fiscale-api";

export { ErroreApiFiscale };

async function req<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...resto } = init ?? {};
  const res = await fetch(url, {
    credentials: "include",
    ...resto,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(resto.headers ?? {}) } : resto.headers,
    body: json !== undefined ? JSON.stringify(json) : resto.body,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new ErroreApiFiscale(body.message || body.error || `Richiesta fallita (${res.status})`, body.error ?? "ERRORE");
  return body;
}

export type IncaricoDto = {
  id: string;
  anno: number;
  stato: StatoIncarico;
  etichetta: string;
  richiestoAt: string;
  assegnatoAt: string | null;
  documenti: { lettera: Documento; informativaIa: Documento; informativaPrivacy: Documento } | null;
  impronta: string | null;
  firmatoAt: string | null;
  accettatoAt: string | null;
  adeguataVerificaAt: string | null;
  chiusoAt: string | null;
  motivoChiusura: string;
};

export type PraticaDto = {
  id: string;
  anno: number;
  stato: StatoPratica;
  etichetta: string;
  chiusuraVersione: number;
  chiusuraImpronta: string;
  osservazioni: string;
  bozza: { nome: string | null; impronta: string | null } | null;
  approvataAt: string | null;
  confermataAt: string | null;
  protocollo: string | null;
  inviataAt: string | null;
  ricevuta: { nome: string | null } | null;
  esito: "accolta" | "scartata" | null;
  esitoAt: string | null;
  differenza: string | null;
  azioni: AzionePratica[];
};

export type SchedaProfessionistaDto = {
  id: string;
  nome: string;
  qualifica: string;
  studio: string;
  pec: string;
  polizza: { compagnia: string; numero: string; massimaleCents: number; scadenza: string | null };
};

export type EventoDto = { id: string; tipo: string; etichetta: string; attore: "cliente" | "professionista" | "prevai" | "sistema"; dettagli: Record<string, unknown>; at: string };
export type MessaggioDto = { id: string; autore: "cliente" | "professionista"; testo: string; lettoAt: string | null; createdAt: string };

export type RispostaServizioCliente = {
  anno: number;
  servizio: { stato: StatoOfferta; modello: ModelloServizio | null; assegnazioneAutomatica: boolean };
  incarico: IncaricoDto | null;
  professionista: SchedaProfessionistaDto | null;
  pratica: PraticaDto | null;
  eventi: EventoDto[];
  twoFactorEnabled: boolean;
};

export const clienteApi = {
  stato: (anno: number) => req<RispostaServizioCliente>(`/api/fiscale/commercialista?anno=${anno}`),
  richiedi: (anno: number) => req<{ incarico: IncaricoDto }>("/api/fiscale/commercialista/richiesta", { method: "POST", json: { anno } }),
  firma: (id: string, impronta: string, informativaIa: boolean, informativaPrivacy: boolean) =>
    req<{ incarico: IncaricoDto }>(`/api/fiscale/commercialista/incarichi/${id}/firma`, { method: "POST", json: { impronta, informativaIa, informativaPrivacy } }),
  revoca: (id: string, motivo: string) => req<{ incarico: IncaricoDto }>(`/api/fiscale/commercialista/incarichi/${id}/revoca`, { method: "POST", json: { motivo } }),
  consegna: (id: string) => req<{ pratica: PraticaDto }>(`/api/fiscale/commercialista/incarichi/${id}/consegna`, { method: "POST", json: {} }),
  conferma: (id: string, bozzaImpronta: string) => req<{ pratica: PraticaDto }>(`/api/fiscale/commercialista/incarichi/${id}/conferma`, { method: "POST", json: { bozzaImpronta } }),
  urlFile: (id: string, tipo: "bozza" | "ricevuta") => `/api/fiscale/commercialista/incarichi/${id}/file/${tipo}`,
  messaggi: (id: string) => req<{ messaggi: MessaggioDto[] }>(`/api/fiscale/commercialista/incarichi/${id}/messaggi`),
  scrivi: (id: string, testo: string) => req<{ messaggio: MessaggioDto }>(`/api/fiscale/commercialista/incarichi/${id}/messaggi`, { method: "POST", json: { testo } }),
};

// ── Studio ───────────────────────────────────────────────────────────────────

export type ProfessionistaDto = {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  sezioneAlbo: "A" | "B";
  ordine: string;
  numeroAlbo: string;
  pec: string;
  studio: string;
  indirizzoStudio: string;
  provincia: string | null;
  abilitatoEntratel: boolean;
  rcCompagnia: string;
  rcNumeroPolizza: string;
  rcMassimaleCents: number;
  rcScadenza: string | null;
  rcVerificataAt: string | null;
  rcGiorniAllaScadenza: number | null;
  altriStrumentiIa: string;
  capienza: number;
  stato: "candidato" | "verificato" | "sospeso" | "cessato";
  verificatoAt: string | null;
  noteVerifica: string;
  motivoSospensione: string;
  compensoPraticaCents: number | null;
  convenzione: { firmataAt: string | null; versione: string | null; impronta: string | null; cessataAt: string | null };
  operativo: boolean;
  motivi: string[];
};

export type ProfiloStudioDto = {
  twoFactorEnabled: boolean;
  professionista: ProfessionistaDto | null;
  convenzione: { documento: Documento; impronta: string } | null;
  sezioniAlbo: Record<"A" | "B", string>;
  servizio: { stato: StatoOfferta; modello: ModelloServizio | null };
};

export type CandidaturaInput = {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  sezioneAlbo: "A" | "B";
  ordine: string;
  numeroAlbo: string;
  pec: string;
  studio: string;
  indirizzoStudio: string;
  provincia: string | null;
  abilitatoEntratel: boolean;
  rcCompagnia: string;
  rcNumeroPolizza: string;
  rcMassimaleCents: number;
  rcScadenza: string;
  altriStrumentiIa: string;
};

export type VoceIncaricoStudio = {
  id: string;
  anno: number;
  stato: StatoIncarico;
  etichetta: string;
  azienda: string;
  pratica: { stato: StatoPratica; etichetta: string } | null;
  messaggiNonLetti: number;
  aggiornatoAt: string;
};

export type CompensoDto = {
  id: string;
  professionista: string;
  anno: number;
  importoCents: number;
  stato: "maturato" | "fatturato" | "pagato";
  maturatoAt: string;
  fatturaNumero: string | null;
  fatturatoAt: string | null;
  pagatoAt: string | null;
};

export type PacchettoStudioDto = {
  pacchetto: PacchettoDto;
  voci: VocePrimaNotaDto[];
  chiusura: { chiusura: ChiusuraDto | null; chiudibile: boolean; differenze: { voce: string; alloraCents: number; oggiCents: number }[] };
  guida: PassoGuidaDto[];
};

export const studioApi = {
  profilo: () => req<ProfiloStudioDto>("/api/studio/profilo"),
  candidatura: (dati: CandidaturaInput) => req<{ professionista: ProfessionistaDto }>("/api/studio/candidatura", { method: "POST", json: dati }),
  firmaConvenzione: (impronta: string) => req<{ professionista: ProfessionistaDto }>("/api/studio/convenzione/firma", { method: "POST", json: { impronta } }),
  incarichi: () => req<{ incarichi: VoceIncaricoStudio[] }>("/api/studio/incarichi"),
  incarico: (id: string) => req<{ incarico: IncaricoDto; pratica: PraticaDto | null; eventi: EventoDto[] }>(`/api/studio/incarichi/${id}`),
  pacchetto: (id: string) => req<PacchettoStudioDto>(`/api/studio/incarichi/${id}/pacchetto`),
  urlPdf: (id: string) => `/api/studio/incarichi/${id}/pacchetto.pdf`,
  urlCsv: (id: string) => `/api/studio/incarichi/${id}/prima-nota.csv`,
  urlFile: (id: string, tipo: "bozza" | "ricevuta") => `/api/studio/incarichi/${id}/file/${tipo}`,
  accetta: (id: string) => req<{ incarico: IncaricoDto }>(`/api/studio/incarichi/${id}/accetta`, { method: "POST", json: { adeguataVerifica: true } }),
  chiudi: (id: string, tipo: "rifiuta" | "rinuncia", motivo: string) => req<{ incarico: IncaricoDto }>(`/api/studio/incarichi/${id}/${tipo}`, { method: "POST", json: { motivo } }),
  azione: (id: string, azione: AzionePratica, dati: { osservazioni?: string; protocollo?: string; file?: File }) => {
    if (dati.file) {
      const fd = new FormData();
      fd.append("file", dati.file);
      if (dati.osservazioni) fd.append("osservazioni", dati.osservazioni);
      return req<{ pratica: PraticaDto }>(`/api/studio/incarichi/${id}/pratica/${azione}`, { method: "POST", body: fd });
    }
    return req<{ pratica: PraticaDto }>(`/api/studio/incarichi/${id}/pratica/${azione}`, { method: "POST", json: { osservazioni: dati.osservazioni, protocollo: dati.protocollo } });
  },
  messaggi: (id: string) => req<{ messaggi: MessaggioDto[] }>(`/api/studio/incarichi/${id}/messaggi`),
  scrivi: (id: string, testo: string) => req<{ messaggio: MessaggioDto }>(`/api/studio/incarichi/${id}/messaggi`, { method: "POST", json: { testo } }),
  compensi: () => req<{ compensi: CompensoDto[] }>("/api/studio/compensi"),
};

// ── Staff PrevAI ─────────────────────────────────────────────────────────────

export type AdminCommercialistiDto = {
  servizio: { stato: StatoOfferta; modello: ModelloServizio | null; assegnazioneAutomatica: boolean; mancanti: { id: string; testo: string }[] };
  professionisti: (ProfessionistaDto & { carico: number })[];
  richieste: { id: string; anno: number; richiestoAt: string; azienda: string; provincia: string | null }[];
  compensi: CompensoDto[];
};

export const adminCommercialistiApi = {
  elenco: () => req<AdminCommercialistiDto>("/api/admin/commercialisti"),
  verifica: (id: string, dati: { note: string; rcVerificata: boolean; entratelVerificato: boolean; capienza?: number; compensoPraticaCents?: number | null }) =>
    req<{ professionista: ProfessionistaDto }>(`/api/admin/commercialisti/${id}/verifica`, { method: "POST", json: dati }),
  sospendi: (id: string, motivo: string, cessa: boolean) => req<{ professionista: ProfessionistaDto }>(`/api/admin/commercialisti/${id}/sospendi`, { method: "POST", json: { motivo, cessa } }),
  assegna: (incaricoId: string, professionistaId: string) => req<{ incarico: { id: string; stato: string } }>(`/api/admin/commercialisti/richieste/${incaricoId}/assegna`, { method: "POST", json: { professionistaId } }),
  compenso: (id: string, azione: "fatturato" | "pagato", fatturaNumero?: string) => req<{ ok: true }>(`/api/admin/commercialisti/compensi/${id}/${azione}`, { method: "POST", json: { fatturaNumero } }),
};
