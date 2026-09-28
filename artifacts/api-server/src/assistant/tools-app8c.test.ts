import { describe, expect, it } from "vitest";
import { ASSISTANT_ACTION_DEFS, type AssistantAction } from "@workspace/config";
import { APP8C_TOOL_DEFINITIONS, APP8C_PROPOSAL_TOOLS, APP8C_READ_TOOLS, likePattern, screenPath, cleanEmail, clientChanges, romeMidnight, SCREENS } from "./tools-app8c.js";
import { TOOL_DEFINITIONS } from "./tools.js";
import { levelsFor, toolsFor, withUnavailable, proposalOutcome } from "./permissions.js";
import { progressLabel, failedToolName, dropNulls } from "./stream.js";
import { APP8C_EVAL_CASES } from "./evals/cases.js";
import { textToHtml, buildClientMessageHtml } from "../lib/clientMessage.js";

// APP-8c (docs/ASSISTENTE-PLAN.md, "Fatta quando"): every new tool has a test and
// a case in the APP-8h set; the customer-facing sends can never run by themselves.

const names = APP8C_TOOL_DEFINITIONS.map((t) => (t.type === "function" ? t.function.name : ""));

describe("the new tools", () => {
  it("are all offered to the model, each either a read or a card", () => {
    const all = TOOL_DEFINITIONS.map((t) => (t.type === "function" ? t.function.name : ""));
    expect(names).toHaveLength(11);
    for (const n of names) {
      expect(all).toContain(n);
      expect(APP8C_READ_TOOLS.has(n) !== Boolean(APP8C_PROPOSAL_TOOLS[n])).toBe(true);
    }
  });

  it("each has a case in the APP-8h set and a line of its own while it runs", () => {
    const covered = new Set(APP8C_EVAL_CASES.flatMap((c) => [c.first, ...(c.note?.match(/\b(propose_\w+|open_screen|brief_me|find|get_quote)\b/g) ?? [])]));
    for (const n of names) {
      expect(covered, n).toContain(n);
      expect(progressLabel(n)).not.toBe("Controllo i dati");
    }
  });

  it("customer-facing sends ask first and can never be set to Lo fa", () => {
    for (const a of ["send_quote", "send_contract", "reply_lead", "message_client"] as AssistantAction[]) {
      expect(ASSISTANT_ACTION_DEFS[a].group).toBe("money");
      expect(ASSISTANT_ACTION_DEFS[a].max).toBe("ask");
      const levels = levelsFor("owner", [{ action: a, role: "", level: "auto" }], true);
      expect(levels[a]).toBe("ask");
      expect(proposalOutcome(levels[a], true)).toBe("card");
    }
  });

  it("a draft, a note and a client's details can be undone", () => {
    for (const a of ["draft_quote", "job_note", "update_client"] as AssistantAction[]) expect(ASSISTANT_ACTION_DEFS[a].undoable).toBe(true);
    expect(levelsFor("owner", [], true)).toMatchObject({ draft_quote: "auto", job_note: "auto", update_client: "ask" });
  });

  it("the role wins: a foreman writes notes but sends no quote, a viewer does nothing", () => {
    const foreman = levelsFor("foreman", [], true);
    expect(foreman).toMatchObject({ job_note: "auto", draft_quote: "never", send_quote: "never", send_contract: "never", reply_lead: "never", message_client: "never", update_client: "never" });
    const viewer = levelsFor("viewer", [], true);
    for (const a of Object.values(APP8C_PROPOSAL_TOOLS)) expect(viewer[a as AssistantAction]).toBe("never");
    const bookkeeper = levelsFor("bookkeeper", [], true);
    expect(bookkeeper.send_quote).toBe("never");
    expect(bookkeeper.message_client).toBe("never");
  });

  it("job notes are not offered before migration 0011", () => {
    const levels = withUnavailable(levelsFor("owner", [], true), { job_note: true });
    expect(levels.job_note).toBe("never");
    const offered = toolsFor(TOOL_DEFINITIONS, levels).map((t) => (t.type === "function" ? t.function.name : ""));
    expect(offered).not.toContain("propose_job_note");
    expect(offered).toContain("brief_me");
    expect(withUnavailable(levelsFor("owner", [], true), { job_note: false }).job_note).toBe("auto");
  });
});

describe("a tool called with null or bad arguments", () => {
  it("every optional argument accepts null, required ones don't", () => {
    const open = TOOL_DEFINITIONS.find((t) => t.type === "function" && t.function.name === "open_screen")!;
    const props = (open.type === "function" ? open.function.parameters : {}) as { properties: Record<string, { type: unknown; enum?: unknown[] }> };
    expect(props.properties.id!.type).toEqual(["string", "null"]);
    // APP-8h: screen is free text now (an unknown value is dropped, not refused by Groq).
    expect(props.properties.screen!.type).toEqual(["string", "null"]);
    expect(props.properties.target!.type).toBe("string");
  });
  it("nulls are dropped before the tool reads the arguments", () => {
    expect(dropNulls({ target: "screen", id: null, screen: "invoices" })).toEqual({ target: "screen", screen: "invoices" });
  });
  it("reads which tool Groq refused", () => {
    expect(failedToolName({ error: { failed_generation: "{\"name\": \"open_screen\", \"arguments\": {\"id\": null}}" } })).toBe("open_screen");
    expect(failedToolName(new Error("x"))).toBeNull();
  });
});

describe("find", () => {
  it("takes the words literally", () => {
    expect(likePattern("Rossi")).toBe("%Rossi%");
    expect(likePattern(" 50%_off\\ ")).toBe("%50\\%\\_off\\\\%");
  });
});

describe("open_screen", () => {
  it("builds the page of a thing or a section", () => {
    expect(screenPath("job", "0b8f6a8e-1111-4222-8333-944455556666", undefined, "owner")).toEqual({ path: "/dashboard/jobs/0b8f6a8e-1111-4222-8333-944455556666", label: "" });
    expect(screenPath("screen", undefined, "invoices", "owner")).toEqual(SCREENS.invoices);
  });
  it("refuses a missing or strange id, and a section the role can't open", () => {
    expect(screenPath("quote", undefined, undefined, "owner")).toHaveProperty("error");
    expect(screenPath("quote", "../../admin", undefined, "owner")).toHaveProperty("error");
    expect(screenPath("screen", undefined, "fisco", "foreman")).toHaveProperty("error");
    expect(screenPath("screen", undefined, "fisco", "bookkeeper")).toEqual(SCREENS.fisco);
  });
  it("only ever points inside the dashboard", () => {
    for (const s of Object.values(SCREENS)) expect(s.path.startsWith("/dashboard")).toBe(true);
  });
});

describe("cards", () => {
  it("accept only real email addresses", () => {
    expect(cleanEmail(" Sara.Lini@Example.IT ")).toBe("sara.lini@example.it");
    for (const bad of ["", "sara", "a@b", "a b@c.it", "x@y.it, z@w.it", "<a@b.it>"]) expect(cleanEmail(bad)).toBeNull();
  });
  it("update_client keeps only what changes", () => {
    expect(clientChanges({ email: "a@b.it", phone: null }, { email: "a@b.it", phone: " 333 ", address: undefined, city: "" })).toEqual({ phone: "333" });
  });
  it("brief_me's day starts at midnight in Italy, summer and winter", () => {
    expect(romeMidnight(new Date("2026-07-15T10:00:00Z")).toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(romeMidnight(new Date("2026-01-15T23:30:00Z")).toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });
});

describe("message_client email", () => {
  it("escapes every character of the text", () => {
    const html = textToHtml("Buongiorno <b>Marco</b>,\nlunedì alle 8.\n\nSaluti & grazie");
    expect(html).toContain("&lt;b&gt;Marco&lt;/b&gt;");
    expect(html).toContain("lunedì alle 8.");
    expect(html).toContain("<br>");
    expect(html.match(/<p /g)).toHaveLength(2);
    expect(html).toContain("Saluti &amp; grazie");
  });
  it("signs with the company and has no unsubscribe link (one-to-one)", () => {
    const html = buildClientMessageHtml({ subject: "x", body: "ciao", profile: { companyName: "Edilizia <Rossi>", address: null, phone: "02 123", email: "info@rossi.it", logoUrl: null } });
    expect(html).toContain("Edilizia &lt;Rossi&gt;");
    expect(html).toContain("02 123 · info@rossi.it");
    expect(html.toLowerCase()).not.toContain("disiscriv");
  });
});

describe("APP-8h: find types in Italian", () => {
  it("maps the Italian names the model writes to the search types", async () => {
    const { findType } = await import("./tools-app8c.js");
    expect(findType("fornitore")).toBe("supplier");
    expect(findType("richiesta")).toBe("lead");
    expect(findType("cantiere")).toBe("job");
    expect(findType("quote")).toBe("quote");
  });
});
