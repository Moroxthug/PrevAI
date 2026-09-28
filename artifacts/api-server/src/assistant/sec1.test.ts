import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cardMustAsk, cardNeedsTapAlways, voiceConfirmation, voiceNeedsTap } from "@workspace/config";
import { signVoiceProof, verifyVoiceProof, VOICE_PROOF_TTL_MS } from "./voice-proof.js";

// SEC-1 (riga 42): niente soldi né dati che escono senza un tocco.

describe("cardMustAsk — never by itself, whatever the setting", () => {
  it("completing a phase that releases a payment term asks", () => {
    expect(cardMustAsk({ kind: "milestone_update", payload: { status: "completed", releasesPaymentTerm: "SAL 1" } })).toBe(true);
  });

  it("other phase changes may still run by themselves", () => {
    expect(cardMustAsk({ kind: "milestone_update", payload: { status: "completed", releasesPaymentTerm: null } })).toBe(false);
    expect(cardMustAsk({ kind: "milestone_update", payload: { status: "in_progress", releasesPaymentTerm: null } })).toBe(false);
    expect(cardMustAsk({ kind: "milestone_update", payload: { plannedEnd: "2026-10-20" } })).toBe(false);
  });

  it("a client's email, phone, PEC or SdI code asks; the address does not", () => {
    for (const f of ["email", "phone", "pec", "codiceSdi"]) expect(cardMustAsk({ kind: "update_client", payload: { changes: { [f]: "x" } } }), f).toBe(true);
    expect(cardMustAsk({ kind: "update_client", payload: { changes: { city: "Rimini", address: "via Po 3" } } })).toBe(false);
  });

  it("does not touch the other cards", () => {
    expect(cardMustAsk({ kind: "cost_entry", payload: { totalCents: 100 } })).toBe(false);
    expect(cardMustAsk({ kind: "task", payload: {} })).toBe(false);
  });
});

describe("the voice never confirms free text to a customer or a new contact", () => {
  it("message_client always takes the tap, even with the highest threshold", () => {
    const card = { kind: "message_client", summary: "Email a <x@example.it>", payload: { toEmail: "x@example.it" } };
    expect(cardNeedsTapAlways(card)).toBe(true);
    expect(voiceNeedsTap(card, 2_000_000)).toBe(true);
    expect(voiceConfirmation(card, 2_000_000).needsTap).toBe(true);
  });

  it("update_client: contact fields take the tap, the rest may be said", () => {
    expect(voiceNeedsTap({ kind: "update_client", summary: "", payload: { changes: { email: "a@b.it" } } }, 2_000_000)).toBe(true);
    expect(voiceNeedsTap({ kind: "update_client", summary: "", payload: { changes: { city: "Rimini" } } }, 2_000_000)).toBe(false);
  });
});

describe("voice proof — the server heard the sì", () => {
  const saved = process.env.BETTER_AUTH_SECRET;
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = "test-secret-sec1"; });
  afterEach(() => { if (saved === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = saved; });

  const now = 1_790_000_000_000;

  it("a fresh yes of the same person is accepted", () => {
    const proof = signVoiceProof("actor-1", "Sì.", now)!;
    const check = verifyVoiceProof(proof, "actor-1", now + 5_000);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("no proof, or a made-up one, is refused", () => {
    expect(verifyVoiceProof(undefined, "actor-1", now)).toEqual({ ok: false, reason: "missing" });
    expect(verifyVoiceProof("", "actor-1", now)).toEqual({ ok: false, reason: "missing" });
    const forged = Buffer.from(JSON.stringify({ a: "actor-1", t: "sì", i: now })).toString("base64url") + ".AAAA";
    expect(verifyVoiceProof(forged, "actor-1", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("a proof with its text changed is refused", () => {
    const proof = signVoiceProof("actor-1", "no", now)!;
    const [, sig] = proof.split(".");
    const edited = Buffer.from(JSON.stringify({ a: "actor-1", t: "sì", i: now })).toString("base64url") + "." + sig;
    expect(verifyVoiceProof(edited, "actor-1", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("what was heard must be a clear yes", () => {
    for (const heard of ["no", "sì, anzi no", "mandala a Luca", "annulla"]) {
      expect(verifyVoiceProof(signVoiceProof("actor-1", heard, now), "actor-1", now), heard).toEqual({ ok: false, reason: "not_yes" });
    }
  });

  it("another person's proof, or an old one, is refused", () => {
    expect(verifyVoiceProof(signVoiceProof("actor-2", "sì", now), "actor-1", now)).toEqual({ ok: false, reason: "other_person" });
    expect(verifyVoiceProof(signVoiceProof("actor-1", "sì", now), "actor-1", now + VOICE_PROOF_TTL_MS + 1)).toEqual({ ok: false, reason: "expired" });
  });

  it("a proof signed with another secret is refused", () => {
    const proof = signVoiceProof("actor-1", "sì", now)!;
    process.env.BETTER_AUTH_SECRET = "another-secret";
    expect(verifyVoiceProof(proof, "actor-1", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("without a server secret the voice can't confirm", () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(signVoiceProof("actor-1", "sì", now)).toBeNull();
    expect(verifyVoiceProof("x.y", "actor-1", now)).toEqual({ ok: false, reason: "missing" });
  });
});
