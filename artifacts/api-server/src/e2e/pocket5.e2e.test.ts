// POCKET-5 (docs/POCKET-APP-PLAN.md, QuoteAI 128): il lato server di «Assistente, impostazioni, account». Provato sul server vero:
//  - Assistente d'impresa: senza Elite è spento; con i promemoria su «Chiedimi prima» una fattura scaduta diventa una proposta in italiano,
//    approvata parte per email col testo corretto, scartata si rimette; un ordine sotto scorta va in lista e si annulla dall'Attività;
//    un altro tenant riceve 404; i permessi si salvano e il promemoria automatico rispetta il livello;
//  - Preferenze e numeri della persona, Piano, profilo con le pagine delle Impostazioni (controllate) e i campi nuovi;
//  - Archivio (vista e ripristino del cliente), Importazioni (foglio e clienti, telefoni italiani), Parere dall'app;
//  - Ruoli: il mestiere di un membro, le paghe nascoste e l'invio fattura fermato quando l'interruttore è spento, nessun effetto su chi non ha un mestiere;
//  - Disiscrizione in italiano con «Riiscriviti».
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, assistantSuggestionsTable, businessProfilesTable, clientsTable, collaboratorsTable, costEntriesTable, inventoryItemsTable, invoicesTable, organizationMembersTable, quotesTable, suppliersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { runInvoiceMaintenance } from "../invoices/maintenance.js";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, seedQuote, daysAgo, type TestUser } from "./harness.js";
import { emailsTo } from "./mailbox.js";

describe("POCKET-5 — assistente, impostazioni, account", () => {
  let owner: TestUser;
  let stranger: TestUser;
  let pro: TestUser;
  let member: TestUser;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Assistente Srl", plan: "monthly_elite" });
    stranger = await createOrg({ companyName: "Estranei Srl", plan: "monthly_elite" });
    pro = await createOrg({ companyName: "Pro Srl", plan: "monthly_pro" });
    member = await createUser({ name: "Paola Ufficio" });
    await db.insert(organizationMembersTable).values({ ownerId: owner.userId, userId: member.userId, role: "office", status: "active", invitedEmail: member.email, invitedByUserId: owner.userId, joinedAt: new Date() });
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  /** An invoice of `org` already sent and `daysLate` past due, to a client with an email. */
  async function overdueInvoice(org: TestUser, daysLate: number) {
    const client = await org.api("/api/clients", { body: { name: "Dana Bianchi", email: `dana-${Date.now()}@example.invalid` } });
    expect(client.status, JSON.stringify(client.body)).toBeLessThan(300);
    const made = await org.api("/api/invoices", { body: { clientId: client.body.client.id, title: "Acconto", lines: [{ description: "Acconto 30%", quantity: 1, unitCents: 100_000, amountCents: 100_000 }], dueDays: 15 } });
    expect(made.status, JSON.stringify(made.body)).toBeLessThan(300);
    const id = made.body.invoice?.id ?? made.body.id;
    await db.update(invoicesTable).set({ status: "overdue", dueDate: daysAgo(daysLate), issueDate: daysAgo(daysLate + 15) }).where(eq(invoicesTable.id, id));
    return id as string;
  }

  test("assistente d'impresa: spento senza Elite; proposta, approvazione, scarta e rimetti; un altro tenant non la vede", async () => {
    const off = await pro.api("/api/assistant/company/overview");
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ enabled: false, requiredPlan: "monthly_elite", pending: [] });
    expect((await pro.api("/api/assistant/company/permissions", { method: "PUT", body: { levels: { reminders: 0 } } })).status).toBe(403);

    // Starting levels keep what the automations did; "ask first" for reminders is saved and read back.
    const start = await owner.api("/api/assistant/company/permissions");
    expect(start.body).toMatchObject({ enabled: true, canEdit: true, levels: { followups: 1, reminders: 1, receipts: 1, scheduling: 0, crew: 1 }, spendLimitCents: 30000 });
    const saved = await owner.api("/api/assistant/company/permissions", { method: "PUT", body: { levels: { reminders: 0 }, quiet: { from: 21 * 60 } } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.levels.reminders).toBe(0);
    expect(saved.body.quiet).toMatchObject({ on: true, from: 21 * 60, until: 7 * 60 });
    expect((await member.api("/api/assistant/company/permissions", { method: "PUT", body: { levels: { reminders: 1 } }, headers: { "x-active-org": owner.userId } })).status).toBe(403);

    const invoiceId = await overdueInvoice(owner, 5);
    const ov = await owner.api("/api/assistant/company/overview");
    expect(ov.status, JSON.stringify(ov.body)).toBe(200);
    const card = ov.body.pending.find((s: { kind: string; payload: { invoiceId?: string } }) => s.kind === "reminder" && s.payload.invoiceId === invoiceId);
    expect(card, JSON.stringify(ov.body.pending)).toBeTruthy();
    expect(card.payload).toMatchObject({ channel: "email", language: "it", daysLate: 5 });
    expect(card.payload.draft).toContain("Buongiorno Dana");

    // Dismiss, Undo, then approve with an edited text: the email carries it, the invoice counts the reminder, Activity says so.
    expect((await owner.api(`/api/assistant/company/suggestions/${card.id}/dismiss`, { body: {} })).status).toBe(200);
    expect((await owner.api(`/api/assistant/company/suggestions/${card.id}/restore`, { body: {} })).status).toBe(200);
    expect((await stranger.api(`/api/assistant/company/suggestions/${card.id}/approve`, { body: {} })).status).toBe(404);
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    const ok = await owner.api(`/api/assistant/company/suggestions/${card.id}/approve`, { body: { draft: "Buongiorno Dana, testo corretto a mano." } });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(emailsTo(inv!.customer.email!).some((m) => m.html.includes("testo corretto a mano"))).toBe(true);
    const [after] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    expect(after!.reminderCount).toBe(1);
    expect((await owner.api(`/api/assistant/company/suggestions/${card.id}/approve`, { body: {} })).status).toBe(409);
    const act = await owner.api("/api/assistant/company/activity");
    expect(act.status).toBe(200);
    expect(act.body.rows.some((r: { kind: string; whoKind: string; entityType?: string }) => r.kind === "reminder" && r.whoKind === "you")).toBe(true);
    expect(act.body.voice).toMatchObject({ used: expect.any(Number) });
    expect((await stranger.api("/api/assistant/company/activity")).body.rows.length).toBe(0);
  });

  test("assistente d'impresa: con «Chiedimi prima» il promemoria automatico non parte", async () => {
    const invoiceId = await overdueInvoice(owner, 4);
    await runInvoiceMaintenance(new Date());
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    expect(inv!.reminderCount).toBe(0);
    // Back to "do it and tell me": the daily run sends it and writes a "Regola" row.
    await owner.api("/api/assistant/company/permissions", { method: "PUT", body: { levels: { reminders: 1 } } });
    await runInvoiceMaintenance(new Date());
    const [sent] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
    expect(sent!.reminderCount).toBe(1);
    const act = await owner.api("/api/assistant/company/activity");
    expect(act.body.rows.some((r: { kind: string; whoKind: string; who: string }) => r.kind === "reminder" && r.whoKind === "auto" && r.who === "reminders")).toBe(true);
  });

  test("assistente d'impresa: un materiale sotto scorta diventa un ordine, in lista, che si annulla", async () => {
    const [sup] = await db.insert(suppliersTable).values({ userId: owner.userId, name: "Edilferro" }).returning();
    await db.insert(inventoryItemsTable).values({ userId: owner.userId, name: "Lastra cartongesso", unit: "lastre", par: "10", shopQty: "2" });
    await db.insert(costEntriesTable).values({ userId: owner.userId, supplierId: sup!.id, vendor: "Edilferro", category: "materials", amountCents: 4000, date: daysAgo(10), aiExtraction: { lines: [{ description: "Lastra cartongesso", quantity: 4, unitPrice: 9.5, total: 38 }] } } as never);
    const ov = await owner.api("/api/assistant/company/overview");
    const order = ov.body.pending.find((s: { kind: string }) => s.kind === "order");
    expect(order, JSON.stringify(ov.body.pending)).toBeTruthy();
    expect(order.payload).toMatchObject({ supplierName: "Edilferro", overLimit: false });
    expect(order.payload.lines[0]).toMatchObject({ name: "Lastra cartongesso", unitPriceCents: 950 });
    const ok = await owner.api(`/api/assistant/company/suggestions/${order.id}/approve`, { body: {} });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await stranger.api(`/api/assistant/company/activity/${ok.body.activityId}/undo`, { body: {} })).status).toBe(404);
    const undo = await owner.api(`/api/assistant/company/activity/${ok.body.activityId}/undo`, { body: {} });
    expect(undo.status, JSON.stringify(undo.body)).toBe(200);
    expect(undo.body).toMatchObject({ toast: "order", activity: { undone: true, word: "Undone" } });
    expect((await owner.api(`/api/assistant/company/activity/${ok.body.activityId}/undo`, { body: {} })).status).toBe(409);
    const [left] = await db.select().from(assistantSuggestionsTable).where(and(eq(assistantSuggestionsTable.userId, owner.userId), eq(assistantSuggestionsTable.id, order.id)));
    expect(left!.status).toBe("approved");
  });

  test("preferenze, numeri e piano", async () => {
    const start = await member.api("/api/me/preferences", { headers: { "x-active-org": owner.userId } });
    expect(start.body.preferences).toMatchObject({ voice: "ember", speak: true, confirmSend: true });
    const put = await member.api("/api/me/preferences", { method: "PUT", body: { voice: "tide", jobTitle: "Ufficio tecnico", home: { tabs: ["quotes", "jobs", "clients"] } }, headers: { "x-active-org": owner.userId } });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect((await member.api("/api/me/preferences", { headers: { "x-active-org": owner.userId } })).body.preferences).toMatchObject({ voice: "tide", jobTitle: "Ufficio tecnico" });
    // One person's choices are theirs: the owner's stay the defaults.
    expect((await owner.api("/api/me/preferences")).body.preferences.voice).toBe("ember");
    expect((await owner.api("/api/me/preferences", { method: "PUT", body: { language: "fr" } })).status).toBe(400);

    await seedQuote(owner.userId);
    const nums = await owner.api("/api/me/numbers?period=month");
    expect(nums.status).toBe(200);
    expect(nums.body).toMatchObject({ period: "month", scope: "company" });
    expect(nums.body.now.made).toBeGreaterThanOrEqual(1);
    expect(nums.body.months).toHaveLength(3);

    const plan = await owner.api("/api/plan/overview");
    expect(plan.status).toBe(200);
    expect(plan.body).toMatchObject({ plan: "monthly_elite", name: "Elite", active: true, openJobs: null, texts: null });
    expect(plan.body.logins).toMatchObject({ used: 2 });
    expect(plan.body.features).toEqual(expect.arrayContaining(["assistant", "calendar_sync"]));
    expect((await pro.api("/api/plan/overview")).body.features).not.toContain("assistant");
  });

  test("profilo: i campi nuovi e le pagine delle Impostazioni, una pagina cambia solo le sue chiavi", async () => {
    const a = await owner.api("/api/business-profile", { method: "PUT", body: { legalName: "Assistente S.r.l.", website: "https://assistente.example", brandColor: "#1F4F86", pocketSettings: { tax: { split: true }, widget: { colour: "harbour" } } } });
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    const b = await owner.api("/api/business-profile", { method: "PUT", body: { pocketSettings: { tax: { perLine: true }, defaults: { validDays: 45 } } } });
    expect(b.status, JSON.stringify(b.body)).toBe(200);
    expect(b.body).toMatchObject({ legalName: "Assistente S.r.l.", website: "https://assistente.example", brandColor: "#1F4F86" });
    expect(b.body.pocketSettings).toMatchObject({ tax: { split: true, perLine: true }, widget: { colour: "harbour" }, defaults: { validDays: 45 } });
    expect((await owner.api("/api/business-profile", { method: "PUT", body: { pocketSettings: { tax: { split: "si" } } } })).status).toBe(400);
    expect((await owner.api("/api/business-profile", { method: "PUT", body: { brandColor: "blu" } })).status).toBe(400);
    expect((await stranger.api("/api/business-profile")).body.pocketSettings).toEqual({});
  });

  test("archivio, importazioni e parere dall'app", async () => {
    const [c] = await db.insert(clientsTable).values({ userId: owner.userId, name: "Cliente archiviato", dedupKey: `archiviato-${Date.now()}`, archivedAt: new Date(), archivedByName: "Assistente Srl" }).returning();
    const [q] = await db.select().from(quotesTable).where(eq(quotesTable.userId, owner.userId)).limit(1);
    await db.update(quotesTable).set({ archivedAt: new Date(), archivedByName: "Assistente Srl" }).where(eq(quotesTable.id, q!.id));
    const ar = await owner.api("/api/archive/overview");
    expect(ar.status).toBe(200);
    expect(ar.body.items.find((i: { id: string }) => i.id === c!.id)).toMatchObject({ type: "client", title: "Cliente archiviato", state: "client" });
    expect(ar.body.items.find((i: { id: string }) => i.id === q!.id)).toMatchObject({ type: "quote" });
    expect((await stranger.api("/api/archive/overview")).body.items).toEqual([]);
    expect((await stranger.api(`/api/archive/clients/${c!.id}/restore`, { body: {} })).status).toBe(404);
    expect((await owner.api(`/api/archive/clients/${c!.id}/restore`, { body: {} })).status).toBe(200);
    const [back] = await db.select().from(clientsTable).where(eq(clientsTable.id, c!.id));
    expect(back!.archivedAt).toBeNull();

    const form = new FormData();
    form.append("file", new Blob(["Nome;Telefono;Email\nRossi Costruzioni;333 123 4567;rossi@example.invalid\n;02 1234;\n"], { type: "text/csv" }), "clienti.csv");
    const sheet = await owner.api("/api/imports/sheet", { form });
    expect(sheet.status, JSON.stringify(sheet.body)).toBe(200);
    expect(sheet.body).toMatchObject({ fileName: "clienti.csv", total: 2 });
    // A client the company already has, with the same mobile written without +39.
    await owner.api("/api/clients", { body: { name: "Rossi Costruzioni", phone: "333 123 4567" } });
    const imp = await owner.api("/api/imports/clients", { body: { rows: [
      { row: 2, name: "Verdi Impianti", phone: "347 555 0199", email: "verdi@example.invalid" },
      { row: 3, name: "Bianchi", phone: "333-55" },
      { row: 4, name: "Rossi bis", phone: "+39 333 1234567" },
    ] } });
    expect(imp.status, JSON.stringify(imp.body)).toBe(201);
    expect(imp.body).toMatchObject({ added: 1, errors: [{ row: 3, why: "short_phone" }] });
    expect(imp.body.matches).toEqual([expect.objectContaining({ row: 4, why: "phone", existingName: "Rossi Costruzioni" })]);

    const fb = new FormData();
    fb.append("kind", "idea"); fb.append("note", "Vorrei vedere le ore nella Home"); fb.append("appVersion", "0.1.0"); fb.append("device", "Pixel 8 · Android 16"); fb.append("screen", "Home");
    const sent = await owner.api("/api/feedback", { form: fb });
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    expect(sent.body.ref).toMatch(/^FB-[0-9A-F]{6}$/);
    const empty = new FormData();
    expect((await owner.api("/api/feedback", { form: empty })).status).toBe(400);
  });

  test("ruoli: paghe nascoste e invio fermato per chi ha un mestiere, niente per chi non ce l'ha", async () => {
    const [w] = await db.insert(collaboratorsTable).values({ userId: owner.userId, name: "Luca Muratore", hourlyRate: 2500 } as never).returning();
    expect(w).toBeTruthy();
    const as = { headers: { "x-active-org": owner.userId } };
    // Nobody gave Paola a job role: she sees what an office role always saw.
    const before = await member.api("/api/team/workers", as);
    expect(before.status, JSON.stringify(before.body)).toBe(200);
    expect(JSON.stringify(before.body)).toContain("hourlyRate");

    const list = await owner.api("/api/job-roles");
    expect(list.status).toBe(200);
    expect(list.body.included).toBe(true);
    expect(list.body.people.find((p: { id: string }) => p.id === member.userId)).toMatchObject({ access: "office", jobRole: "officeManager", assigned: false });
    expect((await pro.api("/api/job-roles/members/" + member.userId, { method: "PUT", body: { jobRole: "estimator" } })).status).toBe(403);
    expect((await stranger.api("/api/job-roles/members/" + member.userId, { method: "PUT", body: { jobRole: "estimator" } })).status).toBe(404);
    expect((await owner.api("/api/job-roles/members/" + owner.userId, { method: "PUT", body: { jobRole: "estimator" } })).status).toBe(409);
    const set = await owner.api("/api/job-roles/members/" + member.userId, { method: "PUT", body: { jobRole: "estimator" } });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(set.body.sensitive).toEqual({ payRates: false, margins: true, approveTime: false, sendInvoices: false });

    await new Promise((r) => setTimeout(r, 10_500)); // the restriction is cached for 10 s
    const after = await member.api("/api/team/workers", as);
    expect(after.status).toBe(200);
    expect(JSON.stringify(after.body)).not.toContain("hourlyRate");
    const me = await member.api("/api/me/job-role", as);
    expect(me.body).toMatchObject({ included: true, jobRole: "estimator", access: "office" });
    const invoiceId = await overdueInvoice(owner, 1);
    const blocked = await member.api(`/api/invoices/${invoiceId}/send`, { body: {}, ...as });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("SENSITIVE_OFF");
    // The owner is never restricted.
    expect(JSON.stringify((await owner.api("/api/team/workers")).body)).toContain("hourlyRate");
  }, 60_000);

  test("disiscrizione in italiano, con «Riiscriviti» che la toglie", async () => {
    const quote = await seedQuote(owner.userId);
    const [row] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    const page = await api(`/api/public/quotes/unsubscribe?token=${row!.unsubscribeToken}`);
    expect(page.status).toBe(200);
    expect(String(page.body)).toContain("Basta solleciti per email");
    expect(String(page.body)).toContain("Riiscriviti");
    expect(String(page.body)).toContain('lang="it"');
    const [off] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(off!.unsubscribedAt).not.toBeNull();
    const again = await api(`/api/public/quotes/resubscribe?token=${row!.unsubscribeToken}`, { method: "POST" });
    expect(again.status).toBe(200);
    expect(String(again.body)).toContain("Ti sei iscritto di nuovo");
    const [on] = await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id));
    expect(on!.unsubscribedAt).toBeNull();
    expect((await api("/api/public/quotes/unsubscribe?token=nope")).status).toBe(404);
    expect(String((await api("/api/public/quotes/unsubscribe")).body)).toContain("Manca il link");
  });

  test("le preferenze dell'app non toccano la Home del sito, e senza profilo il Profilo parte da zero", async () => {
    const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, stranger.userId));
    expect(p!.pocketSettings).toEqual({});
  });
});
