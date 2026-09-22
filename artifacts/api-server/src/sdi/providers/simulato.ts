import { createHash } from "node:crypto";
import { descrizioneErroreSdi, type StatoSdi } from "@workspace/db";
import { leggiFatturaPaXml, blocco, testo } from "../parse.js";
import type { EsitoInvio, EventoSdi, IntermediarioSdi, PassivaScaricata, Ambiente } from "./types.js";

// ── A-1: intermediario finto ─────────────────────────────────────────────────
// Serve per sviluppo, staging ed e2e: si comporta come lo SdI senza mandare
// niente a nessuno. È anche il valore predefinito di `sdi_settings.provider`,
// così un'impresa che attiva il modulo per sbaglio non emette nulla di reale.
//
// L'esito lo decide il codice destinatario, in modo che i test possano
// chiedere esplicitamente uno scarto:
//   0000000 / qualunque → consegnata (RC)
//   SCARTO1             → scartata (NS 00305)
//   MANCATA             → mancata consegna (MC)

const ESITI: Record<string, { stato: StatoSdi; tipo: string; codice?: string }> = {
  SCARTO1: { stato: "scartata", tipo: "NS", codice: "00305" },
  MANCATA: { stato: "mancata_consegna", tipo: "MC" },
};

type DocumentoFinto = { fileName: string; xml: string; destinatario: string; inviatoAt: Date };

const documenti = new Map<string, DocumentoFinto>();
const passiveInCoda = new Map<string, { providerDocumentId: string; fileName: string; xml: string }[]>();

/** Mette in coda una fattura di acquisto finta: la usano gli e2e del ciclo passivo. */
export function accodaPassivaSimulata(userId: string, xml: string, fileName = "IT00000000000_SIM01.xml"): string {
  const providerDocumentId = `simp_${createHash("sha1").update(`${userId}:${fileName}:${xml.length}:${passiveInCoda.get(userId)?.length ?? 0}`).digest("hex").slice(0, 16)}`;
  const coda = passiveInCoda.get(userId) ?? [];
  coda.push({ providerDocumentId, fileName, xml });
  passiveInCoda.set(userId, coda);
  return providerDocumentId;
}

/** Svuota lo stato in memoria fra un test e l'altro. */
export function azzeraSimulatore(): void {
  documenti.clear();
  passiveInCoda.clear();
}

export class IntermediarioSimulato implements IntermediarioSdi {
  readonly nome = "simulato" as const;

  constructor(
    readonly ambiente: Ambiente = "sandbox",
    private readonly userId: string = "",
  ) {}

  configurato(): boolean {
    return true;
  }

  codiceDestinatarioRicezione(): string {
    return "SIMULA";
  }

  async invia(params: { fileName: string; xml: string; conservazione: boolean }): Promise<EsitoInvio> {
    const intestazione = blocco(params.xml, "DatiTrasmissione") ?? "";
    const destinatario = (testo(intestazione, "CodiceDestinatario") ?? "0000000").toUpperCase();
    const providerDocumentId = `sim_${createHash("sha1").update(params.fileName).digest("hex").slice(0, 16)}`;
    documenti.set(providerDocumentId, { fileName: params.fileName, xml: params.xml, destinatario, inviatoAt: new Date() });
    return { providerDocumentId, identificativoSdi: `SIM${providerDocumentId.slice(4, 12).toUpperCase()}`, stato: "inviata", messaggio: "Trasmissione simulata: nessun documento è stato inviato allo SdI." };
  }

  async stato(providerDocumentId: string): Promise<{ stato: StatoSdi; eventi: EventoSdi[] }> {
    const doc = documenti.get(providerDocumentId);
    if (!doc) return { stato: "inviata", eventi: [] };
    const esito = ESITI[doc.destinatario] ?? { stato: "consegnata" as StatoSdi, tipo: "RC" };
    const evento: EventoSdi = {
      tipo: esito.tipo,
      stato: esito.stato,
      messaggio: esito.codice ? descrizioneErroreSdi(esito.codice) : "Ricevuta di consegna simulata.",
      providerEventId: `${providerDocumentId}:${esito.tipo}`,
      providerDocumentId,
      erroreCodice: esito.codice ?? null,
      ricevutoAt: new Date(),
      payload: { simulato: true, destinatario: doc.destinatario },
    };
    return { stato: esito.stato, eventi: [evento] };
  }

  async scaricaPassive(): Promise<PassivaScaricata[]> {
    const coda = passiveInCoda.get(this.userId) ?? [];
    passiveInCoda.set(this.userId, []);
    return coda.map((p) => ({ ...leggiFatturaPaXml(p.xml), providerDocumentId: p.providerDocumentId, fileName: p.fileName, xml: p.xml }));
  }

  verificaWebhook(params: { segreto: string | null; intestazioni: Record<string, string | undefined> }): boolean {
    if (!params.segreto) return true;
    return params.intestazioni["x-sdi-secret"] === params.segreto;
  }

  leggiWebhook(payload: unknown): EventoSdi[] {
    const p = (payload ?? {}) as Record<string, unknown>;
    const providerDocumentId = typeof p.providerDocumentId === "string" ? p.providerDocumentId : null;
    const tipo = typeof p.tipo === "string" ? p.tipo : "RC";
    const codice = typeof p.codice === "string" ? p.codice : null;
    const stato = statoPerTipo(tipo);
    return [
      {
        tipo,
        stato,
        messaggio: typeof p.messaggio === "string" ? p.messaggio : codice ? descrizioneErroreSdi(codice) : "",
        providerEventId: typeof p.eventId === "string" ? p.eventId : providerDocumentId ? `${providerDocumentId}:${tipo}` : null,
        providerDocumentId,
        erroreCodice: codice,
        ricevutoAt: new Date(),
        payload: p,
      },
    ];
  }
}

/** Le sigle delle ricevute SdI, uguali per ogni intermediario. */
export function statoPerTipo(tipo: string): StatoSdi | null {
  switch (tipo.toUpperCase()) {
    case "RC":
      return "consegnata";
    case "NS":
      return "scartata";
    case "MC":
      return "mancata_consegna";
    case "DT":
      return "decorrenza_termini";
    case "NE":
      return null; // l'esito del committente PA arriva con un attributo separato
    case "AT":
    case "EC":
    default:
      return null;
  }
}
