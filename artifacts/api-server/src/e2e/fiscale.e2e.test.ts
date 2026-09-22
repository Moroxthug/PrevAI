import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db, businessProfilesTable, taxProfilesTable, fiscalPaymentsTable, invoicesTable, clientsTable, clientDedupKey } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment } from "../invoices/service.js";
import { runFiscalMaintenance } from "../fiscale/maintenance.js";

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
    expect(r.body.revisione.regole.length).toBe(16);
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

  it("le fatture restano pro-forma: il modulo fiscale non le rende fiscali", async () => {
    // A-2 calcola, non emette. La natura del documento la decide A-1.
    const fatture = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, org.userId));
    expect(fatture.every((f) => f.fiscale === false)).toBe(true);
  });
});
