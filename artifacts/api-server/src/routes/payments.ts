import { Router } from "express";
import { requireAuth, getUserId } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission";
import { getBaseUrl } from "../lib/baseUrl";
import { db, quotesTable, businessProfilesTable, authUsersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutSessionBody } from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { PREVENTIVI_SINGOLI, PREZZI_PIANI, lookupKeyPiano, pianoDaLookupKey, prezzoPianoCents, testoPreventivi, type IntervalloAddon, type PianoInAbbonamento } from "@workspace/config";
import { eAbbonamentoAddon, sincronizzaAbbonamento, type AbbonamentoStripe } from "../addons/amministrazione.js";

const TRIAL_DAYS = 7;
const TRIAL_DOWNLOAD_LIMIT = 3;

export function getTrialStatus(profile: typeof businessProfilesTable.$inferSelect | null | undefined) {
  if (!profile?.trialStartedAt) {
    return {
      isTrialActive: false,
      trialStartedAt: null,
      trialDownloadsUsed: 0,
      trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
      trialDaysLeft: null,
      trialExpiresAt: null,
    };
  }
  const now = new Date();
  const started = profile.trialStartedAt;
  const expiresAt = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const downloadsUsed = profile.trialDownloadsUsed ?? 0;
  const isExpiredByTime = now > expiresAt;
  const isExpiredByDownloads = downloadsUsed >= TRIAL_DOWNLOAD_LIMIT;
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isTrialActive = !isExpiredByTime && !isExpiredByDownloads;
  return {
    isTrialActive,
    trialStartedAt: started.toISOString(),
    trialDownloadsUsed: downloadsUsed,
    trialDownloadsLimit: TRIAL_DOWNLOAD_LIMIT,
    trialDaysLeft: isTrialActive ? daysLeft : 0,
    trialExpiresAt: expiresAt.toISOString(),
  };
}

const router = Router();

export const PLANS = [
  {
    id: "monthly_starter",
    stripePriceId: "price_1TUdJjCaDBaDETvnCGbjTgIq",
    name: "Starter",
    price: PREZZI_PIANI.monthly_starter.mensileCents / 100,
    annualPrice: PREZZI_PIANI.monthly_starter.annualeCents / 100,
    currency: "eur",
    interval: "month",
    features: [
      testoPreventivi("monthly_starter"),
      "PDF con logo aziendale",
      "Riga 'Fatto con prevai.it' in calce",
      "Template Standard incluso",
      "Upload appunti (2 preventivi/mese)",
      "Registrazione vocale (1 preventivo/mese)",
    ],
    hasWatermark: true,
    quotaPerMonth: PREZZI_PIANI.monthly_starter.preventiviMese,
    tier: "starter",
  },
  {
    id: "monthly_pro",
    stripePriceId: "price_1TUdJjCaDBaDETvnfBv37ryF",
    name: "Pro",
    price: PREZZI_PIANI.monthly_pro.mensileCents / 100,
    annualPrice: PREZZI_PIANI.monthly_pro.annualeCents / 100,
    currency: "eur",
    interval: "month",
    features: [
      testoPreventivi("monthly_pro"),
      "PDF puliti — nessun watermark",
      "Logo aziendale personalizzato",
      "Tutti i template PDF disponibili",
      "Upload appunti (30 preventivi/mese)",
      "Registrazione vocale (30 preventivi/mese)",
      "Priorità generazione AI",
    ],
    hasWatermark: false,
    quotaPerMonth: PREZZI_PIANI.monthly_pro.preventiviMese,
    tier: "pro",
  },
  {
    id: "monthly_elite",
    // Price storico a 59 €: lo tengono gli abbonati di prima di A-5. I nuovi
    // passano dalla lookup key piano_elite_* (79 €, decisione D5).
    stripePriceId: "price_1TUdJjCaDBaDETvnCo3JKGJ7",
    name: "Elite",
    price: PREZZI_PIANI.monthly_elite.mensileCents / 100,
    annualPrice: PREZZI_PIANI.monthly_elite.annualeCents / 100,
    currency: "eur",
    interval: "month",
    features: [
      "Preventivi illimitati",
      "PDF puliti — nessun watermark",
      "Logo aziendale personalizzato",
      "Tutti i template PDF disponibili",
      "Upload appunti illimitato",
      "Registrazione vocale illimitata",
      "Priorità massima generazione AI",
      "Supporto dedicato",
    ],
    hasWatermark: false,
    quotaPerMonth: PREZZI_PIANI.monthly_elite.preventiviMese,
    tier: "elite",
  },
  {
    id: "oneshot_watermark",
    stripePriceId: "price_1TUdJjCaDBaDETvnRnYfWJWh",
    name: "Singolo con Watermark",
    price: PREVENTIVI_SINGOLI.oneshot_watermark.cents / 100,
    annualPrice: null,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF", "Riga prevai.it in calce", "Download immediato"],
    hasWatermark: true,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
  {
    id: "oneshot_clean",
    stripePriceId: "price_1TUdJkCaDBaDETvnVsY6ZWec",
    name: "Singolo Pulito",
    price: PREVENTIVI_SINGOLI.oneshot_clean.cents / 100,
    annualPrice: null,
    currency: "eur",
    interval: null,
    features: ["1 preventivo PDF pulito", "Logo aziendale", "Nessun watermark", "Download immediato"],
    hasWatermark: false,
    quotaPerMonth: 1,
    tier: "oneshot",
  },
];

/**
 * Price Stripe storici → piano. Riconosce gli abbonati di prima di A-5 (Elite
 * a 59 € compreso), che tengono il loro prezzo: Stripe non tocca un
 * abbonamento esistente quando si crea un Price nuovo.
 */
export const PRICE_TO_PLAN = PLANS.reduce<Record<string, string>>((acc, plan) => {
  if (plan.stripePriceId) {
    acc[plan.stripePriceId] = plan.id;
  }
  return acc;
}, {});

/** Piano di un Price Stripe: prima per id storico, poi per lookup key (`piano_pro_annuale`). */
export function pianoDaPrezzo(price: { id?: string | null; lookup_key?: string | null } | null | undefined): string | null {
  if (!price) return null;
  if (price.id && PRICE_TO_PLAN[price.id]) return PRICE_TO_PLAN[price.id]!;
  return pianoDaLookupKey(price.lookup_key);
}

export class ErrorePrezzo extends Error {
  constructor(public readonly codice: string, message: string) {
    super(message);
  }
}

/**
 * Il Price da addebitare per un piano, con la garanzia che dica la stessa cosa
 * della pagina: lookup key `piano_<nome>_<periodo>` se esiste su Stripe,
 * altrimenti il Price storico **solo se** ha lo stesso importo (così Starter e
 * Pro continuano a vendersi al cutover senza toccare Stripe). Se nessuno dei
 * due torna, niente checkout: meglio un errore che un importo diverso da
 * quello mostrato.
 */
export async function prezzoPianoStripe(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  plan: (typeof PLANS)[number],
  intervallo: IntervalloAddon,
): Promise<string> {
  if (!plan.interval) return plan.stripePriceId; // preventivi singoli: prezzi invariati
  const piano = plan.id as PianoInAbbonamento;
  const atteso = prezzoPianoCents(piano, intervallo);
  const recurring = intervallo === "annuale" ? "year" : "month";
  const coincide = (p: { unit_amount: number | null; currency: string; recurring: { interval: string } | null; active: boolean }) =>
    p.active && p.unit_amount === atteso && p.currency === "eur" && p.recurring?.interval === recurring;
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKeyPiano(piano, intervallo)], active: true, limit: 1 });
  if (data[0]) {
    if (coincide(data[0])) return data[0].id;
    logger.error({ piano, intervallo, atteso, trovato: data[0].unit_amount }, "Price del piano su Stripe diverso dalla configurazione");
    throw new ErrorePrezzo("PLAN_PRICE_MISMATCH", "Il prezzo su Stripe non coincide con quello mostrato: pagamento sospeso.");
  }
  if (intervallo === "mensile") {
    const storico = await stripe.prices.retrieve(plan.stripePriceId).catch(() => null);
    if (storico && coincide(storico)) return storico.id;
  }
  throw new ErrorePrezzo("PLAN_PRICE_MISSING", `Prezzo "${lookupKeyPiano(piano, intervallo)}" non configurato su Stripe (RUNBOOKS §10.3).`);
}

router.get("/payments/plans", (_req, res) => {
  res.json(PLANS);
});

router.get("/payments/trial-status", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    res.json(getTrialStatus(profile ?? null));
  } catch (err) {
    logger.error({ err }, "Error getting trial status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/checkout", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const { quoteId, planType } = parsed.data;
    const intervallo: IntervalloAddon = parsed.data.billing === "annuale" ? "annuale" : "mensile";
    const plan = PLANS.find((p) => p.id === planType);
    if (!plan) {
      res.status(400).json({ error: "Invalid plan type" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let priceId: string;
    try {
      priceId = await prezzoPianoStripe(stripe, plan, intervallo);
    } catch (err) {
      if (err instanceof ErrorePrezzo) {
        res.status(503).json({ error: err.codice, message: err.message });
        return;
      }
      throw err;
    }

    const baseUrl = getBaseUrl();

    const successUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=success`
      : `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = quoteId
      ? `${baseUrl}/dashboard/quotes/${quoteId}?payment=cancelled`
      : `${baseUrl}/dashboard?payment=cancelled`;

    // Look up user email and existing stripeCustomerId to pre-fill checkout and avoid duplicate customers
    const [profile] = await db
      .select({ stripeCustomerId: businessProfilesTable.stripeCustomerId })
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));
    const [authUser] = await db
      .select({ email: authUsersTable.email })
      .from(authUsersTable)
      .where(eq(authUsersTable.id, userId));

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: plan.interval ? "subscription" : "payment",
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        quoteId: quoteId ?? "",
        planType,
        billing: intervallo,
        hasWatermark: String(plan.hasWatermark),
      },
    };

    // Reuse existing Stripe customer (prevents duplicate customers and ensures email match)
    if (profile?.stripeCustomerId) {
      sessionParams.customer = profile.stripeCustomerId;
    } else if (authUser?.email) {
      // Pre-fill email so the Stripe customer is created with the correct prevai email
      sessionParams.customer_email = authUser.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (quoteId) {
      await db
        .update(quotesTable)
        .set({ status: "pending_payment", stripeSessionId: session.id })
        .where(eq(quotesTable.id, quoteId));
    }

    res.json({ url: session.url!, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "Error creating checkout session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/subscription", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const isActive = profile?.subscriptionStatus === "active";
    const plan = PLANS.find(p => p.id === profile?.subscriptionPlan) ?? null;

    let quotaUsed: number | null = null;
    let quotaLimit: number | null = null;
    let quotaRemaining: number | null = null;
    let quotaResetDate: string | null = null;

    if (isActive && plan?.quotaPerMonth != null) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [{ count: used }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotesTable)
        .where(
          sql`${quotesTable.userId} = ${userId}
            AND ${quotesTable.createdAt} >= ${monthStart.toISOString()}
            AND ${quotesTable.createdAt} < ${nextMonthStart.toISOString()}`
        );

      quotaUsed = used ?? 0;
      quotaLimit = plan.quotaPerMonth;
      quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
      quotaResetDate = nextMonthStart.toISOString();
    }

    res.json({
      plan: profile?.subscriptionPlan ?? null,
      status: profile?.subscriptionStatus ?? null,
      periodEnd: profile?.subscriptionPeriodEnd?.toISOString() ?? null,
      isActive,
      quotaUsed,
      quotaLimit,
      quotaRemaining,
      quotaResetDate,
    });
  } catch (err) {
    logger.error({ err }, "Error getting subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Phase 66: any member who can edit quotes may unlock one with the org's
// subscription (the quote page calls this on open — `settings:full` made it
// 403 for every non-owner and left their quotes un-sendable).
router.post("/payments/unlock-quote", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const { quoteId } = req.body as { quoteId: string };

    if (!quoteId) {
      res.status(400).json({ error: "quoteId required" });
      return;
    }

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (profile?.subscriptionStatus !== "active") {
      res.status(403).json({ error: "No active subscription" });
      return;
    }

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quoteId));

    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    // Only a draft (or an abandoned one-shot checkout) is unlocked. This used
    // to be `!== "unlocked"`, which silently reverted every *accepted* quote
    // to "unlocked" the moment a subscriber opened it (Phase 66).
    if (quote.status === "draft" || quote.status === "pending_payment") {
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: profile.subscriptionPlan ?? null })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, userId, plan: profile.subscriptionPlan }, "Quote unlocked via subscription");
      res.json({ status: "unlocked" });
      return;
    }

    res.json({ status: quote.status });
  } catch (err) {
    logger.error({ err }, "Error unlocking quote with subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/portal", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    if (!profile?.stripeCustomerId) {
      res.status(400).json({ error: "No Stripe customer found — subscribe first" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const baseUrl = getBaseUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    logger.error({ err }, "Error creating customer portal session");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/sync-subscription", requireAuth, requirePermission("settings", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const stripe = await getUncachableStripeClient();

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    let customerId = profile?.stripeCustomerId ?? null;

    if (!customerId) {
      const [authUser] = await db
        .select({ email: authUsersTable.email })
        .from(authUsersTable)
        .where(eq(authUsersTable.id, userId));
      if (authUser?.email) {
        const customers = await stripe.customers.list({ email: authUser.email, limit: 5 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }
    }

    if (!customerId) {
      res.json({ synced: false, message: "No Stripe customer found for this account" });
      return;
    }



    const tutte = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });
    // A-5: l'add-on Amministrazione è un abbonamento a parte. Si sincronizza
    // per conto suo e non va scambiato per il piano (prima veniva preso
    // `data[0]` qualunque fosse).
    const subscriptions = { data: tutte.data.filter((s) => !eAbbonamentoAddon(s as unknown as AbbonamentoStripe)) };
    for (const s of tutte.data) {
      if (eAbbonamentoAddon(s as unknown as AbbonamentoStripe)) await sincronizzaAbbonamento(s as unknown as AbbonamentoStripe);
    }

    if (subscriptions.data.length === 0) {
      const cancelledSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "canceled",
        limit: 1,
      });

      await db
        .insert(businessProfilesTable)
        .values({ userId, stripeCustomerId: customerId, subscriptionStatus: "cancelled", subscriptionPlan: null })
        .onConflictDoUpdate({
          target: businessProfilesTable.userId,
          set: { stripeCustomerId: customerId, subscriptionStatus: cancelledSubs.data.length > 0 ? "cancelled" : null, subscriptionPlan: null },
        });

      res.json({ synced: true, active: false, message: "No active subscription found" });
      return;
    }

    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price?.id;
    const planType = pianoDaPrezzo(sub.items.data[0]?.price);

    if (!planType) {
      res.json({ synced: false, message: `Unknown price ID: ${priceId ?? "N/A"}` });
      return;
    }

    // As of Stripe SDK v22, current_period_end/start live on the individual
    // subscription item (no longer on the Subscription object): without this,
    // periodEnd always came out null and subscriptionPeriodEnd never got
    // synced correctly during a manual re-sync.
    const currentPeriodEnd = sub.items.data[0]?.current_period_end;
    const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;

    await db
      .insert(businessProfilesTable)
      .values({
        userId,
        stripeCustomerId: customerId,
        subscriptionPlan: planType,
        subscriptionStatus: "active",
        subscriptionPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: businessProfilesTable.userId,
        set: {
          stripeCustomerId: customerId,
          subscriptionPlan: planType,
          subscriptionStatus: "active",
          subscriptionPeriodEnd: periodEnd,
        },
      });

    logger.info({ userId, planType, customerId }, "Subscription synced manually");
    res.json({ synced: true, active: true, plan: planType });
  } catch (err) {
    logger.error({ err }, "Error syncing subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments/verify/:quoteId", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const quoteId = req.params["quoteId"] as string;

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!quote || quote.userId !== userId) {
      res.status(404).json({ error: "Quote not found" });
      return;
    }

    if (quote.status === "unlocked") {
      res.json({ status: "unlocked" });
      return;
    }

    if (!quote.stripeSessionId) {
      res.json({ status: quote.status });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(quote.stripeSessionId);

    if (session.payment_status === "paid" || session.status === "complete") {
      const planType = (session.metadata as Record<string, string> | null)?.planType ?? null;
      await db
        .update(quotesTable)
        .set({ status: "unlocked", unlockedWithPlan: planType })
        .where(eq(quotesTable.id, quoteId));
      logger.info({ quoteId, planType }, "Quote unlocked via verify endpoint");
      res.json({ status: "unlocked" });
      return;
    }

    res.json({ status: quote.status });
  } catch (err) {
    logger.error({ err }, "Error verifying payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
