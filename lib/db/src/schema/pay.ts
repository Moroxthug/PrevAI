import { pgTable, text, uuid, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// POCKET-4 (riga 61, da QuoteAI 127.2 Pay): «Ore e costo del lavoro». Non è un cedolino: sono le ore approvate, il costo e il
// file di ore per il consulente del lavoro. Le regole (frequenza, quando parte lo straordinario, la maggiorazione, i codici
// dipendente del consulente) stanno in una riga per impresa; ogni esportazione lascia una riga con le ore di quel momento.
export type PaySettingsRaw = {
  frequency?: "weekly" | "biweekly" | "monthly";
  /** Un lunedì da cui contare i periodi di due settimane. */
  anchorDate?: string;
  /** Dopo quante ore a settimana si paga lo straordinario; assente = nessuno straordinario. */
  overtimeWeeklyHours?: number | null;
  /** Coefficiente dello straordinario (1,25 = +25 %). */
  overtimeMultiplier?: number;
  /** Il codice che il consulente del lavoro ha dato a ciascun dipendente, per id operaio. */
  payrollCodes?: Record<string, string>;
};

export const paySettingsTable = pgTable("pay_settings", {
  userId: text("user_id").primaryKey(),
  settings: jsonb("settings").$type<PaySettingsRaw>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const payExportsTable = pgTable(
  "pay_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Il primo giorno del periodo esportato, `AAAA-MM-GG`. */
    periodStart: text("period_start").notNull(),
    format: text("format").notNull().default("generic"),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
    exportedByName: text("exported_by_name"),
    /** Le ore di ogni operaio al momento dell'esportazione: serve a dire se dopo qualcosa è cambiato. */
    snapshot: jsonb("snapshot").$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [index("pay_exports_user_period_idx").on(t.userId, t.periodStart)],
);

export type PayExport = typeof payExportsTable.$inferSelect;
