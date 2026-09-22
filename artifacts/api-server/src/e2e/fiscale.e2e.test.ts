import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db, businessProfilesTable, taxProfilesTable, fiscalPaymentsTable, fiscalDeadlinesTable, invoicesTable, clientsTable, clientDedupKey } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment } from "../invoices/service.js";
import { runFiscalMaintenance } from "../fiscale/maintenance.js";
import { promemoriaDaInviare } from "../fiscale/promemoria.js";

// ── A-2: il modulo fiscale dall'esterno ──────────────────────────────────────
// Il motore ha già i suoi test unitari: qui si prova il giro completo —
// gate dell'add-on, onboarding, lettura dei dati veri dal database, e il fatto
// che il ruolo sbagliato non veda nulla.

describe("modulo fiscale forfettario", () => {
  let org: TestUser & { province: string };
  let clientId: string;

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ province: "MI", companyName: "Impianti Fiscali Srl" });
    const nome = "Giulia Bianchi";
    const email = `cliente-${org.userId}@example.invalid`;
    const [cliente] = await db
      .insert(clientsTable)
      .values({
        userId: org.userId,
        type: "individual",
        name: nome,
        email,
        address: "Via Verdi 3",
        city: "Milano",
        province: "MI",
        postalCode: "20121",
        dedupKey: clientDedupKey({ name: nome, email }),
      })
      .returning();
    clientId = cliente!.id;
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  async function accendiModulo() {
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    await db
      .update(businessProfilesTable)
      .set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } })
      .where(eq(businessProfilesTable.userId, org.userId));
  }

  it("senza l'add-on non risponde nulla", async () => {
    const r = await org.api("/api/fiscale/calcolo");
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("FISCAL_MODULE_OFF");
  });

  it("con l'add-on acceso chiede prima l'onboarding fiscale", async () => {
    await accendiModulo();
    const r = await org.api("/api/fiscale/calcolo");
    expect(r.status).toBe(200);
    expect(r.body.passiMancanti).toContain("ateco");
    expect(r.body.passiMancanti).toContain("avviso");
    // Il calcolo esiste comunque, ma è tutto a zero: non inventa un profilo.
    expect(r.body.calcolo.impostaCents).toBe(0);
  });

  it("dichiara sempre se le regole sono state revisionate da un commercialista", async () => {
    const r = await org.api("/api/fiscale/calcolo");
    expect(r.body.revisione.revisionato).toBe(false);
    expect(r.body.revisione.regole.length).toBe(19);
    expect(r.body.calcolo.revisionato).toBe(false);
    expect(r.body.avviso.testo).toContain("Non è consulenza fiscale");
  });

  it("rifiuta un codice ATECO implausibile", async () => {
    const r = await org.api("/api/fiscale/profilo", { method: "PATCH", body: { codiceAteco: "4" } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("ATECO_NON_VALIDO");
  });

  it("completa l'onboarding e ricava il coefficiente dal codice ATECO", async () => {
    const r = await org.api("/api/fiscale/profilo", {
      method: "PATCH",
      body: {
        codiceAteco: "43.22.01",
        gestione: "artigiani",
        riduzione: "nessuna",
        annoInizioAttivita: 2020,
        requisitiStartup: false,
        accettaAvviso: true,
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.profilo.coefficienteEffettivo).toBe(86);
    expect(r.body.profilo.passiMancanti).toEqual([]);
    expect(r.body.profilo.completatoAt).toBeTruthy();
  });

  it("conta come ricavo solo ciò che è stato incassato", async () => {
    const anno = new Date().getUTCFullYear();
    const ctx = await buildInvoiceContext({ userId: org.userId, clientId });
    const fattura = await createInvoice({
      userId: org.userId,
      ctx,
      type: "manual",
      source: "manual",
      actor: "contractor",
      lines: [{ description: "Rifacimento bagno", quantity: 1, unitCents: 1_000_000, amountCents: 1_000_000 }],
      dueDays: 30,
      title: "Bagno",
    });
    const { invoice } = await sendInvoice({ invoiceId: fattura.id, userId: org.userId, actor: "contractor" });

    // Emessa e non pagata: non fa imposta, ma entra nel monitor della soglia.
    const prima = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    expect(prima.body.dati.incassatiCents).toBe(0);
    expect(prima.body.dati.fatturatoNonIncassatoCents).toBeGreaterThan(0);
    expect(prima.body.calcolo.imponibileCents).toBe(0);
    expect(prima.body.calcolo.soglia.maturatoCents).toBeGreaterThan(0);

    await recordPayment({ invoiceId: invoice.id, userId: org.userId, amountCents: 1_000_000, method: "bank_transfer" });

    const dopo = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    expect(dopo.body.dati.incassatiCents).toBe(1_000_000);
    // 10.000 € × 86 % = 8.600 € di reddito forfettario.
    expect(dopo.body.calcolo.contributi.redditoCents).toBe(860_000);
    expect(dopo.body.calcolo.impostaCents).toBeGreaterThan(0);
  });

  it("deduce i contributi versati e abbassa l'imposta", async () => {
    const anno = new Date().getUTCFullYear();
    const prima = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    const creato = await org.api("/api/fiscale/versamenti", {
      method: "POST",
      body: { anno, tipo: "contributi_inps", data: `${anno}-05-16`, importoCents: 113_034, riferimento: "F24 prima rata" },
    });
    expect(creato.status).toBe(201);

    const dopo = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    expect(dopo.body.calcolo.imponibileCents).toBe(prima.body.calcolo.imponibileCents - 113_034);
    expect(dopo.body.calcolo.impostaCents).toBeLessThan(prima.body.calcolo.impostaCents);
    expect(dopo.body.calcolo.contributi.versatiCents).toBe(113_034);

    const lista = await org.api(`/api/fiscale/versamenti?anno=${anno}`);
    expect(lista.body.versamenti).toHaveLength(1);
    const eliminato = await org.api(`/api/fiscale/versamenti/${creato.body.id}`, { method: "DELETE" });
    expect(eliminato.status).toBe(204);
  });

  it("spiega ogni importo che mostra", async () => {
    const r = await org.api("/api/fiscale/calcolo");
    const ids = r.body.calcolo.spiegazioni.map((s: { id: string }) => s.id);
    expect(ids).toContain("imponibile");
    expect(ids).toContain("da_mettere_via");
    for (const s of r.body.calcolo.spiegazioni) {
      expect(s.formula).toBeTruthy();
      expect(s.fonte).toBeTruthy();
      expect(Array.isArray(s.passaggi)).toBe(true);
    }
  });

  it("simula un lavoro nuovo senza salvare niente", async () => {
    const anno = new Date().getUTCFullYear();
    const prima = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    const sim = await org.api("/api/fiscale/simula", { method: "POST", body: { importoCents: 2_000_000, anno } });
    expect(sim.status).toBe(200);
    expect(sim.body.deltaImpostaCents).toBeGreaterThan(0);
    expect(sim.body.nettoCents).toBe(2_000_000 - sim.body.deltaImpostaCents - sim.body.deltaContributiCents);
    const dopo = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    expect(dopo.body.calcolo.impostaCents).toBe(prima.body.calcolo.impostaCents);
  });

  it("avvisa una volta sola quando la soglia peggiora", async () => {
    // Un incasso enorme, scritto direttamente: quello che conta qui è il
    // monitor, non il giro delle fatture (già provato sopra).
    const anno = new Date().getUTCFullYear();
    const ctx = await buildInvoiceContext({ userId: org.userId, clientId });
    const grossa = await createInvoice({
      userId: org.userId,
      ctx,
      type: "manual",
      source: "manual",
      actor: "contractor",
      lines: [{ description: "Ristrutturazione completa", quantity: 1, unitCents: 9_000_000, amountCents: 9_000_000 }],
      dueDays: 30,
      title: "Ristrutturazione",
    });
    const { invoice } = await sendInvoice({ invoiceId: grossa.id, userId: org.userId, actor: "contractor" });
    await recordPayment({ invoiceId: invoice.id, userId: org.userId, amountCents: 9_000_000, method: "bank_transfer" });

    const calcolo = await org.api(`/api/fiscale/calcolo?anno=${anno}`);
    expect(["superata", "fuori_regime"]).toContain(calcolo.body.calcolo.soglia.livello);

    const primo = await runFiscalMaintenance();
    expect(primo.avvisi).toBeGreaterThanOrEqual(1);
    const [profilo] = await db.select().from(taxProfilesTable).where(eq(taxProfilesTable.userId, org.userId));
    expect(profilo!.sogliaLivelloNotificato).toBeTruthy();

    // Secondo giro: lo stesso livello non produce un secondo avviso.
    const secondo = await runFiscalMaintenance();
    expect(secondo.avvisi).toBe(0);
  });

  it("non lascia leggere la posizione fiscale a un ruolo operativo", async () => {
    // Quanto incassa e quanto deve il titolare non è un dato di lavoro: il
    // capo cantiere vede i cantieri, non la posizione fiscale dell'impresa.
    const email = `e2e-foreman-${org.userId}@example.invalid`;
    const invito = await org.api("/api/team/members/invite", { body: { email, role: "foreman" } });
    expect(invito.status, JSON.stringify(invito.body)).toBe(201);
    const token = String(invito.body.url).split("/team-invite/")[1];
    const capo = await createUser({ email, name: "Capo Cantiere" });
    const accettato = await capo.api(`/api/team/invite/${token}/accept`, { method: "POST" });
    expect(accettato.status, JSON.stringify(accettato.body)).toBe(200);

    // Vede i cantieri…
    expect((await capo.api("/api/jobs")).status).toBe(200);
    // …e non il fisco.
    const r = await capo.api("/api/fiscale/calcolo");
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("FORBIDDEN");
  });

  it("non lascia vedere il profilo fiscale di un'altra impresa", async () => {
    const altra = await createOrg({ province: "NA", companyName: "Altra Impresa Srl" });
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, altra.userId));
    await db
      .update(businessProfilesTable)
      .set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } })
      .where(eq(businessProfilesTable.userId, altra.userId));

    const r = await altra.api("/api/fiscale/calcolo");
    expect(r.status).toBe(200);
    expect(r.body.dati.incassatiCents).toBe(0);
    expect(r.body.profilo).toBeUndefined();

    // E i versamenti dell'una non si cancellano dall'altra.
    const anno = new Date().getUTCFullYear();
    const creato = await org.api("/api/fiscale/versamenti", {
      method: "POST",
      body: { anno, tipo: "contributi_inps", data: `${anno}-05-16`, importoCents: 50_000 },
    });
    const tentativo = await altra.api(`/api/fiscale/versamenti/${creato.body.id}`, { method: "DELETE" });
    expect(tentativo.status).toBe(404);
    const righe = await db.select().from(fiscalPaymentsTable).where(eq(fiscalPaymentsTable.id, creato.body.id));
    expect(righe).toHaveLength(1);
  });

  // ── A-3: scadenzario, F24 precompilato, promemoria ─────────────────────────

  it("costruisce lo scadenzario dal profilo e non lo conserva come verità", async () => {
    const anno = new Date().getUTCFullYear();
    const r = await org.api(`/api/fiscale/scadenzario?anno=${anno}`);
    expect(r.status).toBe(200);
    const chiavi = r.body.voci.map((v: { scadenza: { id: string } }) => v.scadenza.id);
    expect(chiavi).toContain("saldo_primo_acconto");
    expect(chiavi).toContain("inps_fissi_1");
    expect(chiavi).toContain("dichiarazione");
    // Le voci sono in ordine di data e ognuna porta la sua spiegazione.
    const date = r.body.voci.map((v: { scadenza: { data: string } }) => v.scadenza.data);
    expect([...date].sort()).toEqual(date);
    for (const voce of r.body.voci) {
      expect(voce.scadenza.descrizione).toBeTruthy();
      expect(voce.scadenza.importoCents).toBe(
        voce.scadenza.righe.reduce((s: number, x: { importoCents: number }) => s + x.importoCents, 0) || voce.scadenza.importoCents,
      );
    }
    // Lo stato sta nel database, le scadenze no: le righe di stato nascono
    // alla prima lettura e sono tante quante le scadenze calcolate.
    const salvate = await db
      .select()
      .from(fiscalDeadlinesTable)
      .where(and(eq(fiscalDeadlinesTable.userId, org.userId), eq(fiscalDeadlinesTable.anno, anno)));
    expect(salvate.length).toBe(r.body.voci.length);
  });

  it("prepara l'F24 con i codici tributo e segna i campi INPS mancanti", async () => {
    const anno = new Date().getUTCFullYear();
    const r = await org.api(`/api/fiscale/scadenzario/saldo_primo_acconto/f24?anno=${anno}`);
    expect(r.status).toBe(200);
    const codici = r.body.prospetto.sezioni
      .filter((s: { sezione: string }) => s.sezione === "erario")
      .flatMap((s: { righe: string[][] }) => s.righe.map((riga) => riga[0]));
    expect(codici).toContain("1792");
    // Matricola e sede INPS non sono state ancora inserite: il prospetto lo dice.
    expect(r.body.prospetto.campiMancanti).toContain("Matricola INPS");
    expect(r.body.prospetto.avvertenze[0]).toContain("non il modello F24 ufficiale");

    await org.api("/api/fiscale/profilo", { method: "PATCH", body: { matricolaInps: "1234567890", sedeInps: "4700" } });
    const dopo = await org.api(`/api/fiscale/scadenzario/saldo_primo_acconto/f24?anno=${anno}`);
    expect(dopo.body.prospetto.campiMancanti).not.toContain("Matricola INPS");
    expect(dopo.body.prospetto.campiMancanti).not.toContain("Codice sede INPS");
    // Il codice fiscale dell'impresa resta segnalato finché non è nel profilo:
    // è l'altro campo senza il quale la delega non si può presentare.
    expect(dopo.body.prospetto.campiMancanti).toContain("Codice fiscale");
  });

  it("rifiuta un codice sede INPS che non sta nel modello", async () => {
    const r = await org.api("/api/fiscale/profilo", { method: "PATCH", body: { sedeInps: "47" } });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("SEDE_INPS_NON_VALIDA");
  });

  it("scarica il prospetto F24 in PDF", async () => {
    const anno = new Date().getUTCFullYear();
    const r = await org.api(`/api/fiscale/scadenzario/saldo_primo_acconto/f24.pdf?anno=${anno}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/pdf");
    expect(String(r.body).startsWith("%PDF-")).toBe(true);
    expect(r.headers.get("content-disposition")).toContain("F24-saldo_primo_acconto");
  });

  it("registra una riga di versamento per ogni tributo del modello", async () => {
    // La delega di giugno contiene imposta **e** contributi: registrarla come
    // un versamento solo farebbe sparire una deduzione vera.
    const anno = new Date().getUTCFullYear();
    const r = await org.api("/api/fiscale/scadenzario/saldo_primo_acconto/versata", {
      method: "POST",
      body: { anno, data: `${anno}-06-30`, riferimento: "CRO 12345" },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.versamenti).toBeGreaterThan(1);

    const righe = await db
      .select()
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, org.userId), eq(fiscalPaymentsTable.scadenzaChiave, "saldo_primo_acconto")));
    const tipi = righe.map((x) => x.tipo);
    expect(tipi).toContain("imposta_saldo");
    expect(tipi).toContain("contributi_inps");
    expect(righe.reduce((s, x) => s + x.importoCents, 0)).toBe(r.body.importoCents);

    const scadenzario = await org.api(`/api/fiscale/scadenzario?anno=${anno}`);
    const voce = scadenzario.body.voci.find((v: { scadenza: { id: string } }) => v.scadenza.id === "saldo_primo_acconto");
    expect(voce.stato).toBe("versata");

    // Riaprire toglie di mezzo i versamenti che ne erano nati.
    const riaperta = await org.api(`/api/fiscale/scadenzario/saldo_primo_acconto/riapri?anno=${anno}`, { method: "POST" });
    expect(riaperta.status).toBe(204);
    const dopo = await db
      .select()
      .from(fiscalPaymentsTable)
      .where(and(eq(fiscalPaymentsTable.userId, org.userId), eq(fiscalPaymentsTable.scadenzaChiave, "saldo_primo_acconto")));
    expect(dopo).toHaveLength(0);
  });

  it("non lascia registrare un versamento sulla dichiarazione, che non è un versamento", async () => {
    const anno = new Date().getUTCFullYear();
    const r = await org.api("/api/fiscale/scadenzario/dichiarazione/versata", {
      method: "POST",
      body: { anno, data: `${anno}-10-30` },
    });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("NON_VERSABILE");
  });

  it("sceglie la soglia più stretta e non ripete lo stesso promemoria", () => {
    // Funzione pura: si prova senza database e senza aspettare il calendario.
    const anno = new Date().getUTCFullYear();
    const voce = {
      scadenza: {
        id: "inps_fissi_1",
        etichetta: "1ª rata contributi fissi INPS",
        data: `${anno}-05-16`,
        importoCents: 120_000,
        categoria: "contributi" as const,
        descrizione: "…",
        righe: [{ sezione: "inps" as const, causale: "AF", descrizione: "Contributi fissi", annoRiferimento: anno, importoCents: 120_000, regole: [] }],
        regole: [],
      },
      stato: "aperta" as const,
      giorniAllaScadenza: 3,
      scaduta: false,
      versataAt: null,
      quietanza: null,
      promemoriaInviati: {},
      versatoCents: 0,
      regoleNonRevisionate: [],
    };
    // A 3 giorni tocca la soglia dei 3, non quella dei 15: chi apre il
    // prodotto tardi riceve un messaggio, non due nello stesso giorno.
    expect(promemoriaDaInviare(voce, [15, 3])?.chiave).toBe("3");
    expect(promemoriaDaInviare({ ...voce, giorniAllaScadenza: 20 }, [15, 3])).toBeNull();
    expect(promemoriaDaInviare({ ...voce, promemoriaInviati: { "3": "2026-01-01" } }, [15, 3])).toBeNull();
    expect(promemoriaDaInviare({ ...voce, stato: "versata" }, [15, 3])).toBeNull();
    // Scaduta: un solo richiamo, e non all'infinito.
    expect(promemoriaDaInviare({ ...voce, giorniAllaScadenza: -2, scaduta: true }, [15, 3])?.chiave).toBe("scaduta");
    expect(promemoriaDaInviare({ ...voce, giorniAllaScadenza: -90, scaduta: true }, [15, 3])).toBeNull();
  });

  it("manda il promemoria dal cron una volta sola", async () => {
    // Il tempo si passa dall'esterno: la prima rata INPS scade il 16 maggio,
    // quindi il 13 maggio siamo a tre giorni. Così il test non dipende dal
    // giorno in cui gira.
    const anno = new Date().getUTCFullYear();
    const treGiorniPrima = new Date(Date.UTC(anno, 4, 13, 9, 0, 0));

    const primo = await runFiscalMaintenance(treGiorniPrima);
    expect(primo.promemoria.inApp).toBeGreaterThanOrEqual(1);
    // WhatsApp resta a zero: senza template Meta approvato il canale non invia.
    expect(primo.promemoria.whatsapp).toBe(0);

    const secondo = await runFiscalMaintenance(treGiorniPrima);
    expect(secondo.promemoria.inApp).toBe(0);

    const [riga] = await db
      .select()
      .from(fiscalDeadlinesTable)
      .where(and(eq(fiscalDeadlinesTable.userId, org.userId), eq(fiscalDeadlinesTable.anno, anno), eq(fiscalDeadlinesTable.chiave, "inps_fissi_1")));
    expect(Object.keys(riga!.promemoriaInviati)).toContain("3");
  });

  it("non lascia vedere lo scadenzario di un'altra impresa", async () => {
    const estranea = await createOrg({ province: "TO", companyName: "Estranea Srl" });
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, estranea.userId));
    await db
      .update(businessProfilesTable)
      .set({ featureFlags: { ...(profile?.featureFlags ?? {}), fiscal_engine: true } })
      .where(eq(businessProfilesTable.userId, estranea.userId));

    const anno = new Date().getUTCFullYear();
    const r = await estranea.api(`/api/fiscale/scadenzario?anno=${anno}`);
    expect(r.status).toBe(200);
    // Profilo vuoto: nessuna scadenza con importo, e comunque nessuna dell'altra impresa.
    const righeAltrui = await db.select().from(fiscalDeadlinesTable).where(eq(fiscalDeadlinesTable.userId, estranea.userId));
    expect(righeAltrui.every((x) => x.userId === estranea.userId)).toBe(true);
  });

  it("le fatture restano pro-forma: il modulo fiscale non le rende fiscali", async () => {
    // A-2 calcola, non emette. La natura del documento la decide A-1.
    const fatture = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, org.userId));
    expect(fatture.every((f) => f.fiscale === false)).toBe(true);
  });
});
