import { Router, type Response } from "express";
import { z } from "zod";
import { and, asc, eq, gte, lt, ne, notInArray } from "drizzle-orm";
import {
  accountantCommentsTable,
  authUsersTable,
  bankImportsTable,
  bankMovementsTable,
  businessProfilesTable,
  costEntriesTable,
  db,
  invoicePaymentsTable,
  invoicesTable,
  monthClosesTable,
} from "@workspace/db";
import { requireAuth, getUserId, getUserName, getActorRole, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { createNotification } from "../lib/notifications.js";
import { estremiMese, isMese, oggiItalia } from "../primanota/mese.js";
import { moduloOForbidden } from "./primanota.js";

// ── POCKET-4 (riga 61, QuoteAI 127.3): la vista del contabile ────────────────
// Il «Contabile» (ruolo `bookkeeper`) è un membro dell'impresa che legge i conti. Qui c'è ciò che la schermata mostra di un mese
// (a che punto è ciascuna parte), i due file che non hanno un'altra rotta in sola lettura e il filo dei commenti. Le scadenze
// vengono da /fiscale/calendario, che già risponde a chi legge. Stesso gate di prima nota e chiusura (PrevAI Fisco).

const router = Router();

const shiftMonth = (month: string, by: number): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

const FUSO = "Europe/Rome";
const giornoItalia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

const cella = (v: string | number) => {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const euro = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const data = (g: string) => g.split("-").reverse().join("/");

/** Le uscite che sono acquisti (ore, mezzi e rimborsi non sono scontrini). */
const NON_ACQUISTI = ["time_entry", "equipment"] as const;
/** Una spesa di questa cifra o più vuole il suo documento allegato. */
const DOCUMENTO_DA_CENTS = 3000;

router.get("/accountant/overview", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const oggi = oggiItalia();
  const questoMese = oggi.slice(0, 7);
  const q = z.object({ month: z.string().refine(isMese).optional() }).safeParse(req.query);
  const month = q.success && q.data.month && q.data.month <= questoMese ? q.data.month : shiftMonth(questoMese, -1);
  const { primo, ultimo, da, a } = estremiMese(month);
  const nelMese = (d: Date) => {
    const g = giornoItalia(d);
    return g >= primo && g <= ultimo;
  };

  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  const [owner] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, userId));
  const chiusure = await db.select().from(monthClosesTable).where(eq(monthClosesTable.userId, userId));
  const months = [-3, -2, -1, 0].map((d) => shiftMonth(questoMese, d)).map((m) => {
    const c = chiusure.find((x) => x.month === m);
    return { month: m, closed: c ? { at: c.closedAt.toISOString(), by: c.closedByName } : null };
  });

  // Estratto conto (solo se ne è stato importato uno).
  const [import1] = await db.select({ id: bankImportsTable.id }).from(bankImportsTable).where(eq(bankImportsTable.userId, userId)).limit(1);
  let bank: { total: number; matched: number } | null = null;
  if (import1) {
    const righe = (await db.select({ data: bankMovementsTable.data, stato: bankMovementsTable.stato }).from(bankMovementsTable).where(and(eq(bankMovementsTable.userId, userId), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a)))).filter((r) => nelMese(r.data));
    bank = { total: righe.length, matched: righe.filter((r) => r.stato !== "da_abbinare").length };
  }

  // Documenti: acquisti da 30 € in su e quanti hanno il documento allegato.
  const costi = (
    await db
      .select({ data: costEntriesTable.date, totalCents: costEntriesTable.totalCents, sourceDocumentId: costEntriesTable.sourceDocumentId })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), notInArray(costEntriesTable.source, [...NON_ACQUISTI]), gte(costEntriesTable.date, da), lt(costEntriesTable.date, a)))
  ).filter((c) => nelMese(c.data) && c.totalCents >= DOCUMENTO_DA_CENTS);
  const receipts = { total: costi.length, attached: costi.filter((c) => !!c.sourceDocumentId).length };

  // Fatture e pro-forma del mese: quante emesse (non in bozza) e per quanto.
  const doc = (
    await db
      .select({ status: invoicesTable.status, issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), ne(invoicesTable.status, "void"), gte(invoicesTable.issueDate, da), lt(invoicesTable.issueDate, a)))
  ).filter((i) => nelMese(i.issueDate));
  const emesse = doc.filter((i) => i.status !== "draft");
  const invoices = { total: doc.length, issued: emesse.length, issuedCents: emesse.reduce((s, i) => s + i.totalCents, 0) };

  res.json({
    enabled: true,
    today: oggi,
    company: { name: profile?.companyName ?? "", ownerName: owner?.name ?? "" },
    you: { name: getUserName(res), role: getActorRole(res) },
    fiscalYearEnd: null,
    province: null,
    month,
    months,
    bank,
    receipts,
    invoices,
    // Le ore non sono una busta paga: il consulente del lavoro riceve il file dal titolare (Ore e costo del lavoro).
    payroll: null,
  });
});

router.get("/accountant/export.csv", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const q = z.object({ kind: z.enum(["transactions", "invoices"]), month: z.string().refine(isMese) }).safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "INVALID", message: "Parametri non validi" });
    return;
  }
  const { month, kind } = q.data;
  const { primo, ultimo, da, a } = estremiMese(month);
  const nelMese = (d: Date) => {
    const g = giornoItalia(d);
    return g >= primo && g <= ultimo;
  };
  let csv: string;
  let nome: string;
  if (kind === "invoices") {
    const righe = (
      await db
        .select({ number: invoicesTable.number, issueDate: invoicesTable.issueDate, customer: invoicesTable.customer, totalCents: invoicesTable.totalCents, status: invoicesTable.status, paidCents: invoicesTable.paidCents, fiscale: invoicesTable.fiscale })
        .from(invoicesTable)
        .where(and(eq(invoicesTable.userId, userId), ne(invoicesTable.status, "draft"), ne(invoicesTable.status, "void"), gte(invoicesTable.issueDate, da), lt(invoicesTable.issueDate, a)))
    )
      .filter((i) => nelMese(i.issueDate))
      .sort((x, y) => x.issueDate.getTime() - y.issueDate.getTime());
    const head = ["Numero", "Data", "Tipo", "Cliente", "Totale", "Incassato", "Stato"].map(cella).join(";");
    csv = [head, ...righe.map((i) => [i.number, data(giornoItalia(i.issueDate)), i.fiscale ? "Fattura" : "Pro-forma", i.customer?.name ?? "", euro(i.totalCents), euro(i.paidCents), i.status].map(cella).join(";"))].join("\r\n");
    nome = `fatture-${month}`;
  } else {
    const righe: { day: string; fonte: string; descrizione: string; cents: number; stato: string }[] = [];
    // Un costo o un incasso abbinato a un movimento è già quel movimento: elencarli entrambi li conterebbe due volte.
    const inBanca = { costo: new Set<string>(), incasso: new Set<string>() };
    const mov = await db.select().from(bankMovementsTable).where(and(eq(bankMovementsTable.userId, userId), gte(bankMovementsTable.data, da), lt(bankMovementsTable.data, a)));
    for (const m of mov) {
      if (m.stato === "abbinato" && m.abbinamentoId && m.abbinamentoTipo === "costo") inBanca.costo.add(m.abbinamentoId);
      if (m.stato === "abbinato" && m.abbinamentoId && m.abbinamentoTipo === "incasso") inBanca.incasso.add(m.abbinamentoId);
      if (nelMese(m.data)) righe.push({ day: giornoItalia(m.data), fonte: "Banca", descrizione: [m.controparte, m.descrizione].filter(Boolean).join(" · "), cents: m.importoCents, stato: m.stato });
    }
    const costi = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), notInArray(costEntriesTable.source, [...NON_ACQUISTI]), gte(costEntriesTable.date, da), lt(costEntriesTable.date, a)));
    for (const c of costi) if (nelMese(c.date) && !inBanca.costo.has(c.id)) righe.push({ day: giornoItalia(c.date), fonte: "Costo", descrizione: [c.vendor, c.description].filter(Boolean).join(" · "), cents: -c.totalCents, stato: c.status + (c.sourceDocumentId ? ", documento" : "") });
    const inc = await db
      .select({ id: invoicePaymentsTable.id, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, reference: invoicePaymentsTable.reference, number: invoicesTable.number })
      .from(invoicePaymentsTable)
      .innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId))
      .where(and(eq(invoicePaymentsTable.userId, userId), gte(invoicePaymentsTable.date, da), lt(invoicePaymentsTable.date, a)));
    for (const p of inc) if (nelMese(p.date) && !inBanca.incasso.has(p.id)) righe.push({ day: giornoItalia(p.date), fonte: "Incasso", descrizione: `${p.number} · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`, cents: p.amountCents, stato: "registrato" });
    righe.sort((x, y) => (x.day === y.day ? x.fonte.localeCompare(y.fonte) : x.day < y.day ? -1 : 1));
    csv = [["Data", "Fonte", "Descrizione", "Importo", "Stato"].map(cella).join(";"), ...righe.map((r) => [data(r.day), r.fonte, r.descrizione, euro(r.cents), r.stato].map(cella).join(";"))].join("\r\n");
    nome = `movimenti-${month}`;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nome}.csv"`);
  res.send(String.fromCharCode(0xfeff) + csv + "\r\n");
});

// ── Commenti ─────────────────────────────────────────────────────────────────

const serializza = (c: typeof accountantCommentsTable.$inferSelect, actorId: string) => ({
  id: c.id, month: c.month, authorName: c.authorName, authorRole: c.authorRole, body: c.body, at: c.createdAt.toISOString(), mine: c.authorUserId === actorId,
});

/** Scrivono il contabile e chi tiene la parte fiscale; gli altri, se vedono, leggono soltanto. */
function puoScrivere(res: Response): boolean {
  const role = getActorRole(res);
  return role === "bookkeeper" || roleCan(role, "fiscale", "full");
}

router.get("/accountant/comments", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  const q = z.object({ month: z.string().refine(isMese) }).safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: "INVALID", message: "Parametri non validi" });
    return;
  }
  const rows = await db.select().from(accountantCommentsTable).where(and(eq(accountantCommentsTable.userId, userId), eq(accountantCommentsTable.month, q.data.month))).orderBy(asc(accountantCommentsTable.createdAt)).limit(200);
  res.json({ items: rows.map((r) => serializza(r, getActorUserId(res))), canWrite: puoScrivere(res) });
});

router.post("/accountant/comments", requireAuth, requirePermission("fiscale", "view"), async (req, res) => {
  const userId = getUserId(res);
  if (!(await moduloOForbidden(userId, res))) return;
  if (!puoScrivere(res)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Il tuo ruolo può leggere questo filo ma non scriverci." });
    return;
  }
  const body = z.object({ month: z.string().refine(isMese), body: z.string().trim().min(1).max(2000) }).safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: "INVALID", message: "Parametri non validi" });
    return;
  }
  const actorId = getActorUserId(res);
  const role = getActorRole(res);
  const [row] = await db.insert(accountantCommentsTable).values({ userId, month: body.data.month, authorUserId: actorId, authorName: getUserName(res), authorRole: role, body: body.data.body }).returning();
  // L'impresa viene a sapere del commento del contabile (il campanello).
  if (role === "bookkeeper" && actorId !== userId) {
    await createNotification({ userId, type: "accountant_comment", title: `${getUserName(res) || "Il tuo contabile"} ha commentato ${body.data.month}`, body: body.data.body.slice(0, 200), link: "/dashboard/fisco", entityType: "accountant_comment", entityId: row!.id, push: false });
  }
  res.status(201).json({ comment: serializza(row!, actorId) });
});

export default router;
