import { pgTable, text, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// POCKET-2: la lista "Da fare oggi" della Home dell'app. Spuntare un compito del cantiere lo completa davvero;
// spuntare qualsiasi altra cosa ("serve a te") vuol dire "gestito oggi" e resta spuntato fino a mezzanotte
// (Europe/Rome). Una riga per persona, giorno e voce.
export const todayChecksTable = pgTable("today_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** L'impresa (titolare). */
  userId: text("user_id").notNull(),
  /** Chi ha spuntato (il titolare o un membro della squadra). */
  memberUserId: text("member_user_id").notNull(),
  /** Il giorno di calendario (YYYY-MM-DD, Europe/Rome). */
  day: text("day").notNull(),
  itemId: text("item_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("today_checks_member_day_item_idx").on(t.memberUserId, t.day, t.itemId),
]);
