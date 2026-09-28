import { describe, expect, it } from "vitest";
import { ASSISTANT_ACTION_DEFS, classifyVoiceReply, spokenPhone, telefonoPerChiamata, voiceConfirmation, voiceNeedsTap } from "@workspace/config";
import { APP8G_TOOL_DEFINITIONS, APP8G_PROPOSAL_TOOLS, fold, matchScore, nameTokens, pickCallee, referente, type CallCandidate } from "./tools-app8g.js";
import { PROPOSAL_TOOLS, TOOL_DEFINITIONS } from "./tools.js";
import { levelsFor, proposalOutcome, toolsFor } from "./permissions.js";
import { progressLabel } from "./stream.js";
import { APP8G_EVAL_CASES } from "./evals/cases.js";

// APP-8g (docs/ASSISTENTE-PLAN.md): "Chiama Rossi" opens the phone — the right
// number, never by itself, and several people with that name → it asks.

describe("telefonoPerChiamata", () => {
  it.each([
    ["333 123 4567", "+393331234567", "333 123 4567"],
    ["3331234567", "+393331234567", "333 123 4567"],
    ["+39 333 1234567", "+393331234567", "+39 333 1234567"],
    ["0039 333 123 4567", "+393331234567", "0039 333 123 4567"],
    ["02/1234567", "+39021234567", "02/1234567"],
    ["06 1234 5678", "+390612345678", "06 1234 5678"],
    ["+39 (0)2 1234 567", "+39021234567", "+39 (0)2 1234 567"],
    ["393331234567", "+393331234567", "333 123 4567"],
    ["+41 44 123 45 67", "+41441234567", "+41 44 123 45 67"],
    ["tel:+393331234567", "+393331234567", "333 123 4567"],
  ])("%s → %s", (raw, dial, display) => {
    expect(telefonoPerChiamata(raw)).toEqual({ dial, display });
  });

  it.each([null, "", "  ", "123", "mario@example.it", "chiamare dopo le 18", "12345678901234567", "555 1234"])("%j is not a number to call", (raw) => {
    expect(telefonoPerChiamata(raw)).toBeNull();
  });
});

describe("the spoken card", () => {
  const card = { kind: "call", summary: "Chiama Edilceramiche (fornitore, ceramiche) al 333 123 4567", payload: { name: "Edilceramiche", phone: "+393331234567", phoneDisplay: "333 123 4567" } };

  it("reads the number digit by digit in its groups", () => {
    expect(spokenPhone("333 123 4567")).toBe("3 3 3, 1 2 3, 4 5 6 7");
    expect(spokenPhone("+39 02 1234 5678")).toBe("0 2, 1 2 3 4, 5 6 7 8");
  });

  it("asks before opening the phone, and a yes is enough (no amount)", () => {
    expect(voiceNeedsTap(card, 0)).toBe(false);
    expect(voiceConfirmation(card, 500000).say).toBe("Chiamo Edilceramiche al 3 3 3, 1 2 3, 4 5 6 7? Di' sì e apro il telefono.");
  });

  it("'chiamalo' is a yes, 'chiama Luca' is not", () => {
    expect(classifyVoiceReply("Chiamalo.")).toBe("yes");
    expect(classifyVoiceReply("sì, chiama")).toBe("yes");
    expect(classifyVoiceReply("chiama Luca")).toBe("other");
    expect(classifyVoiceReply("no, chiama l'altro")).toBe("other");
  });
});

describe("who to call", () => {
  const c = (type: CallCandidate["type"], id: string, name: string, extra: string, phone: string | null): CallCandidate => ({ type, id, name, detail: null, phone, haystack: `${name} ${extra}` });
  const book = [
    c("supplier", "s1", "Edilceramiche Srl", "ceramiche Marco Bianchi fornitore", "333 111 2222"),
    c("supplier", "s2", "Idraulica Neri", "idraulico Paolo fornitore", "02 555 6666"),
    c("client", "c1", "Mario Rossi", "via Roma 3 Milano cliente", "347 000 1111"),
    c("lead", "l1", "Mario Rossi", "richiesta", "347 000 1111"),
    c("client", "c2", "Marco Verdi", "cliente", "348 999 8888"),
    c("worker", "w1", "Giuseppe Esposito", "muratore squadra", "320 123 4567"),
  ];

  it("keeps the words that name someone", () => {
    expect(nameTokens("Marco di Edilceramiche")).toEqual(["marco", "edilceramiche"]);
    expect(nameTokens("chiama il signor Rossi")).toEqual(["rossi"]);
    expect(fold("Nicolò D'Àngelo")).toBe("nicolo d angelo");
  });

  it("matches whole words, starts and (4+ letters) inside", () => {
    expect(matchScore(["edil"], "Edilceramiche Srl")).toBe(1);
    expect(matchScore(["ceramiche"], "Edilceramiche Srl")).toBe(1);
    expect(matchScore(["ros"], "Mario Grossi")).toBe(0);
  });

  it("finds the supplier by referente and company together", () => {
    const pick = pickCallee(nameTokens("Marco di Edilceramiche"), book);
    expect(pick.kind === "one" && pick.candidate.id).toBe("s1");
  });

  it("finds a supplier by trade", () => {
    const pick = pickCallee(nameTokens("l'idraulico"), book);
    expect(pick.kind === "one" && pick.candidate.id).toBe("s2");
  });

  it("the client and the lead of the same person with the same number are one", () => {
    const pick = pickCallee(nameTokens("Rossi"), book);
    expect(pick.kind).toBe("one");
  });

  it("two people with different numbers → it asks", () => {
    const pick = pickCallee(nameTokens("Marco"), book);
    expect(pick.kind).toBe("choose");
    expect(pick.kind === "choose" && pick.candidates.map((x) => x.id).sort()).toEqual(["c2", "s1"]);
  });

  it("a partial match is never called by itself", () => {
    const pick = pickCallee(nameTokens("Marco Rossi"), book);
    expect(pick.kind).toBe("choose");
  });

  it("a supplier's notes give the referente when they start with a name", () => {
    expect(referente("Marco Neri")).toBe("Marco Neri");
    expect(referente("Paolo Esposito - P. IVA 01234567890")).toBe("Paolo Esposito");
    expect(referente("Marco Bianchi · 333 111 2222")).toBe("Marco Bianchi");
    expect(referente("P. IVA 01234567890")).toBeNull();
    expect(referente("ordini@ditta.it")).toBeNull();
    expect(referente("")).toBeNull();
  });

  it("says the referente and the company", () => {
    const say = voiceConfirmation({ kind: "call", summary: "", payload: { name: "Marco Neri", company: "Edilceramiche Srl", phoneDisplay: "333 987 6543" } }, 0).say;
    expect(say).toBe("Chiamo Marco Neri di Edilceramiche Srl al 3 3 3, 9 8 7, 6 5 4 3? Di' sì e apro il telefono.");
  });

  it("nobody → none", () => {
    expect(pickCallee(nameTokens("Bianki"), book).kind).toBe("none");
    expect(pickCallee([], book).kind).toBe("none");
  });
});

describe("the tool", () => {
  it("is offered, is a card and has cases in the APP-8h set", () => {
    const all = TOOL_DEFINITIONS.map((t) => (t.type === "function" ? t.function.name : ""));
    for (const t of APP8G_TOOL_DEFINITIONS) {
      const name = t.type === "function" ? t.function.name : "";
      expect(all).toContain(name);
      expect(PROPOSAL_TOOLS[name]).toBe("call");
      expect(APP8G_PROPOSAL_TOOLS[name]).toBe("call");
      expect(progressLabel(name)).toBe("Cerco il numero");
      expect(APP8G_EVAL_CASES.some((c) => c.first === name)).toBe(true);
    }
  });

  it("always asks first: opening the phone can't be set to Lo fa", () => {
    expect(ASSISTANT_ACTION_DEFS.call.max).toBe("ask");
    const levels = levelsFor("owner", [{ action: "call", role: "", level: "auto" }], true);
    expect(levels.call).toBe("ask");
    expect(proposalOutcome(levels.call, true)).toBe("card");
  });

  it("anyone who sees the jobs may ask for it, unless the owner says Mai", () => {
    expect(levelsFor("viewer", [], true).call).toBe("ask");
    const never = levelsFor("office", [{ action: "call", role: "", level: "never" }], true);
    expect(never.call).toBe("never");
    expect(toolsFor(TOOL_DEFINITIONS, never).some((t) => t.type === "function" && t.function.name === "propose_call")).toBe(false);
  });

  it("no eval case expects a message where a call was asked", () => {
    for (const c of APP8G_EVAL_CASES) expect(c.never ?? []).not.toContain("propose_call");
  });
});
