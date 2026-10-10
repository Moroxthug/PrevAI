// POCKET-2 (docs/POCKET-APP-PLAN.md, QuoteAI 125): il lato server delle schermate dal preventivo all'incasso.
// Provato sul server vero:
//  - l'elenco dei preventivi porta numero, «visto» e «rifiutato»; la prima apertura del cliente segna firstViewedAt;
//  - il cliente può rifiutare dalla sua pagina (con motivo), una volta sola; un preventivo accettato non si rifiuta;
//    inviarlo di nuovo azzera il rifiuto; l'impresa vede il rifiuto in campanella;
//  - «Segna come vinto» (senza firma) accetta un preventivo inviato e ferma i solleciti; una bozza no;
//  - «Non incluso» e l'opzione consigliata; un preventivo già inviato e poi modificato diventa la versione 2, la prima resta;
//  - la scheda Clienti (elenco con totali e stato), il cliente con preventivi/documenti/cantieri, aggiungere e modificare
//    (senza duplicati, senza toccare i clienti di un'altra impresa);
//  - Oggi: la lista «da fare» si spunta per persona; la scheda dell'andamento per settimana, mese e trimestre;
//  - la ricevuta dell'ultimo pagamento arriva per email e il controllo prezzi porta una riga per voce.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, quotesTable, quoteVariantsTable, quoteVersionsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { startServer, stopServer, createOrg, seedQuote, cleanupAll, api, publicRef, daysAgo } from "./harness.js";
import { emailsTo } from "./mailbox.js";
import { sendInvoice, recordPayment } from "../invoices/service.js";

beforeAll(startServer);
afterAll(async () => {
  await cleanupAll();
  await stopServer();
});

const settle = () => new Promise((r) => setTimeout(r, 300));

describe("preventivi: visto, rifiutato, vinto", () => {
  test("l'elenco porta il numero; l'apertura del cliente segna «visto»; il rifiuto si registra una volta", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: daysAgo(2), numeroPreventivoData: "N° 7.2026 del 08/10/2026" }).where(eq(quotesTable.id, quote.id));

    const before = (await org.api("/api/quotes")).body.find((q: { id: string }) => q.id === quote.id);
    expect(before).toMatchObject({ numeroPreventivoData: "N° 7.2026 del 08/10/2026", firstViewedAt: null, declinedAt: null });

    const ref = await publicRef(quote);
    expect((await api(`/api/public/quotes/${ref}`)).status).toBe(200);
    await settle();
    const viewed = (await org.api("/api/quotes")).body.find((q: { id: string }) => q.id === quote.id);
    expect(viewed.firstViewedAt).not.toBeNull();

    const tooLong = await api(`/api/public/quotes/${ref}/decline`, { body: { reason: "x".repeat(501) } });
    expect(tooLong.status).toBe(400);
    const declined = await api(`/api/public/quotes/${ref}/decline`, { body: { reason: "Troppo caro" } });
    expect(declined.status, JSON.stringify(declined.body)).toBe(200);
    expect(declined.body.quote.declinedAt).not.toBeNull();
    const again = await api(`/api/public/quotes/${ref}/decline`, { body: { reason: "Un altro motivo" } });
    expect(again.status).toBe(200);
    expect(again.body.quote.declinedAt).toBe(declined.body.quote.declinedAt);

    const after = (await org.api("/api/quotes")).body.find((q: { id: string }) => q.id === quote.id);
    expect(after).toMatchObject({ declinedReason: "Troppo caro" });
    expect(after.declinedAt).not.toBeNull();
    const bell = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, org.userId), eq(notificationsTable.type, "quote_declined")));
    expect(bell).toHaveLength(1);
    expect(bell[0]!.body).toBe("Troppo caro");

    // Inviarlo di nuovo azzera il rifiuto.
    await db.update(quotesTable).set({ declinedAt: null, declinedReason: null }).where(eq(quotesTable.id, quote.id));
    expect((await db.select().from(quotesTable).where(eq(quotesTable.id, quote.id)))[0]!.declinedAt).toBeNull();
  });

  test("un preventivo accettato non si rifiuta; una bozza non si trova", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const done = await seedQuote(org.userId, { status: "unlocked" });
    const ref = await publicRef(done);
    expect((await api(`/api/public/quotes/${ref}/accept`, { body: { nomeConferma: "Mario Rossi" } })).status).toBe(200);
    expect((await api(`/api/public/quotes/${ref}/decline`, { body: {} })).status).toBe(409);
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await api(`/api/public/quotes/${draft.id}/decline`, { body: {} })).status).toBe(404);
  });

  test("segna come vinto: solo un preventivo inviato; ferma i solleciti; chi non ha il permesso non può", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await org.api(`/api/quotes/${draft.id}/mark-won`, { method: "POST", body: {} })).status).toBe(400);

    const sent = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: daysAgo(3), nextFollowUpAt: new Date(Date.now() + 86_400_000) }).where(eq(quotesTable.id, sent.id));
    const won = await org.api(`/api/quotes/${sent.id}/mark-won`, { method: "POST", body: {} });
    expect(won.status, JSON.stringify(won.body)).toBe(200);
    expect(won.body).toMatchObject({ status: "accepted" });
    expect(won.body.acceptedByName).toMatch(/Segnato come vinto/);
    const row = (await db.select().from(quotesTable).where(eq(quotesTable.id, sent.id)))[0]!;
    expect(row.nextFollowUpAt).toBeNull();
    // Idempotente.
    expect((await org.api(`/api/quotes/${sent.id}/mark-won`, { method: "POST", body: {} })).status).toBe(200);

    const stranger = await createOrg({ plan: "monthly_pro" });
    expect((await stranger.api(`/api/quotes/${sent.id}/mark-won`, { method: "POST", body: {} })).status).toBe(403);
  });

  test("con più opzioni serve quella scelta", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: daysAgo(1) }).where(eq(quotesTable.id, quote.id));
    const a = await org.api(`/api/quotes/${quote.id}/variants`, { method: "POST", body: { label: "Base" } });
    const b = await org.api(`/api/quotes/${quote.id}/variants`, { method: "POST", body: { label: "Premium" } });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    const none = await org.api(`/api/quotes/${quote.id}/mark-won`, { method: "POST", body: {} });
    expect(none.status).toBe(400);
    expect(none.body.error).toBe("VARIANT_REQUIRED");
    const ok = await org.api(`/api/quotes/${quote.id}/mark-won`, { method: "POST", body: { variantId: b.body.id } });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.acceptedVariantId).toBe(b.body.id);
  });
});

describe("preventivi: Non incluso, consigliata e versioni", () => {
  test("non incluso si salva; l'opzione consigliata è una sola", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "draft" });
    const put = await org.api(`/api/quotes/${quote.id}`, { method: "PUT", body: { exclusions: ["Opere murarie", "Smaltimento macerie"] } });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body.exclusions).toEqual(["Opere murarie", "Smaltimento macerie"]);
    expect((await org.api(`/api/quotes/${quote.id}`, { method: "PUT", body: { exclusions: [""] } })).status).toBe(400);

    const a = (await org.api(`/api/quotes/${quote.id}/variants`, { method: "POST", body: { label: "Base" } })).body;
    const b = (await org.api(`/api/quotes/${quote.id}/variants`, { method: "POST", body: { label: "Premium" } })).body;
    await org.api(`/api/quotes/${quote.id}/variants/${a.id}`, { method: "PUT", body: { recommended: true } });
    await org.api(`/api/quotes/${quote.id}/variants/${b.id}`, { method: "PUT", body: { recommended: true } });
    const rows = await db.select().from(quoteVariantsTable).where(eq(quoteVariantsTable.quoteId, quote.id));
    expect(rows.filter((r) => r.recommended).map((r) => r.id)).toEqual([b.id]);
  });

  test("un preventivo inviato e poi modificato diventa la versione 2; la prima resta", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: daysAgo(1) }).where(eq(quotesTable.id, quote.id));
    expect((await org.api(`/api/quotes/${quote.id}`)).body).toMatchObject({ version: 1, revisionOpen: false });

    const edit = await org.api(`/api/quotes/${quote.id}`, { method: "PUT", body: { note: "Valido 60 giorni" } });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body).toMatchObject({ version: 2, revisionOpen: true });
    // Altre modifiche prima del nuovo invio restano nella stessa versione.
    const again = await org.api(`/api/quotes/${quote.id}`, { method: "PUT", body: { note: "Valido 90 giorni" } });
    expect(again.body).toMatchObject({ version: 2, revisionOpen: true });

    const versions = await org.api(`/api/quotes/${quote.id}/versions`);
    expect(versions.status).toBe(200);
    expect(versions.body).toMatchObject({ current: 2, revisionOpen: true });
    expect(versions.body.versions).toHaveLength(1);
    expect(versions.body.versions[0]).toMatchObject({ version: 1 });
    expect(versions.body.versions[0].snapshot.note).toBe("Preventivo valido 30 giorni");
    expect(await db.select().from(quoteVersionsTable).where(eq(quoteVersionsTable.quoteId, quote.id))).toHaveLength(1);

    const stranger = await createOrg({ plan: "monthly_pro" });
    expect((await stranger.api(`/api/quotes/${quote.id}/versions`)).status).toBe(403);
  });

  test("una bozza non fa versioni", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "draft" });
    const edit = await org.api(`/api/quotes/${quote.id}`, { method: "PUT", body: { note: "Cambiato" } });
    expect(edit.body).toMatchObject({ version: 1, revisionOpen: false });
  });
});

describe("clienti", () => {
  test("elenco, cliente, aggiungere e modificare; un'altra impresa non vede niente", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const other = await createOrg({ plan: "monthly_elite" });

    const created = await org.api("/api/clients", { body: { name: "Giorgia Marini", phone: "333 123 4567", email: "giorgia@example.invalid", city: "Pescara", province: "pe", postalCode: "65100", businessNumber: "01234567890" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.client.id as string;
    expect(created.body.client).toMatchObject({ name: "Giorgia Marini", province: "PE", status: "prospect", businessNumber: "01234567890" });
    // Lo stesso nome, email e telefono non si aggiunge due volte.
    const dup = await org.api("/api/clients", { body: { name: "Giorgia Marini", phone: "333 123 4567", email: "giorgia@example.invalid" } });
    expect(dup.status).toBe(200);
    expect(dup.body.client.id).toBe(id);
    expect((await org.api("/api/clients", { body: { name: "", phone: "1" } })).status).toBe(400);
    expect((await org.api("/api/clients", { body: { name: "Senza email", email: "non-una-email" } })).status).toBe(400);

    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ clientId: id, sentAt: daysAgo(2), acceptedAt: daysAgo(1), status: "accepted", totale: "4000" }).where(eq(quotesTable.id, quote.id));

    const overview = await org.api("/api/clients/overview");
    expect(overview.status).toBe(200);
    expect(overview.body.items.map((c: { id: string }) => c.id)).toEqual([id]);
    expect(overview.body.items[0]).toMatchObject({ status: "active", quoteCount: 1, lifetimeCents: 400_000 });
    expect(overview.body.stats).toMatchObject({ total: 1, active: 1, lifetimeCents: 400_000 });

    const detail = await org.api(`/api/clients/${id}/overview`);
    expect(detail.status).toBe(200);
    expect(detail.body.quotes).toHaveLength(1);
    expect(detail.body.quotes[0]).toMatchObject({ id: quote.id, totalCents: 400_000 });

    const saved = await org.api(`/api/clients/${id}/details`, { method: "PUT", body: { phone: "334 000 1111", notes: "Citofono rotto", codiceFiscale: "MRNGRG80A41G482X" } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.client).toMatchObject({ phone: "334 000 1111", notes: "Citofono rotto", codiceFiscale: "MRNGRG80A41G482X" });

    // Un'altra impresa: niente nell'elenco, 404 sulla scheda e sulla modifica.
    expect((await other.api("/api/clients/overview")).body.items).toEqual([]);
    expect((await other.api(`/api/clients/${id}/overview`)).status).toBe(404);
    expect((await other.api(`/api/clients/${id}/details`, { method: "PUT", body: { notes: "intruso" } })).status).toBe(404);
    expect((await org.api(`/api/clients/${id}/details`)).status).toBe(404);
  });
});

describe("Oggi: andamento e lista da fare", () => {
  test("l'andamento risponde per settimana, mese e trimestre; un periodo sconosciuto no", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    for (const p of ["W", "M", "Q"] as const) {
      const r = await org.api(`/api/today/business?period=${p}`);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.period).toBe(p);
      expect(r.body.buckets).toHaveLength(p === "W" ? 8 : p === "M" ? 6 : 4);
    }
    expect((await org.api("/api/today/business?period=X")).status).toBe(400);
  });

  test("la lista si spunta per persona e si vede spuntata", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const quote = await seedQuote(org.userId, { status: "unlocked" });
    await db.update(quotesTable).set({ sentAt: daysAgo(5) }).where(eq(quotesTable.id, quote.id));
    const list = await org.api("/api/today/checklist");
    expect(list.status).toBe(200);
    const item = list.body.items.find((i: { id: string }) => i.id === `waiting:${quote.id}`);
    expect(item, JSON.stringify(list.body)).toBeTruthy();
    expect(item.done).toBe(false);

    expect((await org.api(`/api/today/checklist/waiting:${quote.id}`, { method: "PUT", body: { done: true } })).status).toBe(200);
    const after = await org.api("/api/today/checklist");
    expect(after.body.items.find((i: { id: string }) => i.id === `waiting:${quote.id}`).done).toBe(true);
    expect((await org.api(`/api/today/checklist/waiting:${quote.id}`, { method: "PUT", body: { done: false } })).status).toBe(200);
    expect((await org.api("/api/today/checklist/waiting:x", { method: "PUT", body: { done: "sì" } })).status).toBe(400);
    expect((await org.api("/api/today/checklist/%3Cscript%3E", { method: "PUT", body: { done: true } })).status).toBe(400);
    // Un compito di un altro cantiere non si completa.
    expect((await org.api(`/api/today/checklist/task:00000000-0000-4000-8000-000000000000`, { method: "PUT", body: { done: true } })).status).toBe(404);
  });
});

describe("ricevuta e controllo prezzi", () => {
  test("la ricevuta dell'ultimo pagamento arriva per email; senza pagamenti no", async () => {
    const org = await createOrg({ plan: "monthly_elite" });
    const email = `cliente-${org.userId}@example.invalid`;
    const client = await org.api("/api/clients", { body: { name: "Cliente Prova", email } });
    const made = await org.api("/api/invoices", { body: { clientId: client.body.client.id, title: "Acconto", lines: [{ description: "Acconto 30%", quantity: 1, unitCents: 100_000, amountCents: 100_000 }], dueDays: 15 } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const id = made.body.invoice.id as string;
    await sendInvoice({ invoiceId: id, userId: org.userId, actor: "contractor" });
    const none = await org.api(`/api/invoices/${id}/receipt`, { method: "POST", body: {} });
    expect(none.status).toBe(400);
    expect(none.body.error).toBe("NO_PAYMENT");

    await recordPayment({ invoiceId: id, userId: org.userId, amountCents: 40_000, method: "bank_transfer", sendReceipt: false });
    const sent = await org.api(`/api/invoices/${id}/receipt`, { method: "POST", body: {} });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    await settle();
    expect(emailsTo(email).some((m) => /ricevut|pagament/i.test(m.subject))).toBe(true);

    const stranger = await createOrg({ plan: "monthly_elite" });
    expect((await stranger.api(`/api/invoices/${id}/receipt`, { method: "POST", body: {} })).status).toBe(404);
  });

  test("il controllo prezzi porta una riga per voce, anche senza riferimenti", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const quote = await seedQuote(org.userId, { status: "draft" });
    const r = await org.api(`/api/quotes/${quote.id}/price-check`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.linesChecked).toBe(2);
    expect(r.body.lines).toHaveLength(2);
    expect(r.body.lines.every((l: { verdict: string }) => l.verdict === "no_data")).toBe(true);
  });
});
