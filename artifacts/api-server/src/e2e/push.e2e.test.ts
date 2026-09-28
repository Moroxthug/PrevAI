// APP-2 — notifiche push sul telefono, lato server (docs/APP-PLAN.md):
//  • iscrizione → una notifica della campanella di un tipo "push" parte cifrata
//    verso il browser (decifrata qui con la chiave privata dell'iscritto),
//    firmata VAPID; i tipi solo-campanella e `push: false` non partono
//  • il primo "cliente ha aperto il preventivo" dal link pubblico, una volta sola
//  • chi riceve cosa: il ruolo (la scadenza fiscale non arriva al capocantiere),
//    le preferenze della persona, un membro non più attivo non riceve nulla
//  • 410 dal servizio push → riga cancellata; disiscrizione; 503 senza chiavi

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, organizationMembersTable, pushSubscriptionsTable, notificationsTable } from "@workspace/db";
import { createNotification } from "../lib/notifications.js";
import { generateVapidKeys, decryptPayloadForTest, verifyVapidForTest } from "../lib/webPush.js";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, seedQuote } from "./harness.js";
import { installVendorStubs, stubHost, unstubHost, requestsTo, resetRecorded } from "./vendorStub.js";

const PUSH_HOST = "https://push.e2e-test.invalid/";

function browser() {
  const ua = createECDH("prime256v1");
  ua.generateKeys();
  const auth = randomBytes(16);
  const endpoint = `${PUSH_HOST}send/${randomUUID()}`;
  return { ua, auth, endpoint, subscription: { endpoint, keys: { p256dh: ua.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } } };
}

const pushesTo = (endpoint: string) => requestsTo(PUSH_HOST).filter((r) => r.url.startsWith(endpoint));
const settle = () => new Promise((r) => setTimeout(r, 200));

describe("Notifiche push (APP-2)", () => {
  const keys = generateVapidKeys();
  const saved = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  let status = 201;

  beforeAll(async () => {
    await startServer();
    installVendorStubs();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    stubHost(PUSH_HOST, () => new Response(null, { status }));
  });
  afterAll(async () => {
    unstubHost(PUSH_HOST);
    if (saved.pub) process.env.VAPID_PUBLIC_KEY = saved.pub; else delete process.env.VAPID_PUBLIC_KEY;
    if (saved.priv) process.env.VAPID_PRIVATE_KEY = saved.priv; else delete process.env.VAPID_PRIVATE_KEY;
    await cleanupAll();
    await stopServer();
  });

  test("iscrizione, consegna firmata, solo i tipi push, 410 cancella, disiscrizione", async () => {
    status = 201;
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();

    const cfg = await org.api("/api/push/config");
    expect(cfg.body).toMatchObject({ configured: true, ready: true, publicKey: keys.publicKey, subscribed: false, muted: [] });
    expect(cfg.body.kinds).toEqual(expect.arrayContaining([{ kind: "scadenza_fiscale", allowed: true }]));

    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    // Stesso browser di nuovo → stessa riga.
    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    expect(await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, org.userId))).toHaveLength(1);
    expect((await org.api(`/api/push/config?endpoint=${encodeURIComponent(b.endpoint)}`)).body.subscribed).toBe(true);

    resetRecorded();
    await createNotification({ userId: org.userId, type: "quote_accepted", title: "Rossi ha accettato il preventivo 12/2026", body: "Totale € 1.250,00", link: "/dashboard/quotes/q1", entityType: "quote", entityId: "q1" });
    const sent = pushesTo(b.endpoint);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.headers["content-encoding"]).toBe("aes128gcm");
    expect(verifyVapidForTest(sent[0]!.headers.authorization!, keys.publicKey)).toMatchObject({ aud: "https://push.e2e-test.invalid", sub: "mailto:notifiche@prevai.it" });

    // Solo campanella: un tipo che non è push, e una scadenza lontana (push: false).
    await createNotification({ userId: org.userId, type: "invoice_drafted", title: "Bozza pronta" });
    await createNotification({ userId: org.userId, type: "scadenza_fiscale", title: "Saldo IRPEF fra 30 giorni", push: false });
    await settle();
    expect(pushesTo(b.endpoint)).toHaveLength(1);
    const bell = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId));
    expect(bell.map((n) => n.type).sort()).toEqual(["invoice_drafted", "quote_accepted", "scadenza_fiscale"]);

    // La prova arriva solo ai browser di chi la chiede.
    const t = await org.api("/api/push/test", { body: {} });
    expect(t.body).toMatchObject({ sent: 1, failed: 0, removed: 0 });

    // Il servizio push dice che il browser non c'è più → riga cancellata.
    status = 410;
    await createNotification({ userId: org.userId, type: "lead_new", title: "Nuova richiesta dal sito: Bianchi" });
    expect(await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, b.endpoint))).toHaveLength(0);

    status = 201;
    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    expect((await org.api("/api/push/subscriptions", { method: "DELETE", body: { endpoint: b.endpoint } })).body).toEqual({ success: true, removed: true });
    expect((await org.api("/api/push/test", { body: {} })).body.skipped).toBe("no_subscriptions");
    expect((await org.api("/api/push/subscriptions", { body: { endpoint: "http://insecure.invalid/x", keys: b.subscription.keys } })).status).toBe(400);
  });

  test("il contenuto si decifra con la chiave dell'iscritto", async () => {
    status = 201;
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    const raw: Buffer[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(b.endpoint)) {
        raw.push(Buffer.from(init!.body as Uint8Array));
        return new Response(null, { status: 201 });
      }
      return real(input, init);
    }) as typeof fetch;
    try {
      expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
      await createNotification({ userId: org.userId, type: "lead_new", title: "Nuova richiesta dal sito: Bianchi", body: "Stima 3.400,00 €", link: "/dashboard/quotes/x", entityType: "lead", entityId: "l1" });
      expect(raw).toHaveLength(1);
      expect(JSON.parse(decryptPayloadForTest(raw[0]!, b.ua, b.auth).toString())).toEqual({ title: "Nuova richiesta dal sito: Bianchi", body: "Stima 3.400,00 €", link: "/dashboard/quotes/x", tag: "lead_new:l1" });
    } finally {
      globalThis.fetch = real;
    }
  });

  test("il primo cliente che apre il preventivo avvisa una volta sola", async () => {
    status = 201;
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(201);
    const quote = await seedQuote(org.userId, { status: "unlocked", clientName: "Mario Rossi" });
    resetRecorded();
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(200);
    expect((await api(`/api/public/quotes/${quote.id}`)).status).toBe(200);
    await settle();
    const viewed = (await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId))).filter((n) => n.type === "quote_viewed");
    expect(viewed).toHaveLength(1);
    expect(viewed[0]!.title).toMatch(/^Mario Rossi ha aperto il preventivo /);
    expect(viewed[0]!.link).toBe(`/dashboard/quotes/${quote.id}`);
    expect(pushesTo(b.endpoint)).toHaveLength(1);

    // Un preventivo in bozza non è pubblico: niente avviso.
    const draft = await seedQuote(org.userId, { status: "draft" });
    expect((await api(`/api/public/quotes/${draft.id}`)).status).toBe(404);
    expect((await db.select().from(notificationsTable).where(eq(notificationsTable.entityId, draft.id)))).toHaveLength(0);
  });

  test("chi riceve cosa: ruolo, preferenze, membro uscito", async () => {
    status = 201;
    const org = await createOrg({ plan: "monthly_elite" });
    const foreman = await createUser({ name: "Capocantiere" });
    await db.insert(organizationMembersTable).values({ ownerId: org.userId, userId: foreman.userId, role: "foreman", status: "active", invitedEmail: foreman.email, invitedByUserId: org.userId, joinedAt: new Date() });
    const ob = browser();
    const fb = browser();
    expect((await org.api("/api/push/subscriptions", { body: ob.subscription })).status).toBe(201);
    expect((await foreman.api("/api/push/subscriptions", { body: fb.subscription })).status).toBe(201);
    const [frow] = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, fb.endpoint));
    expect(frow).toMatchObject({ userId: org.userId, memberUserId: foreman.userId });

    const fcfg = await foreman.api("/api/push/config");
    expect(fcfg.body.kinds).toEqual(expect.arrayContaining([{ kind: "scadenza_fiscale", allowed: false }, { kind: "quote_accepted", allowed: true }]));

    resetRecorded();
    await createNotification({ userId: org.userId, type: "scadenza_fiscale", title: "F24 fra 7 giorni" });
    await createNotification({ userId: org.userId, type: "quote_accepted", title: "Accettato" });
    expect(pushesTo(ob.endpoint)).toHaveLength(2);
    expect(pushesTo(fb.endpoint)).toHaveLength(1);

    // Il capocantiere spegne "Preventivo accettato": solo per lui.
    const pref = await foreman.api("/api/push/preferences", { method: "PUT", body: { muted: ["quote_accepted"] } });
    expect(pref.body).toEqual({ muted: ["quote_accepted"] });
    expect((await foreman.api("/api/push/config")).body.muted).toEqual(["quote_accepted"]);
    expect((await foreman.api("/api/push/preferences", { method: "PUT", body: { muted: ["non_esiste"] } })).status).toBe(400);
    resetRecorded();
    await createNotification({ userId: org.userId, type: "quote_accepted", title: "Accettato di nuovo" });
    expect(pushesTo(ob.endpoint)).toHaveLength(1);
    expect(pushesTo(fb.endpoint)).toHaveLength(0);

    // Tolto dalla squadra: niente più notifiche, anche se il browser è ancora iscritto.
    await foreman.api("/api/push/preferences", { method: "PUT", body: { muted: [] } });
    await db.update(organizationMembersTable).set({ status: "suspended" }).where(eq(organizationMembersTable.userId, foreman.userId));
    resetRecorded();
    await createNotification({ userId: org.userId, type: "lead_new", title: "Nuova richiesta" });
    expect(pushesTo(ob.endpoint)).toHaveLength(1);
    expect(pushesTo(fb.endpoint)).toHaveLength(0);
  });

  test("503 senza chiavi VAPID", async () => {
    const org = await createOrg({ plan: "monthly_pro" });
    const b = browser();
    delete process.env.VAPID_PUBLIC_KEY;
    try {
      expect((await org.api("/api/push/config")).body).toMatchObject({ configured: false, publicKey: null });
      expect((await org.api("/api/push/subscriptions", { body: b.subscription })).status).toBe(503);
      expect((await org.api("/api/push/test", { body: {} })).status).toBe(503);
    } finally {
      process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    }
  });
});
