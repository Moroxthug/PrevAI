// SEC-1 (riga 42) — the "sì" of a voice confirmation is heard by the server.
//
// /api/speech/transcribe signs what Whisper heard (who, what, when) and the app
// hands that proof back with { via: "voice" }. /confirm accepts the voice only
// when the proof is ours, fresh, of the same person, and what was heard is a
// clear yes by the same rule the app uses (classifyVoiceReply). A confirmation
// that only *says* it came from the voice gets no voice treatment: the card
// asks for the tap. A proof confirms one card (its hash is in the audit row).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { classifyVoiceReply } from "@workspace/config";

/** How long after the transcription the "sì" may still confirm a card. */
export const VOICE_PROOF_TTL_MS = 2 * 60_000;

function secret(): string | null {
  const s = process.env.BETTER_AUTH_SECRET;
  return s ? `voice-proof:${s}` : null;
}

function sign(body: string, key: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

/** The proof for one transcription, or null when the server has no secret (then the voice can't confirm). */
export function signVoiceProof(actorId: string, text: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify({ a: actorId, t: text.slice(0, 200), i: now })).toString("base64url");
  return `${body}.${sign(body, key)}`;
}

export type VoiceProofCheck = { ok: true; hash: string } | { ok: false; reason: "missing" | "invalid" | "expired" | "other_person" | "not_yes" };

export function verifyVoiceProof(proof: unknown, actorId: string, now = Date.now()): VoiceProofCheck {
  const key = secret();
  if (typeof proof !== "string" || !proof || proof.length > 2000 || !key) return { ok: false, reason: "missing" };
  const [body, sig] = proof.split(".");
  if (!body || !sig) return { ok: false, reason: "invalid" };
  const want = Buffer.from(sign(body, key));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: "invalid" };
  let data: { a?: unknown; t?: unknown; i?: unknown };
  try { data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return { ok: false, reason: "invalid" }; }
  if (data.a !== actorId) return { ok: false, reason: "other_person" };
  if (typeof data.i !== "number" || now - data.i > VOICE_PROOF_TTL_MS || data.i - now > 30_000) return { ok: false, reason: "expired" };
  if (typeof data.t !== "string" || classifyVoiceReply(data.t) !== "yes") return { ok: false, reason: "not_yes" };
  return { ok: true, hash: createHash("sha256").update(proof).digest("hex").slice(0, 32) };
}
