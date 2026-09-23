import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db, businessProfilesTable, taxProfilesTable, invoicesTable, clientsTable, clientDedupKey, costEntriesTable, bankMovementsTable, accountantShareAccessesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, type TestUser } from "./harness.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment } from "../invoices/service.js";

// ── A-4: prima nota, estratto conto, chiusura d'anno, commercialista ─────────
// Il giro completo contro il database: la prima nota legge ciò che esiste già
// (non lo ricopia), l'estratto conto si riconcilia creando righe solo nelle
// tabelle di sempre, la chiusura è una fotografia che non blocca nulla, e il
// link del commercialista si apre senza account e smette di funzionare quando
// deve.

const anno = new Date().getUTCFullYear();
const annoScorso = anno - 1;

describe("prima nota e chiusura d'anno", () => {
  let org: TestUser & { province: string };
  let clientId: string;
  let fatturaAperta: { id: string; number: string; totalCents: number };
  let costoEsistenteId: string;

  async function fattura(importoCents: number, titolo: string) {
    const ctx = await buildInvoiceContext({ userId: org.userId, clientId });
    const creata = await createInvoice({
      userId: org.userId,
      ctx,
      type: "manual",
      source: "manual",
      actor: "contractor",
      lines: [{ description: titolo, quantity: 1, unitCents: importoCents, amountCents: importoCents }],
      dueDays: 30,
      title: titolo,
    });
    const { invoice } = await sendInvoice({ invoiceId: creata.id, userId: org.userId, actor: "contractor" });
    return invoice;
  }

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ province: "MI", companyName: "Idraulica Prima Nota Srl" });
    const nome = "Paolo Neri";
    const email = `cliente-pn-${org.userId}@example.invalid`;
    const [cliente] = await db
      .insert(clientsTable)
      .values({ userId: org.userId, type: "individual", name: nome, email, address: "Via Po 1", city: "Milano", province: "MI", postalCode: "20121", dedupKey: clientDedupKey({ name: nome, email }) })
      .returning();
    clientId = cliente!.id;
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  it("senza il modulo non risponde nulla", async () => {
    const r = await org.api(`/api/fiscale/prima-nota?anno=${anno}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("FISCAL_MODULE_OFF");
  });

  it("legge incassi, costi e versamenti da dove già stanno, e tiene fuori le ore dei cantieri", async () => {
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    await db.update(businessProfilesTable).set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } }).where(eq(businessProfilesTable.userId, org.userId));
    const onboarding = await org.api("/api/fiscale/profilo", {
      method: "PATCH",
      body: { codiceAteco: "43.22.01", gestione: "artigiani", riduzione: "nessuna", annoInizioAttivita: 2019, requisitiStartup: false, accettaAvviso: true },
    });
    expect(onboarding.status).toBe(200);

    const pagata = await fattura(500_000, "Caldaia");
    await recordPayment({ invoiceId: pagata.id, userId: org.userId, amountCents: 500_000, method: "bank_transfer", date: new Date(`${anno}-02-10T12:00:00Z`), sendReceipt: false });

    const [costo] = await db
      .insert(costEntriesTable)
      .values({ userId: org.userId, category: "materials", vendor: "Termoidraulica Rossi", description: "Tubi e raccordi", date: new Date(`${anno}-03-05T12:00:00Z`), subtotalCents: 24_000, totalCents: 24_000, status: "confirmed", source: "manual" })
      .returning();
    costoEsistenteId = costo!.id;
    // Un'ora di lavoro approvata diventa un costo di cantiere, ma non è
    // denaro uscito dal conto: la prima nota non la deve contare.
    await db.insert(costEntriesTable).values({ userId: org.userId, category: "labour", description: "Ore", date: new Date(`${anno}-03-06T12:00:00Z`), subtotalCents: 30_000, totalCents: 30_000, status: "confirmed", source: "time_entry" });

    const versamento = await org.api("/api/fiscale/versamenti", { method: "POST", body: { anno, tipo: "contributi_inps", data: `${anno}-05-16`, importoCents: 113_034 } });
    expect(versamento.status).toBe(201);

    const r = await org.api(`/api/fiscale/prima-nota?anno=${anno}`);
    expect(r.status).toBe(200);
    const fonti = r.body.voci.map((v: { fonte: string }) => v.fonte);
    expect(fonti).toEqual(["incasso", "costo", "versamento"]);
    expect(r.body.totali.incassiCents).toBe(500_000);
    expect(r.body.totali.costiCents).toBe(24_000);
    expect(r.body.totali.versamentiCents).toBe(113_034);
    expect(r.body.totali.saldoCents).toBe(500_000 - 24_000 - 113_034);
    // I versamenti si vedono, ma non sono un costo: l'utile sottrae già il carico fiscale.
    expect(r.body.voci.find((v: { fonte: string }) => v.fonte === "versamento").incideSulUtile).toBe(false);
    expect(r.body.totali.mesi[1].entrateCents).toBe(500_000);
  });

  it("i movimenti manuali rispettano il verso, e i prelievi non sono un costo", async () => {
    const sbagliato = await org.api("/api/fiscale/prima-nota/movimenti", { method: "POST", body: { data: `${anno}-04-01`, tipo: "entrata", categoria: "prelievo_titolare", importoCents: 100_000 } });
    expect(sbagliato.status).toBe(400);
    expect(sbagliato.body.error).toBe("CATEGORIA_NON_VALIDA");

    const prelievo = await org.api("/api/fiscale/prima-nota/movimenti", { method: "POST", body: { data: `${anno}-04-01`, tipo: "uscita", categoria: "prelievo_titolare", importoCents: 100_000 } });
    expect(prelievo.status).toBe(201);
    const affitto = await org.api("/api/fiscale/prima-nota/movimenti", { method: "POST", body: { data: `${anno}-04-02`, tipo: "uscita", categoria: "affitto_utenze", importoCents: 50_000, descrizione: "Magazzino aprile" } });
    expect(affitto.status).toBe(201);

    const r = await org.api(`/api/fiscale/prima-nota?anno=${anno}`);
    expect(r.body.totali.movimentiNeutriCents).toBe(100_000);
    expect(r.body.totali.costiCents).toBe(24_000 + 50_000);

    expect((await org.api(`/api/fiscale/prima-nota/movimenti/${prelievo.body.id}`, { method: "DELETE" })).status).toBe(204);
  });

  it("calcola l'utile netto sottraendo il carico fiscale di competenza, non i versamenti di cassa", async () => {
    const r = await org.api(`/api/fiscale/utile?anno=${anno}`);
    expect(r.status).toBe(200);
    const u = r.body.utile;
    expect(u.ricaviCents).toBe(500_000);
    expect(u.costiCents).toBe(74_000);
    expect(u.utileNettoCents).toBe(u.margineCents - u.impostaCents - u.contributiCents - u.bolloCents);
    expect(u.costiPresuntiCents).toBe(70_000); // 14 % di 5.000 €
    expect(u.revisionato).toBe(false);
    expect(r.body.revisione.revisionato).toBe(false);
  });

  // ── Estratto conto ─────────────────────────────────────────────────────────

  function csvEstratto(numeroFattura: string, bonificoCents: number): string {
    const euro = (c: number) => (c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
    const d = (mese: string, g: string) => `${g}/${mese}/${anno}`;
    return [
      "Estratto conto;;;;",
      `Saldo iniziale;;;;10.000,00`,
      "Data contabile;Data valuta;Descrizione operazione;Dare;Avere",
      `${d("03", "12")};${d("03", "12")};BONIFICO DA NERI PAOLO SALDO FATTURA ${numeroFattura};;${euro(bonificoCents)}`,
      `${d("03", "06")};${d("03", "06")};PAGAMENTO POS TERMOIDRAULICA ROSSI;240,00;`,
      `${d("03", "31")};${d("03", "31")};COMMISSIONI TENUTA CONTO;3,50;`,
      `${d("03", "20")};${d("03", "20")};PAGAMENTO POS FERRAMENTA BIANCHI;85,40;`,
      `${d("03", "16")};${d("03", "16")};DELEGA F24 AGENZIA ENTRATE;777,77;`,
      `Saldo finale;;;;`,
    ].join("\r\n");
  }

  let movimenti: { id: string; descrizione: string; importoCents: number; suggerimenti: { azione: string; certezza?: string; invoiceId?: string; tipo?: string; id?: string }[] }[] = [];
  const trova = (testo: string) => movimenti.find((m) => m.descrizione.includes(testo))!;

  it("carica un CSV della banca, scarta le righe di saldo e non raddoppia se lo ricarichi", async () => {
    const aperta = await fattura(183_000, "Impianto bagno");
    fatturaAperta = { id: aperta.id, number: aperta.number, totalCents: aperta.totalCents };

    const form = () => {
      const f = new FormData();
      f.append("file", new Blob([csvEstratto(aperta.number, aperta.totalCents)], { type: "text/csv" }), "estratto-marzo.csv");
      f.append("conto", "Conto aziendale");
      return f;
    };
    const primo = await org.api("/api/fiscale/banca/import", { method: "POST", form: form() });
    expect(primo.status, JSON.stringify(primo.body)).toBe(201);
    expect(primo.body.nuove).toBe(5);
    expect(primo.body.scartate.length).toBeGreaterThanOrEqual(1);
    expect(primo.body.giaCaricato).toBe(false);

    const secondo = await org.api("/api/fiscale/banca/import", { method: "POST", form: form() });
    expect(secondo.status).toBe(201);
    expect(secondo.body.nuove).toBe(0);
    expect(secondo.body.duplicate).toBe(5);
    expect(secondo.body.giaCaricato).toBe(true);

    const nonCsv = new FormData();
    nonCsv.append("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "estratto.pdf");
    expect((await org.api("/api/fiscale/banca/import", { method: "POST", form: nonCsv })).status).toBe(400);
  });

  it("suggerisce l'abbinamento giusto per ogni movimento", async () => {
    const r = await org.api(`/api/fiscale/banca?anno=${anno}`);
    expect(r.status).toBe(200);
    movimenti = r.body.movimenti;
    expect(r.body.riepilogo.daAbbinare.n).toBe(5);

    const bonifico = trova("BONIFICO DA NERI");
    expect(bonifico.suggerimenti[0]).toMatchObject({ azione: "registra_incasso", invoiceId: fatturaAperta.id, certezza: "alta" });
    const pos = trova("TERMOIDRAULICA");
    expect(pos.suggerimenti[0]).toMatchObject({ azione: "abbina", tipo: "costo", id: costoEsistenteId, certezza: "alta" });
    expect(trova("COMMISSIONI").suggerimenti[0]).toMatchObject({ azione: "registra_movimento" });
    expect(trova("DELEGA F24").suggerimenti[0]).toMatchObject({ azione: "scadenzario" });
    expect(trova("FERRAMENTA").suggerimenti[0]).toMatchObject({ azione: "registra_costo" });
  });

  it("«abbina i sicuri» collega solo ciò che è già registrato e non crea nulla", async () => {
    const costiPrima = await db.select().from(costEntriesTable).where(eq(costEntriesTable.userId, org.userId));
    const r = await org.api("/api/fiscale/banca/abbina-sicuri", { method: "POST", body: { anno } });
    expect(r.body.abbinati).toBe(1);
    const costiDopo = await db.select().from(costEntriesTable).where(eq(costEntriesTable.userId, org.userId));
    expect(costiDopo).toHaveLength(costiPrima.length);
    const [pos] = await db.select().from(bankMovementsTable).where(eq(bankMovementsTable.id, trova("TERMOIDRAULICA").id));
    expect(pos).toMatchObject({ stato: "abbinato", abbinamentoTipo: "costo", abbinamentoId: costoEsistenteId });
  });

  it("registra l'accredito come incasso della fattura, con la stessa funzione del resto del prodotto", async () => {
    const bonifico = trova("BONIFICO DA NERI");
    const r = await org.api(`/api/fiscale/banca/movimenti/${bonifico.id}/incasso`, { method: "POST", body: { invoiceId: fatturaAperta.id } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, fatturaAperta.id));
    expect(inv!.status).toBe("paid");
    expect(inv!.paidCents).toBe(fatturaAperta.totalCents);

    // Lo stesso movimento non si abbina due volte.
    const ancora = await org.api(`/api/fiscale/banca/movimenti/${bonifico.id}/incasso`, { method: "POST", body: { invoiceId: fatturaAperta.id } });
    expect(ancora.status).toBe(400);
    expect(ancora.body.error).toBe("GIA_GESTITO");

    const nota = await org.api(`/api/fiscale/prima-nota?anno=${anno}`);
    const incasso = nota.body.voci.find((v: { fonte: string; importoCents: number }) => v.fonte === "incasso" && v.importoCents === fatturaAperta.totalCents);
    expect(incasso.inBanca).toBe(true);
  });

  it("registra costi e commissioni nelle tabelle di sempre", async () => {
    const costo = await org.api(`/api/fiscale/banca/movimenti/${trova("FERRAMENTA").id}/costo`, { method: "POST", body: { categoria: "materials" } });
    expect(costo.status).toBe(201);
    const [riga] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, costo.body.costId));
    expect(riga).toMatchObject({ source: "bank_feed", status: "confirmed", totalCents: 8_540, vendor: "" });

    const commissioni = await org.api(`/api/fiscale/banca/movimenti/${trova("COMMISSIONI").id}/movimento`, { method: "POST", body: { categoria: "commissioni_bancarie" } });
    expect(commissioni.status).toBe(201);

    // Eliminare il movimento manuale rimette il movimento bancario da abbinare:
    // altrimenti resterebbe "abbinato" a una riga che non esiste più.
    expect((await org.api(`/api/fiscale/prima-nota/movimenti/${commissioni.body.movimentoId}`, { method: "DELETE" })).status).toBe(204);
    const [bancario] = await db.select().from(bankMovementsTable).where(eq(bankMovementsTable.id, trova("COMMISSIONI").id));
    expect(bancario!.stato).toBe("da_abbinare");
  });

  it("non abbina importi diversi né versi opposti", async () => {
    const f24 = trova("DELEGA F24");
    const importo = await org.api(`/api/fiscale/banca/movimenti/${f24.id}/abbina`, { method: "POST", body: { tipo: "costo", id: costoEsistenteId } });
    expect(importo.status).toBe(400);
    const verso = await org.api(`/api/fiscale/banca/movimenti/${f24.id}/incasso`, { method: "POST", body: { invoiceId: fatturaAperta.id } });
    expect(verso.status).toBe(400);
    expect(verso.body.error).toBe("VERSO_DIVERSO");

    expect((await org.api(`/api/fiscale/banca/movimenti/${f24.id}/ignora`, { method: "POST" })).status).toBe(200);
    expect((await org.api(`/api/fiscale/banca/movimenti/${f24.id}/scollega`, { method: "POST" })).status).toBe(200);
  });

  it("non lascia togliere un estratto con movimenti già abbinati", async () => {
    const r = await org.api(`/api/fiscale/banca?anno=${anno}`);
    const importId = r.body.estratti.find((e: { righeNuove: number }) => e.righeNuove === 5).id;
    const tolto = await org.api(`/api/fiscale/banca/import/${importId}`, { method: "DELETE" });
    expect(tolto.status).toBe(400);
    expect(tolto.body.error).toBe("IMPORT_CON_ABBINAMENTI");
  });

  it("esporta la prima nota in CSV per Excel", async () => {
    const r = await org.api(`/api/fiscale/prima-nota.csv?anno=${anno}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    const testo = String(r.body);
    // Il BOM c'è (lo prova il test unitario), ma fetch().text() lo toglie.
    expect(testo).toContain("Data;Tipo;Categoria");
    expect(testo).toContain((fatturaAperta.totalCents / 100).toFixed(2).replace(".", ","));
  });

  // ── Chiusura d'anno ────────────────────────────────────────────────────────

  it("non chiude un anno ancora in corso", async () => {
    const r = await org.api("/api/fiscale/chiusura/chiudi", { method: "POST", body: { anno } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("ANNO_APERTO");
  });

  it("chiude l'anno scorso con una fotografia firmata e riporta ricavi e imposta sul profilo", async () => {
    const vecchia = await fattura(2_000_000, "Ristrutturazione anno scorso");
    await recordPayment({ invoiceId: vecchia.id, userId: org.userId, amountCents: 2_000_000, method: "bank_transfer", date: new Date(`${annoScorso}-11-20T12:00:00Z`), sendReceipt: false });

    const prima = await org.api(`/api/fiscale/chiusura?anno=${annoScorso}`);
    expect(prima.status).toBe(200);
    expect(prima.body.chiudibile).toBe(true);
    expect(prima.body.chiusura).toBeNull();
    const lm22 = prima.body.pacchetto.prospetto.righi.find((r: { descrizione: string }) => r.descrizione.startsWith("Ricavi"));
    expect(lm22.importoCents).toBe(2_000_000);
    expect(prima.body.pacchetto.prospetto.regoleNonRevisionate).toContain("F20");
    expect(prima.body.guida.length).toBeGreaterThan(3);

    const chiusa = await org.api("/api/fiscale/chiusura/chiudi", { method: "POST", body: { anno: annoScorso, riporta: true } });
    expect(chiusa.status, JSON.stringify(chiusa.body)).toBe(200);
    expect(chiusa.body.chiusura.impronta).toMatch(/^[0-9a-f]{64}$/);
    expect(chiusa.body.chiusura.regoleRevisionate).toBe(false);
    expect(chiusa.body.riportato).toBe(true);

    const [profilo] = await db.select().from(taxProfilesTable).where(eq(taxProfilesTable.userId, org.userId));
    expect(profilo!.ricaviAnnoPrecedenteCents).toBe(2_000_000);
    expect(profilo!.impostaAnnoPrecedenteCents).toBe(prima.body.pacchetto.utile.impostaCents);
  });

  it("dopo la chiusura i dati restano modificabili e la pagina mostra cosa è cambiato", async () => {
    const tardiva = await fattura(100_000, "Fattura trovata a luglio");
    await recordPayment({ invoiceId: tardiva.id, userId: org.userId, amountCents: 100_000, method: "bank_transfer", date: new Date(`${annoScorso}-12-15T12:00:00Z`), sendReceipt: false });
    const r = await org.api(`/api/fiscale/chiusura?anno=${annoScorso}`);
    const ricavi = r.body.differenze.find((d: { voce: string }) => d.voce.startsWith("Ricavi"));
    expect(ricavi).toMatchObject({ alloraCents: 2_000_000, oggiCents: 2_100_000 });

    // Richiudere dà una nuova versione, con una nuova impronta.
    const di_nuovo = await org.api("/api/fiscale/chiusura/chiudi", { method: "POST", body: { anno: annoScorso } });
    expect(di_nuovo.body.chiusura.versione).toBe(2);
    expect((await org.api(`/api/fiscale/chiusura?anno=${annoScorso}`)).body.differenze).toEqual([]);

    expect((await org.api("/api/fiscale/chiusura/riapri", { method: "POST", body: { anno: annoScorso } })).status).toBe(204);
    expect((await org.api(`/api/fiscale/chiusura?anno=${annoScorso}`)).body.chiusura.stato).toBe("riaperto");
  });

  it("produce il pacchetto in PDF", async () => {
    const pdf = await org.api(`/api/fiscale/chiusura/pacchetto.pdf?anno=${annoScorso}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(String(pdf.body).startsWith("%PDF")).toBe(true);
  });

  // ── Commercialista ─────────────────────────────────────────────────────────

  it("condivide l'anno in sola lettura, registra ogni accesso e smette di funzionare quando lo revochi", async () => {
    const senzaNome = await org.api("/api/fiscale/condivisioni", { method: "POST", body: { anno: annoScorso, destinatario: "", giorni: 30 } });
    expect(senzaNome.status).toBe(400);
    const durata = await org.api("/api/fiscale/condivisioni", { method: "POST", body: { anno: annoScorso, destinatario: "Studio Verdi", giorni: 365 } });
    expect(durata.status).toBe(400);

    const creata = await org.api("/api/fiscale/condivisioni", { method: "POST", body: { anno: annoScorso, destinatario: "Studio Verdi", email: "studio@example.invalid", giorni: 30 } });
    expect(creata.status, JSON.stringify(creata.body)).toBe(201);
    const token = String(creata.body.url).split("/commercialista/")[1]!;
    expect(token.length).toBeGreaterThan(30);

    // Senza account.
    const aperta = await api(`/api/commercialista/${token}`);
    expect(aperta.status).toBe(200);
    expect(aperta.headers.get("x-robots-tag")).toContain("noindex");
    expect(aperta.headers.get("cache-control")).toBe("no-store");
    expect(aperta.body.pacchetto.anno).toBe(annoScorso);
    expect(aperta.body.pacchetto.impresa.denominazione).toBe("Idraulica Prima Nota Srl");
    expect(aperta.body.voci.length).toBeGreaterThan(0);
    expect((await api(`/api/commercialista/${token}/prima-nota.csv`)).status).toBe(200);

    const elenco = await org.api("/api/fiscale/condivisioni");
    const link = elenco.body.condivisioni.find((c: { id: string }) => c.id === creata.body.id);
    expect(link.accessi).toBe(2);
    expect(link.attivo).toBe(true);
    // Il token non torna mai indietro: nell'elenco non c'è.
    expect(JSON.stringify(elenco.body)).not.toContain(token);
    const accessi = await db.select().from(accountantShareAccessesTable).where(eq(accountantShareAccessesTable.shareId, creata.body.id));
    expect(accessi.map((a) => a.risorsa).sort()).toEqual(["pacchetto", "prima-nota.csv"]);

    expect((await api(`/api/commercialista/${token.slice(0, -2)}xx`)).status).toBe(404);

    expect((await org.api(`/api/fiscale/condivisioni/${creata.body.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(`/api/commercialista/${token}`)).status).toBe(404);
  });

  it("il link smette di funzionare anche se l'impresa spegne il modulo", async () => {
    const creata = await org.api("/api/fiscale/condivisioni", { method: "POST", body: { anno: annoScorso, destinatario: "Studio Bianchi", giorni: 7 } });
    const token = String(creata.body.url).split("/commercialista/")[1]!;
    expect((await api(`/api/commercialista/${token}`)).status).toBe(200);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    await db.update(businessProfilesTable).set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: false } }).where(eq(businessProfilesTable.userId, org.userId));
    expect((await api(`/api/commercialista/${token}`)).status).toBe(404);
    await db.update(businessProfilesTable).set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } }).where(eq(businessProfilesTable.userId, org.userId));
  });

  // ── Permessi e isolamento ──────────────────────────────────────────────────

  it("l'ufficio non vede la prima nota, l'amministratore la legge ma non la tocca", async () => {
    async function membro(ruolo: "office" | "admin") {
      const email = `e2e-${ruolo}-pn-${org.userId}@example.invalid`;
      const invito = await org.api("/api/team/members/invite", { body: { email, role: ruolo } });
      expect(invito.status, JSON.stringify(invito.body)).toBe(201);
      const token = String(invito.body.url).split("/team-invite/")[1];
      const utente = await createUser({ email, name: ruolo });
      expect((await utente.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
      return utente;
    }
    const ufficio = await membro("office");
    expect((await ufficio.api(`/api/fiscale/prima-nota?anno=${anno}`)).status).toBe(403);
    expect((await ufficio.api("/api/fiscale/condivisioni")).status).toBe(403);

    const admin = await membro("admin");
    expect((await admin.api(`/api/fiscale/prima-nota?anno=${anno}`)).status).toBe(200);
    const scrive = await admin.api("/api/fiscale/prima-nota/movimenti", { method: "POST", body: { data: `${anno}-04-01`, tipo: "uscita", categoria: "altro", importoCents: 100 } });
    expect(scrive.status).toBe(403);
    expect((await admin.api("/api/fiscale/condivisioni", { method: "POST", body: { anno: annoScorso, destinatario: "X", giorni: 7 } })).status).toBe(403);
  });

  it("un'altra impresa non vede né tocca i movimenti bancari di questa", async () => {
    const altra = await createOrg({ province: "RM", companyName: "Altra Srl" });
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, altra.userId));
    await db.update(businessProfilesTable).set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } }).where(eq(businessProfilesTable.userId, altra.userId));

    const lista = await altra.api(`/api/fiscale/banca?anno=${anno}`);
    expect(lista.body.movimenti).toEqual([]);
    const f24 = trova("DELEGA F24");
    const tocca = await altra.api(`/api/fiscale/banca/movimenti/${f24.id}/ignora`, { method: "POST" });
    expect(tocca.status).toBe(404);
    const [intatto] = await db.select().from(bankMovementsTable).where(and(eq(bankMovementsTable.id, f24.id), eq(bankMovementsTable.userId, org.userId)));
    expect(intatto!.stato).toBe("da_abbinare");
  });
});
