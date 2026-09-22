import { db, sdiSettingsTable, hasFeature, type SdiSettings, type PlanLike } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── A-1: "questa impresa emette fatture elettroniche?" ───────────────────────
// Modulo minuscolo apposta: lo importa anche `invoices/service.ts`, che non
// può dipendere da `sdi/service.ts` (sarebbe un ciclo, visto che il servizio
// SDI parte proprio dalle fatture).

/** Impostazioni SDI dell'impresa, senza crearle. */
export async function impostazioniSdi(userId: string): Promise<SdiSettings | null> {
  const [row] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, userId));
  return row ?? null;
}

/**
 * Il modulo è operativo quando l'add-on è acceso sul profilo **e**
 * l'onboarding è arrivato in fondo. Entrambe le condizioni: l'add-on da solo
 * non basta a emettere documenti fiscali, e una configurazione completa non
 * vale niente se l'add-on non è stato attivato.
 */
export function moduloAttivo(profile: PlanLike, settings: Pick<SdiSettings, "stato"> | null | undefined): boolean {
  return hasFeature(profile, "sdi_invoicing") && settings?.stato === "attivo";
}

export async function moduloSdiAttivo(userId: string, profile: PlanLike): Promise<boolean> {
  if (!hasFeature(profile, "sdi_invoicing")) return false;
  return moduloAttivo(profile, await impostazioniSdi(userId));
}
