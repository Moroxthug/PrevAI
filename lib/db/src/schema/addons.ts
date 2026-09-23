import { pgTable, text, uuid, timestamp, integer, index } from "drizzle-orm/pg-core";

// ── A-5: add-on in abbonamento ───────────────────────────────────────────────
// Un add-on è un secondo abbonamento Stripe dello stesso cliente, accanto al
// piano. Non ha una tabella sua: lo stato vive in `business_profiles.addons`
// (jsonb, una chiave per add-on), così `hasFeature(profile, …)` lo vede in
// ogni rotta che già legge il profilo intero, senza una query in più.
//
// La tabella qui sotto registra invece gli eventi del **test di prezzo**
// (vista del paywall, interesse, checkout, attivazione, disdetta) con la
// variante che l'utente ha visto: è l'unico modo di sapere, alla fine, quale
// prezzo converte meglio.

export const ADDON_IDS = ["amministrazione"] as const;
export type AddonId = (typeof ADDON_IDS)[number];

/**
 * - `attivo` / `prova`: abbonamento Stripe `active` / `trialing`.
 * - `insoluto`: Stripe `past_due`. L'accesso resta finché Stripe riprova
 *   l'addebito: togliere i propri dati fiscali a chi ha una carta scaduta
 *   sarebbe sproporzionato, e dopo l'ultimo tentativo Stripe cancella da sé.
 * - `beta`: utenti che avevano il modulo col flag prima del lancio, con una
 *   data di fine (`betaFino`). Scritto solo da `ops:addon-beta`.
 * - `cessato`: disdetto o scaduto. Si tiene la riga per la variante e lo storico.
 */
export const STATI_ADDON = ["attivo", "prova", "insoluto", "beta", "cessato"] as const;
export type StatoAddon = (typeof STATI_ADDON)[number];

export type AbbonamentoAddon = {
  stato?: StatoAddon;
  /** Variante del test di prezzo assegnata all'impresa: una volta scelta non cambia. */
  variante?: string;
  varianteFonte?: "utente" | "campagna";
  varianteAssegnataIl?: string;
  subscriptionId?: string;
  intervallo?: "mensile" | "annuale";
  prezzoCents?: number;
  finePeriodo?: string | null;
  disdettaAFinePeriodo?: boolean;
  betaFino?: string;
  aggiornatoIl?: string;
};

export type AddonsProfilo = Partial<Record<AddonId, AbbonamentoAddon>>;

/** Stati che danno accesso. `beta` solo fino alla sua data. */
export function addonAttivo(abbonamento: AbbonamentoAddon | null | undefined, now: Date = new Date()): boolean {
  const stato = abbonamento?.stato;
  if (stato === "attivo" || stato === "prova" || stato === "insoluto") return true;
  if (stato === "beta") {
    const fino = abbonamento?.betaFino ? Date.parse(abbonamento.betaFino) : NaN;
    return Number.isFinite(fino) && now.getTime() <= fino;
  }
  return false;
}

/** Da stato Stripe dell'abbonamento a stato nostro. */
export function statoAddonDaStripe(status: string | null | undefined): StatoAddon {
  switch (status) {
    case "active":
      return "attivo";
    case "trialing":
      return "prova";
    case "past_due":
      return "insoluto";
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return "cessato";
  }
}

export const TIPI_EVENTO_ADDON = ["vista", "interesse", "checkout", "attivato", "cessato", "beta"] as const;
export type TipoEventoAddon = (typeof TIPI_EVENTO_ADDON)[number];

export const addonEventsTable = pgTable(
  "addon_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    addon: text("addon").$type<AddonId>().notNull(),
    variante: text("variante").notNull(),
    tipo: text("tipo").$type<TipoEventoAddon>().notNull(),
    intervallo: text("intervallo"),
    importoCents: integer("importo_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("addon_events_user_idx").on(t.userId, t.addon, t.tipo),
    index("addon_events_variante_idx").on(t.addon, t.variante, t.tipo),
  ],
);

export type AddonEvent = typeof addonEventsTable.$inferSelect;
