import { Router } from "express";
import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { db, memberPreferencesTable, quotesTable, invoicesTable, projectsTable, type MemberPrefs } from "@workspace/db";
import { ZONE, localDay } from "../assistant/companyRules.js";
import { numbersFor, periodWindow, type Period } from "../me/numbers.js";
import { localMidnight } from "../today/business.js";
import { requireAuth, getUserId, getActorUserId } from "../middlewares/authMiddleware.js";

// ── POCKET-5 (riga 62, QuoteAI 128.3 e 128.7): le scelte di una persona nell'app e i suoi numeri ──
// GET /api/me/preferences · PUT /api/me/preferences { voice?, speak?, confirmSend?, jobTitle?, mobile?, signature?, home? }
// Per impresa e persona, su ogni dispositivo. Di partenza: voce Aurora (ember), legge le risposte, chiede prima di inviare.
// Senza la migrazione 0026 la tabella non c'è: la lettura dà i valori di partenza, il salvataggio 503.

const router = Router();

const DEFAULTS: MemberPrefs = { voice: "ember", speak: true, confirmSend: true };

const Body = z.object({
  voice: z.enum(["ember", "tide", "stone"]).optional(),
  speak: z.boolean().optional(),
  confirmSend: z.boolean().optional(),
  jobTitle: z.string().trim().max(80).optional(),
  mobile: z.string().trim().max(40).optional(),
  signature: z.string().max(20_000).optional(),
  home: z.object({ order: z.array(z.string().max(30)).max(40).optional(), on: z.record(z.string().max(30), z.boolean()).optional(), tabs: z.array(z.string().max(20)).max(4).optional(), density: z.union([z.literal(0), z.literal(1)]).optional() }).strict().optional(),
}).strict();

export async function readPrefs(userId: string, memberUserId: string): Promise<MemberPrefs> {
  try {
    const [row] = await db.select({ prefs: memberPreferencesTable.prefs }).from(memberPreferencesTable).where(and(eq(memberPreferencesTable.userId, userId), eq(memberPreferencesTable.memberUserId, memberUserId)));
    return { ...DEFAULTS, ...(row?.prefs ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

router.get("/me/preferences", requireAuth, async (req, res) => {
  try {
    res.json({ preferences: await readPrefs(getUserId(res), getActorUserId(res)) });
  } catch (err) {
    req.log.error({ err }, "Error reading preferences");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/me/preferences", requireAuth, async (req, res) => {
  try {
    const body = Body.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const userId = getUserId(res), memberUserId = getActorUserId(res);
    const prefs = { ...(await readPrefs(userId, memberUserId)), ...body.data };
    await db.insert(memberPreferencesTable).values({ userId, memberUserId, prefs })
      .onConflictDoUpdate({ target: [memberPreferencesTable.userId, memberPreferencesTable.memberUserId], set: { prefs, updatedAt: new Date() } });
    res.json({ preferences: prefs });
  } catch (err) {
    req.log.error({ err }, "Error saving preferences");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/me/numbers?period=month|quarter|year — Profilo → «I miei numeri»: preventivi fatti e inviati, quanti degli inviati sono stati vinti,
// il fatturato e i cantieri; con il periodo prima per le frecce, e gli ultimi tre mesi uno per uno.
// PrevAI non registra chi ha creato un preventivo, una fattura o un cantiere: i numeri sono dell'impresa (`scope: "company"`), e l'app lo dice.
router.get("/me/numbers", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const period = (["month", "quarter", "year"] as const).includes(req.query.period as Period) ? (req.query.period as Period) : "month";
    const today = localDay(new Date(), ZONE);
    const at = (day: string) => localMidnight(day, ZONE);
    const win = (back: number, p: Period = period) => { const w = periodWindow(p, today, back); return { from: at(w.start), to: at(w.end) }; };
    const since = at(periodWindow("year", today, 1).start);
    const [qs, ivs, js] = await Promise.all([
      db.select({ createdAt: quotesTable.createdAt, sentAt: quotesTable.sentAt, acceptedAt: quotesTable.acceptedAt, status: quotesTable.status }).from(quotesTable).where(and(eq(quotesTable.userId, userId), gte(quotesTable.createdAt, new Date(since.getTime() - 120 * 86_400_000)))).limit(5000),
      db.select({ issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents, status: invoicesTable.status }).from(invoicesTable).where(and(eq(invoicesTable.userId, userId), gte(invoicesTable.issueDate, since))).limit(5000),
      db.select({ createdAt: projectsTable.createdAt, status: projectsTable.status }).from(projectsTable).where(eq(projectsTable.userId, userId)).limit(5000),
    ]);
    const quotes = qs.map((q) => ({ createdAt: q.createdAt, sentAt: q.sentAt, acceptedAt: q.acceptedAt, accepted: q.status === "accepted" || !!q.acceptedAt }));
    const months = [0, 1, 2].map((b) => { const w = win(b, "month"); const n = numbersFor(w, quotes, ivs, js); return { month: periodWindow("month", today, b).start.slice(0, 7), sent: n.sent, won: n.won, invoicedCents: n.invoicedCents }; });
    res.json({ period, scope: "company", now: numbersFor(win(0), quotes, ivs, js), before: numbersFor(win(1), quotes, ivs, js), months });
  } catch (err) {
    req.log.error({ err }, "Error reading the numbers");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
