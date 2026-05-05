import { Router } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import type { Request } from "express";
import { db, quotesTable, businessProfilesTable } from "@workspace/db";
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
import type { QuoteChapter, QuoteDiscount } from "@workspace/db";
import { logger } from "../lib/logger.js";

const router = Router();

const AI_PROMPT = `Sei un consulente esperto di preventivi professionali per il mercato italiano (artigiani, edilizia, impianti, servizi tecnici).

Devi trasformare una descrizione libera in un'ANALISI ECONOMICA E COMPUTO METRICO PREZZATO professionale, strutturata a capitoli, coerente con i prezzi di mercato in Italia nel 2026.

REGOLE FONDAMENTALI:
1. Prezzi realistici di mercato italiano 2026:
   - imbianchino/pittore: 5–12€/mq per tinteggiatura, 15–25€/mq per lavori speciali
   - elettricista: 40–70€/ora manodopera, prezzi materiali a mercato
   - idraulico: 45–75€/ora manodopera
   - edilizia generale: prezzi coerenti con listino DEI/Regione
   - muratore: 35–55€/ora
   - carpentiere/falegname: 40–65€/ora
2. Se mancano dati specifici: fai assunzioni realistiche, NON chiedere chiarimenti
3. Organizza il lavoro in CAPITOLI logici (A, B, C, D, …) con titoli professionali (es: "Allestimento cantiere", "Opere di demolizione", "Nuove opere edili", "Impianto elettrico", ecc.)
4. Ogni capitolo contiene VOCI di lavoro dettagliate con unità di misura professionali (mq, ml, mc, kg, ore, a.c., pezzi, cadauno, kw, etc.)
5. Calcola subtotale per ogni capitolo
6. Suggerisci uno sconto se appropriato (tipicamente 0–10%); usa 0 se non giustificato
7. Condizioni di pagamento tipiche edilizia: 30% acconto firma, 30% SAL intermedio, 30% SAL finale, 10% saldo fine lavori
8. Sempre IVA 22% salvo indicazione contraria
9. Il titolo_riga2 deve descrivere l'intervento e il luogo del cantiere
10. numero_preventivo_data: usa il formato "N° X.2026 del GG/MM/AAAA" con data odierna

OUTPUT — SOLO JSON VALIDO, nessun testo extra:
{
  "titolo_riga1": "Analisi Economica e Computo Metrico Prezzato",
  "titolo_riga2": "Intervento di [descrizione breve] – [Comune] ([Prov])",
  "numero_preventivo_data": "N° 1.2026 del GG/MM/AAAA",
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "Descrizione sintetica dell'intervento",
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "Allestimento cantiere",
      "osservazione": "Voce ordinaria",
      "voci": [
        {
          "descrizione": "Allestimento area di cantiere completo",
          "um": "a.c.",
          "quantita": 1,
          "prezzo_unitario": 2500.00,
          "totale": 2500.00
        }
      ],
      "subtotale": 2500.00
    }
  ],
  "sconto": { "percentuale": 5, "importo_scontato": 0 },
  "condizioni_pagamento": [
    "30% acconto alla firma del contratto",
    "30% a completamento prima fase lavori",
    "30% a completamento seconda fase lavori",
    "10% saldo a fine lavori"
  ],
  "subtotale": 0,
  "iva_percentuale": 22,
  "iva_valore": 0,
  "totale": 0,
  "note": "Preventivo valido 30 giorni dalla data di emissione. Eventuali lavori aggiuntivi non contemplati nel presente preventivo saranno preventivati separatamente."
}

CALCOLI:
- subtotale = somma di tutti i subtotali capitoli
- Se sconto > 0: imponibile_scontato = subtotale * (1 - percentuale/100); iva_valore = imponibile_scontato * iva_percentuale/100; totale = imponibile_scontato + iva_valore
- Se sconto = 0: iva_valore = subtotale * iva_percentuale/100; totale = subtotale + iva_valore
- sconto.importo_scontato = subtotale dopo applicazione sconto (prima di IVA)

IMPORTANTISSIMO: output SOLO JSON puro, nessuna spiegazione, nessun markdown.`;

function getUserId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

type QuoteRow = typeof quotesTable.$inferSelect;

function serializeQuote(q: QuoteRow) {
  return {
    id: q.id,
    userId: q.userId,
    clientData: q.clientData,
    descrizioneGenerale: q.descrizioneGenerale,
    items: Array.isArray(q.items) ? q.items : [],
    capitoli: Array.isArray(q.capitoli) ? q.capitoli : [],
    sconto: (q.sconto as QuoteDiscount | null) ?? null,
    condizioniPagamento: Array.isArray(q.condizioniPagamento) ? q.condizioniPagamento : [],
    titoloPreventivoRiga1: q.titoloPreventivoRiga1 ?? null,
    titoloPreventivoRiga2: q.titoloPreventivoRiga2 ?? null,
    numeroPreventivoData: q.numeroPreventivoData ?? null,
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

    const [recentQuotes, statsResult, allForStats] = await Promise.all([
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
      db
        .select({ status: quotesTable.status })
        .from(quotesTable)
        .where(eq(quotesTable.userId, userId)),
    ]);

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
      recentQuotes: recentQuotes.map(serializeQuote),
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
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "user", content: rawInput },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: {
      titolo_riga1?: string;
      titolo_riga2?: string;
      numero_preventivo_data?: string;
      cliente?: { nome?: string; indirizzo?: string };
      descrizione_generale?: string;
      capitoli?: Array<{
        lettera?: string;
        titolo?: string;
        osservazione?: string;
        voci?: Array<{
          descrizione?: string;
          um?: string;
          quantita?: number;
          prezzo_unitario?: number;
          totale?: number;
        }>;
        subtotale?: number;
      }>;
      sconto?: { percentuale?: number; importo_scontato?: number } | null;
      condizioni_pagamento?: string[];
      subtotale?: number;
      iva_percentuale?: number;
      iva_valore?: number;
      totale?: number;
      note?: string;
    };

    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      aiData = JSON.parse(cleaned);
    } catch {
      req.log.error({ content }, "Failed to parse AI JSON");
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    const capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap) => ({
      lettera: cap.lettera ?? "A",
      titolo: cap.titolo ?? "",
      osservazione: cap.osservazione ?? "Voce ordinaria",
      voci: (cap.voci ?? []).map((v) => ({
        descrizione: v.descrizione ?? "",
        um: v.um ?? "a.c.",
        quantita: Number(v.quantita ?? 0),
        prezzoUnitario: Number(v.prezzo_unitario ?? 0),
        totale: Number(v.totale ?? 0),
      })),
      subtotale: Number(cap.subtotale ?? 0),
    }));

    const scontoRaw = aiData.sconto;
    const sconto: QuoteDiscount | null =
      scontoRaw && Number(scontoRaw.percentuale ?? 0) > 0
        ? {
            percentuale: Number(scontoRaw.percentuale ?? 0),
            importoScontato: Number(scontoRaw.importo_scontato ?? 0),
          }
        : null;

    const condizioniPagamento = aiData.condizioni_pagamento ?? [
      "30% acconto alla firma del contratto",
      "30% a completamento prima fase lavori",
      "30% a completamento seconda fase lavori",
      "10% saldo a fine lavori",
    ];

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
        items: [],
        capitoli,
        sconto,
        condizioniPagamento,
        titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Analisi Economica e Computo Metrico Prezzato",
        titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
        numeroPreventivoData: aiData.numero_preventivo_data ?? "",
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
    if (body.capitoli !== undefined) updates.capitoli = body.capitoli as QuoteChapter[];
    if (body.sconto !== undefined) updates.sconto = body.sconto as QuoteDiscount | null;
    if (body.condizioniPagamento !== undefined) updates.condizioniPagamento = body.condizioniPagamento;
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

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, userId));

    const html = generateQuoteHtml(quote, false, profile ?? null);
    res.json({ htmlContent: html, pdfUrl: quote.pdfUrl });
  } catch (err) {
    req.log.error({ err }, "Error generating PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

type ProfileRow = typeof businessProfilesTable.$inferSelect | null;

function formatEur(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function generateQuoteHtml(
  quote: QuoteRow,
  withWatermark: boolean,
  profile: ProfileRow
): string {
  const clientData = quote.clientData ?? { nome: "", indirizzo: "" };
  const capitoli: QuoteChapter[] = Array.isArray(quote.capitoli) && quote.capitoli.length > 0
    ? quote.capitoli as QuoteChapter[]
    : [];
  const legacyItems = Array.isArray(quote.items) ? quote.items : [];
  const hasCapitoli = capitoli.length > 0;
  const sconto = quote.sconto as QuoteDiscount | null;
  const condizioniPagamento: string[] = Array.isArray(quote.condizioniPagamento)
    ? quote.condizioniPagamento
    : [];

  const titolo1 = quote.titoloPreventivoRiga1 || "Analisi Economica e Computo Metrico Prezzato";
  const titolo2 = quote.titoloPreventivoRiga2 || "";
  const numeroData = quote.numeroPreventivoData || `N° ${quote.id.slice(0, 4).toUpperCase()} del ${new Date().toLocaleDateString("it-IT")}`;
  const subtotale = Number(quote.subtotale);
  const ivaPerc = Number(quote.ivaPercentuale);
  const ivaValore = Number(quote.ivaValore);
  const totale = Number(quote.totale);

  const logoHtml = profile?.logoUrl
    ? `<img src="${profile.logoUrl}" alt="Logo" style="max-height:60px;max-width:180px;object-fit:contain;" />`
    : "";

  const companyHtml = `
    <div class="company-block">
      ${logoHtml}
      <div class="company-name">${profile?.companyName || ""}</div>
      ${profile?.vatNumber ? `<div class="company-detail">P.IVA / C.F.: ${profile.vatNumber}</div>` : ""}
      ${profile?.address ? `<div class="company-detail">${profile.address}</div>` : ""}
      ${profile?.phone ? `<div class="company-detail">Tel: ${profile.phone}</div>` : ""}
      ${profile?.email ? `<div class="company-detail">${profile.email}</div>` : ""}
    </div>`;

  const quadroSinteticoHtml = hasCapitoli
    ? `<div class="section">
        <table class="table-sintetico">
          <thead>
            <tr>
              <th>Capitolo</th>
              <th class="col-amount">Importo netto</th>
              <th class="col-obs">Osservazione</th>
            </tr>
          </thead>
          <tbody>
            ${capitoli.map(cap => `
              <tr>
                <td>${cap.lettera}. ${cap.titolo}</td>
                <td class="col-amount">€&nbsp;${formatEur(cap.subtotale)}</td>
                <td class="col-obs">${cap.osservazione ?? "Voce ordinaria"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`
    : "";

  const chaptersHtml = hasCapitoli
    ? capitoli.map(cap => `
        <div class="chapter-section">
          <div class="chapter-heading">${cap.lettera}. ${cap.titolo}</div>
          <table class="table-detail">
            <thead>
              <tr>
                <th class="col-desc">Descrizione</th>
                <th class="col-um">U.M.</th>
                <th class="col-qty">Q.tà</th>
                <th class="col-pu">P.u.</th>
                <th class="col-tot">Totale</th>
              </tr>
            </thead>
            <tbody>
              ${cap.voci.map(v => `
                <tr>
                  <td class="col-desc">${v.descrizione}</td>
                  <td class="col-um">${v.um}</td>
                  <td class="col-qty">${v.quantita}</td>
                  <td class="col-pu">€&nbsp;${formatEur(v.prezzoUnitario)}</td>
                  <td class="col-tot">€&nbsp;${formatEur(v.totale)}</td>
                </tr>`).join("")}
              <tr class="subtotale-row">
                <td colspan="4">Subtotale capitolo ${cap.lettera}</td>
                <td class="col-tot">€&nbsp;${formatEur(cap.subtotale)}</td>
              </tr>
            </tbody>
          </table>
        </div>`).join("")
    : `<div class="chapter-section">
        <table class="table-detail">
          <thead>
            <tr>
              <th class="col-desc">Descrizione</th>
              <th class="col-um">U.M.</th>
              <th class="col-qty">Q.tà</th>
              <th class="col-pu">P.u.</th>
              <th class="col-tot">Totale</th>
            </tr>
          </thead>
          <tbody>
            ${legacyItems.map(item => `
              <tr>
                <td class="col-desc">${item.descrizione}</td>
                <td class="col-um">${item.unita}</td>
                <td class="col-qty">${item.quantita}</td>
                <td class="col-pu">€&nbsp;${formatEur(Number(item.prezzoUnitario))}</td>
                <td class="col-tot">€&nbsp;${formatEur(Number(item.totale))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

  const scontoHtml = sconto && sconto.percentuale > 0
    ? `<tr>
        <td class="tot-label">SCONTO APPLICATO</td>
        <td class="tot-value">${sconto.percentuale}%</td>
       </tr>
       <tr>
        <td class="tot-label">IMPONIBILE SCONTATO</td>
        <td class="tot-value">€&nbsp;${formatEur(sconto.importoScontato)}</td>
       </tr>`
    : "";

  const totalsHtml = `
    <div class="totals-section">
      <table class="table-totals">
        <tbody>
          <tr>
            <td class="tot-label">TOTALE IMPONIBILE</td>
            <td class="tot-value">€&nbsp;${formatEur(subtotale)}</td>
          </tr>
          ${scontoHtml}
          <tr>
            <td class="tot-label">IVA (${ivaPerc.toFixed(0)}%)</td>
            <td class="tot-value">€&nbsp;${formatEur(ivaValore)}</td>
          </tr>
          <tr class="grand-total-row">
            <td class="tot-label">TOTALE + IVA</td>
            <td class="tot-value">€&nbsp;${formatEur(totale)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  const condizioniHtml = condizioniPagamento.length > 0
    ? `<div class="condizioni">
        <div class="condizioni-title">CONDIZIONI DI PAGAMENTO</div>
        <ul>${condizioniPagamento.map(c => `<li>${c.toUpperCase()}</li>`).join("")}</ul>
        <p class="nota-bene">N.B. I LAVORI RICHIESTI NON PRESENTI SU QUESTO PREVENTIVO VANNO PREVENTIVATI E PAGATI SEPARATAMENTE.</p>
      </div>`
    : "";

  const acceptanceHtml = `
    <div class="acceptance">
      <div class="acceptance-title">DICHIARAZIONE DI ACCETTAZIONE ${numeroData}</div>
      <div class="acceptance-subtitle">PERSONA FISICA/GIURIDICA</div>
      <table class="accept-table">
        <tr>
          <td>Il sottoscritto <span class="blank-line"></span></td>
        </tr>
        <tr>
          <td>Nato a <span class="blank-line-short"></span> il <span class="blank-line-short"></span></td>
        </tr>
        <tr>
          <td>Codice Fiscale <span class="blank-line"></span></td>
        </tr>
        <tr>
          <td>Residente in Via <span class="blank-line"></span> Comune <span class="blank-line"></span></td>
        </tr>
        <tr>
          <td>CAP <span class="blank-line-xs"></span> Provincia <span class="blank-line-xs"></span></td>
        </tr>
      </table>
      <p class="dichiara">DICHIARA</p>
      <p class="dichiara-text">di aver preso visione e di accettare integralmente il preventivo indicato sopra e le condizioni di pagamento concordate in data ………………………………</p>
      <p class="nb-doc">N.B. Allegare fotocopia di un documento di identità del committente</p>
      <table class="sign-table">
        <tr>
          <td class="sign-col">
            <div class="sign-label">FIRMA DITTA ESECUTRICE DEI LAVORI</div>
            <div class="sign-line"></div>
          </td>
          <td class="sign-col">
            <div class="sign-label">FIRMA PER ACCETTAZIONE DEL COMMITTENTE/CLIENTE</div>
            <div class="sign-line"></div>
          </td>
        </tr>
      </table>
    </div>`;

  const footerHtml = profile?.companyName
    ? `<div class="doc-footer">${profile.companyName}${profile.address ? ` – ${profile.address}` : ""}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>${titolo1}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 16mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      margin: 0;
      padding: 16px 20px;
      background: white;
    }
    /* ---- Header ---- */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .company-block { max-width: 55%; }
    .company-name { font-size: 13pt; font-weight: 700; color: #1a1a2e; margin: 4px 0 2px; }
    .company-detail { font-size: 8pt; color: #555; line-height: 1.4; }
    .doc-meta { text-align: right; font-size: 8pt; color: #555; }
    .doc-meta .numero { font-weight: 700; font-size: 10pt; color: #1a1a2e; }
    /* ---- Title ---- */
    .doc-title {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1a1a2e;
      margin: 0 0 2px;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 9pt;
      color: #444;
      margin: 0 0 14px;
      font-style: italic;
    }
    /* ---- Client box ---- */
    .client-box {
      background: #f4f6f9;
      border-left: 3px solid #1a1a2e;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5pt;
    }
    .client-box .label { font-weight: 700; font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .client-box .value { font-weight: 600; color: #1a1a2e; }
    /* ---- Section headings ---- */
    .section { margin-bottom: 14px; }
    .section-heading {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 4px;
    }
    /* ---- Tables ---- */
    table { width: 100%; border-collapse: collapse; }
    th {
      background: #1a1a2e;
      color: white;
      padding: 6px 8px;
      text-align: left;
      font-size: 8pt;
      font-weight: 600;
    }
    td { padding: 5px 8px; font-size: 8.5pt; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f8f9fb; }
    .table-sintetico { margin-bottom: 14px; }
    .table-sintetico .col-amount { text-align: right; white-space: nowrap; }
    .table-sintetico .col-obs { color: #666; font-style: italic; }
    /* ---- Chapter sections ---- */
    .chapter-section { margin-bottom: 18px; page-break-inside: avoid; }
    .chapter-heading {
      font-size: 10pt;
      font-weight: 700;
      color: #1a1a2e;
      border-left: 4px solid #1a1a2e;
      padding: 4px 0 4px 8px;
      margin-bottom: 6px;
      background: #f4f6f9;
    }
    .table-detail .col-desc { width: 44%; }
    .table-detail .col-um { width: 8%; text-align: center; }
    .table-detail .col-qty { width: 8%; text-align: center; }
    .table-detail .col-pu { width: 16%; text-align: right; white-space: nowrap; }
    .table-detail .col-tot { width: 16%; text-align: right; white-space: nowrap; }
    .subtotale-row td {
      background: #edf0f5 !important;
      font-weight: 700;
      border-top: 2px solid #c5cce0;
      font-size: 8.5pt;
    }
    /* ---- Totals ---- */
    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .table-totals { width: 340px; border: 1px solid #dde1ec; }
    .table-totals td { padding: 6px 10px; }
    .table-totals .tot-label { font-weight: 600; font-size: 8.5pt; color: #333; }
    .table-totals .tot-value { text-align: right; font-weight: 700; white-space: nowrap; font-size: 9pt; }
    .grand-total-row td { background: #1a1a2e !important; color: white !important; font-size: 10pt; font-weight: 700; }
    /* ---- Condizioni ---- */
    .condizioni {
      border: 1px solid #dde1ec;
      border-radius: 3px;
      padding: 10px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .condizioni-title {
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1a1a2e;
      margin-bottom: 6px;
    }
    .condizioni ul { margin: 0 0 8px; padding-left: 18px; }
    .condizioni li { font-size: 8.5pt; margin-bottom: 3px; font-weight: 600; }
    .nota-bene { font-size: 8pt; color: #c00; font-weight: 700; margin: 6px 0 0; }
    /* ---- Acceptance ---- */
    .acceptance {
      border: 1px solid #c5cce0;
      border-radius: 3px;
      padding: 12px 16px;
      page-break-inside: avoid;
    }
    .acceptance-title {
      font-size: 9.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #1a1a2e;
      margin-bottom: 4px;
    }
    .acceptance-subtitle { font-size: 8.5pt; font-weight: 600; color: #555; margin-bottom: 10px; }
    .accept-table td { padding: 4px 0; font-size: 8.5pt; border: none; background: transparent; }
    .blank-line {
      display: inline-block;
      width: 220px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .blank-line-short {
      display: inline-block;
      width: 100px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .blank-line-xs {
      display: inline-block;
      width: 60px;
      border-bottom: 1px dotted #666;
      margin-left: 4px;
      vertical-align: bottom;
    }
    .dichiara { font-size: 9pt; font-weight: 700; text-transform: uppercase; margin: 10px 0 4px; }
    .dichiara-text { font-size: 8.5pt; color: #333; margin-bottom: 6px; }
    .nb-doc { font-size: 7.5pt; color: #888; margin-bottom: 14px; font-style: italic; }
    .sign-table { width: 100%; border: none; }
    .sign-table td { border: none; background: transparent; padding: 0; }
    .sign-col { width: 48%; padding: 0 10px 0 0 !important; vertical-align: bottom; }
    .sign-label { font-size: 7.5pt; font-weight: 600; color: #333; text-transform: uppercase; margin-bottom: 20px; }
    .sign-line { border-bottom: 1px solid #333; height: 1px; width: 90%; }
    /* ---- Footer ---- */
    .doc-footer {
      margin-top: 14px;
      text-align: center;
      font-size: 7.5pt;
      color: #aaa;
      border-top: 1px solid #eee;
      padding-top: 6px;
    }
    /* ---- Watermark ---- */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 72pt;
      color: rgba(0,0,0,0.045);
      font-weight: 900;
      z-index: 9999;
      white-space: nowrap;
      pointer-events: none;
      letter-spacing: 4px;
    }
    @media print {
      body { padding: 0; }
      .watermark { position: fixed; }
    }
  </style>
</head>
<body>
  ${withWatermark ? '<div class="watermark">BOZZA NON VALIDA</div>' : ""}

  <div class="doc-header">
    ${companyHtml}
    <div class="doc-meta">
      <div class="numero">${numeroData}</div>
      <div>Data: ${new Date().toLocaleDateString("it-IT")}</div>
    </div>
  </div>

  <div class="doc-title">${titolo1}</div>
  ${titolo2 ? `<div class="doc-subtitle">${titolo2}</div>` : ""}

  <div class="client-box">
    <div class="label">Spett.le Committente</div>
    <div class="value">${clientData.nome || "——"}</div>
    <div>${clientData.indirizzo || ""}</div>
  </div>

  ${hasCapitoli ? `<div class="section">
    <div class="section-heading">1. Quadro Sintetico</div>
    ${quadroSinteticoHtml}
  </div>` : ""}

  <div class="section">
    ${hasCapitoli ? `<div class="section-heading">2. Computo Metrico Dettagliato</div>` : ""}
    ${chaptersHtml}
  </div>

  ${totalsHtml}
  ${condizioniHtml}
  ${acceptanceHtml}
  ${footerHtml}
</body>
</html>`;
}

export { generateQuoteHtml };
export default router;
