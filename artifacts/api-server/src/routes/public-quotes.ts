import { Router } from "express";
import { db, quotesTable, businessProfilesTable, priceCatalogItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateNumeroPreventivo } from "../lib/quoteNumber.js";
import { logger } from "../lib/logger.js";
import type { QuoteChapter, QuoteDiscount, QuoteClientData } from "@workspace/db";
import { sendWidgetLeadNotification } from "../lib/email.js";

const router = Router();

// Helper in-memory semantic search for listino prices
function findRelevantCatalogItems(
  input: string,
  catalog: Array<typeof priceCatalogItemsTable.$inferSelect>,
  limit = 20
): Array<typeof priceCatalogItemsTable.$inferSelect> {
  if (catalog.length <= limit) return catalog;

  const words = input.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (words.length === 0) return catalog.slice(0, limit);

  const scored = catalog.map(item => {
    const nameLower = item.nome.toLowerCase();
    const catLower = (item.categoria || "").toLowerCase();
    const noteLower = (item.note || "").toLowerCase();

    let score = 0;
    for (const word of words) {
      if (nameLower.includes(word)) score += 3;
      if (catLower.includes(word)) score += 1.5;
      if (noteLower.includes(word)) score += 0.5;
    }
    return { item, score };
  });

  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);

  if (filtered.length < limit) {
    const addedIds = new Set(filtered.map(f => f.id));
    for (const item of catalog) {
      if (filtered.length >= limit) break;
      if (!addedIds.has(item.id)) {
        filtered.push(item);
        addedIds.add(item.id);
      }
    }
  }

  return filtered.slice(0, limit);
}

const AI_PROMPT = `Sei un consulente esperto di preventivi professionali per il mercato italiano (artigiani, edilizia, impianti, servizi tecnici).

Devi trasformare una descrizione libera in un'ANALISI ECONOMICA E COMPUTO METRICO PREZZATO professionale, strutturata a capitoli, coerente con i prezzi di listino del proprietario e con le stime di mercato in Italia nel 2026.

REGOLE FONDAMENTALI:
1. Prezzi di riferimento e di catalogo (LISTINO):
   - Se è fornito un "LISTINO PREZZI PERSONALIZZATO DELL'UTENTE", devi usare PRIORITARIAMENTE i prezzi unitari definiti nel listino per tutte le lavorazioni corrispondenti o correlate.
   - Non inventare nuovi prezzi unitari se la voce corrisponde a qualcosa presente nel listino personalizzato.
   - Se una lavorazione non è presente nel listino personalizzato, usa prezzi realistici del mercato italiano 2026.
2. Se mancano dati specifici: fai assunzioni realistiche, NON chiedere chiarimenti. Se sono fornite le "MISURE E DIMENSIONI DELL'IMMOBILE", devi usarle rigorosamente per calcolare le quantità (mq, metri lineari, ecc.) in modo matematico.
3. Organizza il lavoro in CAPITOLI logici (A, B, C, D, …) con titoli professionali (es: "Allestimento cantiere", "Opere di demolizione", "Nuove opere edili", "Impianto elettrico", ecc.)
4. Ogni capitolo contiene VOCI di lavoro dettagliate con unità di misura professionali (mq, ml, mc, kg, ore, a.c., pezzi, cadauno, kw, etc.)
5. Calcola subtotale per ogni capitolo. Il QUADRO SINTETICO è ricavato automaticamente dall'array capitoli.
6. Sempre IVA 22% salvo indicazione contraria.
7. Il titolo_riga2 deve descrivere l'intervento.
8. numero_preventivo_data: NON GENERARE — il server assegna il numero automaticamente. Restituisci una stringa vuota.

OUTPUT — SOLO JSON VALIDO, nessun testo extra:
{
  "titolo_riga1": "Analisi Economica e Computo Metrico Prezzato",
  "titolo_riga2": "Intervento di [descrizione breve]",
  "numero_preventivo_data": "",
  "cliente": { "nome": "", "indirizzo": "" },
  "descrizione_generale": "Descrizione sintetica dell'intervento",
  "capitoli": [
    {
      "lettera": "A",
      "titolo": "Opere",
      "osservazione": "Voce ordinaria",
      "voci": [
        {
          "descrizione": "Descrizione voce",
          "um": "mq",
          "quantita": 10,
          "prezzo_unitario": 25.00,
          "totale": 250.00
        }
      ],
      "subtotale": 250.00
    }
  ],
  "sconto": { "percentuale": 0, "importo_scontato": 0 },
  "condizioni_pagamento": [],
  "subtotale": 0,
  "iva_percentuale": 22,
  "iva_valore": 0,
  "totale": 0,
  "note": "Preventivo generato via Widget"
}

IMPORTANTISSIMO: output SOLO JSON puro, nessuna spiegazione, nessun markdown.`;

// GET /api/public/config (autenticato con x-api-key o query param apiKey)
router.get("/public/config", async (req, res) => {
  try {
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKeyHeader) {
      res.status(401).json({ error: "Chiave API mancante. Fornisci l'header x-api-key o il parametro query apiKey." });
      return;
    }

    const apiKey = String(apiKeyHeader);

    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.apiKey, apiKey));

    if (!profile) {
      res.status(403).json({ error: "Chiave API non valida o inattiva." });
      return;
    }

    // Carica il catalogo prezzi per determinare le categorie supportate
    const catalogItems = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, profile.userId));

    const categoriesSet = new Set<string>();
    for (const item of catalogItems) {
      if (item.categoria) {
        categoriesSet.add(item.categoria.trim());
      }
    }

    res.json({
      success: true,
      companyName: profile.companyName,
      logoUrl: profile.logoUrl,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      supportedCategories: Array.from(categoriesSet),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching public widget config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes (autenticato con x-api-key)
router.post("/public/quotes", async (req, res) => {
  try {
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKeyHeader) {
      res.status(401).json({ error: "Chiave API mancante. Fornisci l'header x-api-key o il parametro query apiKey." });
      return;
    }

    const apiKey = String(apiKeyHeader);

    // Trova il profilo aziendale corrispondente alla chiave API
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.apiKey, apiKey));

    if (!profile) {
      res.status(403).json({ error: "Chiave API non valida o inattiva." });
      return;
    }

    const userId = profile.userId;

    const { rawInput, clientData, misure } = req.body as {
      rawInput?: string;
      clientData?: { nome: string; email?: string; phone?: string; indirizzo?: string; citta?: string; cap?: string; provincia?: string };
      misure?: Record<string, string | number>;
    };

    if (!rawInput || !rawInput.trim()) {
      res.status(400).json({ error: "Il parametro rawInput è obbligatorio." });
      return;
    }

    // Carica il listino dell'azienda per fare il filtro RAG
    const catalogItems = await db
      .select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome);

    const relevantCatalogItems = findRelevantCatalogItems(rawInput, catalogItems, 20);
    const catalogContext = relevantCatalogItems.length > 0
      ? `LISTINO PREZZI PERSONALIZZATO DELL'UTENTE (usa questi prezzi come riferimento PRIORITARIO):
${relevantCatalogItems
  .map(item => `  - ${item.nome} (${item.um}): ${Number(item.prezzoUnitario).toFixed(2)}€/unità${item.categoria ? ` [${item.categoria}]` : ""}`)
  .join("\n")}`
      : "";

    // Misure geometriche
    let misureContext = "";
    if (misure && typeof misure === "object" && Object.keys(misure).length > 0) {
      misureContext = `MISURE E DIMENSIONI DELL'IMMOBILE:
${Object.entries(misure)
  .map(([key, val]) => `  - ${key}: ${val}`)
  .join("\n")}
Usa queste misure esatte per calcolare matematicamente le quantità.`;
    }

    // Chiama OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: AI_PROMPT },
        ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
        ...(misureContext ? [{ role: "system" as const, content: misureContext }] : []),
        { role: "user", content: rawInput },
      ],
    });

    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;
    const modelUsed = completion.model || "gpt-4o-mini";

    const isMini = modelUsed.includes("mini");
    const isGpt4 = modelUsed.includes("gpt-4o") && !isMini;
    const pCostRate = isMini ? 0.00000015 : isGpt4 ? 0.000005 : 0.00000059;
    const cCostRate = isMini ? 0.00000060 : isGpt4 ? 0.000015 : 0.00000079;
    const apiCost = ((promptTokens * pCostRate) + (completionTokens * cCostRate)).toFixed(6);

    const content = completion.choices[0]?.message?.content ?? "{}";
    let aiData: any = {};
    try {
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      aiData = JSON.parse(cleaned);
    } catch (err) {
      logger.error({ content }, "Failed to parse public API quote JSON");
      res.status(422).json({ error: "L'AI non è riuscita a strutturare il preventivo. Riprova con una descrizione diversa." });
      return;
    }

    // Struttura i capitoli
    const capitoli: QuoteChapter[] = (aiData.capitoli ?? []).map((cap: any) => ({
      lettera: cap.lettera ?? "A",
      titolo: cap.titolo ?? "",
      osservazione: cap.osservazione ?? "Voce ordinaria",
      voci: (cap.voci ?? []).map((v: any) => ({
        descrizione: v.descrizione ?? "",
        um: v.um ?? "a.c.",
        quantita: Number(v.quantita ?? 0),
        prezzoUnitario: Number(v.prezzo_unitario ?? 0),
        totale: Number(v.totale ?? 0),
      })),
      subtotale: Number(cap.subtotale ?? 0),
    }));

    const subtotale = Number(aiData.subtotale ?? 0);
    const ivaPercentuale = Number(aiData.iva_percentuale ?? 22);
    const ivaValore = Number(aiData.iva_valore ?? 0);
    const totale = Number(aiData.totale ?? 0);

    const resolvedClientData: QuoteClientData = {
      nome: clientData?.nome || aiData.cliente?.nome || "Lead Widget",
      indirizzo: clientData?.indirizzo || aiData.cliente?.indirizzo || "",
      email: clientData?.email,
      phone: clientData?.phone,
      citta: clientData?.citta,
      cap: clientData?.cap,
      provincia: clientData?.provincia,
    };

    // Genera numero preventivo
    const numeroPreventivoData = await generateNumeroPreventivo(userId);

    // Inserisci il preventivo (catturando implicitamente il lead CRM)
    const [quote] = await db
      .insert(quotesTable)
      .values({
        userId,
        rawInput,
        clientData: resolvedClientData,
        companySnapshot: {
          companyName: profile.companyName,
          vatNumber: profile.vatNumber ?? undefined,
          address: profile.address ?? undefined,
          phone: profile.phone ?? undefined,
          email: profile.email ?? undefined,
          logoUrl: profile.logoUrl ?? undefined,
        },
        descrizioneGenerale: aiData.descrizione_generale ?? "",
        items: [],
        capitoli,
        sconto: null,
        condizioniPagamento: aiData.condizioni_pagamento ?? [],
        titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Analisi Economica e Computo Metrico Prezzato",
        titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
        numeroPreventivoData,
        subtotale: subtotale.toFixed(2),
        ivaPercentuale: ivaPercentuale.toFixed(2),
        ivaValore: ivaValore.toFixed(2),
        totale: totale.toFixed(2),
        note: aiData.note ?? "Preventivo generato via Widget",
        status: "draft",
        source: "widget", // Traccia che arriva dal widget
        promptTokens,
        completionTokens,
        totalTokens,
        modelUsed,
        apiCost,
      })
      .returning();

    // Ritorna la stima in range per il widget
    res.status(201).json({
      success: true,
      quoteId: quote.id,
      totale,
      prezzoMinimo: Math.round(totale * 0.9 * 100) / 100,
      prezzoMassimo: Math.round(totale * 1.25 * 100) / 100,
      descrizioneGenerale: quote.descrizioneGenerale,
    });

    // Invia notifica email asincrona all'impresa
    const contractorEmail = profile.email || "notifiche@prevai.it";
    if (contractorEmail) {
      sendWidgetLeadNotification({
        toEmail: contractorEmail,
        companyName: profile.companyName,
        clientName: resolvedClientData.nome,
        clientEmail: resolvedClientData.email || "Nessuna email fornita",
        clientPhone: resolvedClientData.phone || "Nessun telefono fornito",
        rawInput: rawInput || "",
        totale: totale.toFixed(2),
        prezzoMinimo: (totale * 0.9).toFixed(2),
        prezzoMassimo: (totale * 1.25).toFixed(2),
      }).catch(emailErr => {
        logger.error({ err: emailErr }, "Failed to send lead email notification asynchronously");
      });
    }
  } catch (err) {
    logger.error({ err }, "Error creating public widget quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
