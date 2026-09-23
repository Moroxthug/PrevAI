import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Stripe from "stripe";
import { db, businessProfilesTable, addonEventsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupAll, api, type TestUser } from "./harness.js";

// ── A-5: add-on Amministrazione ──────────────────────────────────────────────
// Oggi l'offerta è in "interesse" (D5 chiusa il 2026-09-23, D6 e D8 aperte):
// si vede il prezzo e si registra l'interesse, ma non si vende. Il gating deve
// già funzionare come dopo il lancio — l'add-on
// pagato accende tutto il modulo, la parte a pagamento non si apre col solo
// calcolo fiscale, e gli eventi Stripe dell'add-on non toccano il piano.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_e2e");
const anno = new Date().getUTCFullYear();

function stripeEvent(type: string, object: Record<string, unknown>) {
  return JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: "event", type, data: { object } });
}

async function stripeWebhook(payload: string) {
  const base = await startServer();
  const res = await fetch(`${base}/api/payments/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! }) },
    body: payload,
  });
  return { status: res.status };
}

async function profilo(userId: string) {
  const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return p!;
}

describe("add-on PrevAI Fisco", () => {
  let org: TestUser & { province: string };

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ province: "RM", companyName: "Elettrica Add-on Srl" });
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  it("il riepilogo dice interesse, il nome, il prezzo della variante e i posti fondatori", async () => {
    const r = await org.api("/api/addons/amministrazione");
    expect(r.status).toBe(200);
    expect(r.body.offerta.stato).toBe("interesse");
    expect(r.body.offerta.nome).toBe("PrevAI Fisco");
    expect(r.body.offerta.etichettaIva).toBe("IVA inclusa");
    expect(r.body.offerta.gratuitoAttivo).toBe(false);
    // A offerta pubblica gli utenti non vedono l'elenco interno di ciò che manca.
    expect(r.body.offerta.mancanti).toEqual([]);
    expect(r.body.fondatori).toMatchObject({ posti: 100, mensileCents: 990, annualeCents: 9900 });
    expect(r.body.offerta.voci.length).toBeGreaterThan(4);
    expect(["a", "b", "c"]).toContain(r.body.prezzo.variante);
    expect(r.body.prezzo.annualeCents).toBe(r.body.prezzo.mensileCents * 10);
    expect(r.body.abbonamento.attivo).toBe(false);
    expect(r.body.funzioni).toEqual({ fattureSdi: false, calcoloFiscale: false, suite: false });
  });

  it("in 'interesse' non si vende, ma si registrano vista e interesse con la variante della campagna", async () => {
    const checkout = await org.api("/api/addons/amministrazione/checkout", { method: "POST", body: { intervallo: "annuale" } });
    expect(checkout.status).toBe(409);
    expect(checkout.body.error).toBe("ADDON_NOT_ON_SALE");

    const vista = await org.api("/api/addons/amministrazione/eventi", { method: "POST", body: { tipo: "vista", campagna: "c" } });
    expect(vista.status).toBe(200);
    expect(vista.body).toEqual({ registrato: true, variante: "c" });
    // La stessa impresa nello stesso giorno è una vista sola, e la variante non cambia più.
    const ancora = await org.api("/api/addons/amministrazione/eventi", { method: "POST", body: { tipo: "vista", campagna: "b" } });
    expect(ancora.body).toEqual({ registrato: false, variante: "c" });
    expect((await org.api("/api/addons/amministrazione/eventi", { method: "POST", body: { tipo: "interesse" } })).body.registrato).toBe(true);

    const r = await org.api("/api/addons/amministrazione");
    expect(r.body.prezzo).toMatchObject({ variante: "c", mensileCents: 1790, annualeCents: 17900 });
    expect(r.body.interesseRegistrato).toBe(true);
    const eventi = await db.select().from(addonEventsTable).where(eq(addonEventsTable.userId, org.userId));
    expect(eventi.map((e) => e.tipo).sort()).toEqual(["interesse", "vista"]);
  });

  it("l'endpoint pubblico dà stato e posti fondatori, senza account", async () => {
    const r = await api("/api/public/offerta-fisco");
    expect(r.status).toBe(200);
    expect(r.body.stato).toBe("interesse");
    expect(r.body.fondatori.posti).toBe(100);
    expect(r.body.fondatori.rimasti).toBeLessThanOrEqual(100);
    expect(Object.keys(r.body)).toEqual(["stato", "fondatori"]);
  });

  it("valida i corpi e tiene i numeri del test di prezzo per lo staff", async () => {
    expect((await org.api("/api/addons/amministrazione/checkout", { method: "POST", body: { intervallo: "settimanale" } })).status).toBe(400);
    expect((await org.api("/api/addons/amministrazione/eventi", { method: "POST", body: { tipo: "attivato" } })).status).toBe(400);
    expect((await org.api("/api/admin/addons/test-prezzo")).status).toBe(403);
    expect((await api("/api/addons/amministrazione")).status).toBe(401);
  });

  it("il solo calcolo fiscale non apre la parte a pagamento", async () => {
    await db.update(businessProfilesTable).set({ featureFlags: { fiscal_engine: true } }).where(eq(businessProfilesTable.userId, org.userId));
    const nota = await org.api(`/api/fiscale/prima-nota?anno=${anno}`);
    expect(nota.status).toBe(403);
    expect(nota.body.error).toBe("ADMIN_SUITE_OFF");
    const f24 = await org.api(`/api/fiscale/scadenzario/qualsiasi/f24?anno=${anno}`);
    expect(f24.status).toBe(403);
    expect(f24.body.error).toBe("ADMIN_SUITE_OFF");
    // Il calcolo invece risponde (onboarding da fare, ma il modulo c'è).
    expect((await org.api(`/api/fiscale/calcolo?anno=${anno}`)).status).not.toBe(403);
  });

  it("l'add-on attivo accende tutto il modulo e blocca la 2FA obbligatoria", async () => {
    await db
      .update(businessProfilesTable)
      .set({ featureFlags: {}, addons: { amministrazione: { stato: "attivo", variante: "a", intervallo: "annuale" } }, twoFactorRequired: false })
      .where(eq(businessProfilesTable.userId, org.userId));
    const bp = await org.api("/api/business-profile");
    expect(bp.body.features).toMatchObject({ sdi_invoicing: true, fiscal_engine: true, admin_suite: true });
    expect((await org.api(`/api/fiscale/prima-nota?anno=${anno}`)).status).toBe(200);
    const riepilogo = await org.api("/api/addons/amministrazione");
    expect(riepilogo.body.abbonamento).toMatchObject({ attivo: true, stato: "attivo", intervallo: "annuale" });
    expect(riepilogo.body.prezzo.variante).toBe("a");

    const policy = await org.api("/api/security/policy");
    expect(policy.body.twoFactorLocked).toBe(true);
    const spegni = await org.api("/api/security/policy", { method: "PATCH", body: { twoFactorRequired: false } });
    expect(spegni.status).toBe(409);
    expect(spegni.body.error).toBe("two_factor_locked");

    // Già attivo: niente secondo abbonamento (il 409 dello stato viene prima, ma
    // anche a offerta in vendita la risposta resterebbe un rifiuto).
    expect((await org.api("/api/addons/amministrazione/checkout", { method: "POST", body: { intervallo: "mensile" } })).status).toBe(409);
  });

  it("webhook: gli eventi dell'add-on aggiornano l'add-on e non toccano il piano", async () => {
    const customer = `cus_e2e_addon_${org.userId.slice(0, 8)}`;
    await db
      .update(businessProfilesTable)
      .set({ stripeCustomerId: customer, subscriptionPlan: "monthly_pro", subscriptionStatus: "active", addons: {}, twoFactorRequired: false })
      .where(eq(businessProfilesTable.userId, org.userId));

    const sub = (status: string, extra: Record<string, unknown> = {}) => ({
      id: "sub_e2e_addon",
      customer,
      status,
      cancel_at_period_end: false,
      metadata: { addon: "amministrazione", userId: org.userId, variante: "b", intervallo: "mensile", fondatore: "1" },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86_400, price: { id: "price_e2e_addon", lookup_key: "amministrazione_fondatori_mensile", unit_amount: 990, recurring: { interval: "month" } } }] },
      ...extra,
    });

    const postiPrima = (await api("/api/public/offerta-fisco")).body.fondatori.rimasti;
    expect((await stripeWebhook(stripeEvent("customer.subscription.created", sub("active")))).status).toBe(200);
    let p = await profilo(org.userId);
    expect(p.addons.amministrazione).toMatchObject({ stato: "attivo", subscriptionId: "sub_e2e_addon", intervallo: "mensile", prezzoCents: 990, fondatore: true });
    expect((await api("/api/public/offerta-fisco")).body.fondatori.rimasti).toBe(postiPrima - 1);
    expect(p.twoFactorRequired).toBe(true);
    expect(p.subscriptionPlan).toBe("monthly_pro");

    // Stripe ripete gli eventi: un secondo "created" non registra una seconda attivazione.
    await stripeWebhook(stripeEvent("customer.subscription.updated", sub("active")));
    const attivazioni = await db.select().from(addonEventsTable).where(and(eq(addonEventsTable.userId, org.userId), eq(addonEventsTable.tipo, "attivato")));
    expect(attivazioni).toHaveLength(1);

    await stripeWebhook(stripeEvent("customer.subscription.updated", sub("past_due")));
    p = await profilo(org.userId);
    expect(p.addons.amministrazione?.stato).toBe("insoluto");
    expect((await org.api("/api/business-profile")).body.features.admin_suite).toBe(true);

    // La disdetta dell'add-on: prima di A-5 avrebbe riportato l'impresa al piano gratuito.
    expect((await stripeWebhook(stripeEvent("customer.subscription.deleted", sub("canceled")))).status).toBe(200);
    p = await profilo(org.userId);
    expect(p.addons.amministrazione?.stato).toBe("cessato");
    // Il posto fondatori resta consumato anche dopo la disdetta.
    expect(p.addons.amministrazione?.fondatore).toBe(true);
    expect(p.subscriptionPlan).toBe("monthly_pro");
    expect(p.subscriptionStatus).toBe("active");
    expect((await org.api("/api/business-profile")).body.features).toMatchObject({ contracts: true, admin_suite: false, sdi_invoicing: false });
    const cessazioni = await db.select().from(addonEventsTable).where(and(eq(addonEventsTable.userId, org.userId), eq(addonEventsTable.tipo, "cessato")));
    expect(cessazioni).toHaveLength(1);

    // Senza add-on la 2FA si può di nuovo spegnere.
    expect((await org.api("/api/security/policy")).body.twoFactorLocked).toBe(false);
  });

  it("un abbonamento fondatori mai partito (incomplete) non consuma il posto", async () => {
    const altra = await createOrg({ province: "MI", companyName: "Fondatore Mancato Srl" });
    const prima = (await api("/api/public/offerta-fisco")).body.fondatori.rimasti;
    await stripeWebhook(
      stripeEvent("customer.subscription.created", {
        id: "sub_e2e_incomplete",
        customer: `cus_e2e_inc_${altra.userId.slice(0, 8)}`,
        status: "incomplete",
        metadata: { addon: "amministrazione", userId: altra.userId, variante: "a", intervallo: "annuale", fondatore: "1" },
        items: { data: [{ price: { id: "price_e2e_f", lookup_key: "amministrazione_fondatori_annuale", unit_amount: 9900, recurring: { interval: "year" } } }] },
      }),
    );
    const p = await profilo(altra.userId);
    expect(p.addons.amministrazione?.stato).toBe("cessato");
    expect(p.addons.amministrazione?.fondatore).toBeUndefined();
    expect((await api("/api/public/offerta-fisco")).body.fondatori.rimasti).toBe(prima);
  });

  it("i risultati del test di prezzo contano imprese distinte per variante", async () => {
    const { risultatiTestPrezzo, registraEventoInterno } = await import("../addons/amministrazione.js");
    const prima = await risultatiTestPrezzo();
    const rigaB = (r: typeof prima) => r.righe.find((x) => x.variante === "b")!;
    await registraEventoInterno(org.userId, "vista", "b");
    await registraEventoInterno(org.userId, "vista", "b");
    const dopo = await risultatiTestPrezzo();
    // Due viste della stessa impresa sono una impresa; l'attivazione del webhook qui sopra era sulla b.
    expect(rigaB(dopo).imprese.vista).toBe(rigaB(prima).imprese.vista + 1);
    expect(rigaB(dopo).imprese.attivato).toBeGreaterThanOrEqual(1);
    expect(rigaB(dopo).conversionePercent).not.toBeNull();
    expect(dopo.righe.map((r) => r.variante)).toEqual(["a", "b", "c"]);
  });

  it("webhook: la disdetta del piano resta la disdetta del piano", async () => {
    const [p0] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    await stripeWebhook(stripeEvent("customer.subscription.deleted", { id: "sub_e2e_plan", customer: p0!.stripeCustomerId, status: "canceled", items: { data: [{ price: { id: "price_1TUdJjCaDBaDETvnfBv37ryF" } }] } }));
    const p = await profilo(org.userId);
    expect(p.subscriptionStatus).toBe("cancelled");
    expect(p.subscriptionPlan).toBeNull();
    expect(p.addons.amministrazione?.stato).toBe("cessato");
  });
});
