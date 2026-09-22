// A-1 — Fatture SDI (docs/AMMINISTRAZIONE-PLAN.md §8 modulo 1), la metà che
// gira davvero: il modulo è spento finché non lo si accende, la fattura
// diventa un documento fiscale solo quando la configurazione è completa,
// l'XML FatturaPA viene generato, validato e trasmesso una volta sola, lo
// scarto dello SdI si vede e si può rinviare, il bollo finisce nel trimestre
// giusto e il ciclo passivo non scarica niente senza adesione esplicita.
//
// L'intermediario è il provider `simulato`: nessuna fattura lascia la macchina.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, authUsersTable, businessProfilesTable, clientsTable, invoicesTable, eInvoicesTable, sdiSettingsTable, clientDedupKey } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupAll, type TestUser } from "./harness.js";
import { buildInvoiceContext, createInvoice } from "../invoices/service.js";
import { accodaPassivaSimulata, azzeraSimulatore } from "../sdi/providers/simulato.js";
import { impostazioniOCrea } from "../sdi/service.js";
import { buildFatturaPaXml } from "../sdi/xml.js";
import { leggiFatturaPaXml } from "../sdi/parse.js";

let org: TestUser;
let clientId: string;

/** Una fattura già inviata al cliente: è da lì che parte la trasmissione allo SdI. */
async function fatturaInviata(userId: string, importoCents: number, opts: { clientId?: string } = {}) {
  const ctx = await buildInvoiceContext({ userId, clientId: opts.clientId ?? clientId });
  const invoice = await createInvoice({
    userId,
    ctx,
    type: "manual",
    source: "manual",
    actor: "contractor",
    lines: [{ description: "Rifacimento impianto elettrico", quantity: 1, unitCents: importoCents, amountCents: importoCents }],
    dueDays: 30,
    title: "Lavori di impianto",
  });
  const [inviata] = await db.update(invoicesTable).set({ status: "sent", sentAt: new Date() }).where(eq(invoicesTable.id, invoice.id)).returning();
  return inviata!;
}

/** Porta la configurazione allo stato "attivo" (tutti i requisiti soddisfatti). */
async function attivaModulo(userId: string): Promise<void> {
  await db
    .update(businessProfilesTable)
    .set({
      featureFlags: { sdi_invoicing: true },
      twoFactorRequired: true,
      vatNumber: "01234567897",
      codiceFiscale: "01234567897",
      address: "Via Roma 12",
      city: "Milano",
      cap: "20100",
      province: "MI",
    })
    .where(eq(businessProfilesTable.userId, userId));
  // Il modulo pretende la 2FA di organizzazione (A-0): senza averla attivata,
  // requireAuth risponderebbe 403 a ogni chiamata successiva.
  await db.update(authUsersTable).set({ twoFactorEnabled: true }).where(eq(authUsersTable.id, userId));
  await impostazioniOCrea(userId);
  await db.update(sdiSettingsTable).set({ delegaFirmataAt: new Date(), regimeFiscale: "RF19" }).where(eq(sdiSettingsTable.userId, userId));
}

beforeAll(async () => {
  await startServer();
  azzeraSimulatore();
  org = await createOrg({ province: "MI", companyName: "E2E Impianti SdI Srl" });
  const [cliente] = await db
    .insert(clientsTable)
    .values({
      userId: org.userId,
      type: "individual",
      name: "Mario Rossi",
      email: `cliente-${org.userId}@example.invalid`,
      address: "Via Verdi 3",
      city: "Milano",
      province: "MI",
      postalCode: "20121",
      codiceFiscale: "RSSMRA80A01H501U",
      dedupKey: clientDedupKey({ name: "Mario Rossi", email: `cliente-${org.userId}@example.invalid` }),
    })
    .returning();
  clientId = cliente!.id;
});

afterAll(async () => {
  await cleanupAll();
  await stopServer();
  azzeraSimulatore();
});

describe("A-1: il modulo è spento finché non lo si accende", () => {
  test("le rotte SDI rispondono 403 e le fatture restano pro-forma", async () => {
    const settings = await org.api("/api/sdi/settings");
    expect(settings.status).toBe(403);
    expect(settings.body.error).toBe("SDI_MODULE_OFF");

    const fattura = await fatturaInviata(org.userId, 100_000);
    expect(fattura.fiscale).toBe(false);
    expect(fattura.number.startsWith("PF-")).toBe(true);

    const invio = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(invio.status).toBe(403);
  });
});

describe("A-1: configurazione e onboarding", () => {
  test("l'onboarding elenca cosa manca e il codice destinatario da registrare", async () => {
    await db.update(businessProfilesTable).set({ featureFlags: { sdi_invoicing: true } }).where(eq(businessProfilesTable.userId, org.userId));

    const prima = await org.api("/api/sdi/onboarding");
    expect(prima.status).toBe(200);
    expect(prima.body.stato).not.toBe("attivo");
    // Senza 2FA obbligatoria e senza delega il modulo non può essere attivo.
    const campi = prima.body.requisitiMancanti.map((r: { campo: string }) => r.campo);
    expect(campi).toContain("sdi.delega");
    expect(campi).toContain("profilo.twoFactorRequired");
    expect(prima.body.passi).toHaveLength(6);
    expect(prima.body.codiceDestinatarioIntermediario).toBeTruthy();

    await attivaModulo(org.userId);
    const dopo = await org.api("/api/sdi/settings");
    expect(dopo.status).toBe(200);
    expect(dopo.body.settings.stato).toBe("attivo");
    expect(dopo.body.settings.requisitiMancanti).toEqual([]);
  });

  test("le credenziali dell'intermediario entrano ma non escono", async () => {
    const patch = await org.api("/api/sdi/settings", { method: "PATCH", body: { provider: "openapi", providerApiKey: "tok_segretissimo_123" } });
    expect(patch.status).toBe(200);
    expect(patch.body.settings.credenzialiPresenti).toBe(true);
    expect(JSON.stringify(patch.body)).not.toContain("tok_segretissimo_123");

    const [riga] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, org.userId));
    expect(riga!.providerApiKey?.startsWith("enc1:")).toBe(true);

    // Senza credenziali valide il servizio ricade sul simulatore: si torna lì.
    await org.api("/api/sdi/settings", { method: "PATCH", body: { provider: "simulato" } });
  });

  test("un codice destinatario malformato viene rifiutato", async () => {
    const res = await org.api("/api/sdi/settings", { method: "PATCH", body: { codiceDestinatarioRicezione: "ABC" } });
    expect(res.status).toBe(400);
  });
});

describe("A-1: emissione", () => {
  test("con il modulo attivo la fattura nasce fiscale, in serie FT-", async () => {
    const fattura = await fatturaInviata(org.userId, 120_000);
    expect(fattura.fiscale).toBe(true);
    expect(fattura.number.startsWith("FT-")).toBe(true);
  });

  test("anteprima, invio, XML archiviato e seconda trasmissione rifiutata", async () => {
    const fattura = await fatturaInviata(org.userId, 100_000);

    const anteprima = await org.api(`/api/invoices/${fattura.id}/sdi/anteprima`);
    expect(anteprima.status).toBe(200);
    expect(anteprima.body.validazione.ok, JSON.stringify(anteprima.body.validazione)).toBe(true);
    expect(anteprima.body.xml).toContain("<RegimeFiscale>RF19</RegimeFiscale>");
    expect(anteprima.body.xml).toContain("<Natura>N2.2</Natura>");
    // Bollo: 1.000 € senza IVA → 2 €.
    expect(anteprima.body.bolloCents).toBe(200);

    const invio = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(invio.status).toBe(200);
    expect(invio.body.trasmissione.stato).toBe("inviata");
    expect(invio.body.trasmissione.fileName).toMatch(/^IT01234567897_\d{7}\.xml$/);

    const stato = await org.api(`/api/invoices/${fattura.id}/sdi`);
    expect(stato.status).toBe(200);
    expect(stato.body.corrente.progressivoInvio).toBe(invio.body.trasmissione.progressivoInvio);

    const xml = await org.api<string>(`/api/sdi/transmissions/${invio.body.trasmissione.id}/xml`);
    expect(xml.status).toBe(200);
    expect(String(xml.body)).toContain("<FatturaElettronicaHeader>");

    // Una fattura si trasmette una volta sola.
    const bis = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(bis.status).toBe(409);
    expect(bis.body.error).toBe("GIA_TRASMESSA");
  });

  test("i dati mancanti del cliente bloccano l'invio prima dello scarto", async () => {
    const [senzaId] = await db
      .insert(clientsTable)
      .values({
        userId: org.userId,
        type: "individual",
        name: "Cliente Senza Dati",
        address: "Via Ignota 1",
        city: "Milano",
        province: "MI",
        postalCode: "20100",
        dedupKey: clientDedupKey({ name: "Cliente Senza Dati" }),
      })
      .returning();
    const fattura = await fatturaInviata(org.userId, 50_000, { clientId: senzaId!.id });

    const res = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("NON_VALIDA");
    const codici = (res.body.dettagli ?? []).map((d: { codiceSdi?: string }) => d.codiceSdi);
    expect(codici).toContain("00417"); // cessionario senza P. IVA né C.F.

    // Nessuna trasmissione è stata registrata.
    const righe = await db.select().from(eInvoicesTable).where(eq(eInvoicesTable.invoiceId, fattura.id));
    expect(righe).toHaveLength(0);
  });

  test("uno scarto dello SdI si vede e la fattura si può rinviare", async () => {
    const [scarto] = await db
      .insert(clientsTable)
      .values({
        userId: org.userId,
        type: "business",
        name: "Edilizia Scarto Srl",
        address: "Via Test 9",
        city: "Milano",
        province: "MI",
        postalCode: "20100",
        businessNumber: "01234567897",
        codiceSdi: "SCARTO1", // il simulatore risponde NS 00305
        dedupKey: clientDedupKey({ name: "Edilizia Scarto Srl" }),
      })
      .returning();
    const fattura = await fatturaInviata(org.userId, 80_000, { clientId: scarto!.id });

    const invio = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(invio.status).toBe(200);

    const aggiornata = await org.api(`/api/sdi/transmissions/${invio.body.trasmissione.id}/aggiorna`, { method: "POST" });
    expect(aggiornata.status).toBe(200);
    expect(aggiornata.body.trasmissione.stato).toBe("scartata");
    expect(aggiornata.body.trasmissione.erroreCodice).toBe("00305");
    expect(aggiornata.body.trasmissione.erroreMessaggio).toMatch(/[Cc]odice destinatario/);

    // Dopo uno scarto il rinvio è permesso e crea una nuova trasmissione.
    const rinvio = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(rinvio.status).toBe(200);
    expect(rinvio.body.trasmissione.id).not.toBe(invio.body.trasmissione.id);
    expect(rinvio.body.trasmissione.progressivoInvio).not.toBe(invio.body.trasmissione.progressivoInvio);
  });
});

describe("A-1: bollo virtuale", () => {
  test("i trimestri e l'F24 precompilato", async () => {
    const anno = new Date().getFullYear();
    const bollo = await org.api(`/api/sdi/bollo?anno=${anno}`);
    expect(bollo.status).toBe(200);
    expect(bollo.body.periodi).toHaveLength(4);
    expect(bollo.body.periodi.map((p: { codiceTributo: string }) => p.codiceTributo)).toEqual(["2521", "2522", "2523", "2524"]);

    const trimestre = Math.floor(new Date().getUTCMonth() / 3) + 1;
    const f24 = await org.api(`/api/sdi/bollo/${anno}/${trimestre}/f24`);
    expect(f24.status).toBe(200);
    expect(f24.body.sezione).toBe("Erario");
    expect(f24.body.codiceTributo).toBe(["2521", "2522", "2523", "2524"][trimestre - 1]);
    // L'ambiente è sandbox: le trasmissioni di prova non generano bollo da versare.
    expect(f24.body.importoCents).toBe(0);
  });
});

describe("A-1: ciclo passivo", () => {
  test("senza adesione non si scarica niente; con l'adesione la fattura diventa un costo", async () => {
    const spento = await org.api("/api/sdi/passive/sincronizza", { method: "POST" });
    expect(spento.status).toBe(400);
    expect(spento.body.error).toBe("CICLO_PASSIVO_SPENTO");

    const attiva = await org.api("/api/sdi/settings", { method: "PATCH", body: { cicloPassivoAttivo: true } });
    expect(attiva.status).toBe(200);
    expect(attiva.body.settings.cicloPassivoAttivo).toBe(true);
    expect(attiva.body.settings.cicloPassivoAttivatoAt).toBeTruthy();

    accodaPassivaSimulata(org.userId, xmlFornitore());

    const sync = await org.api("/api/sdi/passive/sincronizza", { method: "POST" });
    expect(sync.status).toBe(200);
    expect(sync.body.nuove).toBe(1);

    const lista = await org.api("/api/sdi/passive");
    expect(lista.status).toBe(200);
    const passiva = lista.body.fatture[0];
    expect(passiva.fornitoreNome).toBe("Ferramenta Bianchi Srl");
    expect(passiva.numero).toBe("2026/451");
    expect(passiva.imponibileCents).toBe(50_000);
    expect(passiva.ivaCents).toBe(11_000);
    expect(passiva.totaleCents).toBe(61_000);
    expect(passiva.stato).toBe("nuova");

    // Collegata a un cantiere diventa un costo; il collegamento non si ripete.
    const progetto = await org.api("/api/jobs", { method: "POST", body: { name: "Cantiere e2e SDI", address: "Via Cantiere 1" } });
    expect(progetto.status).toBe(201);
    const projectId = progetto.body.job.id as string;

    const collega = await org.api(`/api/sdi/passive/${passiva.id}/collega`, { method: "POST", body: { projectId, category: "materials" } });
    expect(collega.status).toBe(200);
    expect(collega.body.fattura.stato).toBe("collegata");
    expect(collega.body.fattura.costEntryId).toBeTruthy();

    const bis = await org.api(`/api/sdi/passive/${passiva.id}/collega`, { method: "POST", body: { projectId } });
    expect(bis.status).toBe(409);
  });
});

describe("A-1: il webhook crede solo a chi conosce il segreto", () => {
  test("senza segreto 401, con il segreto l'evento si applica una volta sola", async () => {
    const fattura = await fatturaInviata(org.userId, 90_000);
    const invio = await org.api(`/api/invoices/${fattura.id}/sdi/invia`, { method: "POST" });
    expect(invio.status).toBe(200);
    const [trasmissione] = await db.select().from(eInvoicesTable).where(eq(eInvoicesTable.id, invio.body.trasmissione.id));
    const providerDocumentId = trasmissione!.providerDocumentId!;

    await org.api("/api/sdi/settings", { method: "PATCH", body: { webhookSecret: "segreto-webhook-e2e-123456" } });

    const corpo = { providerDocumentId, tipo: "RC", eventId: `${providerDocumentId}:RC` };
    const rifiutato = await org.api(`/api/webhooks/sdi/${org.userId}`, { method: "POST", body: corpo });
    expect(rifiutato.status).toBe(401);

    const accettato = await org.api(`/api/webhooks/sdi/${org.userId}?token=segreto-webhook-e2e-123456`, { method: "POST", body: corpo });
    expect(accettato.status).toBe(200);
    expect(accettato.body.applicati).toBe(1);

    const [dopo] = await db.select().from(eInvoicesTable).where(eq(eInvoicesTable.id, trasmissione!.id));
    expect(dopo!.stato).toBe("consegnata");

    // Stesso evento due volte: nessun doppione, nessun cambio di stato.
    const ripetuto = await org.api(`/api/webhooks/sdi/${org.userId}?token=segreto-webhook-e2e-123456`, { method: "POST", body: corpo });
    expect(ripetuto.status).toBe(200);
    const eventi = await db.select().from(eInvoicesTable).where(and(eq(eInvoicesTable.id, trasmissione!.id), eq(eInvoicesTable.stato, "consegnata")));
    expect(eventi).toHaveLength(1);
  });
});

describe("A-1: lettura di una FatturaPA in arrivo", () => {
  test("i campi che servono alla prima nota", () => {
    const letta = leggiFatturaPaXml(xmlFornitore());
    expect(letta.fornitoreNome).toBe("Ferramenta Bianchi Srl");
    expect(letta.fornitorePartitaIva).toBe("01234567897");
    expect(letta.numero).toBe("2026/451");
    expect(letta.imponibileCents).toBe(50_000);
    expect(letta.ivaCents).toBe(11_000);
    expect(letta.righe).toHaveLength(1);
    expect(letta.righe[0].descrizione).toBe("Materiale elettrico vario");
  });

  test("un documento generato da noi si rilegge identico", () => {
    const xml = buildFatturaPaXml({
      formatoTrasmissione: "FPR12",
      trasmittente: { paese: "IT", codice: "01234567897" },
      progressivoInvio: "2600099",
      codiceDestinatario: "0000000",
      cedente: {
        partitaIva: "01234567897",
        paese: "IT",
        anagrafica: { denominazione: "Impianti Bianchi" },
        regimeFiscale: "RF19",
        sede: { indirizzo: "Via Roma 12", cap: "20100", comune: "Milano", provincia: "MI", nazione: "IT" },
      },
      cessionario: {
        codiceFiscale: "RSSMRA80A01H501U",
        anagrafica: { nome: "Mario", cognome: "Rossi" },
        sede: { indirizzo: "Via Verdi 3", cap: "20121", comune: "Milano", provincia: "MI", nazione: "IT" },
      },
      tipoDocumento: "TD01",
      divisa: "EUR",
      data: "2026-09-01",
      numero: "FT-2026-0001",
      bolloVirtualeCents: 200,
      totaleDocumentoCents: 100_000,
      righe: [{ numero: 1, descrizione: "Impianto elettrico", quantita: 1, prezzoUnitarioCents: 100_000, prezzoTotaleCents: 100_000, aliquota: 0, natura: "N2.2" }],
      riepilogo: [{ aliquota: 0, natura: "N2.2", imponibileCents: 100_000, impostaCents: 0, esigibilita: "I", riferimentoNormativo: "Regime forfettario" }],
    });
    const letta = leggiFatturaPaXml(xml);
    expect(letta.numero).toBe("FT-2026-0001");
    expect(letta.fornitoreNome).toBe("Impianti Bianchi");
    expect(letta.imponibileCents).toBe(100_000);
    expect(letta.totaleCents).toBe(100_000);
  });
});

/** Una fattura di acquisto come la scriverebbe il gestionale di un fornitore. */
function xmlFornitore(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">',
    "<FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>99999999999</IdCodice></IdTrasmittente>",
    "<ProgressivoInvio>00001</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>SIMULA</CodiceDestinatario></DatiTrasmissione>",
    "<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdFiscaleIVA>",
    "<Anagrafica><Denominazione>Ferramenta Bianchi Srl</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici>",
    "<Sede><Indirizzo>Via dei Fornitori 4</Indirizzo><CAP>20100</CAP><Comune>Milano</Comune><Provincia>MI</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>",
    "<CessionarioCommittente><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>01234567897</IdCodice></IdFiscaleIVA>",
    "<Anagrafica><Denominazione>E2E Impianti SdI Srl</Denominazione></Anagrafica></DatiAnagrafici>",
    "<Sede><Indirizzo>Via Roma 12</Indirizzo><CAP>20100</CAP><Comune>Milano</Comune><Provincia>MI</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente></FatturaElettronicaHeader>",
    "<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-09-10</Data>",
    "<Numero>2026/451</Numero><ImportoTotaleDocumento>610.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>",
    "<DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Materiale elettrico vario</Descrizione><Quantita>1.00</Quantita>",
    "<PrezzoUnitario>500.00</PrezzoUnitario><PrezzoTotale>500.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>",
    "<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>500.00</ImponibileImporto><Imposta>110.00</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo></DatiBeniServizi>",
    "</FatturaElettronicaBody></p:FatturaElettronica>",
  ].join("");
}
