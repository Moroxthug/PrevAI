import { pgTable, text, uuid, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";

// POCKET-3 (riga 60, da QuoteAI 126): l'ultima posizione di chi è in turno e ha scelto di condividerla (Posizione in diretta).
// Una riga per operaio; si cancella all'uscita.
export const crewLocationsTable = pgTable(
  "crew_locations",
  {
    workerId: uuid("worker_id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("crew_locations_user_idx").on(t.userId)],
);
