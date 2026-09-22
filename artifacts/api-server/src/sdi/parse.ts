import type { TipoDocumento } from "@workspace/db";
import type { PassivaScaricata, RigaPassiva } from "./providers/types.js";

// ── A-1: lettura di una FatturaPA in arrivo ──────────────────────────────────
// Il ciclo passivo riceve XML scritti da gestionali altrui: a noi servono
// otto campi (fornitore, numero, data, imponibile, IVA, totale, righe) per
// generare un costo di cantiere. Un parser XML completo sarebbe una
// dipendenza in più per niente: il tracciato è piatto e senza ricorsione,
// quindi si estrae per tag, ignorando il prefisso di namespace.

const re = (nome: string, flag = "") => new RegExp(`<(?:[A-Za-z0-9_]+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${nome}>`, flag);

/** Contenuto del primo elemento `nome`, senza decodifica delle entità. */
export function blocco(xml: string, nome: string): string | null {
  return re(nome).exec(xml)?.[1] ?? null;
}

export function blocchi(xml: string, nome: string): string[] {
  return Array.from(xml.matchAll(re(nome, "g")), (m) => m[1]);
}

function decodifica(testo: string): string {
  return testo
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Testo del primo elemento `nome`, ripulito. */
export function testo(xml: string | null, nome: string): string | null {
  if (!xml) return null;
  const grezzo = blocco(xml, nome);
  return grezzo === null ? null : decodifica(grezzo) || null;
}

/** Importo `1234.56` → centesimi interi. */
export function centesimi(valore: string | null | undefined): number {
  if (!valore) return 0;
  const n = Number.parseFloat(valore.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function dataIso(valore: string | null): Date | null {
  if (!valore || !/^\d{4}-\d{2}-\d{2}/.test(valore)) return null;
  const d = new Date(`${valore.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type FatturaPaLetta = Omit<PassivaScaricata, "providerDocumentId" | "fileName" | "xml">;

/** Estrae dalla FatturaPA in arrivo i campi che servono alla prima nota. */
export function leggiFatturaPaXml(xml: string): FatturaPaLetta {
  const header = blocco(xml, "FatturaElettronicaHeader") ?? xml;
  const cedente = blocco(header, "CedentePrestatore") ?? "";
  const anagrafici = blocco(cedente, "DatiAnagrafici") ?? "";
  const anagrafica = blocco(anagrafici, "Anagrafica") ?? "";
  const idIva = blocco(anagrafici, "IdFiscaleIVA") ?? "";

  const denominazione = testo(anagrafica, "Denominazione");
  const nome = testo(anagrafica, "Nome");
  const cognome = testo(anagrafica, "Cognome");

  // Un file può contenere più corpi (lotto di fatture): prendiamo il primo,
  // che è il caso normale per un fornitore di materiali.
  const body = blocco(xml, "FatturaElettronicaBody") ?? xml;
  const generali = blocco(body, "DatiGeneraliDocumento") ?? "";
  const beni = blocco(body, "DatiBeniServizi") ?? body;

  const righe: RigaPassiva[] = blocchi(beni, "DettaglioLinee").map((r) => ({
    descrizione: testo(r, "Descrizione") ?? "",
    quantita: testo(r, "Quantita") ? Number.parseFloat((testo(r, "Quantita") ?? "0").replace(",", ".")) : null,
    prezzoUnitarioCents: testo(r, "PrezzoUnitario") ? centesimi(testo(r, "PrezzoUnitario")) : null,
    totaleCents: centesimi(testo(r, "PrezzoTotale")),
  }));

  const riepiloghi = blocchi(beni, "DatiRiepilogo");
  const imponibileCents = riepiloghi.reduce((s, r) => s + centesimi(testo(r, "ImponibileImporto")), 0);
  const ivaCents = riepiloghi.reduce((s, r) => s + centesimi(testo(r, "Imposta")), 0);
  const totaleDichiarato = centesimi(testo(generali, "ImportoTotaleDocumento"));

  return {
    fornitoreNome: denominazione ?? [nome, cognome].filter(Boolean).join(" ") ?? "",
    fornitorePartitaIva: testo(idIva, "IdCodice"),
    fornitoreCodiceFiscale: testo(anagrafici, "CodiceFiscale"),
    numero: testo(generali, "Numero") ?? "",
    data: dataIso(testo(generali, "Data")),
    tipoDocumento: ((testo(generali, "TipoDocumento") ?? "TD01") as TipoDocumento),
    imponibileCents,
    ivaCents,
    totaleCents: totaleDichiarato || imponibileCents + ivaCents,
    valuta: testo(generali, "Divisa") ?? "EUR",
    righe,
  };
}
