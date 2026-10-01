// TEAM-1 (riga 56): codici d'accesso, posti (inclusi + extra), chi ha inviato
// e chi ha vinto, classifica della squadra.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, businessProfilesTable, organizationMembersTable, quotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, seedQuote, cleanupAll } from "./harness.js";

const CODE_SHAPE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

describe("team1: codici d'accesso e posti", () => {
  beforeAll(startServer);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("un codice occupa un posto, si usa una volta sola e dà accesso all'impresa", async () => {
    const owner = await createOrg({ plan: "monthly_pro" }); // 2 posti: titolare + uno
    const quote = await seedQuote(owner.userId);

    const made = await owner.api("/api/team/codes", { body: { role: "office", label: "Mario, cantiere Rossi" } });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.code).toMatch(CODE_SHAPE);
    const code = made.body.code as string;

    // Il codice in chiaro non è mai salvato.
    const [row] = await db.select().from(organizationMembersTable).where(eq(organizationMembersTable.id, made.body.memberId));
    expect(row!.accessCodeHash).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(code.replace("-", ""));

    const list = await owner.api("/api/team/members");
    expect(list.body.seats).toMatchObject({ used: 2, included: 2, extra: 0, limit: 2, extraPurchasable: false });
    expect(list.body.items[0]).toMatchObject({ viaCode: true, label: "Mario, cantiere Rossi", status: "invited" });

    // Posti finiti: né un secondo codice né un invito per email.
    const second = await owner.api("/api/team/codes", { body: { role: "office" } });
    expect(second.status).toBe(403);
    expect(second.body.error).toBe("SEAT_LIMIT");
    const invite = await owner.api("/api/team/members/invite", { body: { email: `nope-${owner.userId}@example.invalid`, role: "office", send: false } });
    expect(invite.status).toBe(403);

    // Un codice non si "rimanda" per email.
    const resend = await owner.api(`/api/team/members/${made.body.memberId}/resend`, { method: "POST" });
    expect(resend.status).toBe(409);
    expect(resend.body.error).toBe("CODE_INVITE");

    // Chi lo scrive deve avere un accesso suo.
    const worker = await createUser({ name: "Mario Operaio" });
    expect((await worker.api("/api/team/code/redeem", { body: { code: "ZZZZ-ZZZZ" } })).status).toBe(404);
    expect((await worker.api("/api/team/code/redeem", { body: { code: "abc" } })).status).toBe(400);
    expect((await owner.api("/api/team/code/redeem", { body: { code } })).body.error).toBe("OWN_COMPANY");

    // Minuscole, senza trattino: va bene lo stesso.
    const typed = code.replace("-", "").toLowerCase();
    const redeemed = await worker.api("/api/team/code/redeem", { body: { code: typed } });
    expect(redeemed.status, JSON.stringify(redeemed.body)).toBe(200);
    expect(redeemed.body.member).toMatchObject({ role: "office", status: "active", email: worker.email, viaCode: true });

    // Una volta sola: né lui né un altro.
    const again = await worker.api("/api/team/code/redeem", { body: { code } });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("CODE_USED");
    const other = await createUser();
    const stolen = await other.api("/api/team/code/redeem", { body: { code } });
    expect(stolen.status).toBe(409);
    expect(stolen.body.error).toBe("CODE_USED");

    // Agisce come l'impresa.
    const quotes = await worker.api("/api/quotes");
    expect((quotes.body as { id: string }[]).map((q) => q.id)).toContain(quote.id);

    // Un codice scaduto non entra.
    await db.update(businessProfilesTable).set({ extraSeats: 1 }).where(eq(businessProfilesTable.userId, owner.userId));
    const expiring = await owner.api("/api/team/codes", { body: { role: "viewer" } });
    expect(expiring.status, JSON.stringify(expiring.body)).toBe(201);
    await db.update(organizationMembersTable).set({ inviteTokenExpiresAt: new Date(Date.now() - 1000) }).where(eq(organizationMembersTable.id, expiring.body.memberId));
    const late = await createUser();
    const expired = await late.api("/api/team/code/redeem", { body: { code: expiring.body.code } });
    expect(expired.status).toBe(410);
  });

  test("i posti extra alzano il tetto; un sospeso che torna riprende un posto", async () => {
    const owner = await createOrg({ plan: "monthly_pro" });
    await db.update(businessProfilesTable).set({ extraSeats: 2 }).where(eq(businessProfilesTable.userId, owner.userId));
    expect((await owner.api("/api/team/members")).body.seats).toMatchObject({ included: 2, extra: 2, limit: 4 });
    for (let i = 0; i < 3; i++) {
      const r = await owner.api("/api/team/members/invite", { body: { email: `x${i}-${owner.userId}@example.invalid`, role: "office", send: false } });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    }
    const full = await owner.api("/api/team/members/invite", { body: { email: `x9-${owner.userId}@example.invalid`, role: "office", send: false } });
    expect(full.status).toBe(403);
    expect(full.body.seatsLimit).toBe(4);
  });

  test("chi invia un preventivo lo firma; vale il primo invio; la classifica conta i vinti per chi ha inviato", async () => {
    const owner = await createOrg({ plan: "monthly_elite" });
    const made = await owner.api("/api/team/codes", { body: { role: "office", label: "Luisa" } });
    const worker = await createUser({ name: "Luisa Ufficio" });
    expect((await worker.api("/api/team/code/redeem", { body: { code: made.body.code } })).status).toBe(200);

    const q1 = await seedQuote(owner.userId, { status: "unlocked" });
    const q2 = await seedQuote(owner.userId, { status: "unlocked" });
    const sent = await worker.api(`/api/quotes/${q1.id}/send-pdf-email`, { body: { toEmail: "c1@example.invalid", clientName: "Cliente Uno" } });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect((await owner.api(`/api/quotes/${q2.id}/send-pdf-email`, { body: { toEmail: "c2@example.invalid", clientName: "Cliente Due" } })).status).toBe(200);
    // Il titolare rimanda il primo: la firma resta di Luisa.
    expect((await owner.api(`/api/quotes/${q1.id}/send-pdf-email`, { body: { toEmail: "c1@example.invalid", clientName: "Cliente Uno" } })).status).toBe(200);

    const [row1] = await db.select({ by: quotesTable.sentByUserId }).from(quotesTable).where(eq(quotesTable.id, q1.id));
    const [row2] = await db.select({ by: quotesTable.sentByUserId }).from(quotesTable).where(eq(quotesTable.id, q2.id));
    expect(row1!.by).toBe(worker.userId);
    expect(row2!.by).toBe(owner.userId);

    // Il cliente accetta il primo: vince Luisa.
    await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date() }).where(eq(quotesTable.id, q1.id));

    const board = await owner.api("/api/team/leaderboard?days=90");
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    const byId = new Map((board.body.items as { userId: string; quotesSent: number; quotesWon: number; winRate: number | null }[]).map((r) => [r.userId, r]));
    expect(byId.get(worker.userId)).toMatchObject({ quotesSent: 1, quotesWon: 1, winRate: 100 });
    expect(byId.get(owner.userId)).toMatchObject({ quotesSent: 1, quotesWon: 0, winRate: 0 });
    expect(board.body.items[0].userId).toBe(worker.userId); // più vinti in cima

    // Solo titolare e amministratori vedono la classifica.
    expect((await worker.api("/api/team/leaderboard")).status).toBe(403);
  });
});
