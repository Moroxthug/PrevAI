import { describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { businessProfilesTable } from "@workspace/db";
import { avviaProvaSeServe } from "./trial";

// Captures the statement instead of running it: the point is the SQL shape.
function captureExec() {
  const mock = drizzle.mock();
  let sqlText = "";
  let params: unknown[] = [];
  const exec = {
    insert: (table: typeof businessProfilesTable) => {
      const builder = mock.insert(table);
      return new Proxy(builder, {
        get(target, prop, recv) {
          const v = Reflect.get(target, prop, recv);
          if (prop !== "values") return v;
          return (...a: unknown[]) => {
            const afterValues = (v as (...x: unknown[]) => ReturnType<typeof builder.values>).apply(target, a);
            return {
              onConflictDoUpdate: (cfg: Parameters<typeof afterValues.onConflictDoUpdate>[0]) => {
                const q = afterValues.onConflictDoUpdate(cfg).toSQL();
                sqlText = q.sql;
                params = q.params;
                return Promise.resolve();
              },
            };
          };
        },
      });
    },
  } as unknown as Parameters<typeof avviaProvaSeServe>[0];
  return { exec, get: () => ({ sqlText, params }) };
}

describe("avviaProvaSeServe", () => {
  it("creates the profile row when it is missing instead of updating nothing", async () => {
    const { exec, get } = captureExec();
    const now = new Date("2026-11-10T09:00:00Z");
    await avviaProvaSeServe(exec, "user-1", now);
    const { sqlText, params } = get();
    expect(sqlText).toMatch(/^insert into "business_profiles"/);
    expect(sqlText).toContain('on conflict ("user_id") do update');
    expect(params).toContain("user-1");
  });

  it("never moves the start of a trial that already began", async () => {
    const { exec, get } = captureExec();
    await avviaProvaSeServe(exec, "user-1");
    expect(get().sqlText).toContain('coalesce("business_profiles"."trial_started_at", excluded.trial_started_at)');
  });
});
