// APP-5 — beta con le imprese pilota: usage events, "Segnala un problema",
// the admin pilot report and the feedback status.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, appEventsTable, appFeedbackTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, cleanupAll, api } from "./harness.js";

const savedAdmin = process.env.ADMIN_EMAIL;

describe("app beta (APP-5)", () => {
  beforeAll(startServer);
  afterAll(async () => {
    process.env.ADMIN_EMAIL = savedAdmin;
    await cleanupAll();
    await stopServer();
  });

  test("events are recorded per surface, feedback is stored, the admin report counts native quotes", async () => {
    const pilot = await createOrg({ companyName: "Pilota Edilizia Srl" });
    const admin = await createOrg({ companyName: "Staff PrevAI" });
    process.env.ADMIN_EMAIL = admin.email;

    // Not signed in → 401; bad kind or surface → 400.
    expect((await api("/api/app/events", { body: { kind: "app_open", surface: "android" } })).status).toBe(401);
    expect((await pilot.api("/api/app/events", { body: { kind: "deleted_everything", surface: "android" } })).status).toBe(400);
    expect((await pilot.api("/api/app/events", { body: { kind: "app_open", surface: "windows-phone" } })).status).toBe(400);

    const send = (body: Record<string, unknown>) => pilot.api("/api/app/events", { body: { viewport: "phone", appVersion: "abc123", ...body } });
    expect((await send({ kind: "app_open", surface: "android" })).status).toBe(204);
    expect((await send({ kind: "quote_created", surface: "android", entityId: "q-1" })).status).toBe(204);
    expect((await send({ kind: "quote_created", surface: "ios", entityId: "q-2" })).status).toBe(204);
    expect((await send({ kind: "quote_created", surface: "web", entityId: "q-3" })).status).toBe(204);
    expect((await send({ kind: "quote_shared", surface: "android", entityId: "q-1", channel: "email" })).status).toBe(204);
    // An app_open never carries an entity or a channel, whatever the client sends.
    expect((await send({ kind: "app_open", surface: "pwa", entityId: "x", channel: "link" })).status).toBe(204);

    const rows = await db.select().from(appEventsTable).where(eq(appEventsTable.userId, pilot.userId));
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.actorUserId === pilot.userId && r.viewport === "phone" && r.appVersion === "abc123")).toBe(true);
    const pwaOpen = rows.find((r) => r.surface === "pwa")!;
    expect(pwaOpen.entityId).toBeNull();
    expect(pwaOpen.channel).toBeNull();

    // Feedback: too short → 400; ok → 201 and stored with the page (no query string) and the user agent.
    expect((await pilot.api("/api/app/feedback", { body: { message: "no", surface: "android" } })).status).toBe(400);
    const fb = await pilot.api("/api/app/feedback", {
      body: { message: "Premo Invia e non succede niente", route: "/dashboard/quotes/q-1?tab=x", surface: "android", viewport: "phone" },
      headers: { "user-agent": "PrevAI-e2e/1.0" },
    });
    expect(fb.status, JSON.stringify(fb.body)).toBe(201);
    const [stored] = await db.select().from(appFeedbackTable).where(eq(appFeedbackTable.id, fb.body.id));
    expect(stored).toMatchObject({ userId: pilot.userId, route: "/dashboard/quotes/q-1", surface: "android", userAgent: "PrevAI-e2e/1.0", stato: "nuovo" });

    // The report is staff-only.
    expect((await pilot.api("/api/admin/app-beta")).status).toBe(403);
    const report = await admin.api("/api/admin/app-beta?days=14");
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body.migrated).toBe(true);
    const row = report.body.orgs.find((o: { userId: string }) => o.userId === pilot.userId);
    expect(row).toMatchObject({
      companyName: "Pilota Edilizia Srl",
      native: { app_open: 1, quote_created: 2, quote_shared: 1 },
      total: { app_open: 2, quote_created: 3, quote_shared: 1 },
      surfaces: ["android", "ios", "pwa", "web"],
    });
    expect(report.body.goal.nativeQuotes).toBeGreaterThanOrEqual(2);
    expect(report.body.feedback.find((f: { id: string }) => f.id === fb.body.id)).toMatchObject({ companyName: "Pilota Edilizia Srl", stato: "nuovo" });

    // Staff moves the feedback along; a pilot cannot.
    expect((await pilot.api(`/api/admin/app-beta/feedback/${fb.body.id}`, { method: "PATCH", body: { stato: "risolto" } })).status).toBe(403);
    expect((await admin.api(`/api/admin/app-beta/feedback/${fb.body.id}`, { method: "PATCH", body: { stato: "chiuso" } })).status).toBe(400);
    const patched = await admin.api(`/api/admin/app-beta/feedback/${fb.body.id}`, { method: "PATCH", body: { stato: "risolto" } });
    expect(patched.status).toBe(200);
    expect(patched.body.stato).toBe("risolto");
  });
});
