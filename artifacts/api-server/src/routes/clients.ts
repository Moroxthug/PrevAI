import { Router } from "express";
import { z } from "zod";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/requirePermission.js";
import { db, quotesTable, clientsTable, businessProfilesTable, clientDedupKey, normalizeProvince } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { loadDetail, loadOverview } from "../clients/overview.js";

const router = Router();

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);

    const rows = await db
      .select({
        id: sql<string>`md5(concat_ws('|',
          lower(trim(${quotesTable.clientData}->>'nome')),
          coalesce(lower(trim(${quotesTable.clientData}->>'email')), ''),
          coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')
        ))`,
        clientName: sql<string>`max(${quotesTable.clientData}->>'nome')`,
        email: sql<string | null>`max(${quotesTable.clientData}->>'email')`,
        phone: sql<string | null>`max(${quotesTable.clientData}->>'phone')`,
        quoteCount: sql<number>`count(*)::int`,
        unlockedCount: sql<number>`count(*) filter (where ${quotesTable.status} = 'unlocked')::int`,
        totalValue: sql<number>`sum(${quotesTable.totale}::numeric)::float`,
        unlockedValue: sql<number>`sum(${quotesTable.totale}::numeric) filter (where ${quotesTable.status} = 'unlocked')::float`,
        lastQuoteDate: sql<string>`max(${quotesTable.createdAt})`,
        indirizzo: sql<string | null>`max(${quotesTable.clientData}->>'indirizzo')`,
        city: sql<string | null>`max(${quotesTable.clientData}->>'city')`,
        province: sql<string | null>`max(${quotesTable.clientData}->>'province')`,
        postalCode: sql<string | null>`max(${quotesTable.clientData}->>'postalCode')`,
        partitaIva: sql<string | null>`max(${quotesTable.clientData}->>'partitaIva')`,
        businessNumber: sql<string | null>`max(${quotesTable.clientData}->>'businessNumber')`,
      })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          sql`trim(${quotesTable.clientData}->>'nome') != ''`
        )
      )
      .groupBy(
        sql`lower(trim(${quotesTable.clientData}->>'nome'))`,
        sql`coalesce(lower(trim(${quotesTable.clientData}->>'email')), '')`,
        sql`coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')`
      )
      .orderBy(desc(sql`max(${quotesTable.createdAt})`));

    res.json(
      rows.map((r) => ({
        id: r.id,
        clientName: r.clientName,
        email: r.email || null,
        phone: r.phone || null,
        quoteCount: r.quoteCount,
        unlockedCount: r.unlockedCount ?? 0,
        totalValue: r.totalValue ?? 0,
        unlockedValue: r.unlockedValue ?? 0,
        lastQuoteDate: r.lastQuoteDate,
        indirizzo: r.indirizzo || null,
        city: r.city || null,
        province: r.province || null,
        postalCode: r.postalCode || null,
        partitaIva: r.partitaIva || null,
        businessNumber: r.businessNumber || null,
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error listing clients");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POCKET-2 (QuoteAI Phase 125): la scheda Clienti e la schermata Cliente dell'app ─────────────
// GET /api/clients/overview: ogni cliente con quanto ha comprato, quanto deve e l'ultima cosa successa, più i
// totali della striscia. GET /api/clients/:id/overview: un cliente con preventivi, documenti e cantieri.
// POST /api/clients: aggiunge un cliente senza preventivo. PUT /api/clients/:id/details: modifica la scheda.
// Usano le vere righe di `clients` (clients.id), non gli id md5 dell'elenco storico qui sotto.
const profileOf = async (userId: string) => (await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)))[0];

router.get("/clients/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    res.json(await loadOverview(userId, getActorRole(res), await profileOf(userId)));
  } catch (err) {
    logger.error({ err }, "Error loading the clients overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).json({ error: "Not found" }); return; }
    const detail = await loadDetail(userId, getActorRole(res), await profileOf(userId), id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    res.json(detail);
  } catch (err) {
    logger.error({ err }, "Error loading a client");
    res.status(500).json({ error: "Internal server error" });
  }
});

const clientDetailsBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  province: z.string().trim().max(40).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  businessNumber: z.string().trim().max(20).nullable().optional(),
  codiceFiscale: z.string().trim().max(20).nullable().optional(),
  notes: z.string().max(5000).optional(),
  type: z.enum(["individual", "business"]).optional(),
});

// POST /api/clients: un cliente senza preventivo (l'«Aggiungi cliente» dell'app). La stessa persona (nome, email e
// telefono come chiave) non si aggiunge due volte: torna la scheda esistente con 200.
router.post("/clients", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = clientDetailsBody.safeParse(req.body ?? {});
    if (!body.success || !body.data.name) { res.status(400).json({ error: "Invalid parameters", message: "Un cliente ha bisogno di un nome." }); return; }
    const d = body.data;
    if (d.email && !d.email.includes("@")) { res.status(400).json({ error: "Invalid parameters", message: "Quell'indirizzo email non sembra giusto." }); return; }
    const dedupKey = clientDedupKey({ name: d.name, email: d.email, phone: d.phone });
    const [created] = await db.insert(clientsTable).values({
      userId, name: d.name!, email: d.email || null, phone: d.phone || null, address: d.address || null, city: d.city || null,
      province: d.province ? normalizeProvince(d.province) ?? d.province.toUpperCase().slice(0, 2) : null, postalCode: d.postalCode || null,
      businessNumber: d.businessNumber || null, codiceFiscale: d.codiceFiscale || null,
      notes: d.notes ?? "", type: d.type ?? "individual", dedupKey,
    }).onConflictDoNothing().returning({ id: clientsTable.id });
    const id = created?.id ?? (await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey))))[0]?.id;
    if (!id) { res.status(500).json({ error: "Internal server error" }); return; }
    const detail = await loadDetail(userId, getActorRole(res), await profileOf(userId), id);
    res.status(created ? 201 : 200).json(detail);
  } catch (err) {
    logger.error({ err }, "Error adding a client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id/details", requireAuth, requirePermission("quotes", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const id = String(req.params.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).json({ error: "Not found" }); return; }
    const body = clientDetailsBody.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    if (d.email && !d.email.includes("@")) { res.status(400).json({ error: "Invalid parameters", message: "Quell'indirizzo email non sembra giusto." }); return; }
    const set: Partial<typeof clientsTable.$inferInsert> = {};
    if (d.name !== undefined) set.name = d.name;
    if (d.email !== undefined) set.email = d.email || null;
    if (d.phone !== undefined) set.phone = d.phone || null;
    if (d.address !== undefined) set.address = d.address || null;
    if (d.city !== undefined) set.city = d.city || null;
    if (d.province !== undefined) set.province = d.province ? normalizeProvince(d.province) ?? d.province.toUpperCase().slice(0, 2) : null;
    if (d.postalCode !== undefined) set.postalCode = d.postalCode || null;
    if (d.businessNumber !== undefined) set.businessNumber = d.businessNumber || null;
    if (d.codiceFiscale !== undefined) set.codiceFiscale = d.codiceFiscale || null;
    if (d.notes !== undefined) set.notes = d.notes;
    if (d.type !== undefined) set.type = d.type;
    // La chiave di dedup resta com'è di proposito: il portale del cliente lo indirizza con md5(dedup_key).
    const [updated] = Object.keys(set).length
      ? await db.update(clientsTable).set(set).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId))).returning({ id: clientsTable.id })
      : await db.select({ id: clientsTable.id }).from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.userId, userId)));
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const detail = await loadDetail(userId, getActorRole(res), await profileOf(userId), id);
    res.json(detail);
  } catch (err) {
    logger.error({ err }, "Error editing a client");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id/quotes", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const clientId = req.params.id;

    const quotes = await db
      .select()
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          sql`md5(concat_ws('|',
            lower(trim(${quotesTable.clientData}->>'nome')),
            coalesce(lower(trim(${quotesTable.clientData}->>'email')), ''),
            coalesce(lower(trim(${quotesTable.clientData}->>'phone')), '')
          )) = ${clientId}`
        )
      )
      .orderBy(desc(quotesTable.createdAt));

    res.json(
      quotes.map((q) => ({
        id: q.id,
        userId: q.userId,
        clientData: q.clientData,
        descrizioneGenerale: q.descrizioneGenerale,
        items: q.items,
        capitoli: q.capitoli ?? [],
        sconto: q.sconto ?? null,
        condizioniPagamento: q.condizioniPagamento ?? [],
        titoloPreventivoRiga1: q.titoloPreventivoRiga1 ?? null,
        titoloPreventivoRiga2: q.titoloPreventivoRiga2 ?? null,
        numeroPreventivoData: q.numeroPreventivoData ?? null,
        companySnapshot: q.companySnapshot ?? null,
        subtotale: Number(q.subtotale),
        ivaPercentuale: Number(q.ivaPercentuale),
        ivaValore: Number(q.ivaValore),
        totale: Number(q.totale),
        note: q.note,
        status: q.status,
        pdfUrl: q.pdfUrl ?? null,
        rawInput: q.rawInput,
        pdfDownloadedAt: q.pdfDownloadedAt?.toISOString() ?? null,
        capitolatoPro: q.capitolatoPro,
        capitolatoPdfUrl: q.capitolatoPdfUrl ?? null,
        templateId: q.templateId ?? null,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error listing client quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
