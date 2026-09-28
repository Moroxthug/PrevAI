import { describe, it, expect } from "vitest";
import { roleCan, type PermissionArea, type PermissionAction } from "./requirePermission";
import { TEAM_MEMBER_ROLES } from "@workspace/db";

const AREAS: PermissionArea[] = ["quotes", "contracts", "jobs", "costs", "invoicing", "team", "analytics", "settings", "leads", "integrations", "security"];

describe("roleCan", () => {
  it("owner has full access everywhere", () => {
    for (const area of AREAS) {
      expect(roleCan("owner", area, "full")).toBe(true);
    }
  });

  it("viewer never has edit or full access to anything", () => {
    for (const area of AREAS) {
      expect(roleCan("viewer", area, "edit")).toBe(false);
      expect(roleCan("viewer", area, "full")).toBe(false);
      expect(roleCan("viewer", area, "view")).toBe(true);
    }
  });

  it("foreman is blocked from invoicing edits but can view", () => {
    expect(roleCan("foreman", "invoicing", "view")).toBe(true);
    expect(roleCan("foreman", "invoicing", "edit")).toBe(false);
  });

  it("foreman can edit jobs and costs but not delete/manage full-level actions", () => {
    expect(roleCan("foreman", "jobs", "edit")).toBe(true);
    expect(roleCan("foreman", "jobs", "full")).toBe(false);
    expect(roleCan("foreman", "costs", "edit")).toBe(true);
    expect(roleCan("foreman", "costs", "full")).toBe(false);
  });

  it("every role can at least view the security audit log", () => {
    for (const role of TEAM_MEMBER_ROLES) {
      expect(roleCan(role, "security", "view")).toBe(true);
    }
  });

  it("only owner has full control over security settings", () => {
    for (const role of TEAM_MEMBER_ROLES) {
      if (role === "owner") {
        expect(roleCan(role, "security", "full")).toBe(true);
      } else {
        expect(roleCan(role, "security", "full")).toBe(false);
      }
    }
  });

  // A-2: `fiscale` è la prima area **chiusa**. Incassi, imposte e soglia del
  // forfettario sono la posizione fiscale del titolare, non un dato di lavoro:
  // office, foreman e viewer non li vedono nemmeno in lettura.
  // APP-7: il contabile la legge (scadenze, F24) ma non la cambia.
  it("only owner, admin and bookkeeper can read the fiscal area; nobody else can even view it", () => {
    expect(roleCan("owner", "fiscale", "full")).toBe(true);
    expect(roleCan("admin", "fiscale", "view")).toBe(true);
    expect(roleCan("admin", "fiscale", "full")).toBe(false);
    expect(roleCan("bookkeeper", "fiscale", "view")).toBe(true);
    expect(roleCan("bookkeeper", "fiscale", "edit")).toBe(false);
    for (const role of ["office", "foreman", "viewer"] as const) {
      expect(roleCan(role, "fiscale", "view")).toBe(false);
      expect(roleCan(role, "fiscale", "full")).toBe(false);
    }
  });

  it("bookkeeper handles invoices and costs but only reads quotes and jobs", () => {
    expect(roleCan("bookkeeper", "invoicing", "full")).toBe(true);
    expect(roleCan("bookkeeper", "costs", "full")).toBe(true);
    expect(roleCan("bookkeeper", "quotes", "edit")).toBe(false);
    expect(roleCan("bookkeeper", "jobs", "edit")).toBe(false);
    expect(roleCan("bookkeeper", "team", "edit")).toBe(false);
  });

  it("rank comparison is monotonic: full implies edit implies view", () => {
    const actions: PermissionAction[] = ["view", "edit", "full"];
    for (const role of TEAM_MEMBER_ROLES) {
      for (const area of AREAS) {
        for (let i = 0; i < actions.length; i++) {
          if (roleCan(role, area, actions[i])) {
            for (let j = 0; j <= i; j++) {
              expect(roleCan(role, area, actions[j])).toBe(true);
            }
          }
        }
      }
    }
  });
});
