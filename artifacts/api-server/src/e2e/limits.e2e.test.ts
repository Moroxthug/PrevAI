// SEC-2 (riga 43, docs/CONTROLLO-FASE-41.md §3 n. 3) — limiti e tetto IA sul database vero:
//  • due "istanze" del contatore con lo stesso nome contano sulla stessa riga;
//    la finestra scade e riparte da 1
//  • sopra il tetto mensile IA le rotte con l'IA rispondono 429 AI_BUDGET e
//    l'IA non viene chiamata; ai_budgets alza il tetto o lo toglie
//  • il widget sopra il tetto non perde il contatto: preventivo in bozza vuoto
//    + lead + notifica, e 429 AI_DEGRADED così il widget mostra la sua stima
// Serve la migrazione 0015 sul database di prova.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { db, businessProfilesTable, leadsTable, quotesTable, notificationsTable, usageEventsTable } from "@workspace/db";
import { SharedRateLimitStore } from "../lib/rateLimitStore.js";
import { tableReady } from "../assistant/ready.js";
import { aiBudgetState, forgetAiBudget } from "../lib/aiBudget.js";
import { startServer, stopServer, createOrg, cleanupAll, api } from "./harness.js";

const runId = randomUUID().slice(0, 8);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Limiti condivisi e tetto IA (SEC-2)", () => {
  const savedStore = process.env.RATE_LIMIT_STORE;

  beforeAll(async () => {
    await startServer();
    if (!(await tableReady("rate_limit_counters")) || !(await tableReady("ai_budgets"))) {
      throw new Error("SEC-2 e2e: esegui migrations/v2/0015_sec2_limiti.sql sul database di prova");
    }
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_STORE = savedStore;
    await db.execute(sql`delete from rate_limit_counters where key like ${`e2e-${runId}%`}`);
    await cleanupAll();
    await stopServer();
  });

  test("two instances count on the same row, and the window starts over", async () => {
    process.env.RATE_LIMIT_STORE = "shared";
    try {
      const a = new SharedRateLimitStore(`e2e-${runId}.shared`);
      const b = new SharedRateLimitStore(`e2e-${runId}.shared`);
      a.init({ windowMs: 1500 } as never);
      b.init({ windowMs: 1500 } as never);
      expect((await a.increment("1.2.3.4")).totalHits).toBe(1);
      expect((await b.increment("1.2.3.4")).totalHits).toBe(2);
      const third = await a.increment("1.2.3.4");
      expect(third.totalHits).toBe(3);
      expect(third.resetTime!.getTime()).toBeGreaterThan(Date.now());
      expect((await b.get("1.2.3.4"))?.totalHits).toBe(3);
      // Another client has its own row.
      expect((await b.increment("5.6.7.8")).totalHits).toBe(1);
      await b.decrement("1.2.3.4");
      expect((await a.get("1.2.3.4"))?.totalHits).toBe(2);
      await wait(1700);
      expect(await a.get("1.2.3.4")).toBeUndefined();
      expect((await b.increment("1.2.3.4")).totalHits).toBe(1);
      a.shutdown();
      b.shutdown();
    } finally {
      process.env.RATE_LIMIT_STORE = "memory";
    }
  });

  test("over the monthly cap: 429 AI_BUDGET before any AI call; ai_budgets lifts it", async () => {
    const org = await createOrg({ plan: "monthly_starter" }); // tetto 5,70 €
    // 1.000 centesimi di dollaro ≈ 8,60 € di IA questo mese.
    await db.insert(usageEventsTable).values({ userId: org.userId, kind: "ai_text", quantity: "1000", unitCostCents: "1" });
    forgetAiBudget(org.userId);
    expect(await aiBudgetState(org.userId)).toMatchObject({ superato: true, tettoEurCents: 570 });

    const r = await org.api("/api/quotes/suggest-item-description", { body: { brief: "Rasatura pareti" } });
    expect(r.status).toBe(429);
    expect(r.body).toMatchObject({ code: "AI_BUDGET" });
    expect(r.body.message).toMatch(/limite di spesa/);

    // Staff raises this one company's cap.
    await db.execute(sql`insert into ai_budgets (user_id, monthly_cap_eur_cents, note) values (${org.userId}, 5000, 'e2e')`);
    forgetAiBudget(org.userId);
    expect(await aiBudgetState(org.userId)).toMatchObject({ superato: false, tettoEurCents: 5000 });
    // …or removes it.
    await db.execute(sql`update ai_budgets set monthly_cap_eur_cents = null where user_id = ${org.userId}`);
    forgetAiBudget(org.userId);
    expect(await aiBudgetState(org.userId)).toMatchObject({ superato: false, tettoEurCents: null });
  });

  test("the widget over the cap still saves the request: empty draft, lead, notification", async () => {
    const apiKey = `pk_e2e_${randomUUID().replace(/-/g, "")}`;
    const org = await createOrg({ plan: "monthly_pro", profile: { apiKey } });
    await db.insert(usageEventsTable).values({ userId: org.userId, kind: "ai_vision", quantity: "5000", unitCostCents: "1" });
    forgetAiBudget(org.userId);

    const r = await api("/api/public/quotes", {
      headers: { "x-api-key": apiKey },
      body: { rawInput: "Rifare il bagno di 6 mq, piastrelle e sanitari", clientData: { nome: "Giulia Verdi", email: "giulia@example.invalid", phone: "3331234567" } },
    });
    expect(r.status).toBe(429);
    expect(r.body).toMatchObject({ code: "AI_DEGRADED", leadSaved: true });

    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.userId, org.userId));
    expect(lead).toMatchObject({ name: "Giulia Verdi", email: "giulia@example.invalid", source: "widget", status: "new" });
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, lead!.quoteId!));
    expect(quote).toMatchObject({ status: "draft", source: "widget", totale: "0.00", rawInput: "Rifare il bagno di 6 mq, piastrelle e sanitari" });
    expect(quote!.note).toMatch(/senza stima automatica/);
    expect(quote!.apiCost).toBeNull();
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, org.userId), like(notificationsTable.body, "%senza stima%")));
    expect(notes).toHaveLength(1);

    // Nothing was spent on this request.
    const [spent] = await db.select({ n: sql<number>`count(*)::int` }).from(usageEventsTable).where(eq(usageEventsTable.userId, org.userId));
    expect(spent!.n).toBe(1);
    // The profile is untouched (the key still works for the next month).
    const [p] = await db.select({ apiKey: businessProfilesTable.apiKey }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    expect(p!.apiKey).toBe(apiKey);
  });
});
