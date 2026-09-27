// V2-4 — incentivi v1 sulla struttura QuoteAI, sopra HTTP e contro lo staging:
//  • il catalogo di default viene seminato su un DB vuoto (statali + regionali + comunali)
//  • GET /api/public/incentives filtra per regione/comune/categoria come si aspetta il widget v1
//  • POST /api/public/quotes/:id/incentives calcola i bonus, li salva in clientData.incentivesData
//    (stesse chiavi dei preventivi storici in prod) e manda le due email con il riepilogo
//  • GET /api/public/quotes/:id/incentives (pagina /p/:id) propone i bandi della regione del cantiere
//  • il tick cron chiude i bandi scaduti e ri-verifica gli altri senza AI raggiungibile

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable, incentivesCatalogTable, type QuoteClientData } from "@workspace/db";
import { eq } from "drizzle-orm";
import "../automations/index.js";
import { startServer, stopServer, createOrg, seedQuote, cleanupAll, api, daysAgo } from "./harness.js";
import { sentEmails } from "./mailbox.js";

describe("incentivi v1: catalogo, widget, pagina pubblica, cron", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await db.delete(incentivesCatalogTable).where(eq(incentivesCatalogTable.codice, "E2E_SCADUTO"));
    await cleanupAll();
    await stopServer();
  });

  test("GET /api/public/incentives: statali sempre, regionali/comunali per territorio, categoria compatibile", async () => {
    const all = await api("/api/public/incentives");
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.success).toBe(true);
    const codici = all.body.incentives.map((i: { codice: string }) => i.codice);
    expect(codici).toEqual(expect.arrayContaining(["BONUS_CASA_50", "ECOBONUS_65", "BARRIERE_75", "CONTO_TERMICO_30"]));
    for (const inc of all.body.incentives) {
      expect(["statale", "regionale", "comunale"]).toContain(inc.level);
      expect(inc).not.toHaveProperty("province");
      expect(inc).not.toHaveProperty("incomeTested");
    }

    const lombardia = await api("/api/public/incentives?regione=Lombardia&categoria=efficienza_energetica");
    const lomb = lombardia.body.incentives as { level: string; regione: string | null; codice: string }[];
    expect(lomb.some((i) => i.codice === "LOMBARDIA_EFF_2026")).toBe(true);
    expect(lomb.every((i) => i.level === "statale" || i.regione === "Lombardia")).toBe(true);

    const piemonte = await api("/api/public/incentives?regione=Piemonte&categoria=tinteggiatura");
    const piem = piemonte.body.incentives as { level: string; codice: string }[];
    // Tinteggiatura: solo i bandi "tutti"/"ristrutturazione" — il bando caldaie (efficienza) resta fuori
    expect(piem.some((i) => i.codice === "PIEMONTE_CALDAIE")).toBe(false);
    expect(piem.some((i) => i.codice === "BONUS_CASA_50")).toBe(true);
    expect(piem.some((i) => i.codice === "ECOBONUS_65")).toBe(false);
  });

  test("POST /api/public/quotes/:id/incentives: calcolo v1, salvataggio nel preventivo, email", async () => {
    const org = await createOrg({ companyName: "Impresa Incentivi" });
    const quote = await seedQuote(org.userId, { clientEmail: "cliente-incentivi@e2e-test.invalid" });
    const before = sentEmails.length;

    const res = await api(`/api/public/quotes/${quote.id}/incentives`, {
      method: "POST",
      body: { tipoImmobile: "prima_casa", obiettivoLavori: "ristrutturazione", fasciaIsee: "sotto_30k", regione: "Lombardia", cap: "20100", totalePreventivo: 10000 },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      quoteId: quote.id,
      totaleLavori: 10000,
      scontoIvaStimato: 1000,
      detrazioneFiscaleDecennale: 5000,
      detrazioneFiscaleAnnua: 500,
      bonusStataleHumanVerified: false,
    });
    expect(res.body.bonusStataleApplicato).toMatch(/^Bonus Ristrutturazione Edilizia 50%/);
    // CAP di Milano + ISEE basso → bando comunale di Milano maggiorato del 25 % (3000 → 3750)
    expect(res.body.bandoRegionaleApplicato).toMatch(/Comune di Milano/);
    expect(res.body.esborsoImmediatoStimato).toBe(10000 - 3750 - 1000);

    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    const cd = row!.clientData as QuoteClientData;
    expect(cd.nome).toBe("Giulia Cliente"); // il resto del blocco cliente non viene toccato
    expect(cd.incentivesData).toMatchObject({ tipoImmobile: "prima_casa", regione: "Lombardia", cap: "20100", scontoIvaStimato: 1000, esborsoImmediatoStimato: 5250 });
    expect(Object.keys(cd.incentivesData!)).toEqual(expect.arrayContaining(["bonusStataleApplicato", "bandoRegionaleApplicato", "detrazioneFiscaleDecennale", "detrazioneFiscaleAnnua"]));

    // Due email: all'impresa (riepilogo con esborso) e al cliente
    await new Promise((r) => setTimeout(r, 200));
    const nuove = sentEmails.slice(before);
    expect(nuove.length).toBeGreaterThanOrEqual(2);
    const alImpresa = nuove.find((m) => m.to.some((t) => t.startsWith("owner-"))); // email del profilo impresa (createOrg)
    const alCliente = nuove.find((m) => m.to.includes("cliente-incentivi@e2e-test.invalid"));
    expect(alImpresa?.html).toMatch(/AGEVOLAZIONI|Agevolazioni/);
    expect(alImpresa?.html).toMatch(/ESBORSO IMMEDIATO STIMATO/);
    expect(alCliente?.html).toMatch(/Agevolazioni potenzialmente applicabili/);

    // Il PDF del preventivo (con il box incentivi) si genera senza errori
    const pdf = await org.api(`/api/quotes/${quote.id}/generate-pdf`, { method: "POST", body: {} });
    expect(pdf.status, JSON.stringify(pdf.body)).toBe(200);
    expect(pdf.body.pdfUrl).toBeTruthy();

    expect((await api(`/api/public/quotes/00000000-0000-0000-0000-000000000000/incentives`, { method: "POST", body: {} })).status).toBe(404);
  });

  test("GET /api/public/quotes/:id/incentives (pagina /p/:id): bandi della regione del cantiere", async () => {
    const org = await createOrg();
    const quote = await seedQuote(org.userId, { province: "MI" }); // MI → Lombardia, città Milano
    const res = await api(`/api/public/quotes/${quote.id}/incentives`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const list = res.body.incentives as { level: string; titolo: string; regione?: string }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => ["statale", "regionale", "comunale"].includes(i.level))).toBe(true);
    // "Ristrutturazione cucina" → categoria ristrutturazione: il bando comunale "tutti" di Milano c'è, il regionale energetico no
    expect(list.some((i) => /Comune di Milano/.test(i.titolo))).toBe(true);
    expect(list.some((i) => /Regione Lombardia/.test(i.titolo))).toBe(false);

    const napoli = await seedQuote(org.userId, { province: "NA" });
    const campania = (await api(`/api/public/quotes/${napoli.id}/incentives`)).body.incentives as { level: string }[];
    expect(campania.every((i) => i.level === "statale")).toBe(true);
  });

  test("cron: i bandi con scadenza superata vengono chiusi; gli altri ri-verificati senza AI", async () => {
    await db.insert(incentivesCatalogTable).values({
      level: "regionale", codice: "E2E_SCADUTO", titolo: "Bando scaduto e2e", descrizione: "x", regione: "Lazio",
      tipoAgevolazione: "fondo_perduto", scadenza: daysAgo(3), stato: "active",
    });
    const tick = await api("/api/cron/tick", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(tick.status, JSON.stringify(tick.body)).toBe(200);
    expect(tick.body.incentives.closed).toBeGreaterThanOrEqual(1);
    expect(tick.body.incentives.checked).toBeGreaterThan(0);
    const [row] = await db.select().from(incentivesCatalogTable).where(eq(incentivesCatalogTable.codice, "E2E_SCADUTO"));
    expect(row!.stato).toBe("closed");
    // Chiuso ⇒ sparisce dall'endpoint pubblico
    const pub = await api("/api/public/incentives?regione=Lazio");
    expect(pub.body.incentives.some((i: { codice: string }) => i.codice === "E2E_SCADUTO")).toBe(false);
  });
});
