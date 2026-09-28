import { describe, it, expect } from "vitest";
import { HOME_DEFAULTS, HOME_KINDS, HOME_KIND_ROLE, normalizeHomeLayout } from "@workspace/config";
import { TEAM_MEMBER_ROLES } from "@workspace/db";
import { allowedSections, effectiveLayout, startingLayout } from "./service";

describe("APP-7 home per ruolo", () => {
  it("each role gets its own kind of home", () => {
    expect(effectiveLayout("owner", null, null).layout.order).toEqual(["needs-you", "composer", "stats", "recent-quotes", "jobs", "revenue"]);
    expect(effectiveLayout("foreman", null, null).layout.order).toEqual(["needs-you", "jobs", "hours"]);
    expect(effectiveLayout("bookkeeper", null, null).layout.order).toEqual(["needs-you", "invoices", "fisco", "stats"]);
    expect(effectiveLayout("office", null, null).layout.order[1]).toBe("composer");
  });

  it("a role never gets a section its permissions don't cover, whatever is stored", () => {
    const everything = { order: ["needs-you", "composer", "stats", "invoices", "fisco", "jobs", "hours", "recent-quotes", "revenue", "made-up"], needsYouCollapsed: false, tabs: [], period: "m" };
    // Foreman: reads quotes but can't write them, and has no fiscal area.
    const foreman = effectiveLayout("foreman", everything, null).layout.order;
    expect(foreman).not.toContain("composer");
    expect(foreman).not.toContain("fisco");
    expect(foreman).not.toContain("made-up");
    // Office and viewer: no fiscal area either.
    expect(effectiveLayout("office", everything, null).layout.order).not.toContain("fisco");
    expect(effectiveLayout("viewer", everything, null).layout.order).not.toContain("fisco");
    expect(effectiveLayout("viewer", everything, null).layout.order).not.toContain("hours");
    // The same cut applies to an owner-set role default.
    expect(effectiveLayout("foreman", null, everything).layout.order).not.toContain("composer");
  });

  it("'Serve a te' can't be removed", () => {
    for (const role of TEAM_MEMBER_ROLES) {
      const { layout } = effectiveLayout(role, { order: ["stats"], needsYouCollapsed: true, tabs: [], period: "m" }, null);
      expect(layout.order).toContain("needs-you");
      expect(layout.needsYouCollapsed).toBe(true);
    }
  });

  it("the owner's default for a kind is used until the person saves their own", () => {
    const roleDefault = { order: ["needs-you", "hours", "jobs"], needsYouCollapsed: false, tabs: ["/dashboard/jobs"], period: "q" };
    const viaRole = effectiveLayout("foreman", null, roleDefault);
    expect(viaRole.source).toBe("role");
    expect(viaRole.layout.order).toEqual(["needs-you", "hours", "jobs"]);
    expect(viaRole.layout.period).toBe("q");
    const own = effectiveLayout("foreman", { order: ["jobs"], needsYouCollapsed: false, tabs: [], period: "m" }, roleDefault);
    expect(own.source).toBe("user");
    expect(own.layout.order).toEqual(["needs-you", "jobs"]);
  });

  it("tabs: at most three, dashboard paths only, no duplicates", () => {
    const { layout } = effectiveLayout("owner", { order: [], needsYouCollapsed: false, tabs: ["/dashboard/quotes", "/dashboard/quotes", "https://evil.example", "/dashboard/jobs", "/dashboard/invoices", "/dashboard/clients"], period: "x" }, null);
    expect(layout.tabs).toEqual(["/dashboard/quotes", "/dashboard/jobs", "/dashboard/invoices"]);
    expect(layout.period).toBe("m");
  });

  it("every built-in default only lists sections its kind may see", () => {
    for (const kind of HOME_KINDS) {
      const allowed = allowedSections(HOME_KIND_ROLE[kind]);
      expect(startingLayout(kind, null).order).toEqual(HOME_DEFAULTS[kind].order.filter((id) => allowed.includes(id)));
      expect(normalizeHomeLayout(HOME_DEFAULTS[kind], allowed, HOME_DEFAULTS[kind])).toEqual(HOME_DEFAULTS[kind]);
    }
  });
});

describe("APP-7 'Serve a te' per ruolo", () => {
  it("shows each person what waits on them", async () => {
    const { needsYouKindsFor } = await import("../today/service");
    expect([...needsYouKindsFor("foreman")]).toEqual(["hours"]);
    expect([...needsYouKindsFor("bookkeeper")].sort()).toEqual(["bonifico", "overdue"]);
    for (const role of ["owner", "admin", "office", "viewer"] as const) expect(needsYouKindsFor(role).size).toBe(5);
  });
});
