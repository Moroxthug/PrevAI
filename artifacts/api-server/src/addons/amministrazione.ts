// A-5: l'add-on Amministrazione come abbonamento Stripe.
//
// Tre regole guidano tutto il file:
//
//   1. **Il prezzo mostrato è il prezzo addebitato.** I prezzi stanno in
//      `@workspace/config/offerta` (una copia sola, D5). Su Stripe il titolare
//      crea un Price per ogni variante con una lookup key nota; il checkout lo
//      cerca per chiave e rifiuta di partire se l'importo non coincide.
//   2. **L'add-on è un secondo abbonamento, e non deve toccare il piano.**
//      Prima di A-5 il webhook trattava ogni `customer.subscription.deleted`
//      come la disdetta del piano: disdire l'add-on avrebbe riportato
//      l'impresa al piano gratuito. `eAbbonamentoAddon` separa i due flussi.
//   3. **Niente si vende prima del tempo.** `statoOfferta()` calcola lo stato
//      dai prerequisiti (D5, D6, D8): il checkout risponde 409 finché non è
//      `vendita`, qualunque cosa dica la configurazione.

import { and, eq, gte, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  db,
  addonEventsTable,
  businessProfilesTable,
  authUsersTable,
  effectivePlan,
  hasFeature,
  statoAddonDaStripe,
  addonAttivo,
  type AbbonamentoAddon,
  type BusinessProfile,
  type TipoEventoAddon,
} from "@workspace/db";
import {
  OFFERTA_AMMINISTRAZIONE,
  PREFISSO_LOOKUP_ADDON,
  VOCI_OFFERTA,
  etichettaIva,
  lookupKeyFondatori,
  lookupKeyStripe,
  offertaAlmeno,
  postiFondatoriRimasti,
  prezzoFondatoriCents,
  prezzoCents,
  statoOfferta,
  varianteDaId,
  varianteDiUtente,
  type IntervalloAddon,
  type StatoOffertaCalcolato,
  type VariantePrezzo,
} from "@workspace/config";
import { getUncachableStripeClient } from "../stripeClient.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { logger } from "../lib/logger.js";

export const ADDON = "amministrazione" as const;

export class ErroreAddon extends Error {
  constructor(
    public readonly codice: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function offertaCorrente(now: Date = new Date()): StatoOffertaCalcolato {
  return statoOfferta({ anno: now.getUTCFullYear() });
}

function abbonamentoDi(profile: Pick<BusinessProfile, "addons"> | null | undefined): AbbonamentoAddon {
  return profile?.addons?.[ADDON] ?? {};
}

/**
 * La variante già assegnata, oppure quella che l'impresa avrebbe se la si
 * assegnasse ora (hash dell'id). Leggere non scrive: l'assegnazione diventa
 * definitiva al primo evento.
 */
export function varianteDi(userId: string, profile: Pick<BusinessProfile, "addons"> | null | undefined): VariantePrezzo {
  return varianteDaId(abbonamentoDi(profile).variante) ?? varianteDiUtente(userId);
}

async function profiloDi(userId: string): Promise<BusinessProfile | null> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile ?? null;
}

async function scriviAbbonamento(userId: string, profile: BusinessProfile, patch: AbbonamentoAddon): Promise<AbbonamentoAddon> {
  const nuovo: AbbonamentoAddon = { ...abbonamentoDi(profile), ...patch, aggiornatoIl: new Date().toISOString() };
  await db
    .update(businessProfilesTable)
    .set({ addons: { ...(profile.addons ?? {}), [ADDON]: nuovo } })
    .where(eq(businessProfilesTable.userId, userId));
  return nuovo;
}

/**
 * Fissa la variante dell'impresa se non ne ha ancora una. `campagna` è il
 * `?v=` con cui l'utente è arrivato dalla landing: vince sull'hash, così chi
 * ha visto 9 € in un annuncio non si ritrova 15 € nel paywall.
 */
export async function assegnaVariante(userId: string, campagna?: string | null): Promise<VariantePrezzo> {
  const profile = await profiloDi(userId);
  const gia = varianteDaId(abbonamentoDi(profile).variante);
  if (gia) return gia;
  const daCampagna = varianteDaId(campagna);
  const variante = daCampagna ?? varianteDiUtente(userId);
  if (profile) {
    await scriviAbbonamento(userId, profile, {
      variante: variante.id,
      varianteFonte: daCampagna ? "campagna" : "utente",
      varianteAssegnataIl: new Date().toISOString(),
    });
  }
  return variante;
}

async function registra(userId: string, tipo: TipoEventoAddon, variante: string, extra: { intervallo?: string | null; importoCents?: number | null } = {}) {
  await db.insert(addonEventsTable).values({ userId, addon: ADDON, variante, tipo, intervallo: extra.intervallo ?? null, importoCents: extra.importoCents ?? null });
}

/**
 * Eventi che arrivano dall'interfaccia. `vista` conta una volta al giorno per
 * impresa (un paywall riaperto dieci volte non è dieci persone), `interesse`
 * una volta sola.
 */
export async function registraEventoUtente(userId: string, tipo: "vista" | "interesse", campagna?: string | null): Promise<{ registrato: boolean; variante: string }> {
  const offerta = offertaCorrente();
  if (!offertaAlmeno(offerta.effettivo, "interesse")) {
    // In bozza non si raccoglie niente: il test di prezzo non è ancora partito,
    // e le visite dello staff falserebbero i numeri.
    throw new ErroreAddon("OFFERTA_NON_PUBBLICA", 409, "L'offerta non è ancora pubblica.");
  }
  const variante = await assegnaVariante(userId, campagna);
  const da = tipo === "vista" ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date(0);
  const [gia] = await db
    .select({ id: addonEventsTable.id })
    .from(addonEventsTable)
    .where(and(eq(addonEventsTable.userId, userId), eq(addonEventsTable.addon, ADDON), eq(addonEventsTable.tipo, tipo), gte(addonEventsTable.createdAt, da)))
    .limit(1);
  if (gia) return { registrato: false, variante: variante.id };
  await registra(userId, tipo, variante.id);
  return { registrato: true, variante: variante.id };
}

export type RiepilogoAddon = {
  offerta: {
    nome: string;
    stato: StatoOffertaCalcolato["effettivo"];
    gratuitoAttivo: boolean;
    ivaInclusa: boolean;
    etichettaIva: string;
    /** Cosa manca per arrivare alla vendita. Vuoto per chi la vede pubblicata. */
    mancanti: string[];
    voci: typeof VOCI_OFFERTA;
  };
  prezzo: {
    variante: string;
    mensileCents: number;
    annualeCents: number;
    /** Con il piano Elite il mensile è quello del bundle. */
    conElite: boolean;
    mensileEffettivoCents: number;
  };
  abbonamento: {
    attivo: boolean;
    stato: AbbonamentoAddon["stato"] | null;
    intervallo: AbbonamentoAddon["intervallo"] | null;
    finePeriodo: string | null;
    disdettaAFinePeriodo: boolean;
    betaFino: string | null;
  };
  funzioni: { fattureSdi: boolean; calcoloFiscale: boolean; suite: boolean };
  interesseRegistrato: boolean;
  fondatori: StatoFondatori;
};

export async function riepilogo(userId: string): Promise<RiepilogoAddon> {
  const profile = await profiloDi(userId);
  const offerta = offertaCorrente();
  const variante = varianteDi(userId, profile);
  const conElite = effectivePlan(profile) === "monthly_elite";
  const abb = abbonamentoDi(profile);
  const [interesse] = await db
    .select({ id: addonEventsTable.id })
    .from(addonEventsTable)
    .where(and(eq(addonEventsTable.userId, userId), eq(addonEventsTable.addon, ADDON), eq(addonEventsTable.tipo, "interesse")))
    .limit(1);
  return {
    offerta: {
      nome: OFFERTA_AMMINISTRAZIONE.nome,
      stato: offerta.effettivo,
      gratuitoAttivo: offerta.gratuitoAttivo,
      ivaInclusa: OFFERTA_AMMINISTRAZIONE.ivaInclusa,
      etichettaIva: etichettaIva(),
      // Solo in bozza, cioè solo per chi prova la pagina dall'interno: a offerta
      // pubblica gli utenti non hanno bisogno di sapere cosa manca alla vendita.
      mancanti: offerta.effettivo === "bozza" ? offerta.mancanti.map((m) => m.testo) : [],
      voci: VOCI_OFFERTA,
    },
    prezzo: {
      variante: variante.id,
      mensileCents: variante.mensileCents,
      annualeCents: variante.annualeCents,
      conElite,
      mensileEffettivoCents: prezzoCents(variante, "mensile", conElite),
    },
    abbonamento: {
      attivo: addonAttivo(abb),
      stato: abb.stato ?? null,
      intervallo: abb.intervallo ?? null,
      finePeriodo: abb.finePeriodo ?? null,
      disdettaAFinePeriodo: abb.disdettaAFinePeriodo ?? false,
      betaFino: abb.betaFino ?? null,
    },
    funzioni: {
      fattureSdi: hasFeature(profile, "sdi_invoicing"),
      calcoloFiscale: hasFeature(profile, "fiscal_engine"),
      suite: hasFeature(profile, "admin_suite"),
    },
    interesseRegistrato: Boolean(interesse),
    fondatori: await statoFondatori(),
  };
}

// ── Prezzo fondatori ─────────────────────────────────────────────────────────

/** Imprese che hanno preso un posto fondatori (anche se poi hanno disdetto). */
export async function fondatoriPresi(): Promise<number> {
  const [riga] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessProfilesTable)
    .where(sql`${businessProfilesTable.addons} -> ${ADDON} ->> 'fondatore' = 'true'`);
  return riga?.n ?? 0;
}

export type StatoFondatori = { posti: number; rimasti: number; finoAl: string; mensileCents: number; annualeCents: number; aperti: boolean };

export async function statoFondatori(now: Date = new Date()): Promise<StatoFondatori> {
  const f = OFFERTA_AMMINISTRAZIONE.fondatori;
  const rimasti = postiFondatoriRimasti(await fondatoriPresi(), now);
  return { posti: f.posti, rimasti, finoAl: f.finoAl, mensileCents: f.mensileCents, annualeCents: f.annualeCents, aperti: rimasti > 0 };
}

// ── Checkout ─────────────────────────────────────────────────────────────────

const INTERVALLO_STRIPE: Record<IntervalloAddon, "month" | "year"> = { mensile: "month", annuale: "year" };

/**
 * Cerca il Price per lookup key e controlla che dica la stessa cosa della
 * configurazione. Un Price mancante o diverso blocca la vendita invece di
 * addebitare un importo che l'utente non ha visto.
 */
export async function prezzoStripe(stripe: Stripe, chiave: string, attesoCents: number, intervallo: IntervalloAddon): Promise<Stripe.Price> {
  const { data } = await stripe.prices.list({ lookup_keys: [chiave], active: true, limit: 1 });
  const price = data[0];
  if (!price) {
    throw new ErroreAddon("ADDON_PRICE_MISSING", 503, `Prezzo "${chiave}" non configurato su Stripe (RUNBOOKS §10).`);
  }
  if (price.unit_amount !== attesoCents || price.currency !== "eur" || price.recurring?.interval !== INTERVALLO_STRIPE[intervallo]) {
    logger.error({ chiave, attesoCents, trovato: price.unit_amount, currency: price.currency, interval: price.recurring?.interval }, "Prezzo add-on su Stripe diverso dalla configurazione");
    throw new ErroreAddon("ADDON_PRICE_MISMATCH", 503, `Il prezzo "${chiave}" su Stripe non coincide con quello mostrato: vendita sospesa.`);
  }
  return price;
}

export async function creaCheckout(opts: { userId: string; intervallo: IntervalloAddon; twoFactorEnabled: boolean }): Promise<{ url: string }> {
  const { userId, intervallo } = opts;
  const offerta = offertaCorrente();
  if (offerta.effettivo !== "vendita") {
    throw new ErroreAddon("ADDON_NOT_ON_SALE", 409, "L'add-on non è ancora in vendita.");
  }
  const profile = await profiloDi(userId);
  if (!profile) throw new ErroreAddon("PROFILE_MISSING", 400, "Completa prima il profilo aziendale.");
  const abb = abbonamentoDi(profile);
  if (addonAttivo(abb) && abb.stato !== "beta") {
    throw new ErroreAddon("ADDON_ALREADY_ACTIVE", 409, "L'add-on è già attivo su questo account.");
  }
  // A-0 §6.5: il modulo impone la 2FA a tutta l'organizzazione. Chi compra deve
  // già averla, altrimenti l'attivazione lo chiuderebbe fuori dal suo account.
  if (!opts.twoFactorEnabled) {
    throw new ErroreAddon("two_factor_not_enabled", 400, "Attiva prima la verifica in due passaggi sul tuo account (Impostazioni → Sicurezza).");
  }

  const variante = await assegnaVariante(userId);
  const conElite = effectivePlan(profile) === "monthly_elite";
  // Si applica il prezzo più basso fra quelli a cui l'impresa ha diritto: il
  // bundle Elite mensile (4,90) batte i fondatori (9,90), che battono il listino.
  const listino = prezzoCents(variante, intervallo, conElite);
  const fondatori = await statoFondatori();
  const daFondatore = fondatori.aperti && prezzoFondatoriCents(intervallo) < listino;
  const importo = daFondatore ? prezzoFondatoriCents(intervallo) : listino;
  const chiave = daFondatore ? lookupKeyFondatori(intervallo) : lookupKeyStripe(variante, intervallo, conElite);

  const stripe = await getUncachableStripeClient();
  const price = await prezzoStripe(stripe, chiave, importo, intervallo);

  const [authUser] = await db.select({ email: authUsersTable.email }).from(authUsersTable).where(eq(authUsersTable.id, userId));
  const base = getBaseUrl();
  const metadata = { userId, addon: ADDON, variante: variante.id, intervallo, fondatore: daFondatore ? "1" : "0" };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/dashboard/amministrazione/attiva?esito=ok`,
    cancel_url: `${base}/dashboard/amministrazione/attiva?esito=annullato`,
    metadata,
    // Gli eventi dell'abbonamento non portano i metadati della sessione: vanno
    // ripetuti qui, o il webhook non saprebbe che è un add-on.
    subscription_data: { metadata },
    ...(profile.stripeCustomerId ? { customer: profile.stripeCustomerId } : authUser?.email ? { customer_email: authUser.email } : {}),
  });
  await registra(userId, "checkout", variante.id, { intervallo, importoCents: importo });
  if (!session.url) throw new ErroreAddon("CHECKOUT_FAILED", 502, "Stripe non ha restituito l'indirizzo del pagamento.");
  return { url: session.url };
}

// ── Webhook ──────────────────────────────────────────────────────────────────

/** La forma minima di un abbonamento Stripe che serve qui (webhook o API). */
export type AbbonamentoStripe = {
  id?: string;
  customer?: string | { id: string } | null;
  status?: string;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string> | null;
  items?: { data?: { current_period_end?: number; price?: { id?: string; lookup_key?: string | null; unit_amount?: number | null; recurring?: { interval?: string } | null } }[] };
};

/** true per gli abbonamenti dell'add-on, che il flusso del piano non deve toccare. */
export function eAbbonamentoAddon(sub: AbbonamentoStripe | null | undefined): boolean {
  if (!sub) return false;
  if (sub.metadata?.addon === ADDON) return true;
  const chiave = sub.items?.data?.[0]?.price?.lookup_key;
  return typeof chiave === "string" && chiave.startsWith(PREFISSO_LOOKUP_ADDON);
}

function customerId(sub: AbbonamentoStripe): string | null {
  if (!sub.customer) return null;
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

/**
 * Porta lo stato dell'abbonamento Stripe sul profilo. Idempotente: Stripe
 * ripete gli eventi e li consegna in ordine sparso, quindi si scrive sempre
 * lo stato che l'oggetto dice, mai un delta. Gli eventi del test di prezzo
 * (`attivato`, `cessato`) si registrano solo sui cambi di stato.
 */
export async function sincronizzaAbbonamento(sub: AbbonamentoStripe): Promise<{ userId: string; stato: string } | null> {
  const cliente = customerId(sub);
  let userId = sub.metadata?.userId ?? null;
  let profile = userId ? await profiloDi(userId) : null;
  if (!profile && cliente) {
    const [trovato] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.stripeCustomerId, cliente));
    profile = trovato ?? null;
    userId = profile?.userId ?? null;
  }
  if (!profile || !userId) {
    logger.warn({ subscription: sub.id, customer: cliente }, "Abbonamento add-on senza impresa corrispondente — ignorato");
    return null;
  }

  const prima = abbonamentoDi(profile);
  // Un evento vecchio di un abbonamento sostituito non deve spegnere quello nuovo.
  if (prima.subscriptionId && sub.id && prima.subscriptionId !== sub.id && addonAttivo(prima) && prima.stato !== "beta" && statoAddonDaStripe(sub.status) === "cessato") {
    logger.info({ userId, vecchio: sub.id, attuale: prima.subscriptionId }, "Evento di un abbonamento add-on non più corrente — ignorato");
    return { userId, stato: prima.stato ?? "cessato" };
  }

  const item = sub.items?.data?.[0];
  const stato = statoAddonDaStripe(sub.status);
  const intervallo: IntervalloAddon | undefined = item?.price?.recurring?.interval === "year" ? "annuale" : item?.price?.recurring?.interval === "month" ? "mensile" : prima.intervallo;
  const eraAttivo = addonAttivo(prima);
  const nuovo = await scriviAbbonamento(userId, profile, {
    stato,
    subscriptionId: sub.id ?? prima.subscriptionId,
    intervallo,
    prezzoCents: item?.price?.unit_amount ?? prima.prezzoCents,
    finePeriodo: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : prima.finePeriodo ?? null,
    disdettaAFinePeriodo: Boolean(sub.cancel_at_period_end),
    variante: prima.variante ?? sub.metadata?.variante,
    // Il posto si consuma solo con un abbonamento partito davvero: un checkout
    // abbandonato o un pagamento mai riuscito ("incomplete") non conta.
    fondatore:
      prima.fondatore ||
      (stato !== "cessato" && (sub.metadata?.fondatore === "1" || (item?.price?.lookup_key ?? "").startsWith("amministrazione_fondatori_"))) ||
      undefined,
    // Chi era in beta e si abbona passa all'abbonamento vero: la data di fine beta non conta più.
    betaFino: undefined,
  });
  if (cliente && !profile.stripeCustomerId) {
    await db.update(businessProfilesTable).set({ stripeCustomerId: cliente }).where(eq(businessProfilesTable.userId, userId));
  }

  const oraAttivo = addonAttivo(nuovo);
  const variante = nuovo.variante ?? varianteDiUtente(userId).id;
  if (oraAttivo && !eraAttivo) {
    // A-0 §6.5: dati fiscali completi → 2FA obbligatoria per tutta l'org, e il
    // titolare non può più spegnerla finché l'add-on è attivo (security.ts).
    await db.update(businessProfilesTable).set({ twoFactorRequired: true }).where(eq(businessProfilesTable.userId, userId));
    await registra(userId, "attivato", variante, { intervallo: nuovo.intervallo, importoCents: nuovo.prezzoCents });
  } else if (!oraAttivo && eraAttivo) {
    await registra(userId, "cessato", variante, { intervallo: nuovo.intervallo, importoCents: nuovo.prezzoCents });
  }
  logger.info({ userId, subscription: sub.id, stato }, "Abbonamento add-on sincronizzato");
  return { userId, stato };
}

// ── Lettura per lo staff ─────────────────────────────────────────────────────

export type RigaTestPrezzo = {
  variante: string;
  mensileCents: number;
  annualeCents: number;
  imprese: Record<TipoEventoAddon, number>;
  /** attivati / viste, in percentuale con un decimale. null se nessuna vista. */
  conversionePercent: number | null;
};

/** Imprese distinte per variante e tipo di evento: il risultato del test di prezzo. */
export async function risultatiTestPrezzo(): Promise<{ stato: StatoOffertaCalcolato; righe: RigaTestPrezzo[] }> {
  const righeDb = await db
    .select({ variante: addonEventsTable.variante, tipo: addonEventsTable.tipo, imprese: sql<number>`count(distinct ${addonEventsTable.userId})::int` })
    .from(addonEventsTable)
    .where(eq(addonEventsTable.addon, ADDON))
    .groupBy(addonEventsTable.variante, addonEventsTable.tipo);
  const righe = OFFERTA_AMMINISTRAZIONE.varianti.map((v) => {
    const imprese = { vista: 0, interesse: 0, checkout: 0, attivato: 0, cessato: 0, beta: 0 } as Record<TipoEventoAddon, number>;
    for (const r of righeDb) if (r.variante === v.id) imprese[r.tipo] = r.imprese;
    const conversionePercent = imprese.vista > 0 ? Math.round((imprese.attivato / imprese.vista) * 1000) / 10 : null;
    return { variante: v.id, mensileCents: v.mensileCents, annualeCents: v.annualeCents, imprese, conversionePercent };
  });
  return { stato: offertaCorrente(), righe };
}

/** Per `ops:addon-beta` e per i test: registra l'evento senza passare dall'interfaccia. */
export async function registraEventoInterno(userId: string, tipo: TipoEventoAddon, variante: string): Promise<void> {
  await registra(userId, tipo, variante);
}
