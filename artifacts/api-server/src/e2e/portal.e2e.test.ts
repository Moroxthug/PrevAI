// CLI-1 (docs/PIANO-AZIONE.md riga 50, QuoteAI Phase 76) — il portale del
// cliente da capo a fondo: link e invito dall'app, il codice (OTP via email →
// sessione), la panoramica costruita da una catena vera preventivo →
// contratto → cantiere → pro-forma, i messaggi nei due sensi (email, notifica,
// non letti), i PDF, le azioni sulla fattura, "firma ora" per un contratto da
// firmare, il "vedi tutto" su /i, /sign e /p, e i confini tra imprese.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, quotesTable, contractsTable, contractSignersTable, projectsTable, milestonesTable, invoicesTable, clientsTable, clientPortalsTable, jobPhotosTable, notificationsTable, auditLogTable, clientMessagesTable, automationRunsTable } from "@workspace/db";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { linkQuoteToClient } from "../lib/clients.js";
import { logContractEvent, finalizeContract, sendContractToCustomer } from "../contracts/service.js";
import { sendInvoice, invoiceToken } from "../invoices/service.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { startServer, stopServer, createOrg, cleanupAll, seedQuote, publicRef, api, type TestUser } from "./harness.js";
import { emailsTo, sentEmails } from "./mailbox.js";

const CLIENT_EMAIL = "portal-client@e2e-test.invalid";

async function raiseOrThrow(params: Parameters<typeof raiseAutomation>[0]) {
  const run = await raiseAutomation(params);
  if (!run) return;
  const [row] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.id, run.id));
  if (row?.status !== "succeeded") throw new Error(`automation ${params.event} → ${row?.status} ${row?.lastError ?? ""}`);
}

/** Preventivo accettato (legato a un cliente) → contratto firmato → cantiere con una fase completata → pro-forma di avanzamento inviata; più un secondo contratto inviato ma non firmato. */
async function seedClientChain(org: TestUser & { province: string }) {
  const { userId, province } = org;
  const quote = await seedQuote(userId, { province, clientName: "Cliente Portale", clientEmail: CLIENT_EMAIL });
  await linkQuoteToClient({ id: quote.id, userId, clientData: quote.clientData, province: quote.province }, province, { applyDefaultTerms: false });
  await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Cliente Portale" }).where(eq(quotesTable.id, quote.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: "Cliente Portale" } });
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id));
  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract!.id));
  for (const s of signers) {
    await db.update(contractSignersTable).set({ status: "signed", name: s.role === "contractor" ? "E2E Srl" : "Cliente Portale", signatureType: "typed", signatureData: "x", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, s.id));
    await logContractEvent({ contractId: contract!.id, type: s.role === "contractor" ? "contractor_signed" : "signed", actor: s.role === "contractor" ? "contractor" : "customer", signerId: s.id });
  }
  await finalizeContract(contract!.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract!.id));
  await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: "active", address: "Via Roma 12, Monza" }).where(eq(projectsTable.id, project!.id));
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project!.id));
  const release = milestones.find((m) => m.paymentTermId && m.paymentAmountCents)!;
  await db.update(milestonesTable).set({ status: "completed", actualStart: new Date(), actualEnd: new Date() }).where(eq(milestonesTable.id, release.id));
  await raiseOrThrow({ event: "milestone.completed", userId, entityType: "milestone", entityId: release.id, payload: { projectId: project!.id } });
  const [progressInvoice] = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, project!.id), eq(invoicesTable.paymentTermId, release.paymentTermId!)))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const { invoice: sent } = await sendInvoice({ invoiceId: progressInvoice!.id, userId, actor: "contractor" });

  // Un secondo preventivo accettato, stesso cliente → contratto inviato ma non firmato.
  const pending = await seedQuote(userId, { province, clientName: "Cliente Portale", clientEmail: CLIENT_EMAIL, status: "accepted" });
  await linkQuoteToClient({ id: pending.id, userId, clientData: pending.clientData, province: pending.province }, province, { applyDefaultTerms: false });
  await db.update(quotesTable).set({ acceptedAt: new Date(), acceptedByName: "Cliente Portale" }).where(eq(quotesTable.id, pending.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: pending.id, payload: { acceptedByName: "Cliente Portale" } });
  const [pendingContract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, pending.id));
  const [pc] = await db.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, pendingContract!.id), eq(contractSignersTable.role, "contractor")));
  await db.update(contractSignersTable).set({ status: "signed", name: "E2E Srl", signatureType: "typed", signatureData: "x", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, pc!.id));
  await logContractEvent({ contractId: pendingContract!.id, type: "contractor_signed", actor: "contractor", signerId: pc!.id });
  await sendContractToCustomer({ contractId: pendingContract!.id, userId, toEmail: CLIENT_EMAIL });

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project!.clientId!));
  const [photo] = await db.insert(jobPhotosTable).values({ userId, projectId: project!.id, fileName: "prima.png", fileSize: 100, mimeType: "image/png", fileUrl: `/objects/job-photos/${userId}/${project!.id}/missing.png` }).returning();
  return { quote, contract: contract!, pendingContract: pendingContract!, project: project!, invoice: sent, client: client!, photo: photo!, milestones };
}

const otpFrom = (subject: string) => subject.match(/^(\d{6}) /)?.[1] ?? null;

describe("Portale del cliente (CLI-1)", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let other: Awaited<ReturnType<typeof createOrg>>;
  let chain: Awaited<ReturnType<typeof seedClientChain>>;
  let token = "";
  let session = "";
  const sess = () => ({ "X-Portal-Session": session });

  beforeAll(async () => {
    await startServer();
    org = await createOrg();
    other = await createOrg({ companyName: "Altra Srl" });
    chain = await seedClientChain(org);
  }, 120_000);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("impresa: il link nasce alla prima lettura, vuole un'email, e l'invito parte", async () => {
    const status = await org.api(`/api/clients/${chain.client.id}/portal`);
    expect(status.status, JSON.stringify(status.body)).toBe(200);
    expect(status.body).toMatchObject({ hasEmail: true, email: CLIENT_EMAIL, invitedAt: null, lastSeenAt: null, unread: 0 });
    expect(status.body.url).toMatch(/\/portal\/[A-Za-z0-9_-]{40,}$/);
    token = String(status.body.url).split("/portal/")[1]!;
    // Deterministico: una seconda lettura dà lo stesso link.
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.url).toBe(status.body.url);

    const [noEmail] = await db.insert(clientsTable).values({ userId: org.userId, name: "Senza Email", dedupKey: `noemail-${org.userId}` }).returning();
    expect((await org.api(`/api/clients/${noEmail!.id}/portal`)).body).toMatchObject({ url: null, hasEmail: false });
    expect((await org.api(`/api/clients/${noEmail!.id}/portal/invite`, { body: {} })).status).toBe(409);
    // Un'altra impresa non legge il link di questo cliente.
    expect((await other.api(`/api/clients/${chain.client.id}/portal`)).status).toBe(404);

    const invite = await org.api(`/api/clients/${chain.client.id}/portal/invite`, { body: {} });
    expect(invite.status, JSON.stringify(invite.body)).toBe(200);
    const mail = emailsTo(CLIENT_EMAIL).find((m) => m.subject.includes("la tua area clienti"));
    expect(mail, "email d'invito").toBeTruthy();
    expect(mail!.html).toContain(status.body.url);
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.invitedAt).not.toBeNull();
  });

  test("impresa: l'id md5 della pagina del cliente arriva allo stesso cliente", async () => {
    const md5 = createHash("md5").update(chain.client.dedupKey).digest("hex");
    const listed = await org.api("/api/clients");
    expect(listed.status).toBe(200);
    expect((listed.body as Array<{ id: string }>).map((c) => c.id)).toContain(md5);

    const byMd5 = await org.api(`/api/clients/${md5}/portal`);
    expect(byMd5.status, JSON.stringify(byMd5.body)).toBe(200);
    expect(byMd5.body).toMatchObject({ email: CLIENT_EMAIL, clientId: chain.client.id });
    expect((await org.api(`/api/clients/${md5}/messages`)).status).toBe(200);
    expect((await other.api(`/api/clients/${md5}/portal`)).status).toBe(404);
    expect((await org.api(`/api/clients/${"0".repeat(32)}/portal`)).status).toBe(404);
    expect((await org.api("/api/clients/non-un-id/portal")).status).toBe(404);
  });

  test("impresa: un gruppo di preventivi senza riga cliente la crea alla lettura", async () => {
    await seedQuote(org.userId, { clientName: "Solo Vecchio", clientEmail: "solo-vecchio@e2e-test.invalid" });
    const key = "solo vecchio|solo-vecchio@e2e-test.invalid|0212345678";
    const md5 = createHash("md5").update(key).digest("hex");
    expect((await db.select().from(clientsTable).where(and(eq(clientsTable.userId, org.userId), eq(clientsTable.dedupKey, key)))).length).toBe(0);

    const portal = await org.api(`/api/clients/${md5}/portal`);
    expect(portal.status, JSON.stringify(portal.body)).toBe(200);
    expect(portal.body.email).toBe("solo-vecchio@e2e-test.invalid");
    const [row] = await db.select().from(clientsTable).where(and(eq(clientsTable.userId, org.userId), eq(clientsTable.dedupKey, key)));
    expect(row?.name).toBe("Solo Vecchio");
  });

  test("codice: il token da solo mostra impresa ed email mascherata; la sessione vuole il codice via email", async () => {
    const head = await api(`/api/portal/${token}`);
    expect(head.status).toBe(200);
    expect(head.body).toMatchObject({ company: { name: "E2E MI Srl" }, client: { name: "Cliente Portale", emailMasked: "po•••@e2e-test.invalid" }, authenticated: false });
    expect((await api(`/api/portal/${token}/overview`)).status).toBe(401);
    expect((await api(`/api/portal/${token}/overview`, { headers: { "X-Portal-Session": "non-una-sessione-vera-per-niente" } })).status).toBe(401);
    expect((await api(`/api/portal/${"x".repeat(43)}`)).status).toBe(404);

    const before = sentEmails.length;
    expect((await api(`/api/portal/${token}/otp`, { body: {} })).status).toBe(200);
    // Un secondo codice subito dopo non parte (la casella del cliente non si riempie).
    expect((await api(`/api/portal/${token}/otp`, { body: {} })).status).toBe(429);
    const otpMail = sentEmails.slice(before).find((m) => m.to.includes(CLIENT_EMAIL) && /codice di accesso/.test(m.subject));
    expect(otpMail, "email col codice").toBeTruthy();
    expect(sentEmails.slice(before).filter((m) => /codice di accesso/.test(m.subject))).toHaveLength(1);
    const code = otpFrom(otpMail!.subject)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(otpMail!.html).toContain(code);

    const wrong = await api(`/api/portal/${token}/verify`, { body: { code: code === "000000" ? "000001" : "000000" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ error: "invalid_code", attemptsLeft: 4 });
    expect((await api(`/api/portal/${token}/verify`, { body: { code: "12" } })).status).toBe(400);

    const ok = await api(`/api/portal/${token}/verify`, { body: { code } });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.session).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    session = ok.body.session;
    // Il codice vale una volta sola.
    expect((await api(`/api/portal/${token}/verify`, { body: { code } })).status).toBe(400);
    expect((await api(`/api/portal/${token}`, { headers: sess() })).body.authenticated).toBe(true);
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.lastSeenAt).not.toBeNull();
    // Nel DB solo hash.
    const [portalRow] = await db.select().from(clientPortalsTable).where(eq(clientPortalsTable.clientId, chain.client.id));
    expect(portalRow!.tokenHash).not.toContain(token);
    expect(portalRow!.otpHash).toBeNull();
  });

  test("panoramica: preventivi, i due contratti, la pro-forma inviata, il cantiere con fasi e foto — e nessuna bozza", async () => {
    const r = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { quotes, contracts, invoices, jobs, messages, client, company } = r.body;
    expect(company.name).toBe("E2E MI Srl");
    expect(client).toMatchObject({ name: "Cliente Portale", email: CLIENT_EMAIL });
    expect(quotes.map((q: { id: string; status: string }) => [q.id, q.status]).sort()).toEqual([[chain.quote.id, "accepted"], [chain.pendingContract.quoteId, "accepted"]].sort());
    // SEC-4: il link firmato, mai l'UUID nudo.
    expect(quotes[0].url).toMatch(/\/p\/[0-9a-f-]{36}\.[A-Za-z0-9_-]{22}$/);

    const signed = contracts.find((c: { id: string }) => c.id === chain.contract.id);
    const pending = contracts.find((c: { id: string }) => c.id === chain.pendingContract.id);
    expect(signed).toMatchObject({ status: "signed", canSign: false, jobId: chain.project.id });
    expect(pending).toMatchObject({ status: "sent", canSign: true });

    // La pro-forma di avanzamento è inviata; quella d'acconto fatta alla firma è una bozza e non si vede.
    const drafts = await db.select().from(invoicesTable).where(and(eq(invoicesTable.clientId, chain.client.id), eq(invoicesTable.status, "draft")));
    expect(drafts.length).toBeGreaterThan(0);
    expect(invoices.map((i: { id: string }) => i.id)).toEqual([chain.invoice.id]);
    expect(invoices[0]).toMatchObject({ number: chain.invoice.number, status: "sent", fiscale: false, balanceCents: chain.invoice.totalCents, canPayByCard: false, jobId: chain.project.id });
    expect(invoices[0]).toHaveProperty("iban");
    expect(invoices[0].url).toContain(`/i/${invoiceToken(chain.invoice)}`);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: chain.project.id, address: "Via Roma 12, Monza", status: "active" });
    expect(jobs[0].milestones.length).toBe(chain.milestones.length);
    expect(jobs[0].milestones.some((m: { status: string }) => m.status === "completed")).toBe(true);
    expect(jobs[0].photos).toEqual([expect.objectContaining({ id: chain.photo.id })]);
    expect(messages).toEqual([]);
  });

  test("un preventivo col link revocato non compare nel portale", async () => {
    const revoke = await org.api(`/api/quotes/${chain.quote.id}/public-link`, { method: "DELETE" });
    expect([200, 204]).toContain(revoke.status);
    const r = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(r.body.quotes.map((q: { id: string }) => q.id)).not.toContain(chain.quote.id);
    // Condiviso di nuovo dall'impresa, torna.
    await publicRef(chain.quote);
    const again = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(again.body.quotes.map((q: { id: string }) => q.id)).toContain(chain.quote.id);
  });

  test("messaggi: impresa → cliente per email col link; cliente → impresa con notifica, email e contatore", async () => {
    const before = sentEmails.length;
    const bad = await org.api(`/api/clients/${chain.client.id}/messages`, { body: { body: "x", jobId: "00000000-0000-0000-0000-000000000000" } });
    expect(bad.status).toBe(404);
    const posted = await org.api(`/api/clients/${chain.client.id}/messages`, { body: { body: "Le piastrelle arrivano giovedì, venerdì iniziamo il rivestimento.", jobId: chain.project.id } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body.emailed).toBe(true);
    expect(posted.body.message).toMatchObject({ sender: "contractor", jobId: chain.project.id, jobName: chain.project.name, readAt: null });
    const mail = sentEmails.slice(before).find((m) => m.to.includes(CLIENT_EMAIL) && m.subject.includes("nuovo messaggio"));
    expect(mail, "email del messaggio").toBeTruthy();
    expect(mail!.html).toContain("Le piastrelle arrivano giovedì");
    expect(mail!.html).toContain(`/portal/${token}`);

    // Aprire il portale lo segna letto.
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.messages).toHaveLength(1);
    expect(ov.body.messages[0]).toMatchObject({ sender: "contractor", jobName: chain.project.name });
    const [row] = await db.select().from(clientMessagesTable).where(eq(clientMessagesTable.id, ov.body.messages[0].id));
    expect(row!.readAt).not.toBeNull();
    expect(row!.emailedAt).not.toBeNull();

    // Il cliente risponde dal portale.
    const notBefore = (await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId))).length;
    const mailsBefore = sentEmails.length;
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "x", jobId: "00000000-0000-0000-0000-000000000000" }, headers: sess() })).status).toBe(404);
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "   " }, headers: sess() })).status).toBe(400);
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "ciao" } })).status).toBe(401);
    const reply = await api(`/api/portal/${token}/messages`, { body: { body: "Venerdì va bene. Il codice del cancello è 4471.", jobId: chain.project.id }, headers: sess() });
    expect(reply.status, JSON.stringify(reply.body)).toBe(201);
    expect(reply.body.message).toMatchObject({ sender: "client", senderName: "Cliente Portale", jobId: chain.project.id });

    const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId));
    expect(notes.length).toBe(notBefore + 1);
    expect(notes.find((n) => n.type === "client_message")).toMatchObject({ title: `Cliente Portale ha risposto per ${chain.project.name}`, link: `/dashboard/jobs/${chain.project.id}?tab=messages` });
    const ownerMail = sentEmails.slice(mailsBefore).find((m) => m.to.includes(`owner-${org.userId}@example.invalid`));
    expect(ownerMail, "email di risposta all'impresa").toBeTruthy();
    expect(ownerMail!.subject).toContain("nuova risposta");
    expect(ownerMail!.html).toContain("Il codice del cancello è 4471");

    // Una risposta senza cantiere porta alla pagina del cliente (l'md5 nell'indirizzo).
    await api(`/api/portal/${token}/messages`, { body: { body: "Una domanda in generale." }, headers: sess() });
    const general = (await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId))).find((n) => n.title === "Cliente Portale ti ha scritto");
    expect(general?.link).toBe(`/dashboard/clients/${createHash("md5").update(chain.client.dedupKey).digest("hex")}?tab=messages`);

    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.unread).toBe(2);
    const thread = await org.api(`/api/clients/${chain.client.id}/messages`);
    expect(thread.status).toBe(200);
    expect(thread.body.messages.map((m: { sender: string }) => m.sender)).toEqual(["contractor", "client", "client"]);
    expect(thread.body.client).toMatchObject({ name: "Cliente Portale", email: CLIENT_EMAIL });
    // Aprire lo scambio segna lette le risposte.
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.unread).toBe(0);
    expect((await other.api(`/api/clients/${chain.client.id}/messages`)).status).toBe(404);
    expect((await other.api(`/api/clients/${chain.client.id}/messages`, { body: { body: "intruso" } })).status).toBe(404);
    const audits = await db.select().from(auditLogTable).where(and(eq(auditLogTable.userId, org.userId), eq(auditLogTable.entityId, chain.client.id)));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["portal_invited", "portal_otp_sent", "portal_signed_in", "message_sent", "message_received"]));
  });

  test("documenti e azioni: i PDF vogliono la sessione e righe del cliente; carta onesta su Connect; il bonifico si segnala", async () => {
    const pdf = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pdf`, { headers: sess() });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect((await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pdf`)).status).toBe(401);
    const cpdf = await api(`/api/portal/${token}/contracts/${chain.contract.id}/pdf`, { headers: sess() });
    expect(cpdf.status).toBe(200);
    expect(cpdf.headers.get("content-type")).toContain("application/pdf");

    // Una bozza dello stesso cliente e il contratto di un'altra impresa sono 404 dal portale.
    const [draft] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.clientId, chain.client.id), eq(invoicesTable.status, "draft")));
    expect((await api(`/api/portal/${token}/invoices/${draft!.id}/pdf`, { headers: sess() })).status).toBe(404);
    const otherQuote = await seedQuote(other.userId);
    expect((await api(`/api/portal/${token}/contracts/${otherQuote.id}/pdf`, { headers: sess() })).status).toBe(404);
    expect((await api(`/api/portal/${token}/invoices/non-un-id/pdf`, { headers: sess() })).status).toBe(404);

    // Senza account Connect → 403 NOT_AVAILABLE, mai una chiamata a Stripe.
    const pay = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pay-link`, { body: {}, headers: sess() });
    expect(pay.status).toBe(403);
    expect(pay.body).toMatchObject({ error: "NOT_AVAILABLE" });

    const sent = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/mark-sent`, { body: {}, headers: sess() });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.status).toBe("pending_confirmation");
    expect((await api(`/api/portal/${token}/invoices/${chain.invoice.id}/mark-sent`, { body: {}, headers: sess() })).status).toBe(400);
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.invoices[0].status).toBe("pending_confirmation");

    // Foto: la riga è di un cantiere del cliente ma il file non c'è → 404 (non 500); foto di altri → 404; senza sessione → 401.
    expect((await api(`/api/portal/${token}/photos/${chain.photo.id}/file`, { headers: sess() })).status).toBe(404);
    expect((await api(`/api/portal/${token}/photos/${chain.photo.id}/file`)).status).toBe(401);
    const [foreignProject] = await db.insert(projectsTable).values({ userId: other.userId, name: "Altro", status: "active" }).returning();
    const [foreignPhoto] = await db.insert(jobPhotosTable).values({ userId: other.userId, projectId: foreignProject!.id, fileName: "x.png", fileSize: 1, mimeType: "image/png", fileUrl: `/objects/job-photos/${other.userId}/x.png` }).returning();
    expect((await api(`/api/portal/${token}/photos/${foreignPhoto!.id}/file`, { headers: sess() })).status).toBe(404);
  });

  test("firma ora: un link di firma nuovo col firmatario già verificato; il contratto firmato non si firma", async () => {
    expect((await api(`/api/portal/${token}/contracts/${chain.contract.id}/sign-link`, { body: {}, headers: sess() })).status).toBe(409);
    const link = await api(`/api/portal/${token}/contracts/${chain.pendingContract.id}/sign-link`, { body: {}, headers: sess() });
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const signToken = String(link.body.url).split("/sign/")[1]!;
    const page = await api(`/api/sign/${signToken}`);
    expect(page.status).toBe(200);
    expect(page.body.signer.otpVerified).toBe(true);
    expect(page.body.contract.portalUrl).toContain(`/portal/${token}`);
    // Si firma subito (niente passaggio del codice).
    const done = await api(`/api/sign/${signToken}/complete`, { body: { name: "Cliente Portale", signatureType: "drawn", signatureData: TINY_PNG_DATA_URL, consent: true } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.status).toBe("signed");
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.contracts.find((c: { id: string }) => c.id === chain.pendingContract.id)).toMatchObject({ status: "signed", canSign: false });
  });

  test("'vedi tutto': /i e /p portano il link al portale; un cliente senza email no", async () => {
    const inv = await api(`/api/i/${invoiceToken(chain.invoice)}`);
    expect(inv.status).toBe(200);
    expect(inv.body.invoice.portalUrl).toContain(`/portal/${token}`);
    const quote = await api(`/api/public/quotes/${await publicRef(chain.quote)}`);
    expect(quote.status).toBe(200);
    expect(quote.body.portalUrl).toContain(`/portal/${token}`);

    const unlinked = await seedQuote(org.userId, { clientName: "Nessun Legame" });
    expect((await api(`/api/public/quotes/${await publicRef(unlinked)}`)).body.portalUrl).toBeNull();
  });

  test("esci revoca la sessione; il link di un cliente archiviato smette di funzionare", async () => {
    expect((await api(`/api/portal/${token}/logout`, { body: {}, headers: sess() })).status).toBe(200);
    expect((await api(`/api/portal/${token}/overview`, { headers: sess() })).status).toBe(401);
    expect((await api(`/api/portal/${token}`)).body.authenticated).toBe(false);

    await db.update(clientsTable).set({ archivedAt: new Date() }).where(eq(clientsTable.id, chain.client.id));
    expect((await api(`/api/portal/${token}`)).status).toBe(404);
    expect((await api(`/api/i/${invoiceToken(chain.invoice)}`)).body.invoice.portalUrl).toBeNull();
    await db.update(clientsTable).set({ archivedAt: null }).where(eq(clientsTable.id, chain.client.id));
  });
});
