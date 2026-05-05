import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, quotesTable } from "@workspace/db";
import { eq, desc, count, sum } from "drizzle-orm";
import {
  CreateQuoteBody,
  UpdateQuoteBody,
  GetQuoteParams,
  UpdateQuoteParams,
  DeleteQuoteParams,
  GenerateQuotePdfParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const AI_PROMPT = `Sei un consulente esperto di preventivi professionali per il mercato italiano (artigiani, edilizia, servizi tecnici).

Devi trasformare una descrizione libera in un preventivo realistico, coerente con prezzi di mercato in Italia nel 2026.

REGOLE FONDAMENTALI:
1. Usa prezzi realistici di mercato italiano:
   - imbianchino: 5–12€/mq
   - elettricista: 25–60€/ora
   - idraulico: 30–70€/ora
   - edilizia: prezzi coerenti con media professionale
2. Se mancano dati: fai assunzioni realistiche, NON chiedere chiarimenti
3. Il preventivo deve sembrare "da azienda vera"
4. Non inventare servizi assurdi o non plausibili
5. Sempre IVA standard 22% salvo indicazione diversa

OUTPUT (SOLO JSON VALIDO):
{
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "",
  "voci": [
    { "descrizione": "", "quantita": 0, "unita": "mq|ore|pezzi", "prezzo_unitario": 0, "totale": 0 }
  ],
  "subtotale": 0,
  "iva_percentuale": 22,
  "iva_valore": 0,
  "totale": 0,
  "note": "Preventivo valido 30 giorni"
}
IMPORTANTISSIMO: output SOLO JSON, niente testo extra, niente spiegazioni`;

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

function serializeQuote(q: (typeof quotesTable)["$inferSelect"]) {
  return {
    id: q.id,
    userId: q.userId,
    clientData: q.clientData,
    descrizioneGenerale: q.descrizioneGenerale,
    items: q.items,
    subtotale: Number(q.subtotale),
    ivaPercentuale: Number(q.ivaPercentuale),
    ivaValore: Number(q.ivaValore),
    totale: Number(q.totale),
    note: q.note,
    status: q.status,
    pdfUrl: q.pdfUrl ?? null,
    rawInput: q.rawInput,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

// GET /api/quotes/stats
router.get("/quotes/stats", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);

    const [allQuotes, statsResult] = await Promise.all([
      db
        .select()
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId))
        .orderBy(desc(quotesTable.createdAt))
        .limit(5),
      db
        .select({
          total: count(),
          totalRevenue: sum(quotesTable.totale),
        })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId)),
    ]);

    const statusCounts = { draft: 0, unlocked: 0, pending_payment: 0 };
    for (const q of allQuotes) {
      if (q.status in statusCounts) {
        statusCounts[q.status as keyof typeof statusCounts]++;
      }
    }

    const allForStats = await db
      .select({ status: quotesTable.status })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId));

    const allStatusCounts = { draft: 0, unlocked: 0, pending_payment: 0 };
    for (const q of allForStats) {
      if (q.status in allStatusCounts) {
        allStatusCounts[q.status as keyof typeof allStatusCounts]++;
      }
    }

    res.json({
      total: statsResult[0]?.total ?? 0,
      draft: allStatusCounts.draft,
      unlocked: allStatusCounts.unlocked,
      pendingPayment: allStatusCounts.pending_payment,
      totalRevenue: Number(statsResult[0]?.totalRevenue ?? 0),
      recentQuotes: allQuotes.map(serializeQuote),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/quotes
router.get("/quotes", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const quotes = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt));
    res.json(quotes.map(serializeQuote));
  } catch (err) {
    req.log.error({ err }, "Error fetching quotes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes
router.post("/quotes", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const parsed = CreateQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const { rawInput } = parsed.data;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "user", content: rawInput },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: {
      cliente?: { nome?: string; indirizzo?: string };
      descrizione_generale?: string;
      voci?: Array<{
        descrizione?: string;
        quantita?: number;
        unita?: string;
        prezzo_unitario?: number;
        totale?: number;
      }>;
      subtotale?: number;
      iva_percentuale?: number;
      iva_valore?: number;
      totale?: number;
      note?: string;
    };

    try {
      // Strip markdown code fences if present (e.g. ```json ... ```)
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      aiData = JSON.parse(cleaned);
    } catch {
      req.log.error({ content }, "Failed to parse AI JSON");
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    const items = (aiData.voci ?? []).map((v) => ({
      descrizione: v.descrizione ?? "",
      quantita: Number(v.quantita ?? 0),
      unita: v.unita ?? "pezzi",
      prezzoUnitario: Number(v.prezzo_unitario ?? 0),
      totale: Number(v.totale ?? 0),
    }));

    const subtotale = Number(aiData.subtotale ?? 0);
    const ivaPercentuale = Number(aiData.iva_percentuale ?? 22);
    const ivaValore = Number(aiData.iva_valore ?? 0);
    const totale = Number(aiData.totale ?? 0);

    const [quote] = await db
      .insert(quotesTable)
      .values({
        userId,
        rawInput,
        clientData: {
          nome: aiData.cliente?.nome ?? "",
          indirizzo: aiData.cliente?.indirizzo ?? "",
        },
        descrizioneGenerale: aiData.descrizione_generale ?? "",
        items,
        subtotale: subtotale.toFixed(2),
        ivaPercentuale: ivaPercentuale.toFixed(2),
        ivaValore: ivaValore.toFixed(2),
        totale: totale.toFixed(2),
        note: aiData.note ?? "Preventivo valido 30 giorni",
        status: "draft",
      })
      .returning();

    res.status(201).json(serializeQuote(quote!));
  } catch (err) {
    req.log.error({ err }, "Error creating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/quotes/:id
router.get("/quotes/:id", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = GetQuoteParams.parse(req.params);

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json(serializeQuote(quote));
  } catch (err) {
    req.log.error({ err }, "Error fetching quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/quotes/:id
router.put("/quotes/:id", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = UpdateQuoteParams.parse(req.params);
    const parsed = UpdateQuoteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error });
      return;
    }

    const [existing] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const updates: Partial<typeof existing> = {};
    const body = parsed.data;

    if (body.clientData !== undefined) updates.clientData = body.clientData;
    if (body.descrizioneGenerale !== undefined) updates.descrizioneGenerale = body.descrizioneGenerale;
    if (body.items !== undefined) updates.items = body.items;
    if (body.note !== undefined) updates.note = body.note;
    if (body.status !== undefined) updates.status = body.status;
    if (body.subtotale !== undefined) updates.subtotale = String(body.subtotale);
    if (body.ivaPercentuale !== undefined) updates.ivaPercentuale = String(body.ivaPercentuale);
    if (body.ivaValore !== undefined) updates.ivaValore = String(body.ivaValore);
    if (body.totale !== undefined) updates.totale = String(body.totale);

    const [updated] = await db
      .update(quotesTable)
      .set(updates)
      .where(eq(quotesTable.id, id))
      .returning();

    res.json(serializeQuote(updated!));
  } catch (err) {
    req.log.error({ err }, "Error updating quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/quotes/:id
router.delete("/quotes/:id", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = DeleteQuoteParams.parse(req.params);

    const [existing] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(quotesTable).where(eq(quotesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/quotes/:id/generate-pdf
router.post("/quotes/:id/generate-pdf", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = GenerateQuotePdfParams.parse(req.params);

    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, id));

    if (!quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (quote.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (quote.status !== "unlocked") {
      res.status(403).json({ error: "PDF generation requires unlocked status. Please purchase a plan." });
      return;
    }

    const html = generateQuoteHtml(quote, false);
    res.json({ htmlContent: html, pdfUrl: quote.pdfUrl });
  } catch (err) {
    req.log.error({ err }, "Error generating PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

function generateQuoteHtml(
  quote: (typeof quotesTable)["$inferSelect"],
  withWatermark: boolean
): string {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const clientData = quote.clientData ?? { nome: "", indirizzo: "" };

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td>${item.descrizione}</td>
        <td style="text-align:center">${item.quantita} ${item.unita}</td>
        <td style="text-align:right">€${Number(item.prezzoUnitario).toFixed(2)}</td>
        <td style="text-align:right">€${Number(item.totale).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 40px; font-size: 14px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company-info h2 { margin: 0 0 8px; font-size: 20px; color: #1a1a2e; }
    .company-info p { margin: 2px 0; color: #666; font-size: 12px; }
    .quote-title { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    .quote-meta { color: #888; font-size: 12px; }
    .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
    .client-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 32px; }
    .client-box h3 { margin: 0 0 4px; font-size: 15px; }
    .client-box p { margin: 0; color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #1a1a2e; color: white; }
    thead th { padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody tr:nth-child(even) { background: #f8f9fa; }
    tbody td { padding: 12px 16px; border-bottom: 1px solid #eee; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-box { min-width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .totals-row.grand-total { font-size: 18px; font-weight: 700; color: #1a1a2e; border-bottom: none; padding-top: 12px; }
    .notes { margin-top: 32px; padding: 16px; background: #fffbf0; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #666; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(200,200,200,0.3); font-weight: 900; pointer-events: none; z-index: 9999; white-space: nowrap; }
  </style>
</head>
<body>
  ${withWatermark ? '<div class="watermark">ANTEPRIMA</div>' : ""}
  <div class="header">
    <div class="company-info">
      <h2>Preventivo Professionale</h2>
      <p>Data: ${new Date().toLocaleDateString("it-IT")}</p>
      <p>N. Preventivo: ${quote.id.slice(0, 8).toUpperCase()}</p>
    </div>
    <div style="text-align:right">
      <div class="quote-title">PREVENTIVO</div>
      <div class="quote-meta">Valido 30 giorni dalla data di emissione</div>
    </div>
  </div>

  <div class="section-label">Cliente</div>
  <div class="client-box">
    <h3>${clientData.nome || "Cliente"}</h3>
    <p>${clientData.indirizzo || ""}</p>
  </div>

  <div class="section-label">Descrizione Lavori</div>
  <p style="margin-bottom:24px;color:#444">${quote.descrizioneGenerale}</p>

  <table>
    <thead>
      <tr>
        <th>Descrizione</th>
        <th style="text-align:center">Quantità</th>
        <th style="text-align:right">Prezzo Unit.</th>
        <th style="text-align:right">Totale</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row">
        <span>Subtotale</span>
        <span>€${Number(quote.subtotale).toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>IVA (${Number(quote.ivaPercentuale).toFixed(0)}%)</span>
        <span>€${Number(quote.ivaValore).toFixed(2)}</span>
      </div>
      <div class="totals-row grand-total">
        <span>TOTALE</span>
        <span>€${Number(quote.totale).toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="notes">${quote.note}</div>
</body>
</html>`;
}

export { generateQuoteHtml };
export default router;
