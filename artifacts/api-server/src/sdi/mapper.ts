import {
  rigaIva,
  dataFattura,
  normalizzaPartitaIva,
  normalizzaCodiceFiscale,
  validaPartitaIva,
  validaCodiceFiscale,
  isCodiceDestinatarioPa,
  modalitaPagamentoPerMetodo,
  CODICE_DESTINATARIO_PRIVATO,
  BOLLO,
  type Invoice,
  type InvoiceParty,
  type BusinessProfile,
  type Client,
  type SdiSettings,
  type TipoDocumento,
  type Natura,
} from "@workspace/db";
import type { CessionarioFatturaPa, FatturaPaInput, FormatoTrasmissione, RigaFatturaPa, RiepilogoFatturaPa, SedeFatturaPa } from "./types.js";

// ── A-1: da fattura PrevAI a tracciato FatturaPA ─────────────────────────────
// La riga di `invoices` resta il documento; qui si traduce nel formato che lo
// SdI capisce. Due regole che non si vedono guardando il tracciato:
//
//  * la **ritenuta a garanzia** (v2 Phase 4) non esiste in FatturaPA come
//    concetto: l'imponibile del riepilogo deve tornare con la somma delle
//    righe, quindi la trattenuta diventa una riga negativa esplicita;
//  * una **nota di credito** in PrevAI ha importi negativi (così si applica
//    da sola alla fattura originale), mentre il TD04 vuole importi positivi:
//    il segno lo porta il tipo documento.

const BOLLO_SOGLIA_CENTS = Math.round(BOLLO.soglia * 100);
const BOLLO_IMPORTO_CENTS = Math.round(BOLLO.importo * 100);

/** Un indirizzo libero "Via Roma 12, 20100 Milano (MI)" scomposto alla meglio. */
export function scomponiIndirizzo(address: string | null | undefined): { indirizzo: string; cap: string | null; comune: string | null; provincia: string | null } {
  const testo = (address ?? "").replace(/\s+/g, " ").trim();
  if (!testo) return { indirizzo: "", cap: null, comune: null, provincia: null };
  const pezzi = testo.split(",").map((p) => p.trim()).filter(Boolean);
  const indirizzo = pezzi[0] ?? testo;
  const coda = pezzi.slice(1).join(" ");
  const cap = coda.match(/\b(\d{5})\b/)?.[1] ?? testo.match(/\b(\d{5})\b/)?.[1] ?? null;
  const provincia = coda.match(/\(([A-Za-z]{2})\)/)?.[1]?.toUpperCase() ?? null;
  const comune = coda
    .replace(/\b\d{5}\b/, "")
    .replace(/\([A-Za-z]{2}\)/, "")
    .replace(/\b(IT|Italia|Italy)\b/i, "")
    .replace(/\s+/g, " ")
    .trim() || null;
  return { indirizzo, cap, comune, provincia };
}

function sedeDa(party: Pick<InvoiceParty, "address" | "city" | "province" | "postalCode">, fallback?: { address?: string | null; city?: string | null; cap?: string | null; province?: string | null }): SedeFatturaPa {
  const sciolto = scomponiIndirizzo(party.address ?? fallback?.address);
  return {
    indirizzo: sciolto.indirizzo || (party.address ?? fallback?.address ?? ""),
    cap: (party.postalCode ?? fallback?.cap ?? sciolto.cap ?? "").trim(),
    comune: (party.city ?? fallback?.city ?? sciolto.comune ?? "").trim(),
    provincia: (party.province ?? fallback?.province ?? sciolto.provincia ?? "").trim().toUpperCase() || null,
    nazione: "IT",
  };
}

/** Il `businessNumber` del cliente può essere una P. IVA o un C.F.: qui si decide quale. */
export function identificativiCliente(party: InvoiceParty, client?: Client | null): { partitaIva: string | null; codiceFiscale: string | null } {
  const candidati = [party.businessNumber, client?.businessNumber, client?.codiceFiscale].filter((v): v is string => Boolean(v && v.trim()));
  let partitaIva: string | null = null;
  let codiceFiscale: string | null = null;
  for (const raw of candidati) {
    const piva = normalizzaPartitaIva(raw);
    const cf = normalizzaCodiceFiscale(raw);
    if (!partitaIva && /^\d{11}$/.test(piva) && validaPartitaIva(piva)) partitaIva = piva;
    else if (!codiceFiscale && cf.length === 16 && validaCodiceFiscale(cf)) codiceFiscale = cf;
    else if (!codiceFiscale && cf.length === 16) codiceFiscale = cf; // non valido: lo segnalerà la validazione
    else if (!partitaIva && /^\d{11}$/.test(piva)) partitaIva = piva;
  }
  return { partitaIva, codiceFiscale };
}

/** Nome e cognome di un privato; una ragione sociale resta intera. */
function anagraficaCliente(nome: string, haPartitaIva: boolean): { denominazione?: string; nome?: string; cognome?: string } {
  const pulito = nome.replace(/\s+/g, " ").trim();
  if (haPartitaIva) return { denominazione: pulito };
  const pezzi = pulito.split(" ");
  if (pezzi.length < 2) return { denominazione: pulito };
  return { nome: pezzi.slice(0, -1).join(" "), cognome: pezzi[pezzi.length - 1] };
}

export function tipoDocumentoPer(invoice: Pick<Invoice, "type">): TipoDocumento {
  return invoice.type === "credit_note" ? "TD04" : "TD01";
}

/** Il recapito elettronico congelato sulla fattura, con il cliente come riserva. */
export function recapitoElettronico(party: InvoiceParty, client?: Client | null): { codiceDestinatario: string; pec: string | null } {
  const codice = (party.codiceSdi ?? client?.codiceSdi ?? "").trim().toUpperCase();
  const pec = (party.pec ?? client?.pec ?? "").trim() || null;
  if (codice) return { codiceDestinatario: codice, pec: codice === CODICE_DESTINATARIO_PRIVATO ? pec : null };
  return { codiceDestinatario: CODICE_DESTINATARIO_PRIVATO, pec };
}

/**
 * Bollo virtuale: € 2 sui documenti **senza IVA** sopra € 77,47 (DPR 642/1972,
 * art. 13 della Tariffa). Non viene addebitato al cliente: l'impresa lo assolve
 * in modo virtuale e lo versa a trimestre con F24 (vedi `bollo.ts`).
 */
export function bolloDovutoCents(imponibileCents: number, impostaCents: number): number {
  if (impostaCents !== 0) return 0;
  return Math.abs(imponibileCents) > BOLLO_SOGLIA_CENTS ? BOLLO_IMPORTO_CENTS : 0;
}

export type MappaFatturaInput = {
  invoice: Invoice;
  profile: BusinessProfile | null | undefined;
  settings: Pick<SdiSettings, "regimeFiscale">;
  client?: Client | null;
  /** IBAN già decifrato (A-0): il mapper non tocca la cifratura. */
  iban?: string | null;
  /** Fattura corretta da una nota di credito. */
  fatturaOriginale?: Pick<Invoice, "number" | "issueDate"> | null;
  progressivoInvio: string;
};

export function mappaFattura(input: MappaFatturaInput): FatturaPaInput {
  const { invoice, profile, settings } = input;
  const regime = settings.regimeFiscale;
  const notaCredito = invoice.type === "credit_note";
  const segno = notaCredito ? -1 : 1;

  const contractor = invoice.contractor;
  const customer = invoice.customer;
  const partitaIvaCedente = normalizzaPartitaIva(contractor.vatNumber ?? profile?.vatNumber);
  const cfCedente = normalizzaCodiceFiscale(contractor.codiceFiscale ?? profile?.codiceFiscale) || null;

  const { codiceDestinatario, pec } = recapitoElettronico(customer, input.client);
  const formatoTrasmissione: FormatoTrasmissione = isCodiceDestinatarioPa(codiceDestinatario) ? "FPA12" : "FPR12";

  // ── Righe ────────────────────────────────────────────────────────────────
  const righe: RigaFatturaPa[] = invoice.lines.map((l, i) => {
    const totale = segno * l.amountCents;
    const unitario = segno * l.unitCents;
    const coerente = l.quantity > 0 && Math.abs(Math.round(l.quantity * unitario) - totale) <= 1;
    return {
      numero: i + 1,
      descrizione: l.description,
      quantita: coerente ? l.quantity : null,
      prezzoUnitarioCents: coerente ? unitario : totale,
      prezzoTotaleCents: totale,
      aliquota: 0,
      natura: null,
    };
  });
  if (invoice.holdbackCents > 0) {
    righe.push({
      numero: righe.length + 1,
      descrizione: `Ritenuta a garanzia ${invoice.holdbackPercent} % (art. 1666 c.c.) — svincolo a fine garanzia`,
      quantita: 1,
      prezzoUnitarioCents: -invoice.holdbackCents,
      prezzoTotaleCents: -invoice.holdbackCents,
      aliquota: 0,
      natura: null,
    });
  }

  // ── Riepilogo IVA ────────────────────────────────────────────────────────
  // PrevAI tiene un solo regime per documento: una riga di riepilogo, la cui
  // aliquota è quella davvero applicata (0 nel forfettario).
  const imponibileCents = segno * invoice.taxableCents;
  const riepilogo: RiepilogoFatturaPa[] = [];
  const righeImposta = invoice.taxLines.length > 0 ? invoice.taxLines : [{ code: "ESENTE", label: "IVA", rate: 0, amountCents: 0 }];
  for (const t of righeImposta) {
    const base = rigaIva(t.code, regime);
    // L'aliquota è quella davvero applicata al documento, **mai** riscritta: un
    // forfettario che ha esposto IVA per errore deve essere fermato dalla
    // validazione (scarto 00430), non ritrovarsi un XML con numeri diversi da
    // quelli che il cliente ha in mano.
    const aliquota = t.rate;
    const impostaCents = segno * t.amountCents;
    riepilogo.push({
      aliquota,
      natura: aliquota === 0 ? ((base.natura ?? "N2.2") as Natura) : null,
      imponibileCents,
      impostaCents,
      esigibilita: base.esigibilita,
      riferimentoNormativo: aliquota === 0 ? base.riferimentoNormativo : null,
    });
  }
  // L'aliquota delle righe segue il riepilogo: un solo regime per documento.
  const aliquotaDocumento = riepilogo[0]?.aliquota ?? 0;
  const naturaDocumento = riepilogo[0]?.natura ?? null;
  for (const r of righe) {
    r.aliquota = aliquotaDocumento;
    r.natura = aliquotaDocumento === 0 ? naturaDocumento : null;
  }

  const totaleDocumentoCents = riepilogo.reduce((s, r) => s + r.imponibileCents + r.impostaCents, 0);
  const impostaTotale = riepilogo.reduce((s, r) => s + r.impostaCents, 0);

  const causale: string[] = [];
  if (invoice.title) causale.push(invoice.title);
  if (invoice.siteAddress) causale.push(`Cantiere: ${invoice.siteAddress}`);
  if (invoice.paymentTermLabel) causale.push(invoice.paymentTermLabel);

  const scadenza = dataFattura(invoice.dueDate);

  return {
    formatoTrasmissione,
    trasmittente: { paese: "IT", codice: partitaIvaCedente },
    progressivoInvio: input.progressivoInvio,
    codiceDestinatario,
    pecDestinatario: pec,
    cedente: {
      partitaIva: partitaIvaCedente,
      paese: "IT",
      codiceFiscale: cfCedente,
      anagrafica: { denominazione: contractor.name || profile?.companyName || "" },
      regimeFiscale: regime,
      sede: sedeDa(
        { address: contractor.address, city: contractor.city, province: contractor.province, postalCode: contractor.postalCode },
        { address: profile?.address, city: profile?.city, cap: profile?.cap, province: profile?.province },
      ),
      rea: contractor.reaNumber ? { ufficio: (contractor.province ?? profile?.province ?? "").toUpperCase(), numero: contractor.reaNumber } : null,
      email: contractor.email ?? profile?.email ?? null,
      telefono: contractor.phone ?? profile?.phone ?? null,
    },
    cessionario: cessionarioDa(customer, input.client),
    tipoDocumento: tipoDocumentoPer(invoice),
    divisa: "EUR",
    data: dataFattura(invoice.issueDate),
    numero: invoice.number,
    bolloVirtualeCents: notaCredito ? 0 : bolloDovutoCents(imponibileCents, impostaTotale),
    totaleDocumentoCents,
    causale: causale.length > 0 ? causale : null,
    righe,
    riepilogo,
    pagamento: notaCredito
      ? null
      : {
          condizioni: "TP02",
          modalita: modalitaPagamentoPerMetodo("bank_transfer"),
          scadenza,
          importoCents: totaleDocumentoCents,
          iban: input.iban ?? invoice.paymentInstructions?.iban ?? null,
        },
    fattureCollegate: input.fatturaOriginale ? [{ numero: input.fatturaOriginale.number, data: dataFattura(input.fatturaOriginale.issueDate) }] : null,
    cig: customer.cig ?? input.client?.cig ?? null,
    cup: customer.cup ?? input.client?.cup ?? null,
  };
}

function cessionarioDa(customer: InvoiceParty, client?: Client | null): CessionarioFatturaPa {
  const { partitaIva, codiceFiscale } = identificativiCliente(customer, client);
  return {
    partitaIva,
    paese: partitaIva ? "IT" : null,
    codiceFiscale,
    anagrafica: anagraficaCliente(customer.name || client?.name || "", Boolean(partitaIva)),
    sede: sedeDa({ address: customer.address, city: customer.city, province: customer.province, postalCode: customer.postalCode }),
  };
}
