import { timingSafeEqual } from "node:crypto";
import { descrizioneErroreSdi, type StatoSdi, type TipoDocumento } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { leggiFatturaPaXml } from "../parse.js";
import { statoPerTipo } from "./simulato.js";
import { ErroreIntermediario, type Ambiente, type CredenzialiProvider, type EsitoInvio, type EventoSdi, type IntermediarioSdi, type PassivaScaricata } from "./types.js";

// ── A-1: intermediario Openapi.it ────────────────────────────────────────────
// Openapi è accreditata presso lo SdI e rivende la trasmissione a consumo
// (≈ 0,20 €/fattura a listino, ricezione gratuita): è la scelta predefinita
// del piano (AMMINISTRAZIONE-PLAN.md §4). Non si attiva da sola: senza
// contratto, DPA firmato e token nelle impostazioni, `configurato()` è falso
// e il servizio resta sul simulatore.
//
// ATTENZIONE (D8): rotte e nomi dei campi qui sotto vengono dalla
// documentazione pubblica (console.openapi.com/it/apis/sdi/documentation).
// Al momento dell'attivazione vanno riconfrontati con la documentazione del
// proprio account — per questo sono in un unico blocco e sovrascrivibili da
// env, senza toccare il resto del codice.

const BASE: Record<Ambiente, string> = {
  produzione: process.env.OPENAPI_SDI_BASE_URL ?? "https://sdi.openapi.it",
  sandbox: process.env.OPENAPI_SDI_SANDBOX_URL ?? "https://test.sdi.openapi.it",
};

const ROTTE = {
  /** Invio semplice / con firma e conservazione a norma. */
  invia: "/invoices",
  inviaConConservazione: "/invoices_signature_legal_storage",
  documento: (id: string) => `/invoices/${encodeURIComponent(id)}`,
  notifiche: (id: string) => `/invoices_notifications/${encodeURIComponent(id)}`,
  scarica: (id: string) => `/invoices_download/${encodeURIComponent(id)}`,
  passive: "/invoices",
} as const;

/**
 * Codice destinatario di Openapi: è quello che l'impresa registra nel portale
 * "Fatture e Corrispettivi" per ricevere le fatture di acquisto. Se il tuo
 * contratto ne assegna uno diverso, mettilo in `OPENAPI_SDI_CODICE_DESTINATARIO`.
 */
const CODICE_DESTINATARIO = process.env.OPENAPI_SDI_CODICE_DESTINATARIO ?? "JKKZDGR";

const TIMEOUT_MS = 20_000;

type Busta = { success?: boolean; message?: string; error?: unknown; data?: unknown };

/** Le API Openapi rispondono `{ success, message, data }`; `data` può essere oggetto o lista. */
function estraiDati(corpo: unknown): Record<string, unknown>[] {
  const busta = (corpo ?? {}) as Busta;
  const dati = busta.data ?? corpo;
  if (Array.isArray(dati)) return dati.filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null);
  if (dati && typeof dati === "object") return [dati as Record<string, unknown>];
  return [];
}

const stringa = (r: Record<string, unknown>, ...chiavi: string[]): string | null => {
  for (const k of chiavi) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};

/** Gli stati che Openapi usa sui documenti emessi, tradotti nei nostri. */
export function statoOpenapi(valore: string | null | undefined): StatoSdi | null {
  switch ((valore ?? "").toLowerCase()) {
    case "delivered":
    case "consegnata":
    case "done":
      return "consegnata";
    case "rejected":
    case "scartata":
    case "error":
      return "scartata";
    case "not_delivered":
    case "mancata_consegna":
      return "mancata_consegna";
    case "expired":
    case "decorrenza_termini":
      return "decorrenza_termini";
    case "accepted":
      return "accettata";
    case "refused":
      return "rifiutata";
    case "sent":
    case "received":
    case "pending":
      return "inviata";
    default:
      return null;
  }
}

export class IntermediarioOpenapi implements IntermediarioSdi {
  readonly nome = "openapi" as const;
  readonly ambiente: Ambiente;

  constructor(private readonly credenziali: CredenzialiProvider) {
    this.ambiente = credenziali.ambiente;
  }

  configurato(): boolean {
    return Boolean(this.credenziali.apiKey);
  }

  codiceDestinatarioRicezione(): string {
    return CODICE_DESTINATARIO;
  }

  private async chiamata(percorso: string, init: RequestInit & { corpoXml?: string } = {}): Promise<unknown> {
    if (!this.configurato()) throw new ErroreIntermediario("Intermediario Openapi non configurato: manca il token API.");
    const url = `${BASE[this.ambiente]}${percorso}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const risposta = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.credenziali.apiKey}`,
          Accept: "application/json",
          ...(init.corpoXml ? { "Content-Type": "application/xml" } : init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
        body: init.corpoXml ?? init.body,
      });
      const testo = await risposta.text();
      if (!risposta.ok) {
        throw new ErroreIntermediario(`Openapi ha risposto ${risposta.status} su ${percorso}`, risposta.status, testo.slice(0, 500));
      }
      try {
        return JSON.parse(testo) as unknown;
      } catch {
        return testo;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async invia(params: { fileName: string; xml: string; conservazione: boolean }): Promise<EsitoInvio> {
    const percorso = `${params.conservazione ? ROTTE.inviaConConservazione : ROTTE.invia}?filename=${encodeURIComponent(params.fileName)}`;
    const corpo = await this.chiamata(percorso, { method: "POST", corpoXml: params.xml });
    const [dati] = estraiDati(corpo);
    const providerDocumentId = dati ? stringa(dati, "uuid", "id", "invoice_uuid", "document_id") : null;
    if (!providerDocumentId) {
      throw new ErroreIntermediario("Openapi non ha restituito l'identificativo del documento.", undefined, JSON.stringify(corpo).slice(0, 500));
    }
    const stato = statoOpenapi(dati ? stringa(dati, "status", "state") : null) ?? "inviata";
    return {
      providerDocumentId,
      identificativoSdi: dati ? stringa(dati, "identificativo_sdi", "identificativoSdi", "sdi_id") : null,
      stato,
      messaggio: dati ? stringa(dati, "message") : null,
    };
  }

  async stato(providerDocumentId: string): Promise<{ stato: StatoSdi; eventi: EventoSdi[] }> {
    const [documento] = estraiDati(await this.chiamata(ROTTE.documento(providerDocumentId)));
    const notifiche = estraiDati(await this.chiamata(ROTTE.notifiche(providerDocumentId)).catch((err: unknown) => {
      logger.warn({ err, providerDocumentId }, "Notifiche SdI non leggibili");
      return {};
    }));
    const eventi = notifiche.map((n) => this.evento(n, providerDocumentId)).filter((e): e is EventoSdi => e !== null);
    const statoDocumento = statoOpenapi(documento ? stringa(documento, "status", "state") : null);
    const ultimo = eventi.filter((e) => e.stato !== null).at(-1)?.stato ?? null;
    return { stato: ultimo ?? statoDocumento ?? "inviata", eventi };
  }

  private evento(n: Record<string, unknown>, providerDocumentId: string | null): EventoSdi | null {
    const tipo = stringa(n, "type", "tipo", "notification_type", "event") ?? "EC";
    const codice = stringa(n, "error_code", "codice", "errorCode");
    const stato = statoPerTipo(tipo) ?? statoOpenapi(stringa(n, "status", "state"));
    return {
      tipo,
      stato,
      messaggio: stringa(n, "message", "description", "messaggio") ?? (codice ? descrizioneErroreSdi(codice) : ""),
      providerEventId: stringa(n, "uuid", "id", "notification_id"),
      providerDocumentId: stringa(n, "invoice_uuid", "invoice_id") ?? providerDocumentId,
      identificativoSdi: stringa(n, "identificativo_sdi", "sdi_id"),
      erroreCodice: codice,
      ricevutoAt: new Date(stringa(n, "created_at", "date", "timestamp") ?? Date.now()),
      payload: n,
    };
  }

  async scaricaPassive(params: { da?: Date | null }): Promise<PassivaScaricata[]> {
    const query = new URLSearchParams({ type: "supplier" });
    if (params.da) query.set("from", params.da.toISOString().slice(0, 10));
    const documenti = estraiDati(await this.chiamata(`${ROTTE.passive}?${query.toString()}`));
    const passive: PassivaScaricata[] = [];
    for (const d of documenti) {
      const providerDocumentId = stringa(d, "uuid", "id");
      if (!providerDocumentId) continue;
      const fileName = stringa(d, "filename", "file_name") ?? `${providerDocumentId}.xml`;
      let xml: string | null = null;
      try {
        const scaricato = await this.chiamata(ROTTE.scarica(providerDocumentId));
        xml = typeof scaricato === "string" ? scaricato : (estraiDati(scaricato)[0]?.xml as string | undefined) ?? null;
      } catch (err) {
        logger.warn({ err, providerDocumentId }, "XML della fattura passiva non scaricabile");
      }
      if (xml) {
        passive.push({ ...leggiFatturaPaXml(xml), providerDocumentId, fileName, xml });
        continue;
      }
      // Senza XML si usa quello che il fornitore espone in JSON: meno campi, stesso documento.
      passive.push({
        providerDocumentId,
        fileName,
        xml: null,
        fornitoreNome: stringa(d, "supplier_name", "denominazione", "fornitore") ?? "",
        fornitorePartitaIva: stringa(d, "supplier_vat", "partita_iva"),
        fornitoreCodiceFiscale: stringa(d, "supplier_tax_code", "codice_fiscale"),
        numero: stringa(d, "number", "numero") ?? "",
        data: stringa(d, "date", "data") ? new Date(`${stringa(d, "date", "data")!.slice(0, 10)}T00:00:00Z`) : null,
        tipoDocumento: ((stringa(d, "document_type", "tipo_documento") ?? "TD01") as TipoDocumento),
        imponibileCents: Math.round(Number(d.taxable_amount ?? d.imponibile ?? 0) * 100),
        ivaCents: Math.round(Number(d.tax_amount ?? d.iva ?? 0) * 100),
        totaleCents: Math.round(Number(d.total_amount ?? d.totale ?? 0) * 100),
        valuta: stringa(d, "currency", "divisa") ?? "EUR",
        righe: [],
      });
    }
    return passive;
  }

  /**
   * Openapi non firma i callback: il segreto sta nell'URL registrato con
   * `POST /api_configurations` e la rotta webhook lo passa qui.
   */
  verificaWebhook(params: { segreto: string | null; intestazioni: Record<string, string | undefined> }): boolean {
    if (!params.segreto) return false;
    const fornito = params.intestazioni["x-sdi-secret"] ?? "";
    const atteso = Buffer.from(params.segreto);
    const dato = Buffer.from(fornito);
    return atteso.length === dato.length && timingSafeEqual(atteso, dato);
  }

  leggiWebhook(payload: unknown): EventoSdi[] {
    return estraiDati(payload)
      .map((n) => this.evento(n, stringa(n, "invoice_uuid", "invoice_id", "uuid")))
      .filter((e): e is EventoSdi => e !== null);
  }
}
