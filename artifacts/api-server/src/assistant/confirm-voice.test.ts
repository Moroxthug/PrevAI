import { describe, expect, it } from "vitest";
import { classifyVoiceReply, importoInLettere, numeroInLettere, parseVoiceConfirmMax, voiceConfirmation, voiceNeedsTap, voiceFacts, ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS } from "@workspace/config";
import { APP8F_VOICE_REPLY_CASES } from "./evals/cases.js";
import { levelsFor, voiceConfirmMaxFrom } from "./permissions.js";

// APP-8f: la conferma a voce rilegge l'essenziale e accetta solo un sì chiaro.

describe("numeroInLettere / importoInLettere", () => {
  it.each([
    [0, "zero"], [1, "uno"], [3, "tre"], [16, "sedici"], [21, "ventuno"], [23, "ventitré"], [28, "ventotto"], [80, "ottanta"],
    [100, "cento"], [103, "centotré"], [108, "centotto"], [180, "centottanta"], [999, "novecentonovantanove"],
    [1000, "mille"], [1003, "milletré"], [2000, "duemila"], [7112, "settemilacentododici"], [21000, "ventunomila"], [23000, "ventitremila"],
    [46200, "quarantaseimiladuecento"], [101000, "centounomila"], [1_000_000, "un milione"], [2_300_000, "due milioni trecentomila"],
    [120_000_000, "centoventi milioni"], [1_000_000_000, "un miliardo"],
  ])("%i → %s", (n, words) => expect(numeroInLettere(n)).toBe(words));

  it("says euros and cents", () => {
    expect(importoInLettere(711200)).toBe("settemilacentododici euro");
    expect(importoInLettere(100)).toBe("un euro");
    expect(importoInLettere(150)).toBe("un euro e cinquanta");
    expect(importoInLettere(125050)).toBe("milleduecentocinquanta euro e cinquanta");
    expect(importoInLettere(99)).toBe("novantanove centesimi");
    expect(importoInLettere(200_000_000)).toBe("due milioni di euro");
  });
});

describe("classifyVoiceReply — the test set", () => {
  it.each(APP8F_VOICE_REPLY_CASES.map((c) => [c.say, c.expect] as const))("%j → %s", (say, want) => expect(classifyVoiceReply(say)).toBe(want));

  it("no ambiguous reply confirms", () => {
    const ambiguous = APP8F_VOICE_REPLY_CASES.filter((c) => c.expect !== "yes");
    expect(ambiguous.length).toBeGreaterThanOrEqual(15);
    for (const c of ambiguous) expect(classifyVoiceReply(c.say), c.say).not.toBe("yes");
  });
});

describe("voiceConfirmation", () => {
  const invoice = { kind: "send_invoice", summary: "Invia PF-2026-0042 (7.112,00 €) a marco@example.it", payload: { invoiceId: "x", amountCents: 711200, docNumber: "PF-2026-0042", recipientName: "Marco Venturi" } };

  it("reads the essentials, with the amount in words", () => {
    const v = voiceConfirmation(invoice, ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS);
    expect(v.say).toBe("Invio la fattura PF-2026-0042, settemilacentododici euro, a Marco Venturi per email? È sopra i cinquemila euro: per confermare tocca Conferma sullo schermo.");
    expect(v.needsTap).toBe(true);
  });

  it("under the threshold the voice is enough", () => {
    const v = voiceConfirmation({ ...invoice, payload: { ...invoice.payload, amountCents: 120000 } }, ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS);
    expect(v.needsTap).toBe(false);
    expect(v.say).toMatch(/milleduecento euro, a Marco Venturi per email\? Di' sì per confermare\.$/);
  });

  it("an amount card without its amount (made before APP-8f) takes a tap", () => {
    expect(voiceNeedsTap({ kind: "send_quote", summary: "Invia il preventivo 14 (46.200,00 €)", payload: { quoteId: "q" } }, 10_000_000)).toBe(true);
    expect(voiceNeedsTap({ kind: "reply_lead", summary: "Manda a Sara il messaggio", payload: { leadId: "l" } }, 0)).toBe(false);
  });

  it("threshold 0: any amount takes a tap", () => {
    expect(voiceNeedsTap({ kind: "record_payment", summary: "", payload: { amountCents: 100 } }, 0)).toBe(true);
    expect(voiceConfirmation({ kind: "record_payment", summary: "", payload: { amountCents: 100 } }, 0).say).toBe("Registro un incasso di un euro? Per confermare tocca Conferma sullo schermo.");
  });

  it("other cards: the summary without the address in brackets", () => {
    const v = voiceConfirmation({ kind: "update_client", summary: "Aggiorna **Rossi**: email <mario@example.it>", payload: {} }, 500000);
    expect(v.say).toBe("Aggiorna Rossi: email. Confermo? Di' sì per confermare.");
  });

  it("an unknown stored threshold falls back to the proposal", () => {
    expect(parseVoiceConfirmMax("123")).toBe(ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS);
    expect(parseVoiceConfirmMax("0")).toBe(0);
    expect(parseVoiceConfirmMax("1000000")).toBe(1_000_000);
  });
});

describe("the owner's threshold (a row of assistant_permissions)", () => {
  const rows = [{ action: "send_invoice", role: "", level: "ask" }, { action: "voice_confirm_max", role: "", level: "100000" }];

  it("is read from its row, default 5.000 €", () => {
    expect(voiceConfirmMaxFrom(rows)).toBe(100_000);
    expect(voiceConfirmMaxFrom([])).toBe(ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS);
    expect(voiceConfirmMaxFrom([{ action: "voice_confirm_max", role: "foreman", level: "0" }])).toBe(ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS);
  });

  it("does not change any action level", () => {
    expect(levelsFor("owner", rows, true)).toEqual(levelsFor("owner", rows.slice(0, 1), true));
  });

  it("the voice card facts come from the server", () => {
    expect(voiceFacts(4620000.4, "2026-014", "")).toEqual({ amountCents: 4620000, docNumber: "2026-014", recipientName: null });
  });
});
