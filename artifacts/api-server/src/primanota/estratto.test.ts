import { describe, expect, it } from "vitest";
import { decodificaTesto, dividi, impronte, leggiData, leggiEstratto, leggiImporto, ErroreEstratto } from "./estratto.js";

// ── A-4: lettura dell'estratto conto ─────────────────────────────────────────
// I file qui sotto imitano la forma degli export veri delle banche italiane
// (intestazione col saldo prima delle colonne, punto e virgola, Dare/Avere,
// virgola decimale, righe di saldo in fondo), non il contenuto.

describe("importi", () => {
  it.each([
    ["1.234,56", 123456],
    ["-1.234,56", -123456],
    ["1234,5", 123450],
    ["12,00-", -1200],
    ["(12,00)", -1200],
    ["€ 1.000,00", 100000],
    ["1,234.56", 123456],
    ["12.50", 1250],
    ["1.234", 123400],
    ["+45", 4500],
    ["  ", null],
    ["abc", null],
    ["1,2,3", null],
  ])("%s → %s", (grezzo, atteso) => {
    expect(leggiImporto(grezzo)).toBe(atteso);
  });
});

describe("date", () => {
  it.each([
    ["03/02/2026", "2026-02-03"],
    ["3-2-26", "2026-02-03"],
    ["03.02.2026", "2026-02-03"],
    ["2026-02-03", "2026-02-03"],
    ["20260203120000[+1:CET]", "2026-02-03"],
    ["31/02/2026", null],
    ["Saldo", null],
  ])("%s → %s", (grezzo, atteso) => {
    expect(leggiData(grezzo)).toBe(atteso);
  });
});

describe("CSV", () => {
  it("rispetta le virgolette col separatore dentro", () => {
    expect(dividi('03/02/2026;"Bonifico; rata 1";100,00', ";")).toEqual(["03/02/2026", "Bonifico; rata 1", "100,00"]);
    expect(dividi('a,"con ""virgolette""",b', ",")).toEqual(["a", 'con "virgolette"', "b"]);
  });

  it("legge Dare/Avere, salta l'intestazione col saldo e scarta le righe di saldo dicendo perché", () => {
    const csv = [
      "Conto corrente n. 000012345;;;;",
      "Saldo iniziale al 01/02/2026;;;;12.345,67",
      "",
      "Data contabile;Data valuta;Descrizione operazione;Dare;Avere",
      "03/02/2026;03/02/2026;BONIFICO DA ROSSI MARIO FATT. FT-2026-12;;1.220,00",
      "05/02/2026;04/02/2026;PAGAMENTO POS FERRAMENTA BIANCHI;85,40;",
      "16/02/2026;16/02/2026;DELEGA F24;1.130,34;",
      "28/02/2026;28/02/2026;COMMISSIONI TENUTA CONTO;3,50;",
      "Saldo finale al 28/02/2026;;;;12.346,43",
    ].join("\r\n");
    const l = leggiEstratto(csv);
    expect(l.formato).toBe("csv");
    expect(l.movimenti.map((m) => m.importoCents)).toEqual([122000, -8540, -113034, -350]);
    expect(l.movimenti[1]).toMatchObject({ data: "2026-02-05", dataValuta: "2026-02-04", descrizione: "PAGAMENTO POS FERRAMENTA BIANCHI" });
    expect(l.scartate).toHaveLength(1);
    expect(l.scartate[0]!.motivo).toContain("Nessuna data");
    expect(l.colonne).toMatchObject({ "Data contabile": "data", "Data valuta": "dataValuta", Dare: "dare", Avere: "avere" });
  });

  it("legge un'unica colonna Importo con segno, separatore virgola, causale e descrizione insieme", () => {
    const csv = [
      "Data operazione,Causale,Descrizione,Importo (EUR)",
      '10/03/2026,Bonifico,"Rossi, saldo lavori","2.500,00"',
      "11/03/2026,Addebito,Telepass,-42,60",
    ].join("\n");
    // "-42,60" senza virgolette in un CSV a virgola si spezza in due celle: la
    // riga ha un importo "-42" che va letto come tale. È il file a essere
    // ambiguo, e il test lo documenta invece di nasconderlo.
    const l = leggiEstratto(csv);
    expect(l.movimenti[0]).toMatchObject({ importoCents: 250000, descrizione: "Bonifico — Rossi, saldo lavori" });
    expect(l.movimenti[1]!.importoCents).toBe(-4200);
  });

  it("rifiuta un file senza colonne riconoscibili", () => {
    expect(() => leggiEstratto("nome;cognome\nMario;Rossi")).toThrowError(ErroreEstratto);
  });

  it("accetta Windows-1252 (il simbolo dell'euro è il byte 0x80)", () => {
    const buf = Buffer.from([0x44, 0x61, 0x74, 0x61, 0x3b, 0x49, 0x6d, 0x70, 0x6f, 0x72, 0x74, 0x6f, 0x0a, 0x30, 0x31, 0x2f, 0x30, 0x31, 0x2f, 0x32, 0x30, 0x32, 0x36, 0x3b, 0x80, 0x20, 0x35, 0x2c, 0x30, 0x30]);
    const testo = decodificaTesto(buf);
    expect(testo).toContain("€");
    expect(leggiEstratto(testo).movimenti[0]!.importoCents).toBe(500);
  });
});

describe("OFX", () => {
  it("legge OFX 1.x in SGML, senza tag di chiusura", () => {
    const ofx = [
      "OFXHEADER:100",
      "DATA:OFXSGML",
      "CHARSET:1252",
      "",
      "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>",
      "<STMTTRN>",
      "<TRNTYPE>CREDIT",
      "<DTPOSTED>20260403",
      "<TRNAMT>1500.00",
      "<FITID>A-001",
      "<NAME>VERDI SRL",
      "<MEMO>BONIFICO FT-2026-20 &amp; ACCONTO",
      "<STMTTRN>",
      "<TRNTYPE>DEBIT",
      "<DTPOSTED>20260405120000",
      "<TRNAMT>-19.90",
      "<FITID>A-002",
      "<NAME>CANONE CONTO",
      "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
    ].join("\n");
    const l = leggiEstratto(ofx);
    expect(l.formato).toBe("ofx");
    expect(l.movimenti).toEqual([
      { data: "2026-04-03", dataValuta: null, importoCents: 150000, descrizione: "BONIFICO FT-2026-20 & ACCONTO", controparte: "VERDI SRL", riferimento: "A-001" },
      { data: "2026-04-05", dataValuta: null, importoCents: -1990, descrizione: "CANONE CONTO", controparte: "", riferimento: "A-002" },
    ]);
  });
});

describe("impronte", () => {
  const m = { data: "2026-02-03", dataValuta: null, importoCents: -350, descrizione: "COMMISSIONI", controparte: "", riferimento: "" };

  it("due movimenti identici nello stesso file restano due, ricaricare lo stesso file dà le stesse impronte", () => {
    const a = impronte([m, m]);
    expect(a[0]).not.toBe(a[1]);
    expect(impronte([m, m])).toEqual(a);
  });

  it("col riferimento della banca l'impronta non dipende dalla posizione", () => {
    const conRif = { ...m, riferimento: "X1" };
    expect(impronte([conRif])[0]).toBe(impronte([m, conRif])[1]);
  });
});
