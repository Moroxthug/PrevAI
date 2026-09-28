import { describe, expect, it } from "vitest";
import { ASSISTANT_ACTIONS, ASSISTANT_ACTION_DEFS, clampAssistantLevel, effectiveAssistantLevel, type AssistantAction } from "@workspace/config";
import { TEAM_MEMBER_ROLES, PROPOSAL_KINDS, type TeamMemberRole } from "@workspace/db";
import { TOOL_DEFINITIONS, PROPOSAL_TOOLS } from "./tools.js";
import { levelsFor, roleAllowsAction, toolsFor } from "./permissions.js";
import { permissionsParagraph, proposalOutcome } from "./permissions.js";
import { undoDeadline } from "./permissions.js";

// APP-8b (docs/ASSISTENTE-PLAN.md, "Fatta quando"): a "Mai" tool is never offered,
// "Chiede prima" never runs without a confirmation, and a role without
// invoicing:edit never sends an invoice whatever the settings say.

const toolNames = (role: TeamMemberRole, rows: { action: string; role: string; level: string }[], ready = true) =>
  toolsFor(TOOL_DEFINITIONS, levelsFor(role, rows, ready)).map((t) => (t.type === "function" ? t.function.name : ""));
const toolOf = (a: AssistantAction) => Object.entries(PROPOSAL_TOOLS).find(([, k]) => k === a)![0];
const everything = (level: string, role = "") => ASSISTANT_ACTIONS.map((action) => ({ action, role, level }));

describe("catalog", () => {
  it("covers every kind of proposal card and every propose_* tool", () => {
    expect([...ASSISTANT_ACTIONS].sort()).toEqual([...PROPOSAL_KINDS].sort());
    expect(Object.values(PROPOSAL_TOOLS).sort()).toEqual([...PROPOSAL_KINDS].sort());
  });

  it("money and customer actions can never run by themselves", () => {
    for (const a of ["send_invoice", "record_payment"] as const) {
      expect(ASSISTANT_ACTION_DEFS[a].max).toBe("ask");
      expect(clampAssistantLevel(a, "auto")).toBe("ask");
      expect(effectiveAssistantLevel(a, "owner", [{ action: a, role: "", level: "auto" }], true)).toBe("ask");
    }
  });

  it("defaults follow the plan: notes and drafts Lo fa, money Chiede prima", () => {
    const owner = levelsFor("owner", [], true);
    expect(owner).toEqual({ cost_entry: "auto", task: "auto", milestone_update: "auto", invoice: "auto", send_invoice: "ask", record_payment: "ask", job_note: "auto", update_client: "ask", draft_quote: "auto", send_quote: "ask", send_contract: "ask", reply_lead: "ask", message_client: "ask" });
  });
});

describe("a Mai tool is never offered", () => {
  it("company-wide Mai removes the tool for everyone", () => {
    for (const a of ASSISTANT_ACTIONS) {
      for (const role of TEAM_MEMBER_ROLES) expect(toolNames(role, [{ action: a, role: "", level: "never" }])).not.toContain(toolOf(a));
    }
  });

  it("a role's own Mai wins over the company's choice, only for that role", () => {
    const rows = [{ action: "cost_entry", role: "", level: "auto" }, { action: "cost_entry", role: "office", level: "never" }];
    expect(toolNames("office", rows)).not.toContain("propose_cost_entry");
    expect(toolNames("owner", rows)).toContain("propose_cost_entry");
  });

  it("read tools are always offered, even with everything on Mai", () => {
    const names = toolNames("viewer", everything("never"));
    for (const t of TOOL_DEFINITIONS) {
      const n = t.type === "function" ? t.function.name : "";
      if (!PROPOSAL_TOOLS[n]) expect(names).toContain(n);
    }
    expect(names.some((n) => n.startsWith("propose_"))).toBe(false);
  });

  it("a Mai call the model makes anyway is rejected, not stored", () => {
    expect(proposalOutcome("never", true)).toBe("reject");
    expect(proposalOutcome("never", false)).toBe("reject");
  });
});

describe("Chiede prima never runs without a confirmation", () => {
  it("ask is always a card", () => {
    expect(proposalOutcome("ask", true)).toBe("card");
    expect(proposalOutcome("ask", false)).toBe("card");
  });

  it("before migration 0013 nothing runs by itself, whatever the defaults", () => {
    for (const role of TEAM_MEMBER_ROLES) {
      const levels = levelsFor(role, [], false);
      for (const a of ASSISTANT_ACTIONS) expect(levels[a]).not.toBe("auto");
    }
    expect(proposalOutcome("auto", false)).toBe("card");
  });

  it("only auto, after the migration, runs", () => {
    expect(proposalOutcome("auto", true)).toBe("run");
  });

  it("an owner who set every action to Lo fa still gets a card for sending an invoice or recording a payment", () => {
    const levels = levelsFor("owner", everything("auto"), true);
    expect(proposalOutcome(levels.send_invoice, true)).toBe("card");
    expect(proposalOutcome(levels.record_payment, true)).toBe("card");
  });
});

describe("the role always wins", () => {
  const withoutInvoicingEdit = TEAM_MEMBER_ROLES.filter((r) => !roleAllowsAction(r, "send_invoice"));

  it("foreman and viewer can't invoice by hand, so they can't through the assistant", () => {
    expect(withoutInvoicingEdit).toEqual(expect.arrayContaining(["foreman", "viewer"]));
    expect(withoutInvoicingEdit).not.toContain("owner");
    expect(withoutInvoicingEdit).not.toContain("bookkeeper");
  });

  it("no setting gives them the send-invoice tool", () => {
    const settings = [
      [],
      everything("auto"),
      everything("ask"),
      ...withoutInvoicingEdit.map((r) => everything("auto", r)),
      ...withoutInvoicingEdit.map((r) => everything("ask", r)),
    ];
    for (const role of withoutInvoicingEdit) {
      for (const rows of settings) {
        for (const ready of [true, false]) {
          const levels = levelsFor(role, rows, ready);
          expect(levels.send_invoice).toBe("never");
          expect(levels.record_payment).toBe("never");
          expect(levels.invoice).toBe("never");
          expect(toolNames(role, rows, ready)).not.toContain("propose_send_invoice");
        }
      }
    }
  });

  it("a viewer gets no write tools at all", () => {
    expect(toolNames("viewer", everything("auto")).filter((n) => n.startsWith("propose_"))).toEqual([]);
  });

  it("a bookkeeper records payments but does not touch the schedule", () => {
    const levels = levelsFor("bookkeeper", [], true);
    expect(levels.record_payment).toBe("ask");
    expect(levels.cost_entry).toBe("auto");
    expect(levels.milestone_update).toBe("never");
    expect(levels.task).toBe("never");
  });
});

describe("Annulla", () => {
  const at = new Date("2026-09-27T10:00:00Z");
  it("only for Lo fa actions that can be taken back, for a few seconds", () => {
    expect(undoDeadline({ level: "auto", kind: "cost_entry", executedAt: at, undoneAt: null })?.getTime()).toBe(at.getTime() + 10_000);
    expect(undoDeadline({ level: "ask", kind: "cost_entry", executedAt: at, undoneAt: null })).toBeNull();
    expect(undoDeadline({ level: "auto", kind: "milestone_update", executedAt: at, undoneAt: null })).toBeNull();
    expect(undoDeadline({ level: "auto", kind: "task", executedAt: at, undoneAt: at })).toBeNull();
    expect(undoDeadline(null)).toBeNull();
  });
});

describe("what the model is told", () => {
  it("names each action under its level", () => {
    const text = permissionsParagraph(levelsFor("foreman", [], true));
    expect(text).toContain("fai subito");
    expect(text).toContain("aggiungere un costo");
    expect(text).toContain("non sono disponibili");
    expect(text).toContain("inviare una fattura al cliente");
  });
});
