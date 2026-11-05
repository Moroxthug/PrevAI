import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// PREZZI-2: chi chiede il piano Su misura dal modulo pubblico di /contatti/. La riga resta anche se l'email a noi non parte.
export const contattiSuMisuraTable = pgTable("contatti_su_misura", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  impresa: text("impresa").notNull(),
  email: text("email").notNull(),
  telefono: text("telefono"),
  persone: text("persone"),
  messaggio: text("messaggio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
