import { and, eq, gte, sql } from "drizzle-orm";
import { db, usageEventsTable } from "@workspace/db";
import { ASSISTANT_TTS, ASSISTANT_VOICE_MINUTES_PER_SEAT, estimateSpeechSeconds } from "@workspace/config";
import { recordUsageEvent } from "../lib/usage.js";

// ── APP-8e: la voce dell'assistente (D17 aperta) ─────────────────────────────
// La sintesi di un fornitore parte solo con la sua chiave sul server
// (ASSISTANT_TTS_OPENAI_KEY, AS-2): la chiave non arriva mai al browser. Senza
// chiave il fornitore è "browser": l'app legge con la voce del telefono o del
// computer, gratis. Groq, l'unico fornitore di oggi, non ha voci italiane.
// L'audio non si conserva: va al browser e basta, come la dettatura.

export type SpeechProvider = "openai" | "browser";

export function speechProvider(): SpeechProvider {
  return process.env.ASSISTANT_TTS_OPENAI_KEY ? "openai" : "browser";
}

/** Circa 1,5 centesimi di dollaro al minuto per gpt-4o-mini-tts (prezzo da rileggere quando si decide D17). */
const TTS_COST_CENTS_PER_SECOND = 1.5 / 60;

/** Una frase in mp3. Chi chiama ha già controllato piano, lunghezza e minuti. */
export async function synthesize(orgId: string, text: string, rate: number, signal?: AbortSignal): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.ASSISTANT_TTS_OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: ASSISTANT_TTS.model, voice: ASSISTANT_TTS.voice, input: text, instructions: ASSISTANT_TTS.instructions, speed: rate, response_format: "mp3" }),
    signal,
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  void recordUsageEvent({ userId: orgId, kind: "ai_speech", quantity: estimateSpeechSeconds(text, rate), unitCostCents: TTS_COST_CENTS_PER_SECOND, relatedEntityType: "assistant_speech" });
  return audio;
}

/** Minuti di voce del fornitore usati dall'impresa nel mese (UTC), dagli eventi di consumo. */
export async function voiceMinutesUsed(orgId: string, now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ seconds: sql<string>`coalesce(sum(${usageEventsTable.quantity}), 0)` })
    .from(usageEventsTable)
    .where(and(eq(usageEventsTable.userId, orgId), eq(usageEventsTable.kind, "ai_speech"), gte(usageEventsTable.createdAt, monthStart)));
  return Math.round(Number(row?.seconds ?? 0) / 6) / 10;
}

/**
 * Minuti inclusi (D18). `null` finché il titolare non decide: si contano e si
 * mostrano, non fermano nulla. Quando D18 fissa il numero per posto, qui si
 * moltiplica per i posti dell'impresa.
 */
export function voiceMinutesIncluded(): number | null {
  return ASSISTANT_VOICE_MINUTES_PER_SEAT;
}
