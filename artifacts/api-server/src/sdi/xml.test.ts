// A-1: golden test del tracciato FatturaPA. Un documento scartato dallo SdI
// "non è emesso", quindi queste asserzioni valgono più di un test di unità
// qualunque: fissano l'ordine degli elementi, i decimali e le regole aliquota
// ↔ natura che generano i codici di scarto più frequenti.
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  validaPartitaIva,
  validaCodiceFiscale,
  codiceFiscaleCanonico,
  validaIban,
  validaCodiceDestinatario,
  progressivoInvio,
  nomeFileFattura,
  rigaIva,
} from "@workspace/db";
import { buildFatturaPaXml, testoXml, campo } from "./xml.js";
import { validaFatturaPa } from "./validate.js";
import { bolloDovutoCents, identificativiCliente, scomponiIndirizzo } from "./mapper.js";
import type { FatturaPaInput } from "./types.js";

/** Forfettario che fattura 1.000 € a un privato senza codice destinatario. */
function fatturaForfettaria(): FatturaPaInput {
  return {
    formatoTrasmissione: "FPR12",
    trasmittente: { paese: "IT", codice: "01234567897" },
    progressivoInvio: "2600001",
    codiceDestinatario: "0000000",
    pecDestinatario: "mario.rossi@pec.it",
    cedente: {
      partitaIva: "01234567897",
      paese: "IT",
      codiceFiscale: "01234567897",
      anagrafica: { denominazione: "Impianti Bianchi di Luca Bianchi" },
      regimeFiscale: "RF19",
      sede: { indirizzo: "Via Roma 12", cap: "20100", comune: "Milano", provincia: "MI", nazione: "IT" },
      rea: { ufficio: "MI", numero: "MI-1234567" },
      email: "info@impiantibianchi.it",
      telefono: "0212345678",
    },
    cessionario: {
      codiceFiscale: "RSSMRA80A01H501U",
      anagrafica: { nome: "Mario", cognome: "Rossi" },
      sede: { indirizzo: "Via Verdi 3", cap: "20121", comune: "Milano", provincia: "MI", nazione: "IT" },
    },
    tipoDocumento: "TD01",
    divisa: "EUR",
    data: "2026-09-01",
    numero: "PF-2026-0042",
    bolloVirtualeCents: 200,
    totaleDocumentoCents: 100_000,
    causale: ["Rifacimento impianto elettrico"],
    righe: [
      { numero: 1, descrizione: "Rifacimento impianto elettrico", quantita: 1, prezzoUnitarioCents: 100_000, prezzoTotaleCents: 100_000, aliquota: 0, natura: "N2.2" },
    ],
    riepilogo: [
      {
        aliquota: 0,
        natura: "N2.2",
        imponibileCents: 100_000,
        impostaCents: 0,
        esigibilita: "I",
        riferimentoNormativo: "Operazione non soggetta a IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014 — regime forfettario",
      },
    ],
    pagamento: { condizioni: "TP02", modalita: "MP05", scadenza: "2026-10-01", importoCents: 100_000, iban: "IT60X0542811101000000123456" },
  };
}

test("sdi/xml: fattura forfettaria a un privato", () => {
  const input = fatturaForfettaria();
  const xml = buildFatturaPaXml(input);

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><p:FatturaElettronica versione="FPR12"'));
  assert.ok(xml.includes("<ProgressivoInvio>2600001</ProgressivoInvio>"));
  assert.ok(xml.includes("<CodiceDestinatario>0000000</CodiceDestinatario>"));
  // La PEC si indica solo col codice a sette zeri.
  assert.ok(xml.includes("<PECDestinatario>mario.rossi@pec.it</PECDestinatario>"));
  assert.ok(xml.includes("<RegimeFiscale>RF19</RegimeFiscale>"));
  assert.ok(xml.includes("<Nome>Mario</Nome><Cognome>Rossi</Cognome>"));
  assert.ok(xml.includes("<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>"));
  assert.ok(xml.includes("<ImportoTotaleDocumento>1000.00</ImportoTotaleDocumento>"));
  assert.ok(xml.includes("<AliquotaIVA>0.00</AliquotaIVA><Natura>N2.2</Natura>"));
  assert.ok(xml.includes("<IBAN>IT60X0542811101000000123456</IBAN>"));

  // L'ordine degli elementi fa parte dello schema: invertirne due = scarto 00200.
  const ordine = ["<FatturaElettronicaHeader>", "<DatiTrasmissione>", "<CedentePrestatore>", "<CessionarioCommittente>", "<FatturaElettronicaBody>", "<DatiGenerali>", "<DatiBeniServizi>", "<DatiPagamento>"];
  let cursore = -1;
  for (const tag of ordine) {
    const pos = xml.indexOf(tag);
    assert.ok(pos > cursore, `${tag} fuori ordine`);
    cursore = pos;
  }
  // Dentro DatiGeneraliDocumento: TipoDocumento → Divisa → Data → Numero → DatiBollo → Totale → Causale.
  const testa = xml.slice(xml.indexOf("<DatiGeneraliDocumento>"), xml.indexOf("</DatiGeneraliDocumento>"));
  assert.ok(testa.indexOf("<Divisa>") < testa.indexOf("<Data>"));
  assert.ok(testa.indexOf("<Numero>") < testa.indexOf("<DatiBollo>"));
  assert.ok(testa.indexOf("<DatiBollo>") < testa.indexOf("<ImportoTotaleDocumento>"));
  assert.ok(testa.indexOf("<ImportoTotaleDocumento>") < testa.indexOf("<Causale>"));

  assert.equal(validaFatturaPa(input).ok, true);
});

test("sdi/xml: nota di credito con fattura collegata", () => {
  const base = fatturaForfettaria();
  const nc: FatturaPaInput = {
    ...base,
    tipoDocumento: "TD04",
    numero: "NC-2026-0003",
    progressivoInvio: "2600002",
    bolloVirtualeCents: 0,
    pagamento: null,
    fattureCollegate: [{ numero: "PF-2026-0042", data: "2026-09-01" }],
    righe: [{ numero: 1, descrizione: "Storno parziale", quantita: 1, prezzoUnitarioCents: 30_000, prezzoTotaleCents: 30_000, aliquota: 0, natura: "N2.2" }],
    riepilogo: [{ ...base.riepilogo[0], imponibileCents: 30_000 }],
    totaleDocumentoCents: 30_000,
  };
  const xml = buildFatturaPaXml(nc);
  assert.ok(xml.includes("<TipoDocumento>TD04</TipoDocumento>"));
  assert.ok(xml.includes("<DatiFattureCollegate><IdDocumento>PF-2026-0042</IdDocumento><Data>2026-09-01</Data></DatiFattureCollegate>"));
  // Il TD04 porta importi positivi: il segno è nel tipo documento.
  assert.ok(!xml.includes("-30000") && !xml.includes("<PrezzoTotale>-"));
  assert.ok(!xml.includes("<DatiPagamento>"));
  assert.equal(validaFatturaPa(nc).ok, true);
});

test("sdi/xml: escape e troncamento dei campi", () => {
  assert.equal(testoXml('Muratura "a vista" & <intonaco>'), "Muratura &quot;a vista&quot; &amp; &lt;intonaco&gt;");
  assert.equal(campo("x".repeat(120), 80).length, 80);
  // I caratteri di controllo (copia-incolla da PDF) non possono finire nell'XML.
  assert.equal(testoXml("Riga\u0007uno\nRiga due"), "Riga uno Riga due");

  const xml = buildFatturaPaXml({
    ...fatturaForfettaria(),
    righe: [{ numero: 1, descrizione: 'Posa "Klinker" & stucco <fugante>', quantita: 1, prezzoUnitarioCents: 100_000, prezzoTotaleCents: 100_000, aliquota: 0, natura: "N2.2" }],
  });
  assert.ok(xml.includes("<Descrizione>Posa &quot;Klinker&quot; &amp; stucco &lt;fugante&gt;</Descrizione>"));
});

test("sdi/validate: gli errori che lo SdI scarterebbe", () => {
  // Cliente senza P. IVA né C.F. → 00417.
  const senzaId = fatturaForfettaria();
  senzaId.cessionario = { ...senzaId.cessionario, codiceFiscale: null };
  assert.equal(validaFatturaPa(senzaId).errori.some((e) => e.codiceSdi === "00417"), true);

  // Aliquota 0 senza natura → 00411.
  const senzaNatura = fatturaForfettaria();
  senzaNatura.righe[0].natura = null;
  senzaNatura.riepilogo[0].natura = null;
  const esito = validaFatturaPa(senzaNatura);
  assert.equal(esito.ok, false);
  assert.equal(esito.errori.some((e) => e.codiceSdi === "00411"), true);

  // Forfettario che espone IVA → 00430.
  const conIva = fatturaForfettaria();
  conIva.righe[0] = { ...conIva.righe[0], aliquota: 22, natura: null };
  conIva.riepilogo[0] = { aliquota: 22, natura: null, imponibileCents: 100_000, impostaCents: 22_000, esigibilita: "I", riferimentoNormativo: null };
  conIva.totaleDocumentoCents = 122_000;
  assert.equal(validaFatturaPa(conIva).errori.some((e) => e.codiceSdi === "00430"), true);

  // Imposta che non torna con imponibile × aliquota → 00421.
  const impostaSbagliata = fatturaForfettaria();
  impostaSbagliata.cedente.regimeFiscale = "RF01";
  impostaSbagliata.righe[0] = { ...impostaSbagliata.righe[0], aliquota: 22, natura: null };
  impostaSbagliata.riepilogo[0] = { aliquota: 22, natura: null, imponibileCents: 100_000, impostaCents: 20_000, esigibilita: "I", riferimentoNormativo: null };
  impostaSbagliata.totaleDocumentoCents = 120_000;
  assert.equal(validaFatturaPa(impostaSbagliata).errori.some((e) => e.codiceSdi === "00421"), true);

  // Totale documento che non quadra → 00443.
  const totaleSbagliato = fatturaForfettaria();
  totaleSbagliato.totaleDocumentoCents = 90_000;
  assert.equal(validaFatturaPa(totaleSbagliato).errori.some((e) => e.codiceSdi === "00443"), true);

  // Data nel futuro → 00403.
  const futura = fatturaForfettaria();
  futura.data = "2099-01-01";
  assert.equal(validaFatturaPa(futura).errori.some((e) => e.codiceSdi === "00403"), true);

  // Codice ufficio PA di 6 caratteri su un tracciato privati → 00428.
  const pa = fatturaForfettaria();
  pa.codiceDestinatario = "UF1234";
  assert.equal(validaFatturaPa(pa).errori.some((e) => e.codiceSdi === "00428"), true);

  // Privato senza PEC: passa, ma con un avviso.
  const senzaPec = fatturaForfettaria();
  senzaPec.pecDestinatario = null;
  const esitoPec = validaFatturaPa(senzaPec);
  assert.equal(esitoPec.ok, true);
  assert.equal(esitoPec.avvisi.some((a) => a.campo === "cliente.codiceSdi"), true);
});

test("sdi/validate: ritenuta a garanzia come riga negativa", () => {
  // Un SAL con ritenuta: le righe devono sommare all'imponibile del riepilogo,
  // altrimenti è scarto 00420.
  const sal = fatturaForfettaria();
  sal.righe = [
    { numero: 1, descrizione: "SAL 1 — opere murarie", quantita: 1, prezzoUnitarioCents: 100_000, prezzoTotaleCents: 100_000, aliquota: 0, natura: "N2.2" },
    { numero: 2, descrizione: "Ritenuta a garanzia 10 %", quantita: 1, prezzoUnitarioCents: -10_000, prezzoTotaleCents: -10_000, aliquota: 0, natura: "N2.2" },
  ];
  sal.riepilogo[0].imponibileCents = 90_000;
  sal.totaleDocumentoCents = 90_000;
  sal.pagamento = { ...sal.pagamento!, importoCents: 90_000 };
  assert.equal(validaFatturaPa(sal).ok, true);

  // Senza la riga negativa il riepilogo non torna.
  const rotta = fatturaForfettaria();
  rotta.riepilogo[0].imponibileCents = 90_000;
  rotta.totaleDocumentoCents = 90_000;
  assert.equal(validaFatturaPa(rotta).errori.some((e) => e.codiceSdi === "00420"), true);
});

test("sdi: controlli formali su P. IVA, C.F., IBAN e codice destinatario", () => {
  assert.equal(validaPartitaIva("01234567897"), true);
  assert.equal(validaPartitaIva("IT 01234567897"), true);
  assert.equal(validaPartitaIva("01234567890"), false); // carattere di controllo sbagliato
  assert.equal(validaPartitaIva("123"), false);

  assert.equal(validaCodiceFiscale("RSSMRA80A01H501U"), true);
  assert.equal(validaCodiceFiscale("RSSMRA80A01H501A"), false);
  assert.equal(validaCodiceFiscale("01234567897"), true); // società: coincide con la P. IVA
  // Omocodia: le cifre sostituite da lettere tornano numeri nel confronto.
  assert.equal(codiceFiscaleCanonico("RSSMRAULALMHRLMU"), "RSSMRA80A01H501U");

  assert.equal(validaIban("IT60X0542811101000000123456"), true);
  assert.equal(validaIban("IT60X0542811101000000123457"), false);
  assert.equal(validaIban("IT60X05428111010000001234"), false); // lunghezza sbagliata

  assert.equal(validaCodiceDestinatario("0000000"), true);
  assert.equal(validaCodiceDestinatario("UF1234"), true); // PA
  assert.equal(validaCodiceDestinatario("ABC12"), false);

  assert.equal(progressivoInvio(2026, 42), "2600042");
  assert.equal(nomeFileFattura("IT", "01234567897", "2600042"), "IT01234567897_2600042.xml");
});

test("sdi/mapper: regime, bollo e anagrafiche", () => {
  // Nel forfettario ogni aliquota diventa N2.2, anche se il documento diceva 22 %.
  const forfettario = rigaIva("IVA22", "RF19");
  assert.equal(forfettario.aliquota, 0);
  assert.equal(forfettario.natura, "N2.2");
  assert.match(forfettario.riferimentoNormativo ?? "", /190\/2014/);

  // Fuori dal forfettario le aliquote restano quelle del documento.
  assert.equal(rigaIva("IVA10", "RF01").aliquota, 10);
  assert.equal(rigaIva("RC", "RF01").natura, "N6.7");
  assert.equal(rigaIva("SP", "RF01").esigibilita, "S");

  // Bollo: 2 € solo sui documenti senza IVA oltre 77,47 €.
  assert.equal(bolloDovutoCents(10_000, 0), 200);
  assert.equal(bolloDovutoCents(7_000, 0), 0);
  assert.equal(bolloDovutoCents(100_000, 22_000), 0);

  // Il businessNumber del cliente è P. IVA o C.F. a seconda di com'è fatto.
  const impresa = identificativiCliente({ name: "Edil Srl", businessNumber: "01234567897" });
  assert.equal(impresa.partitaIva, "01234567897");
  assert.equal(impresa.codiceFiscale, null);
  const privato = identificativiCliente({ name: "Mario Rossi", businessNumber: "RSSMRA80A01H501U" });
  assert.equal(privato.partitaIva, null);
  assert.equal(privato.codiceFiscale, "RSSMRA80A01H501U");

  // Indirizzo libero scomposto per la Sede.
  assert.deepEqual(scomponiIndirizzo("Via Roma 12, 20100 Milano (MI)"), { indirizzo: "Via Roma 12", cap: "20100", comune: "Milano", provincia: "MI" });
});
