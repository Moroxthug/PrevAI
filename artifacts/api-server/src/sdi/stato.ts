import { db, sdiSettingsTable, hasFeature, normalizzaPartitaIva, type SdiSettings, type PlanLike } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── A-1: "questa impresa emette fatture elettroniche?" ───────────────────────
// Modulo minuscolo apposta: lo importa anche `invoices/service.ts`, che non
// può dipendere da `sdi/service.ts` (sarebbe un ciclo, visto che il servizio
// SDI parte proprio dalle fatture).
//
// La risposta si **ricalcola** dai requisiti invece di fidarsi della colonna
// `sdi_settings.stato`: quella è una cache per l'interfaccia, e se l'utente
// completa i dati fiscali dal profilo aziendale resterebbe indietro — con
// l'effetto di emettere una pro-forma quando invece il modulo era pronto.

export type Requisito = { campo: string; messaggio: string };

/** Il pezzo di profilo aziendale che la fattura elettronica pretende. */
export type ProfiloFiscale = {
  vatNumber?: string | null;
  codiceFiscale?: string | null;
  companyName?: string | null;
  address?: string | null;
  city?: string | null;
  cap?: string | null;
  province?: string | null;
  twoFactorRequired?: boolean | null;
};

/** Cosa manca ancora per poter emettere. Lo stesso elenco guida l'onboarding. */
export function requisitiMancanti(settings: Pick<SdiSettings, "regimeFiscale" | "provider" | "providerApiKey" | "delegaFirmataAt">, profile: ProfiloFiscale | null): Requisito[] {
  const mancanti: Requisito[] = [];
  if (!profile?.companyName) mancanti.push({ campo: "profilo.companyName", messaggio: "Manca la ragione sociale dell'impresa." });
  if (!normalizzaPartitaIva(profile?.vatNumber)) mancanti.push({ campo: "profilo.vatNumber", messaggio: "Manca la partita IVA." });
  if (!profile?.address || !profile?.city || !profile?.cap || !profile?.province) {
    mancanti.push({ campo: "profilo.sede", messaggio: "Manca la sede completa (indirizzo, CAP, comune, provincia)." });
  }
  if (!settings.regimeFiscale) mancanti.push({ campo: "sdi.regimeFiscale", messaggio: "Scegli il regime fiscale da dichiarare in fattura." });
  if (settings.provider !== "simulato" && !settings.providerApiKey) {
    mancanti.push({ campo: "sdi.providerApiKey", messaggio: "Mancano le credenziali dell'intermediario." });
  }
  if (!settings.delegaFirmataAt) mancanti.push({ campo: "sdi.delega", messaggio: "Conferma di aver firmato la delega presso l'intermediario." });
  // A-0 (§6.5): chi tiene dati fiscali completi in PrevAI deve avere la
  // verifica in due passaggi obbligatoria per tutta l'organizzazione.
  if (!profile?.twoFactorRequired) {
    mancanti.push({ campo: "profilo.twoFactorRequired", messaggio: "Attiva la verifica in due passaggi obbligatoria per l'organizzazione (Impostazioni → Sicurezza)." });
  }
  return mancanti;
}

/** Impostazioni SDI dell'impresa, senza crearle. */
export async function impostazioniSdi(userId: string): Promise<SdiSettings | null> {
  const [row] = await db.select().from(sdiSettingsTable).where(eq(sdiSettingsTable.userId, userId));
  return row ?? null;
}

/**
 * Il modulo è operativo quando l'add-on è acceso sul profilo **e** non manca
 * più niente. Entrambe le condizioni: l'add-on da solo non basta a emettere
 * documenti fiscali, e una configurazione completa non vale niente se
 * l'add-on non è stato attivato.
 */
export function moduloAttivo(profile: (PlanLike & ProfiloFiscale) | null | undefined, settings: SdiSettings | null | undefined): boolean {
  if (!settings || settings.stato === "sospeso") return false;
  if (!hasFeature(profile ?? null, "sdi_invoicing")) return false;
  return requisitiMancanti(settings, profile ?? null).length === 0;
}

export async function moduloSdiAttivo(userId: string, profile: (PlanLike & ProfiloFiscale) | null | undefined): Promise<boolean> {
  if (!hasFeature(profile ?? null, "sdi_invoicing")) return false;
  return moduloAttivo(profile, await impostazioniSdi(userId));
}
