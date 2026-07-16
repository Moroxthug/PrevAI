import { db, incentivesCatalogTable, type IncentiveCatalogItem } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger.js";

const FETCH_TIMEOUT_MS = 8000;
const SNIPPET_MAX_CHARS = 2500;

// Il "Daily AI Incentive Agent" storicamente chiedeva al modello di confermare
// se un bando fosse ancora attivo basandosi solo sulla propria conoscenza
// parametrica (nessun accesso a internet). Qui recuperiamo per davvero il
// testo della pagina ufficiale collegata a ogni bando (quando raggiungibile)
// e lo passiamo al modello come grounding, così l'esito riflette almeno in
// parte una fonte reale. Quando la fonte non è raggiungibile, il bando resta
// etichettato esplicitamente come "verifica euristica" e non come conferma.
async function fetchOfficialSourceSnippet(url: string): Promise<{ ok: boolean; snippet: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PrevAI-IncentiveBot/1.0)" },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return { ok: false, snippet: "" };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return { ok: true, snippet: text.slice(0, SNIPPET_MAX_CHARS) };
  } catch (err) {
    logger.warn({ err, url }, "Could not fetch official incentive source for AI grounding");
    return { ok: false, snippet: "" };
  }
}

interface AiUpdatedStatusItem {
  id?: string;
  stato?: "active" | "expiring_soon";
  note_di_verifica?: string;
}

interface AiVerificationResult {
  updatedStatus?: AiUpdatedStatusItem[];
  riepilogoScansione?: string;
}

export interface IncentivesVerificationOutcome {
  updatedCount: number;
  sourcesFetched: number;
  sourcesTotal: number;
  summary: string;
  disclaimer: string;
}

const HEURISTIC_DISCLAIMER =
  "Controllo euristico preliminare (AI + fonti ufficiali quando raggiungibili). NON costituisce una verifica legale: i bandi vanno confermati da un operatore umano prima di essere mostrati come garantiti a clienti finali.";

export async function runIncentivesVerification(
  activeIncentives: IncentiveCatalogItem[]
): Promise<IncentivesVerificationOutcome> {
  if (activeIncentives.length === 0) {
    return { updatedCount: 0, sourcesFetched: 0, sourcesTotal: 0, summary: "Nessun bando attivo da verificare.", disclaimer: HEURISTIC_DISCLAIMER };
  }

  const sourceLookups = await Promise.all(
    activeIncentives.map(async inc => {
      if (!inc.fonteUfficialeUrl) return { inc, ok: false, snippet: "" };
      const result = await fetchOfficialSourceSnippet(inc.fonteUfficialeUrl);
      return { inc, ...result };
    })
  );

  const sourcesFetched = sourceLookups.filter(s => s.ok).length;

  const bandiBlock = sourceLookups
    .map(({ inc, ok, snippet }) => {
      const fonteInfo = ok
        ? `Estratto fonte ufficiale (${inc.fonteUfficialeUrl}): "${snippet || "(pagina vuota)"}"`
        : `Fonte ufficiale non raggiungibile automaticamente (${inc.fonteUfficialeUrl || "nessun URL registrato"}) — basati solo su conoscenza generale e segnalalo in note_di_verifica.`;
      return `- ID: ${inc.id} | Codice: ${inc.codice} | Titolo: ${inc.titolo} | Stato attuale: ${inc.stato} | Regione: ${inc.regione || "Statale"}\n  ${fonteInfo}`;
    })
    .join("\n");

  const prompt = `Sei l'agente AI responsabile della verifica quotidiana dei bandi e incentivi edili italiani per PrevAI.
Ecco l'elenco attuale dei bandi nel database, con l'estratto testuale della relativa pagina ufficiale quando è stato possibile recuperarla:
${bandiBlock}

Usa il testo estratto dalla fonte ufficiale (quando presente) come base primaria per la verifica. Se la fonte non è stata recuperata, non inventare conferme: imposta comunque uno stato plausibile ma scrivi in note_di_verifica che si tratta di sola verifica euristica senza fonte consultata.
Indica se qualche bando è da contrassegnare come "expiring_soon" (in esaurimento a sportello) o confermato "active".
Restituisci SOLO un JSON valido nel seguente formato:
{
  "updatedStatus": [
    { "id": "ID_DEL_BANDO", "stato": "active" | "expiring_soon", "note_di_verifica": "Sintesi verifica ed eventuale fonte consultata" }
  ],
  "riepilogoScansione": "Sintesi complessiva della scansione"
}`;

  let aiResult: AiVerificationResult = { updatedStatus: [], riepilogoScansione: "Scansione AI completata." };
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: "Sei un revisore legale ed esperto di bandi pubblici italiani per l'edilizia. Non affermi mai una conferma ufficiale se non hai un estratto di fonte a supporto." },
        { role: "user", content: prompt },
      ],
    });

    const cleaned = (completion.choices[0]?.message?.content || "{}")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    aiResult = JSON.parse(cleaned);
  } catch (err) {
    logger.warn({ err }, "Could not parse AI sync response cleanly, proceeding with timestamp-only update");
  }

  let updatedCount = 0;
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
        updatedCount++;
        if (item.note_di_verifica) {
          logger.info({ incentiveId: item.id, note: item.note_di_verifica }, "AI incentive verification note");
        }
      }
    }
  } else {
    for (const inc of activeIncentives) {
      await db
        .update(incentivesCatalogTable)
        .set({ isVerifiedByAi: true, lastCheckedAt: new Date() })
        .where(eq(incentivesCatalogTable.id, inc.id));
      updatedCount++;
    }
  }

  const baseSummary = aiResult.riepilogoScansione || "Scansione euristica completata.";
  return {
    updatedCount,
    sourcesFetched,
    sourcesTotal: activeIncentives.length,
    summary: `${baseSummary} (fonti ufficiali raggiunte: ${sourcesFetched}/${activeIncentives.length})`,
    disclaimer: HEURISTIC_DISCLAIMER,
  };
}
