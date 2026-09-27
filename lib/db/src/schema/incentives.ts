import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Catalogo incentivi (schema v1 di PrevAI, V2-4) ───────────────────────────
// Colonne, enum e default sono quelli della tabella `incentives_catalog` in
// produzione (10 righe reali: bonus statali, bandi regionali e comunali), così
// la migrazione additiva non tocca nulla e il widget v1 continua a leggere gli
// stessi campi. La struttura QuoteAI (catalogo + applicazione per preventivo,
// verifica cron, `userId` per i bandi custom di un'impresa) resta.

export const INCENTIVE_LEVELS = ["statale", "regionale", "comunale"] as const;
export type IncentiveLevel = (typeof INCENTIVE_LEVELS)[number];

/** Categorie d'intervento del catalogo (valori v1). */
export const INCENTIVE_CATEGORIES = [
  "tutti",
  "ristrutturazione",
  "efficienza_energetica",
  "barriere_architettoniche",
  "bagno",
  "elettrico",
  "idraulico",
  "completa",
  "cartongesso",
  "pavimenti",
  "tinteggiatura",
] as const;

/** Tipi di agevolazione (valori v1). */
export const INCENTIVE_TYPES = ["detrazione_10_anni", "conto_termico_gse", "fondo_perduto", "sconto_fattura", "iva_agevolata"] as const;

export const incentivesCatalogTable = pgTable("incentives_catalog", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id"), // null se globale (statale/regionale di sistema), valorizzato se bando custom di una specifica impresa partner
  level: text("level", { enum: INCENTIVE_LEVELS }).notNull().default("statale"),
  codice: text("codice").notNull(), // es. 'BONUS_CASA_50', 'ECOBONUS_65', 'LOMBARDIA_EFF_2026', 'MILANO_FACCIATE'
  titolo: text("titolo").notNull(),
  descrizione: text("descrizione").notNull(),
  regione: text("regione"), // es. 'Lombardia', 'Piemonte', o null se statale
  comune: text("comune"), // es. 'Milano', 'Bologna', o null se statale/regionale
  categoriaIntervento: text("categoria_intervento").notNull().default("tutti"), // vedi INCENTIVE_CATEGORIES
  tipoAgevolazione: text("tipo_agevolazione").notNull().default("detrazione_10_anni"), // vedi INCENTIVE_TYPES
  percentualeMassima: numeric("percentuale_massima", { precision: 5, scale: 2 }).notNull().default("50.00"), // es. 50.00, 65.00, 75.00
  massimaleSpesa: numeric("massimale_spesa", { precision: 12, scale: 2 }), // es. 96000.00
  massimaleContributo: numeric("massimale_contributo", { precision: 12, scale: 2 }), // es. 5000.00 (per fondo perduto)
  requisitiIseeMax: numeric("requisiti_isee_max", { precision: 10, scale: 2 }), // es. 30000.00 o null
  scadenza: timestamp("scadenza", { withTimezone: true }), // data o null se bonus strutturale
  stato: text("stato", { enum: ["active", "expiring_soon", "closed"] }).notNull().default("active"),
  fonteUfficialeUrl: text("fonte_ufficiale_url"),
  isVerifiedByAi: boolean("is_verified_by_ai").notNull().default(true), // esito dell'ultimo controllo euristico del cron AI (non è una validazione legale)
  humanVerified: boolean("human_verified").notNull().default(false), // true solo se un admin ha controllato la fonte ufficiale a mano
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIncentivesCatalogSchema = createInsertSchema(incentivesCatalogTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIncentiveCatalogItem = z.infer<typeof insertIncentivesCatalogSchema>;
export type IncentiveCatalogItem = typeof incentivesCatalogTable.$inferSelect;

/**
 * Esito del calcolatore incentivi (widget v1: `POST /api/public/quotes/:id/incentives`),
 * salvato in `quotes.client_data.incentivesData` e stampato nel PDF del preventivo.
 * Chiavi identiche a quelle scritte da v1 in produzione.
 */
export const quoteIncentivesDataSchema = z.object({
  tipoImmobile: z.string().optional(),
  obiettivoLavori: z.string().optional(),
  fasciaIsee: z.string().optional(),
  regione: z.string().optional(),
  cap: z.string().optional(),
  bonusStataleApplicato: z.string().optional(),
  bonusStataleHumanVerified: z.boolean().optional(),
  bandoRegionaleApplicato: z.string().optional(),
  bandoRegionaleHumanVerified: z.boolean().nullable().optional(),
  scontoIvaStimato: z.number().optional(),
  esborsoImmediatoStimato: z.number().optional(),
  detrazioneFiscaleDecennale: z.number().optional(),
  detrazioneFiscaleAnnua: z.number().optional(),
  // chiavi delle primissime versioni del widget v1, ancora presenti in alcuni preventivi storici
  totaleIncentiviStimati: z.number().optional(),
  costoNettoStimato: z.number().optional(),
  detrazioneAnnuaStimata: z.number().optional(),
  contributoRegionaleStimato: z.number().optional(),
});
export type QuoteIncentivesData = z.infer<typeof quoteIncentivesDataSchema>;
