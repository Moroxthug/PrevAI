import {
  regimeSenzaIva,
  validaCap,
  validaCodiceDestinatario,
  validaCodiceFiscale,
  validaIban,
  validaPartitaIva,
  validaPec,
  isCodiceDestinatarioPa,
  CODICE_DESTINATARIO_PRIVATO,
  CODICE_DESTINATARIO_ESTERO,
} from "@workspace/db";
import { dataFattura } from "@workspace/config";
import type { FatturaPaInput, SedeFatturaPa } from "./types.js";

// ── A-1: controlli prima dell'invio ──────────────────────────────────────────
// Lo SdI scarta e basta: un documento scartato "non è emesso" e va corretto e
// rinviato entro 5 giorni. Meglio bloccare prima, in dashboard, con un
// messaggio che dice cosa manca e dove. Ogni controllo cita il codice di
// scarto che evita, così quando l'AdE cambia le regole si sa cosa aggiornare.

export type ProblemaFattura = {
  /** Percorso leggibile del campo: "cliente.codiceFiscale". */
  campo: string;
  messaggio: string;
  /** Codice di scarto SdI che questo controllo previene. */
  codiceSdi?: string;
};

export type EsitoValidazione = { ok: boolean; errori: ProblemaFattura[]; avvisi: ProblemaFattura[] };

const CENTESIMO = 1;

function controllaSede(prefisso: string, s: SedeFatturaPa, errori: ProblemaFattura[]): void {
  if (!s.indirizzo?.trim()) errori.push({ campo: `${prefisso}.indirizzo`, messaggio: "Manca l'indirizzo." });
  if (!s.comune?.trim()) errori.push({ campo: `${prefisso}.comune`, messaggio: "Manca il comune." });
  const estero = (s.nazione ?? "IT").toUpperCase() !== "IT";
  if (!estero && !validaCap(s.cap)) errori.push({ campo: `${prefisso}.cap`, messaggio: "Il CAP deve essere di 5 cifre." });
  if (!estero && s.provincia && !/^[A-Za-z]{2}$/.test(s.provincia)) {
    errori.push({ campo: `${prefisso}.provincia`, messaggio: "La provincia deve essere la sigla di due lettere (es. MI)." });
  }
  if (!/^[A-Za-z]{2}$/.test(s.nazione ?? "")) errori.push({ campo: `${prefisso}.nazione`, messaggio: "Manca la nazione (codice di due lettere)." });
}

export function validaFatturaPa(input: FatturaPaInput): EsitoValidazione {
  const errori: ProblemaFattura[] = [];
  const avvisi: ProblemaFattura[] = [];

  // ── Emittente ──────────────────────────────────────────────────────────────
  if (!validaPartitaIva(input.cedente.partitaIva)) {
    errori.push({ campo: "impresa.partitaIva", messaggio: "La partita IVA dell'impresa non è valida: controllala nel profilo aziendale.", codiceSdi: "00300" });
  }
  if (input.cedente.codiceFiscale && !validaCodiceFiscale(input.cedente.codiceFiscale)) {
    errori.push({ campo: "impresa.codiceFiscale", messaggio: "Il codice fiscale dell'impresa non è valido.", codiceSdi: "00301" });
  }
  if (!input.cedente.anagrafica.denominazione && !(input.cedente.anagrafica.nome && input.cedente.anagrafica.cognome)) {
    errori.push({ campo: "impresa.nome", messaggio: "Manca la ragione sociale dell'impresa." });
  }
  controllaSede("impresa.sede", input.cedente.sede, errori);
  if (!input.cedente.rea) {
    avvisi.push({ campo: "impresa.rea", messaggio: "Numero REA non indicato: non è obbligatorio in fattura, ma lo è sui documenti delle società iscritte al Registro Imprese." });
  }

  // ── Cliente ────────────────────────────────────────────────────────────────
  const haPiva = Boolean(input.cessionario.partitaIva);
  const haCf = Boolean(input.cessionario.codiceFiscale);
  if (!haPiva && !haCf) {
    errori.push({ campo: "cliente.codiceFiscale", messaggio: "Il cliente deve avere partita IVA (imprese) o codice fiscale (privati).", codiceSdi: "00417" });
  }
  if (haPiva && (input.cessionario.paese ?? "IT").toUpperCase() === "IT" && !validaPartitaIva(input.cessionario.partitaIva)) {
    errori.push({ campo: "cliente.partitaIva", messaggio: "La partita IVA del cliente non è valida.", codiceSdi: "00302" });
  }
  if (haCf && !validaCodiceFiscale(input.cessionario.codiceFiscale)) {
    errori.push({ campo: "cliente.codiceFiscale", messaggio: "Il codice fiscale del cliente non è valido.", codiceSdi: "00303" });
  }
  if (!input.cessionario.anagrafica.denominazione && !(input.cessionario.anagrafica.nome && input.cessionario.anagrafica.cognome)) {
    errori.push({ campo: "cliente.nome", messaggio: "Manca il nome o la ragione sociale del cliente." });
  }
  controllaSede("cliente.sede", input.cessionario.sede, errori);

  // ── Recapito elettronico ───────────────────────────────────────────────────
  const destinatario = (input.codiceDestinatario ?? "").toUpperCase();
  if (!validaCodiceDestinatario(destinatario)) {
    errori.push({ campo: "cliente.codiceSdi", messaggio: "Il codice destinatario deve avere 7 caratteri (6 per la Pubblica Amministrazione).", codiceSdi: "00306" });
  } else if (input.formatoTrasmissione === "FPA12" && !isCodiceDestinatarioPa(destinatario)) {
    errori.push({ campo: "cliente.codiceSdi", messaggio: "Una fattura verso la Pubblica Amministrazione richiede il codice ufficio IPA di 6 caratteri.", codiceSdi: "00428" });
  } else if (input.formatoTrasmissione === "FPR12" && isCodiceDestinatarioPa(destinatario)) {
    errori.push({ campo: "cliente.codiceSdi", messaggio: "Questo codice destinatario è di un ufficio pubblico: la fattura va emessa in formato FPA12.", codiceSdi: "00428" });
  }
  if (destinatario === CODICE_DESTINATARIO_PRIVATO) {
    if (input.pecDestinatario && !validaPec(input.pecDestinatario)) {
      errori.push({ campo: "cliente.pec", messaggio: "La PEC del cliente non è valida.", codiceSdi: "00313" });
    } else if (!input.pecDestinatario) {
      avvisi.push({
        campo: "cliente.codiceSdi",
        messaggio: "Senza codice destinatario né PEC la fattura è valida, ma il cliente la trova solo nel proprio cassetto fiscale: consegnagli anche la copia di cortesia in PDF.",
      });
    }
  }
  if (destinatario === CODICE_DESTINATARIO_ESTERO && (input.cessionario.sede.nazione ?? "IT").toUpperCase() === "IT") {
    errori.push({ campo: "cliente.codiceSdi", messaggio: "Il codice XXXXXXX vale solo per i clienti esteri.", codiceSdi: "00305" });
  }

  // ── Documento ──────────────────────────────────────────────────────────────
  if (!input.numero?.trim()) errori.push({ campo: "fattura.numero", messaggio: "Manca il numero della fattura." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    errori.push({ campo: "fattura.data", messaggio: "La data della fattura non è nel formato AAAA-MM-GG." });
    // "Oggi" va letto **in Italia**, con lo stesso fuso con cui `dataFattura()`
    // ha scritto la data: confrontarla con la data UTC dichiarava nel futuro
    // ogni fattura emessa fra la mezzanotte e le due del mattino italiane.
  } else if (input.data > dataFattura(new Date())) {
    errori.push({ campo: "fattura.data", messaggio: "La data della fattura non può essere nel futuro.", codiceSdi: "00403" });
  }
  if (input.tipoDocumento === "TD04" && (input.fattureCollegate ?? []).length === 0) {
    avvisi.push({ campo: "fattura.fattureCollegate", messaggio: "Una nota di credito dovrebbe indicare la fattura che corregge." });
  }
  if (input.righe.length === 0) errori.push({ campo: "fattura.righe", messaggio: "La fattura non ha righe." });

  // ── Righe ──────────────────────────────────────────────────────────────────
  const forfettario = regimeSenzaIva(input.cedente.regimeFiscale);
  for (const r of input.righe) {
    const dove = `fattura.righe[${r.numero}]`;
    if (!r.descrizione?.trim()) errori.push({ campo: `${dove}.descrizione`, messaggio: "Riga senza descrizione." });
    if (r.aliquota === 0 && !r.natura) {
      errori.push({ campo: `${dove}.natura`, messaggio: "Una riga con aliquota 0 deve indicare la natura dell'operazione.", codiceSdi: "00411" });
    }
    if (r.aliquota > 0 && r.natura) {
      errori.push({ campo: `${dove}.natura`, messaggio: "La natura si indica solo quando l'aliquota è 0.", codiceSdi: "00401" });
    }
    if (r.natura?.startsWith("N6") && r.aliquota !== 0) {
      errori.push({ campo: `${dove}.aliquota`, messaggio: "In inversione contabile l'aliquota deve essere 0.", codiceSdi: "00445" });
    }
    if (forfettario && r.aliquota !== 0) {
      errori.push({ campo: `${dove}.aliquota`, messaggio: "Nel regime forfettario non si può esporre l'IVA in fattura.", codiceSdi: "00430" });
    }
    if (r.quantita !== null && r.quantita !== undefined) {
      const atteso = Math.round(r.quantita * r.prezzoUnitarioCents);
      if (Math.abs(atteso - r.prezzoTotaleCents) > CENTESIMO) {
        errori.push({ campo: `${dove}.prezzoTotale`, messaggio: "Il totale della riga non corrisponde a quantità × prezzo unitario.", codiceSdi: "00423" });
      }
    }
  }

  // ── Riepilogo IVA ──────────────────────────────────────────────────────────
  const chiave = (aliquota: number, natura: string | null | undefined) => `${aliquota.toFixed(2)}|${natura ?? ""}`;
  const imponibiliRighe = new Map<string, number>();
  for (const r of input.righe) {
    const k = chiave(r.aliquota, r.natura);
    imponibiliRighe.set(k, (imponibiliRighe.get(k) ?? 0) + r.prezzoTotaleCents);
  }
  const chiaviRiepilogo = new Set(input.riepilogo.map((r) => chiave(r.aliquota, r.natura)));
  for (const k of imponibiliRighe.keys()) {
    if (!chiaviRiepilogo.has(k)) {
      errori.push({ campo: "fattura.riepilogo", messaggio: `Manca la riga di riepilogo per l'aliquota ${k.split("|")[0]} %.`, codiceSdi: "00419" });
    }
  }
  for (const r of input.riepilogo) {
    const k = chiave(r.aliquota, r.natura);
    const atteso = imponibiliRighe.get(k);
    if (atteso === undefined) {
      errori.push({ campo: "fattura.riepilogo", messaggio: `Riepilogo con aliquota ${r.aliquota} % che non corrisponde a nessuna riga.`, codiceSdi: "00420" });
    } else if (Math.abs(atteso - r.imponibileCents) > CENTESIMO) {
      errori.push({ campo: "fattura.riepilogo", messaggio: "L'imponibile del riepilogo non corrisponde alla somma delle righe.", codiceSdi: "00420" });
    }
    const impostaAttesa = Math.round((r.imponibileCents * r.aliquota) / 100);
    if (Math.abs(impostaAttesa - r.impostaCents) > CENTESIMO) {
      errori.push({ campo: "fattura.riepilogo", messaggio: "L'imposta non corrisponde a imponibile × aliquota.", codiceSdi: "00421" });
    }
    if (r.aliquota === 0 && !r.natura) {
      errori.push({ campo: "fattura.riepilogo", messaggio: "Riepilogo con aliquota 0 senza natura.", codiceSdi: "00411" });
    }
    if (r.aliquota === 0 && !r.riferimentoNormativo) {
      avvisi.push({ campo: "fattura.riepilogo", messaggio: "Manca il riferimento normativo per l'operazione senza IVA." });
    }
    if (r.esigibilita === "S" && r.aliquota === 0) {
      errori.push({ campo: "fattura.riepilogo", messaggio: "La scissione dei pagamenti presuppone un'IVA esposta.", codiceSdi: "00413" });
    }
  }

  // ── Totale documento ───────────────────────────────────────────────────────
  const totaleAtteso = input.riepilogo.reduce((s, r) => s + r.imponibileCents + r.impostaCents, 0);
  if (Math.abs(totaleAtteso - input.totaleDocumentoCents) > CENTESIMO) {
    errori.push({ campo: "fattura.totale", messaggio: "Il totale del documento non corrisponde alla somma di imponibili e imposte.", codiceSdi: "00443" });
  }

  // ── Pagamento ──────────────────────────────────────────────────────────────
  if (input.pagamento?.iban && !validaIban(input.pagamento.iban)) {
    errori.push({ campo: "impresa.iban", messaggio: "L'IBAN indicato per il pagamento non è valido." });
  }
  if (input.pagamento && Math.abs(input.pagamento.importoCents - input.totaleDocumentoCents) > CENTESIMO) {
    avvisi.push({ campo: "fattura.pagamento", messaggio: "L'importo da pagare non coincide col totale del documento." });
  }

  return { ok: errori.length === 0, errori, avvisi };
}
