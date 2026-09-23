// @workspace/config/commercialista — fase 2 del modulo Amministrazione (A-6):
// il commercialista iscritto all'Albo entra nel giro. PrevAI prepara i numeri,
// il professionista li rivede, il cliente conferma, il professionista invia la
// dichiarazione col proprio Entratel e ne risponde.
//
// La linea legale è quella di AMMINISTRAZIONE-PLAN §5: la dichiarazione la
// compila e la invia **solo** un iscritto all'Albo, con un incarico diretto del
// cliente e una propria polizza RC; la consulenza la dà solo lui; PrevAI vende
// il software e l'intermediazione. Tutto quello che qui sotto ha un effetto
// esterno (accettare un incarico, approvare, inviare) è un'azione del
// professionista, e l'invio richiede prima la conferma esplicita del cliente
// su quella versione esatta dei numeri.
//
// D9 (studio unico o rete di professionisti) decide soltanto **a chi** va un
// cliente che chiede il servizio. Finché è aperta, le richieste restano in
// coda e le assegna a mano l'amministrazione di PrevAI; il resto del flusso
// non cambia. Nome e prezzo del servizio sono ipotesi (D11): si fissano solo
// dopo una convenzione firmata con il compenso per pratica (§11 del piano).
//
// Funzioni pure, nessuna data di sistema letta di nascosto.

import { motoreRevisionato, regoleDiAnno } from "./fiscale/regole/index";
import { OFFERTA_AMMINISTRAZIONE, STATI_OFFERTA, type StatoOfferta } from "./offerta";
import { regioneDiProvincia } from "./province";

// ── Il servizio come prodotto ────────────────────────────────────────────────

/** D9: come si organizzano i professionisti. `null` finché il titolare non decide. */
export const MODELLI_SERVIZIO = ["studio_unico", "rete"] as const;
export type ModelloServizio = (typeof MODELLI_SERVIZIO)[number];

export const ETICHETTE_MODELLO: Record<ModelloServizio, string> = {
  studio_unico: "Un unico studio partner",
  rete: "Rete di professionisti convenzionati",
};

export const SERVIZIO_COMMERCIALISTA = {
  /** Id interno (feature, eventi): resta lo stesso se il nome commerciale cambia. */
  id: "commercialista",
  /** Ipotesi di lavoro (D11): nessuna schermata pubblica lo mostra finché l'offerta è in bozza. */
  nome: `${OFFERTA_AMMINISTRAZIONE.nome} + Commercialista`,
  statoRichiesto: "vendita" as StatoOfferta,
  decisioni: {
    /** D9: studio unico o rete. Finché è `null` nessuna assegnazione automatica. */
    D9: null as ModelloServizio | null,
    /** D11: prezzo al cliente e compenso per pratica confermati da una convenzione firmata. */
    D11: false,
  },
  /**
   * Prezzo ipotesi del piano (AMMINISTRAZIONE-PLAN §9.2), IVA inclusa: 39 €/mese
   * o 420 €/anno. Non è un prezzo in vendita: con D11 aperta l'offerta resta in
   * bozza e il prezzo non compare da nessuna parte.
   */
  prezzoIpotesi: { mensileCents: 3900, annualeCents: 42000 },
  /** Forbice del compenso per pratica da negoziare (80–150 € a dichiarazione forfettaria). */
  compensoPraticaIpotesi: { minCents: 8000, maxCents: 15000 },
  /** Tempo massimo promesso per una risposta in chat, in giorni lavorativi (clausola della convenzione). */
  rispostaGiorniLavorativi: 2,
} as const;

export type DecisioneServizio = "D6" | "D8" | "D9" | "D11";

export type PrerequisitoServizio = {
  id: DecisioneServizio | "professionisti";
  chiuso: boolean;
  testo: string;
  blocca: Exclude<StatoOfferta, "bozza">;
};

export type IngressoStatoServizio = {
  anno: number;
  /** Quanti professionisti oggi possono lavorare davvero (verificati, RC valida, convenzione firmata). */
  professionistiOperativi: number;
  statoRichiesto?: StatoOfferta;
  decisioni?: Partial<{ D8: boolean; D9: ModelloServizio | null; D11: boolean }>;
  motoreRevisionato?: boolean;
};

export type StatoServizioCalcolato = {
  richiesto: StatoOfferta;
  effettivo: StatoOfferta;
  modello: ModelloServizio | null;
  /** Le richieste dei clienti si assegnano da sole (D9 chiusa e almeno un professionista operativo). */
  assegnazioneAutomatica: boolean;
  prerequisiti: readonly PrerequisitoServizio[];
  mancanti: readonly PrerequisitoServizio[];
};

const ORDINE: Record<StatoOfferta, number> = { bozza: 0, interesse: 1, vendita: 2 };

/**
 * Lo stato del servizio si calcola come quello dell'add-on (A-5): per essere
 * mostrato servono il modello (D9), il prezzo (D11) e almeno un professionista
 * che possa lavorare; per essere venduto anche ciò che vende l'add-on (D6, D8),
 * perché il servizio lo contiene.
 */
export function statoServizio(ingresso: IngressoStatoServizio): StatoServizioCalcolato {
  const richiesto = ingresso.statoRichiesto ?? SERVIZIO_COMMERCIALISTA.statoRichiesto;
  const d9 = ingresso.decisioni && "D9" in ingresso.decisioni ? (ingresso.decisioni.D9 ?? null) : SERVIZIO_COMMERCIALISTA.decisioni.D9;
  const d11 = ingresso.decisioni?.D11 ?? SERVIZIO_COMMERCIALISTA.decisioni.D11;
  const d8 = ingresso.decisioni?.D8 ?? OFFERTA_AMMINISTRAZIONE.decisioni.D8;
  const d6 = ingresso.motoreRevisionato ?? motoreRevisionato(regoleDiAnno(ingresso.anno));
  const prerequisiti: PrerequisitoServizio[] = [
    { id: "D9", chiuso: d9 !== null, blocca: "interesse", testo: "Non è ancora deciso se lavorare con un unico studio o con una rete di professionisti (D9)." },
    { id: "D11", chiuso: d11, blocca: "interesse", testo: "Prezzo del servizio e compenso per pratica non ancora fissati da una convenzione firmata (D11)." },
    {
      id: "professionisti",
      chiuso: ingresso.professionistiOperativi > 0,
      blocca: "interesse",
      testo: "Nessun commercialista è ancora operativo (iscrizione verificata, polizza RC valida, convenzione firmata).",
    },
    { id: "D6", chiuso: d6, blocca: "vendita", testo: "Regole fiscali non ancora revisionate da un commercialista (D6)." },
    { id: "D8", chiuso: d8, blocca: "vendita", testo: "Contratto con l'intermediario SdI non ancora firmato (D8)." },
  ];
  const aperti = prerequisiti.filter((p) => !p.chiuso);
  let massimo: StatoOfferta = "vendita";
  for (const p of aperti) {
    const sotto = STATI_OFFERTA[ORDINE[p.blocca] - 1] ?? "bozza";
    if (ORDINE[sotto] < ORDINE[massimo]) massimo = sotto;
  }
  const effettivo = ORDINE[richiesto] <= ORDINE[massimo] ? richiesto : massimo;
  return {
    richiesto,
    effettivo,
    modello: d9,
    assegnazioneAutomatica: d9 !== null && ingresso.professionistiOperativi > 0,
    prerequisiti,
    mancanti: aperti,
  };
}

// ── Il professionista ────────────────────────────────────────────────────────

/**
 * Chi può inviare una dichiarazione per conto di altri: gli intermediari
 * abilitati dell'art. 3, comma 3, DPR 322/1998. Nel servizio entrano solo gli
 * iscritti all'Albo dei Dottori Commercialisti e degli Esperti Contabili
 * (D.Lgs. 139/2005), sezione A o B.
 */
export const SEZIONI_ALBO = {
  A: "Sezione A — Dottori commercialisti",
  B: "Sezione B — Esperti contabili",
} as const;
export type SezioneAlbo = keyof typeof SEZIONI_ALBO;

export const STATI_PROFESSIONISTA = ["candidato", "verificato", "sospeso", "cessato"] as const;
export type StatoProfessionista = (typeof STATI_PROFESSIONISTA)[number];

export type ProfessionistaPerOperativita = {
  stato: StatoProfessionista;
  abilitatoEntratel: boolean;
  rcVerificataAt: Date | null;
  rcScadenza: Date | null;
  convenzioneFirmataAt: Date | null;
  convenzioneCessataAt: Date | null;
};

export type Operativita = { operativo: boolean; motivi: string[] };

/**
 * Un professionista lavora (accetta incarichi, rivede, invia, risponde) solo
 * se tutto è in regola **adesso**: la polizza scaduta ieri lo ferma oggi,
 * senza bisogno che qualcuno se ne accorga (DPR 137/2012 art. 5).
 */
export function operativita(p: ProfessionistaPerOperativita, now: Date): Operativita {
  const motivi: string[] = [];
  if (p.stato !== "verificato") {
    motivi.push(
      p.stato === "candidato"
        ? "L'iscrizione all'Albo non è ancora stata verificata da PrevAI."
        : p.stato === "sospeso"
          ? "Il profilo è sospeso."
          : "Il rapporto con PrevAI è cessato.",
    );
  }
  if (!p.abilitatoEntratel) motivi.push("Manca l'abilitazione a Entratel come intermediario (art. 3, comma 3, DPR 322/1998).");
  if (!p.rcVerificataAt) motivi.push("La polizza di responsabilità civile professionale non è ancora stata verificata.");
  else if (!p.rcScadenza || p.rcScadenza.getTime() <= now.getTime()) motivi.push("La polizza di responsabilità civile professionale è scaduta.");
  if (!p.convenzioneFirmataAt || p.convenzioneCessataAt) motivi.push("La convenzione con PrevAI non è firmata o non è più in vigore.");
  return { operativo: motivi.length === 0, motivi };
}

/** Quanti giorni mancano alla scadenza della polizza (negativo se già scaduta). */
export function giorniAllaScadenzaRc(rcScadenza: Date | null, now: Date): number | null {
  if (!rcScadenza) return null;
  return Math.floor((rcScadenza.getTime() - now.getTime()) / 86_400_000);
}

// ── Assegnazione (D9) ────────────────────────────────────────────────────────

export type CandidatoAssegnazione = {
  id: string;
  operativo: boolean;
  /** Incarichi proposti o attivi in questo momento. */
  carico: number;
  capienza: number;
  /** Sigla della provincia dello studio: nella rete si preferisce la stessa regione del cliente. */
  provincia: string | null;
};

/**
 * Chi riceve un cliente. Con D9 aperta nessuno: la richiesta resta in coda e
 * l'assegna l'amministrazione. Con lo studio unico, il meno carico fra i suoi
 * professionisti. Con la rete, prima chi sta nella stessa regione del
 * cliente, poi il meno carico; mai oltre la capienza dichiarata.
 */
export function scegliProfessionista(
  candidati: readonly CandidatoAssegnazione[],
  modello: ModelloServizio | null,
  provinciaCliente: string | null,
): CandidatoAssegnazione | null {
  if (!modello) return null;
  const liberi = candidati.filter((c) => c.operativo && c.carico < c.capienza);
  if (liberi.length === 0) return null;
  const regione = regioneDiProvincia(provinciaCliente);
  const punteggio = (c: CandidatoAssegnazione) => {
    const vicino = modello === "rete" && regione !== null && regioneDiProvincia(c.provincia) === regione ? 0 : 1;
    return [vicino, c.carico / Math.max(1, c.capienza), c.carico, c.id] as const;
  };
  return [...liberi].sort((a, b) => {
    const pa = punteggio(a);
    const pb = punteggio(b);
    for (let i = 0; i < pa.length; i++) {
      if (pa[i]! < pb[i]!) return -1;
      if (pa[i]! > pb[i]!) return 1;
    }
    return 0;
  })[0]!;
}

// ── L'incarico ───────────────────────────────────────────────────────────────

export const STATI_INCARICO = ["da_assegnare", "proposto", "firmato_cliente", "attivo", "rifiutato", "revocato", "rinunciato", "concluso"] as const;
export type StatoIncarico = (typeof STATI_INCARICO)[number];

/** Stati in cui il professionista vede i dati del cliente. */
export const STATI_INCARICO_CON_ACCESSO: readonly StatoIncarico[] = ["attivo"];
/** Stati che occupano un posto nella capienza del professionista. */
export const STATI_INCARICO_IMPEGNATI: readonly StatoIncarico[] = ["proposto", "firmato_cliente", "attivo"];
export const STATI_INCARICO_CHIUSI: readonly StatoIncarico[] = ["rifiutato", "revocato", "rinunciato", "concluso"];

export const ETICHETTE_INCARICO: Record<StatoIncarico, string> = {
  da_assegnare: "In attesa di un professionista",
  proposto: "Da firmare",
  firmato_cliente: "Firmato, in attesa dell'accettazione del professionista",
  attivo: "Attivo",
  rifiutato: "Rifiutato dal professionista",
  revocato: "Revocato",
  rinunciato: "Il professionista ha rinunciato",
  concluso: "Concluso",
};

// ── La pratica: revisione → conferma → invio ─────────────────────────────────

export const STATI_PRATICA = [
  "da_revisionare",
  "in_revisione",
  "modifiche_richieste",
  "approvata",
  "confermata",
  "inviata",
  "conclusa",
] as const;
export type StatoPratica = (typeof STATI_PRATICA)[number];

export const ETICHETTE_PRATICA: Record<StatoPratica, string> = {
  da_revisionare: "Consegnata al professionista",
  in_revisione: "In revisione",
  modifiche_richieste: "Modifiche richieste",
  approvata: "Bozza pronta, da confermare",
  confermata: "Confermata, in attesa di invio",
  inviata: "Inviata all'Agenzia delle Entrate",
  conclusa: "Ricevuta acquisita",
};

export const AZIONI_PRATICA = [
  "consegna", // cliente: manda la chiusura d'anno al professionista
  "prendi_in_carico", // professionista
  "richiedi_modifiche", // professionista, con osservazioni
  "approva", // professionista, con la bozza della dichiarazione
  "conferma", // cliente, sulla bozza e sull'impronta esatte
  "segna_inviata", // professionista, con protocollo telematico
  "esito_accolta", // professionista, con la ricevuta
  "esito_scartata", // professionista, con la ricevuta di scarto
] as const;
export type AzionePratica = (typeof AZIONI_PRATICA)[number];

export type AttorePratica = "cliente" | "professionista";

const TRANSIZIONI: Record<AzionePratica, { attore: AttorePratica; da: readonly (StatoPratica | null)[]; a: StatoPratica }> = {
  // La consegna riparte anche da "modifiche richieste" (il cliente ha corretto e richiuso l'anno)
  // e da "approvata" (il cliente ha cambiato i numeri prima di confermare: la bozza non vale più).
  consegna: { attore: "cliente", da: [null, "modifiche_richieste", "approvata"], a: "da_revisionare" },
  prendi_in_carico: { attore: "professionista", da: ["da_revisionare"], a: "in_revisione" },
  richiedi_modifiche: { attore: "professionista", da: ["da_revisionare", "in_revisione", "approvata", "confermata"], a: "modifiche_richieste" },
  approva: { attore: "professionista", da: ["da_revisionare", "in_revisione"], a: "approvata" },
  conferma: { attore: "cliente", da: ["approvata"], a: "confermata" },
  segna_inviata: { attore: "professionista", da: ["confermata"], a: "inviata" },
  esito_accolta: { attore: "professionista", da: ["inviata"], a: "conclusa" },
  // Una dichiarazione scartata non è stata presentata: si torna alla revisione.
  esito_scartata: { attore: "professionista", da: ["inviata"], a: "in_revisione" },
};

export type EsitoTransizione = { ok: true; a: StatoPratica } | { ok: false; motivo: string };

export function transizionePratica(da: StatoPratica | null, azione: AzionePratica, attore: AttorePratica): EsitoTransizione {
  const t = TRANSIZIONI[azione];
  if (t.attore !== attore) {
    return { ok: false, motivo: attore === "cliente" ? "Questa azione spetta al professionista." : "Questa azione spetta al cliente." };
  }
  if (!t.da.includes(da)) {
    return { ok: false, motivo: `Non si può fare da qui: la pratica è "${da ? ETICHETTE_PRATICA[da] : "non ancora consegnata"}".` };
  }
  return { ok: true, a: t.a };
}

/** Le azioni che un attore può fare adesso, per disegnare i bottoni. */
export function azioniPossibili(da: StatoPratica | null, attore: AttorePratica): AzionePratica[] {
  return AZIONI_PRATICA.filter((a) => transizionePratica(da, a, attore).ok);
}

/**
 * Un protocollo telematico dell'Agenzia delle Entrate: lo si ricopia dalla
 * ricevuta di Entratel. Non si controlla il formato esatto (cambia fra
 * servizi), solo che sia un codice e non una frase.
 */
export function validaProtocolloTelematico(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return /^[0-9A-Za-z][0-9A-Za-z./-]{9,59}$/.test(v);
}

// ── I testi: convenzione, lettera d'incarico, informative ────────────────────
// Ognuno ha una versione. Quando cambia il testo cambia la versione, e ciò che
// ha firmato ciascuno resta salvato così com'era (con la sua impronta).

export const VERSIONE_CONVENZIONE = "2026-09-23";
export const VERSIONE_LETTERA_INCARICO = "2026-09-23";
export const VERSIONE_INFORMATIVA_IA = "2026-09-23";
export const VERSIONE_INFORMATIVA_PRIVACY_PROFESSIONISTA = "2026-09-23";

export type Sezione = { titolo: string; testo: string };
export type Documento = { tipo: "convenzione" | "lettera_incarico" | "informativa_ia" | "informativa_privacy"; versione: string; titolo: string; sezioni: Sezione[] };

export type DatiProfessionista = {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  sezioneAlbo: SezioneAlbo;
  ordine: string;
  numeroAlbo: string;
  pec: string;
  studio: string;
  indirizzoStudio: string;
  rcCompagnia: string;
  rcNumeroPolizza: string;
  rcMassimaleCents: number;
  rcScadenza: Date | null;
  /** Altri strumenti di IA che il professionista usa oltre a PrevAI (li dichiara lui). */
  altriStrumentiIa: string;
};

export type DatiCliente = {
  ragioneSociale: string;
  codiceFiscale: string;
  partitaIva: string;
  indirizzo: string;
  titolare: string;
};

const euroTesto = (cents: number) =>
  (cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const dataTesto = (d: Date | null) =>
  d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "—";

/**
 * Nome e cognome, senza titolo: "Dott." o "Dott.ssa" richiederebbe di
 * indovinare il genere dal nome, e l'iscrizione all'Albo dice già tutto.
 */
export function nomeProfessionista(p: Pick<DatiProfessionista, "nome" | "cognome">): string {
  return `${p.nome} ${p.cognome}`.trim();
}

/** Come il professionista si presenta al cliente: nome e iscrizione sempre visibili (AMMINISTRAZIONE-PLAN §5). */
export function qualificaProfessionista(p: Pick<DatiProfessionista, "sezioneAlbo" | "ordine" | "numeroAlbo">): string {
  return `iscrizione all'Albo dei Dottori Commercialisti e degli Esperti Contabili di ${p.ordine}, sezione ${p.sezioneAlbo}, n. ${p.numeroAlbo}`;
}

function polizzaTesto(p: DatiProfessionista): string {
  return `polizza n. ${p.rcNumeroPolizza} con ${p.rcCompagnia}, massimale ${euroTesto(p.rcMassimaleCents)}, in corso di validità fino al ${dataTesto(p.rcScadenza)}`;
}

/**
 * La convenzione PrevAI ↔ professionista. È la parte che D9 e D11 riempiono
 * davvero (compenso, modello): il testo qui è lo schema che il titolare porta
 * alla negoziazione, e che il professionista accetta in app solo quando il
 * compenso è stato fissato dall'amministrazione.
 */
export function testoConvenzione(p: DatiProfessionista, compensoPraticaCents: number, modello: ModelloServizio | null): Documento {
  return {
    tipo: "convenzione",
    versione: VERSIONE_CONVENZIONE,
    titolo: "Convenzione per il servizio di assistenza fiscale agli utenti PrevAI",
    sezioni: [
      {
        titolo: "1. Parti e oggetto",
        testo:
          `Tra PrevAI e ${nomeProfessionista(p)} (C.F. ${p.codiceFiscale}, P. IVA ${p.partitaIva}), ${qualificaProfessionista(p)}${p.studio ? `, che opera presso ${p.studio}` : ""}. ` +
          "Il professionista rende, in nome proprio e sotto la propria responsabilità, prestazioni professionali agli utenti PrevAI che gliele affidano con una lettera d'incarico: revisione dei dati, predisposizione e trasmissione telematica della dichiarazione dei redditi, consulenza. " +
          "PrevAI fornisce lo strumento e mette in contatto le parti; non rende prestazioni professionali e non interviene nel rapporto fra professionista e cliente." +
          (modello ? ` Modello del servizio: ${ETICHETTE_MODELLO[modello].toLowerCase()}.` : ""),
      },
      {
        titolo: "2. Requisiti del professionista",
        testo:
          "Il professionista dichiara e mantiene per tutta la durata: l'iscrizione all'Albo (D.Lgs. 139/2005) senza provvedimenti di sospensione; l'abilitazione a Entratel come intermediario (art. 3, comma 3, DPR 322/1998); una polizza di responsabilità civile professionale valida (art. 5 DPR 137/2012), di cui comunica ogni rinnovo. " +
          "Se uno di questi requisiti viene meno, PrevAI sospende l'accesso del professionista ai dati dei clienti finché non è ripristinato.",
      },
      {
        titolo: "3. Compenso",
        testo:
          `Per ogni dichiarazione trasmessa con esito positivo PrevAI riconosce al professionista ${euroTesto(compensoPraticaCents)} oltre IVA e contributo previdenziale se dovuti, a fronte di fattura del professionista a PrevAI. ` +
          "La consulenza in chat compresa nell'incarico è remunerata dallo stesso compenso. Il compenso matura alla ricevuta di accoglimento e si paga entro 30 giorni dalla fattura.",
      },
      {
        titolo: "4. Modalità di lavoro",
        testo:
          "Il professionista accetta un incarico solo dopo aver svolto l'adeguata verifica della clientela (D.Lgs. 231/2007) con i propri strumenti. Risponde in chat entro " +
          `${SERVIZIO_COMMERCIALISTA.rispostaGiorniLavorativi} giorni lavorativi. Non trasmette una dichiarazione prima che il cliente abbia confermato in app la bozza e i numeri esatti su cui si basa. ` +
          "Esegue personalmente l'incarico (art. 2232 c.c.) e non lo affida ad altri senza il consenso del cliente.",
      },
      {
        titolo: "5. Dati personali",
        testo:
          "Per i dati dei clienti che tratta per l'incarico il professionista è titolare autonomo del trattamento (artt. 4 e 24 GDPR): li riceve per istruzione del cliente, li usa solo per l'incarico e li conserva secondo i propri obblighi. " +
          "Non estrae né copia i dati fuori dagli strumenti necessari all'incarico. Ogni suo accesso in PrevAI è registrato e visibile al cliente.",
      },
      {
        titolo: "6. Intelligenza artificiale",
        testo:
          "Il professionista usa PrevAI come strumento di supporto e resta pienamente responsabile della prestazione (art. 13 L. 132/2025). Informa il cliente per iscritto degli strumenti di IA che usa: PrevAI gli fornisce il testo dell'informativa, che il cliente accetta insieme alla lettera d'incarico.",
      },
      {
        titolo: "7. Durata e recesso",
        testo:
          "La convenzione dura un anno e si rinnova tacitamente. Ciascuna parte può recedere con 60 giorni di preavviso; gli incarichi in corso si portano a termine o si trasferiscono con il consenso del cliente. " +
          "Il professionista può rinunciare a un singolo incarico per giusta causa (art. 2237 c.c.), avvisando il cliente in tempo utile per le scadenze.",
      },
    ],
  };
}

/** Il compenso e la complessità si dichiarano per iscritto al conferimento dell'incarico (art. 9, comma 4, DL 1/2012). */
export type DatiIncarico = { anno: number; compensoClienteTesto: string; dataProposta: Date };

export function letteraIncarico(p: DatiProfessionista, c: DatiCliente, i: DatiIncarico): Documento {
  return {
    tipo: "lettera_incarico",
    versione: VERSIONE_LETTERA_INCARICO,
    titolo: `Lettera d'incarico professionale — dichiarazione dei redditi ${i.anno + 1} (anno d'imposta ${i.anno})`,
    sezioni: [
      {
        titolo: "1. Parti",
        testo:
          `Cliente: ${c.ragioneSociale}${c.titolare ? `, nella persona di ${c.titolare}` : ""} (C.F. ${c.codiceFiscale || "—"}, P. IVA ${c.partitaIva || "—"}), ${c.indirizzo || "—"}. ` +
          `Professionista: ${nomeProfessionista(p)} (C.F. ${p.codiceFiscale}, P. IVA ${p.partitaIva}), ${qualificaProfessionista(p)}, PEC ${p.pec}${p.indirizzoStudio ? `, studio in ${p.indirizzoStudio}` : ""}.`,
      },
      {
        titolo: "2. Oggetto",
        testo:
          `Il cliente affida al professionista: (a) la revisione dei dati dell'anno d'imposta ${i.anno} preparati con PrevAI (ricavi incassati, contributi, acconti, prospetto dei quadri LM e RR); ` +
          `(b) la predisposizione del modello Redditi Persone Fisiche ${i.anno + 1} e la sua trasmissione telematica all'Agenzia delle Entrate come intermediario abilitato; ` +
          "(c) la consulenza sulle scelte fiscali e contributive legate all'attività, in chat. " +
          "Sono esclusi, salvo accordo scritto a parte: contenzioso tributario, dichiarazioni integrative per anni precedenti, dichiarazioni IVA, modelli 770 e CU, pratiche societarie.",
      },
      {
        titolo: "3. Complessità e modo di svolgimento",
        testo:
          "La pratica è di complessità ordinaria per un'impresa in regime forfettario. Il professionista svolge l'incarico personalmente, con la diligenza dell'art. 1176, secondo comma, c.c. " +
          "Il cliente fornisce dati completi e veritieri e ne risponde; il professionista non trasmette nulla prima che il cliente abbia confermato in PrevAI la bozza della dichiarazione e i numeri esatti su cui si basa.",
      },
      {
        titolo: "4. Compenso",
        testo:
          `${i.compensoClienteTesto} Nessun altro importo è dovuto al professionista per le attività elencate al punto 2. ` +
          "Le attività escluse, se richieste, sono oggetto di un preventivo scritto separato.",
      },
      {
        titolo: "5. Assicurazione",
        testo: `Il professionista è coperto da assicurazione di responsabilità civile professionale: ${polizzaTesto(p)} (art. 5 DPR 137/2012).`,
      },
      {
        titolo: "6. Antiriciclaggio",
        testo:
          "Il professionista è tenuto all'adeguata verifica della clientela (D.Lgs. 231/2007) e può chiedere al cliente documenti e informazioni a questo fine. Senza l'adeguata verifica l'incarico non può iniziare.",
      },
      {
        titolo: "7. Dati personali e uso dell'intelligenza artificiale",
        testo:
          "Il cliente autorizza PrevAI a mettere a disposizione del professionista, in sola lettura, i dati fiscali dell'anno indicato. Le informative sul trattamento dei dati da parte del professionista e sull'uso dell'intelligenza artificiale sono allegate a questa lettera e ne fanno parte.",
      },
      {
        titolo: "8. Durata, revoca e rinuncia",
        testo:
          "L'incarico termina con la ricevuta di accoglimento della dichiarazione. Il cliente può revocarlo in qualsiasi momento (art. 2237 c.c.): da quel momento il professionista non vede più i suoi dati. " +
          "Il professionista può rinunciare per giusta causa, in modo da non recare pregiudizio al cliente.",
      },
    ],
  };
}

export function informativaIa(p: DatiProfessionista): Documento {
  const altri = p.altriStrumentiIa.trim();
  return {
    tipo: "informativa_ia",
    versione: VERSIONE_INFORMATIVA_IA,
    titolo: "Informativa sull'uso di sistemi di intelligenza artificiale (art. 13 L. 132/2025)",
    sezioni: [
      {
        titolo: "Chi usa l'IA e perché",
        testo: `${nomeProfessionista(p)} usa strumenti informatici, alcuni dei quali basati su intelligenza artificiale, solo come supporto alla prestazione. Il lavoro intellettuale, le valutazioni e le scelte restano suoi, e ne risponde personalmente.`,
      },
      {
        titolo: "Quali strumenti",
        testo:
          "PrevAI: i calcoli di imposta e contributi sono fatti da un motore a regole scritte, non da un modello di IA, e ogni numero porta la sua formula. " +
          "Alcuni dati di partenza possono essere stati letti con l'IA (per esempio gli importi degli scontrini fotografati), e sono stati confermati dal cliente prima di entrare nei conti. " +
          "L'IA non decide nulla: non sceglie opzioni fiscali, non invia la dichiarazione e non risponde al posto del professionista nella chat." +
          (altri ? ` Altri strumenti usati dal professionista: ${altri}.` : " Il professionista dichiara di non usare altri strumenti di IA per questa prestazione."),
      },
      {
        titolo: "Controllo umano",
        testo:
          "Il professionista verifica i dati e i risultati prima di approvare la bozza, e la dichiarazione parte solo dopo la conferma del cliente. Il cliente può chiedere in qualsiasi momento come un numero è stato ottenuto.",
      },
    ],
  };
}

export function informativaPrivacyProfessionista(p: DatiProfessionista): Documento {
  return {
    tipo: "informativa_privacy",
    versione: VERSIONE_INFORMATIVA_PRIVACY_PROFESSIONISTA,
    titolo: "Informativa sul trattamento dei dati personali da parte del professionista (art. 13 GDPR)",
    sezioni: [
      {
        titolo: "Titolare",
        testo: `${nomeProfessionista(p)}, PEC ${p.pec}, è titolare autonomo del trattamento dei dati che riceve per l'incarico. PrevAI tratta gli stessi dati per conto del cliente, come responsabile (art. 28 GDPR), e non è contitolare dell'attività del professionista.`,
      },
      {
        titolo: "Dati, finalità e base giuridica",
        testo:
          "Dati anagrafici e fiscali dell'impresa e del titolare, ricavi, costi, versamenti, prospetti della dichiarazione e messaggi della chat. Finalità: eseguire l'incarico (art. 6.1.b GDPR) e adempiere agli obblighi di legge del professionista, fra cui antiriciclaggio e conservazione (art. 6.1.c GDPR).",
      },
      {
        titolo: "Conservazione e diritti",
        testo:
          "Il professionista conserva i dati per il tempo imposto dai suoi obblighi (di regola dieci anni per la documentazione fiscale e antiriciclaggio). Il cliente può esercitare i diritti degli artt. 15–22 GDPR scrivendo alla PEC del professionista, e proporre reclamo al Garante per la protezione dei dati personali.",
      },
    ],
  };
}

/** Tutto il documento in testo semplice: è ciò su cui si calcola l'impronta firmata. */
export function documentoInTesto(d: Documento): string {
  return [`${d.titolo} (versione ${d.versione})`, ...d.sezioni.map((s) => `${s.titolo}\n${s.testo}`)].join("\n\n");
}
