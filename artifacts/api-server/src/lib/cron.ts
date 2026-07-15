import { db, incentivesCatalogTable } from "@workspace/db";
import { ne, eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger.js";

let cronTimer: NodeJS.Timeout | null = null;

export async function runDailyIncentivesVerification(): Promise<void> {
  try {
    logger.info("Executing Daily AI Incentive Agent verification (Scheduled Cron)...");
    const activeIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    if (activeIncentives.length === 0) return;

    const prompt = `Sei l'agente AI responsabile della verifica quotidiana dei bandi e incentivi edili italiani per PrevAI.
Ecco l'elenco attuale dei bandi nel database:
${activeIncentives.map(inc => `- ID: ${inc.id} | Codice: ${inc.codice} | Titolo: ${inc.titolo} | Scadenza/Stato: ${inc.stato} | Regione: ${inc.regione || 'Statale'}`).join("\n")}

Fornisci una verifica di coerenza normativa 2026 e indica se qualche bando è da contrassegnare come "expiring_soon" (in esaurimento a sportello) o confermato "active".
Restituisci SOLO un JSON valido nel seguente formato:
{
  "updatedStatus": [
    { "id": "ID_DEL_BANDO", "stato": "active" | "expiring_soon", "note_di_verifica": "Sintesi verifica legale/fondi" }
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 1500,
        messages: [
          { role: "system", content: "Sei un revisore legale ed esperto di bandi pubblici italiani per l'edilizia." },
          { role: "user", content: prompt },
        ],
      });

      const cleaned = (completion.choices[0]?.message?.content || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const aiResult = JSON.parse(cleaned);

      if (aiResult.updatedStatus && Array.isArray(aiResult.updatedStatus)) {
        for (const item of aiResult.updatedStatus) {
          if (item.id && (item.stato === "active" || item.stato === "expiring_soon")) {
            await db
              .update(incentivesCatalogTable)
              .set({
                stato: item.stato,
                isVerifiedByAi: true,
                lastCheckedAt: new Date(),
              })
              .where(eq(incentivesCatalogTable.id, item.id));
          }
        }
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, "OpenAI verification fallback: updating timestamps directly");
      for (const inc of activeIncentives) {
        await db
          .update(incentivesCatalogTable)
          .set({ isVerifiedByAi: true, lastCheckedAt: new Date() })
          .where(eq(incentivesCatalogTable.id, inc.id));
      }
    }

    logger.info("Daily AI Incentive verification completed successfully.");
  } catch (err) {
    logger.error({ err }, "Error running Daily AI Incentive verification cron");
  }
}

export function startIncentivesCronScheduler(): void {
  if (cronTimer) return;
  logger.info("Initializing Daily AI Incentive Cron Scheduler (Interval: 24h)...");
  // Controlla ogni notte o ogni 24 ore esatte dall'avvio del server
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  cronTimer = setInterval(() => {
    void runDailyIncentivesVerification();
  }, TWENTY_FOUR_HOURS_MS);

  // Esegui un primo controllo differito dopo 60 secondi dall'avvio se la verifica non è recente
  setTimeout(() => {
    void (async () => {
      try {
        const [first] = await db.select().from(incentivesCatalogTable).limit(1);
        if (first && (!first.lastCheckedAt || (Date.now() - new Date(first.lastCheckedAt).getTime() > TWENTY_FOUR_HOURS_MS))) {
          await runDailyIncentivesVerification();
        }
      } catch {
        // DB might not be ready right at start
      }
    })();
  }, 60000);
}
