// La prova gratuita (3 PDF in 7 giorni) parte con il primo preventivo.
//
// Fino al 10/11/2026 partiva con un UPDATE su business_profiles: chi saltava
// l'onboarding non aveva ancora la riga, l'UPDATE non toccava nulla e la prova
// non partiva mai, quindi il primo «Scarica PDF» apriva già il paywall
// (10 account su 19 non paganti, 0 PDF scaricati). Ora la riga si crea se manca;
// la data di una prova già partita non viene mai spostata.
import { businessProfilesTable, type db } from "@workspace/db";
import { sql } from "drizzle-orm";

type Inserter = Pick<typeof db, "insert">;

export async function avviaProvaSeServe(exec: Inserter, userId: string, now = new Date()): Promise<void> {
  await exec
    .insert(businessProfilesTable)
    .values({ userId, trialStartedAt: now })
    .onConflictDoUpdate({
      target: businessProfilesTable.userId,
      set: { trialStartedAt: sql`coalesce(${businessProfilesTable.trialStartedAt}, excluded.trial_started_at)` },
    });
}
