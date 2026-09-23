import { createHash } from "node:crypto";

// ── A-4: lettura dell'estratto conto ─────────────────────────────────────────
// Ogni banca italiana esporta il CSV a modo suo: punto e virgola o virgola,
// "Dare/Avere" o "Importo" con segno, "Data operazione" o "Data contabile",
// qualche riga di intestazione col saldo prima delle colonne, e spesso in
// Windows-1252 invece che in UTF-8. Qui non si prova a indovinare la banca: si
// cercano le colonne per nome, si legge solo ciò che si riconosce, e quello che
// non si capisce si scarta **dicendo perché**, invece di trasformarlo in un
// movimento plausibile.
//
// L'OFX è più semplice perché è uno standard: una transazione per blocco
// <STMTTRN>, con FITID che la identifica in modo stabile.
//
// Niente IA qui dentro. Un estratto conto si legge con regole scritte, e un
// importo letto male da un modello finirebbe in prima nota come vero.
//
// Modulo puro: nessun database, nessuna data di sistema.

export const MAX_MOVIMENTI = 5000;

export type MovimentoLetto = {
  /** `YYYY-MM-DD`. */
  data: string;
  dataValuta: string | null;
  /** Con segno: positivo = accredito, negativo = addebito. */
  importoCents: number;
  descrizione: string;
  controparte: string;
  riferimento: string;
};

export type RigaScartata = { riga: number; motivo: string; testo: string };

export type Lettura = {
  formato: "csv" | "ofx";
  movimenti: MovimentoLetto[];
  scartate: RigaScartata[];
  /** Colonna del file → campo riconosciuto: si mostra all'utente per dire come è stato letto. */
  colonne: Record<string, string>;
};

export class ErroreEstratto extends Error {
  constructor(
    readonly codice: string,
    message: string,
  ) {
    super(message);
  }
}

// ── Testo ────────────────────────────────────────────────────────────────────

/**
 * UTF-8 se è UTF-8 valido, altrimenti Windows-1252 — l'altra codifica che le
 * banche italiane usano davvero. Latin-1 puro sbaglierebbe il simbolo dell'euro.
 */
export function decodificaTesto(buffer: Buffer): string {
  let testo: string;
  try {
    testo = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    testo = decodificaCp1252(buffer);
  }
  return testo.replace(/^\uFEFF/, "");
}

/**
 * Windows-1252 a mano: il `TextDecoder` di Node senza ICU completo lo tratta
 * come Latin-1 e perde proprio la fascia 0x80\u20130x9F, dove stanno l'euro e le
 * virgolette tipografiche.
 */
const CP1252_ALTI = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

function decodificaCp1252(buffer: Buffer): string {
  let out = "";
  for (const byte of buffer) out += String.fromCharCode(byte >= 0x80 && byte <= 0x9f ? CP1252_ALTI[byte - 0x80]! : byte);
  return out;
}

function normalizzaIntestazione(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pulisci(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ── Numeri e date ────────────────────────────────────────────────────────────

/**
 * Importo in centesimi da una cella: `1.234,56`, `-1234,56`, `1,234.56`,
 * `€ 12,00`, `12,00-`, `(12,00)`. `null` se non è un numero.
 *
 * Il caso ambiguo è `1.234`: nei file italiani il punto separa le migliaia,
 * quindi vale 1234 e non 1,234. Con due decimali (`12.50`) è un decimale.
 */
export function leggiImporto(grezzo: string): number | null {
  let s = grezzo.replace(/[\s\u00A0]/g, "").replace(/€|EUR/gi, "");
  if (s === "") return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    negativo = !negativo;
    s = s.slice(0, -1);
  }
  if (!/^[0-9.,']+$/.test(s)) return null;
  s = s.replace(/'/g, "");

  const ultimaVirgola = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");
  let normalizzato: string;
  if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
    // Tutti e due: il separatore decimale è quello che viene dopo.
    normalizzato = ultimaVirgola > ultimoPunto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultimaVirgola >= 0) {
    if (s.indexOf(",") !== ultimaVirgola) return null; // due virgole senza punti: non è un importo
    normalizzato = s.replace(",", ".");
  } else if (ultimoPunto >= 0) {
    normalizzato = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
    if ((normalizzato.match(/\./g) ?? []).length > 1) return null;
  } else {
    normalizzato = s;
  }
  const valore = Number(normalizzato);
  if (!Number.isFinite(valore)) return null;
  const cents = Math.round(valore * 100);
  return negativo ? -cents : cents;
}

function isoValida(anno: number, mese: number, giorno: number): string | null {
  if (anno < 1990 || anno > 2100 || mese < 1 || mese > 12 || giorno < 1) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  if (d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null;
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/** `gg/mm/aaaa`, `gg-mm-aa`, `gg.mm.aaaa`, `aaaa-mm-gg`, `aaaammgg`. Il formato americano non esiste nei file italiani. */
export function leggiData(grezzo: string): string | null {
  const s = grezzo.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T].*)?$/.exec(s);
  if (m) {
    const anno = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return isoValida(anno, Number(m[2]), Number(m[1]));
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(s);
  if (m) return isoValida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return isoValida(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

// ── CSV ──────────────────────────────────────────────────────────────────────

function separatoreDi(righe: string[]): string {
  const candidati = [";", ",", "\t", "|"];
  let migliore = ";";
  let punteggio = -1;
  for (const sep of candidati) {
    // Il separatore giusto è quello che si ripete con lo stesso conteggio su
    // più righe: le righe di intestazione col saldo ne hanno meno, i
    // movimenti tutti uguali.
    const conteggi = righe.slice(0, 40).map((r) => dividi(r, sep).length).filter((n) => n > 1);
    if (conteggi.length === 0) continue;
    const frequenze = new Map<number, number>();
    for (const n of conteggi) frequenze.set(n, (frequenze.get(n) ?? 0) + 1);
    const [colonne, volte] = [...frequenze.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
    const p = volte * 100 + colonne;
    if (p > punteggio) {
      punteggio = p;
      migliore = sep;
    }
  }
  return migliore;
}

/** Una riga CSV con virgolette e separatore dentro le virgolette. */
export function dividi(riga: string, sep: string): string[] {
  const celle: string[] = [];
  let corrente = "";
  let inVirgolette = false;
  for (let i = 0; i < riga.length; i++) {
    const ch = riga[i]!;
    if (inVirgolette) {
      if (ch === '"') {
        if (riga[i + 1] === '"') {
          corrente += '"';
          i++;
        } else inVirgolette = false;
      } else corrente += ch;
    } else if (ch === '"' && corrente.trim() === "") {
      inVirgolette = true;
      corrente = "";
    } else if (ch === sep) {
      celle.push(corrente);
      corrente = "";
    } else corrente += ch;
  }
  celle.push(corrente);
  return celle.map((c) => c.trim());
}

type Campo = "data" | "dataValuta" | "descrizione" | "causale" | "importo" | "dare" | "avere" | "controparte" | "riferimento";

/** Nomi di colonna riconosciuti, già normalizzati (minuscolo, senza accenti né punteggiatura). */
const SINONIMI: Record<Campo, string[]> = {
  data: ["data", "data operazione", "data contabile", "data registrazione", "data movimento", "data op", "data contabilizzazione", "date", "booking date"],
  dataValuta: ["data valuta", "valuta data", "value date"],
  descrizione: ["descrizione", "descrizione operazione", "descrizione estesa", "dettagli", "dettaglio", "operazione", "motivo", "note", "description"],
  causale: ["causale", "causale abi", "tipo operazione", "causale descrizione"],
  importo: ["importo", "importo eur", "importo euro", "importo in euro", "ammontare", "amount", "importo operazione"],
  dare: ["dare", "uscite", "uscita", "addebiti", "addebito", "importo dare", "debit"],
  avere: ["avere", "entrate", "entrata", "accrediti", "accredito", "importo avere", "credit"],
  controparte: ["beneficiario", "ordinante", "controparte", "beneficiario ordinante", "ordinante beneficiario", "nome", "esercente"],
  riferimento: ["id operazione", "riferimento", "cro", "trn", "id transazione", "numero operazione"],
};

function riconosci(intestazione: string[]): Partial<Record<Campo, number>> {
  const trovati: Partial<Record<Campo, number>> = {};
  const norm = intestazione.map(normalizzaIntestazione);
  // Prima le corrispondenze esatte, poi quelle per prefisso: "Data valuta"
  // non deve finire nella colonna "data" solo perché inizia per "data".
  for (const esatta of [true, false]) {
    for (const campo of Object.keys(SINONIMI) as Campo[]) {
      if (trovati[campo] !== undefined) continue;
      const indice = norm.findIndex((n, i) => {
        if (Object.values(trovati).includes(i)) return false;
        return SINONIMI[campo].some((s) => (esatta ? n === s : n.startsWith(s + " ")));
      });
      if (indice >= 0) trovati[campo] = indice;
    }
  }
  return trovati;
}

function leggiCsv(testo: string): Lettura {
  const righe = testo.split(/\r\n|\n|\r/);
  const sep = separatoreDi(righe.filter((r) => r.trim() !== ""));

  let rigaIntestazione = -1;
  let campi: Partial<Record<Campo, number>> = {};
  for (let i = 0; i < Math.min(righe.length, 60); i++) {
    const celle = dividi(righe[i]!, sep);
    if (celle.length < 2) continue;
    const r = riconosci(celle);
    if (r.data !== undefined && (r.importo !== undefined || r.dare !== undefined || r.avere !== undefined)) {
      rigaIntestazione = i;
      campi = r;
      break;
    }
  }
  if (rigaIntestazione < 0) {
    throw new ErroreEstratto(
      "colonne_non_trovate",
      "Non trovo le colonne della data e dell'importo. Servono almeno una colonna «Data» (o «Data operazione») e una colonna «Importo» (o «Dare» e «Avere»).",
    );
  }

  const intestazione = dividi(righe[rigaIntestazione]!, sep);
  const colonne: Record<string, string> = {};
  for (const [campo, indice] of Object.entries(campi)) colonne[intestazione[indice as number] ?? String(indice)] = campo;

  const movimenti: MovimentoLetto[] = [];
  const scartate: RigaScartata[] = [];
  const cella = (celle: string[], campo: Campo) => (campi[campo] !== undefined ? (celle[campi[campo]!] ?? "") : "");

  for (let i = rigaIntestazione + 1; i < righe.length; i++) {
    const grezza = righe[i]!;
    if (grezza.trim() === "" || grezza.replaceAll(sep, "").trim() === "") continue;
    const celle = dividi(grezza, sep);
    const numero = i + 1;
    const testoRiga = grezza.slice(0, 160);

    const data = leggiData(cella(celle, "data"));
    if (!data) {
      // Le righe di saldo in fondo ("Saldo contabile al …") non hanno una
      // data nella colonna giusta: non sono movimenti, e va detto.
      scartate.push({ riga: numero, motivo: "Nessuna data leggibile: non sembra un movimento (saldo, totale o nota).", testo: testoRiga });
      continue;
    }

    let importo: number | null = null;
    if (campi.importo !== undefined) {
      importo = leggiImporto(cella(celle, "importo"));
    } else {
      const dare = leggiImporto(cella(celle, "dare"));
      const avere = leggiImporto(cella(celle, "avere"));
      if (dare !== null || avere !== null) importo = (avere !== null ? Math.abs(avere) : 0) - (dare !== null ? Math.abs(dare) : 0);
    }
    if (importo === null) {
      scartate.push({ riga: numero, motivo: "Importo non leggibile.", testo: testoRiga });
      continue;
    }
    if (importo === 0) {
      scartate.push({ riga: numero, motivo: "Importo zero.", testo: testoRiga });
      continue;
    }

    const causale = pulisci(cella(celle, "causale"));
    const descrizione = pulisci(cella(celle, "descrizione"));
    movimenti.push({
      data,
      dataValuta: leggiData(cella(celle, "dataValuta")),
      importoCents: importo,
      descrizione: [causale, descrizione].filter((x) => x !== "").join(" — ").slice(0, 500),
      controparte: pulisci(cella(celle, "controparte")).slice(0, 200),
      riferimento: pulisci(cella(celle, "riferimento")).slice(0, 100),
    });
    if (movimenti.length > MAX_MOVIMENTI) throw new ErroreEstratto("troppi_movimenti", `Il file ha più di ${MAX_MOVIMENTI} movimenti: dividilo per periodo.`);
  }

  return { formato: "csv", movimenti, scartate, colonne };
}

// ── OFX ──────────────────────────────────────────────────────────────────────

function campoOfx(blocco: string, tag: string): string {
  // SGML (OFX 1.x, senza tag di chiusura) e XML (OFX 2.x) insieme.
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(blocco);
  return m ? decodificaEntita(m[1]!.trim()) : "";
}

function decodificaEntita(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function leggiOfx(testo: string): Lettura {
  const blocchi = testo.split(/<STMTTRN>/i).slice(1);
  const movimenti: MovimentoLetto[] = [];
  const scartate: RigaScartata[] = [];
  blocchi.forEach((grezzo, i) => {
    const blocco = grezzo.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]!;
    const numero = i + 1;
    const data = leggiData(campoOfx(blocco, "DTPOSTED"));
    const importo = leggiImporto(campoOfx(blocco, "TRNAMT"));
    const testoRiga = pulisci(blocco).slice(0, 160);
    if (!data) {
      scartate.push({ riga: numero, motivo: "Transazione senza data (DTPOSTED).", testo: testoRiga });
      return;
    }
    if (importo === null || importo === 0) {
      scartate.push({ riga: numero, motivo: "Transazione senza importo (TRNAMT).", testo: testoRiga });
      return;
    }
    const nome = campoOfx(blocco, "NAME");
    const memo = campoOfx(blocco, "MEMO");
    movimenti.push({
      data,
      dataValuta: leggiData(campoOfx(blocco, "DTUSER")),
      importoCents: importo,
      descrizione: pulisci(memo || nome).slice(0, 500),
      controparte: pulisci(memo ? nome : "").slice(0, 200),
      riferimento: campoOfx(blocco, "FITID").slice(0, 100),
    });
  });
  if (movimenti.length > MAX_MOVIMENTI) throw new ErroreEstratto("troppi_movimenti", `Il file ha più di ${MAX_MOVIMENTI} movimenti: dividilo per periodo.`);
  return { formato: "ofx", movimenti, scartate, colonne: { STMTTRN: "movimenti", DTPOSTED: "data", TRNAMT: "importo", NAME: "controparte", MEMO: "descrizione", FITID: "riferimento" } };
}

// ── Ingresso ─────────────────────────────────────────────────────────────────

export function sembraOfx(testo: string): boolean {
  return /OFXHEADER|<OFX>/i.test(testo.slice(0, 2000));
}

export function leggiEstratto(testo: string): Lettura {
  if (testo.trim() === "") throw new ErroreEstratto("file_vuoto", "Il file è vuoto.");
  const lettura = sembraOfx(testo) ? leggiOfx(testo) : leggiCsv(testo);
  if (lettura.movimenti.length === 0) {
    throw new ErroreEstratto("nessun_movimento", "Ho letto il file ma non ho trovato nessun movimento con data e importo.");
  }
  return lettura;
}

/**
 * Impronta di un movimento, unica per impresa. Col FITID dell'OFX è stabile
 * per costruzione. Senza, vale data + importo + descrizione + **quante volte**
 * lo stesso terzetto compare prima nello stesso file: due bonifici identici lo
 * stesso giorno sono due movimenti, ma ricaricare lo stesso file non li
 * raddoppia.
 */
export function impronte(movimenti: readonly MovimentoLetto[]): string[] {
  const visti = new Map<string, number>();
  return movimenti.map((m) => {
    const base = m.riferimento
      ? `rif|${m.riferimento}|${m.data}|${m.importoCents}`
      : `mov|${m.data}|${m.importoCents}|${normalizzaIntestazione(m.descrizione)}`;
    const n = visti.get(base) ?? 0;
    visti.set(base, n + 1);
    return createHash("sha256").update(`${base}|${m.riferimento ? 0 : n}`).digest("hex");
  });
}
