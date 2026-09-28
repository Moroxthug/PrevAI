import { describe, expect, it } from "vitest";
import { CompletionAccumulator, progressLabel, sseFrame } from "./stream.js";
import { pageContextSchema, screenName } from "./context.js";

describe("APP-8a CompletionAccumulator", () => {
  it("joins text chunks and returns each new piece", () => {
    const acc = new CompletionAccumulator();
    expect(acc.push({ content: "Il cantiere " })).toBe("Il cantiere ");
    expect(acc.push({ content: "è al 40%." })).toBe("è al 40%.");
    expect(acc.push(null)).toBe("");
    expect(acc.text).toBe("Il cantiere è al 40%.");
    expect(acc.toolCalls()).toEqual([]);
  });

  it("rebuilds tool calls that arrive in fragments, in index order", () => {
    const acc = new CompletionAccumulator();
    acc.push({ tool_calls: [{ index: 1, id: "b", function: { name: "list_", arguments: "" } }] });
    acc.push({ tool_calls: [{ index: 0, id: "a", function: { name: "get_job_summary", arguments: '{"job_' } }] });
    acc.push({ tool_calls: [{ index: 1, function: { name: "jobs", arguments: "{}" } }] });
    acc.push({ tool_calls: [{ index: 0, function: { arguments: 'id":"x"}' } }] });
    expect(acc.toolCalls()).toEqual([
      { id: "a", name: "get_job_summary", arguments: '{"job_id":"x"}' },
      { id: "b", name: "list_jobs", arguments: "{}" },
    ]);
    expect(acc.text).toBe("");
  });

  it("gives a call without an id a stable one and drops nameless fragments", () => {
    const acc = new CompletionAccumulator();
    acc.push({ tool_calls: [{ index: 0, function: { name: "list_jobs" } }, { index: 1, function: { arguments: "{}" } }] });
    expect(acc.toolCalls()).toEqual([{ id: "call_0", name: "list_jobs", arguments: "" }]);
  });
});

describe("APP-8a progress labels and SSE frames", () => {
  it("names every read tool in Italian and proposals generically", () => {
    expect(progressLabel("get_job_summary")).toBe("Guardo il cantiere");
    expect(progressLabel("list_costs")).toBe("Guardo i costi");
    expect(progressLabel("propose_send_invoice")).toBe("Preparo la proposta");
    expect(progressLabel("unknown_tool")).toBe("Controllo i dati");
  });

  it("writes one event with single-line JSON data", () => {
    expect(sseFrame("delta", { text: "a\nb" })).toBe('event: delta\ndata: {"text":"a\\nb"}\n\n');
  });
});

describe("APP-8a page context", () => {
  it("accepts a dashboard path with ids and rejects junk", () => {
    const id = "6f1c2f5e-4b1a-4c1e-9d2a-3b4c5d6e7f80";
    expect(pageContextSchema.safeParse({ path: `/dashboard/jobs/${id}`, projectId: id }).success).toBe(true);
    expect(pageContextSchema.safeParse({ path: "/dashboard", quoteId: null }).success).toBe(true);
    expect(pageContextSchema.safeParse({ path: "/dashboard", projectId: "1 OR 1=1" }).success).toBe(false);
    expect(pageContextSchema.safeParse({ path: "javascript:alert(1)" }).success).toBe(false);
    expect(pageContextSchema.safeParse({ path: "/dashboard", clientName: "x" }).success).toBe(false);
  });

  it("names the screen the user is on", () => {
    expect(screenName("/dashboard")).toBe("la home (Oggi)");
    expect(screenName("/dashboard/invoices/abc")).toBe("le fatture");
    expect(screenName("/dashboard/fisco/commercialista")).toBe("il fisco");
    expect(screenName("/help")).toBeNull();
  });
});
