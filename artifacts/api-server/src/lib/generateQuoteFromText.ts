import { db, quotesTable, businessProfilesTable, priceCatalogItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateNumeroPreventivo } from "./quoteNumber.js";
import type { QuoteChapter, QuoteDiscount, QuoteCompanySnapshot, QuoteClientData } from "@workspace/db";
import type { Logger } from "pino";

export const AI_PROMPT = `Sei un consulente esperto di preventivi professionali per il mercato italiano (artigiani, edilizia, impianti, servizi tecnici).

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
3. Organizza il lavoro in CAPITOLI logici (A, B, C, D, …) con titoli professionali
4. Ogni capitolo contiene VOCI di lavoro dettagliate con unità di misura professionali (mq, ml, mc, kg, ore, a.c., pezzi, cadauno, kw, etc.)
5. Calcola subtotale per ogni capitolo.
6. Applica uno sconto SOLO se l'utente lo richiede esplicitamente; altrimenti percentuale: 0
7. Condizioni di pagamento tipiche edilizia: 30% acconto firma, 30% SAL intermedio, 30% SAL finale, 10% saldo fine lavori
8. Sempre IVA 22% salvo indicazione contraria
9. Il titolo_riga2 deve descrivere l'intervento e il luogo del cantiere
10. numero_preventivo_data: NON GENERARE — il server assegna il numero automaticamente. Restituisci una stringa vuota.

OUTPUT — SOLO JSON VALIDO, nessun testo extra:
{
  "titolo_riga1": "Analisi Economica e Computo Metrico Prezzato",
  "titolo_riga2": "Intervento di [descrizione breve] – [Comune] ([Prov])",
  "numero_preventivo_data": "",
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
  "sconto": { "percentuale": 0, "importo_scontato": 0 },
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
  "note": "Preventivo valido 30 giorni dalla data di emissione."
}

CALCOLI:
- subtotale = somma di tutti i subtotali capitoli
- Se sconto = 0: iva_valore = subtotale * iva_percentuale/100; totale = subtotale + iva_valore

IMPORTANTISSIMO: output SOLO JSON puro, nessuna spiegazione, nessun markdown.`;

export const CAPITOLATO_CONTEXT = `MODALITÀ CAPITOLATO TECNICO PROFESSIONALE:
Per ogni voce di lavoro, scrivi la descrizione in stile CAPITOLATO SPECIALE D'APPALTO con ALMENO 4-6 linee tecniche in italiano formale:
- Descrivi con precisione le operazioni eseguite e le modalità esecutive (ciclo lavorativo, tecniche, successione delle fasi)
- Specifica materiali, prodotti e componenti con caratteristiche tecniche e standard normativi italiani/europei (UNI, CEI, UNI EN, D.Lgs., D.M.)
- Indica le caratteristiche di qualità, resistenza, classe o certificazione richieste per i materiali
- Indica esplicitamente cosa è COMPRESO nella voce (forniture, lavorazioni, carico, trasporto, smaltimento)
- Indica eventuali ESCLUSIONI rilevanti e/o oneri a carico del committente
- Usa terminologia professionale edilizia/impiantistica italiana
Esempio: "Demolizione e rimozione di pavimentazione esistente in piastrelle ceramiche compreso il distacco mediante scalpellatura meccanica e la rimozione del massetto di allettamento per uno spessore medio di 5 cm. Compresi il carico, il trasporto e lo smaltimento del materiale di risulta presso discarica autorizzata secondo D.Lgs. 152/2006. Esclusi lavori di ripristino strutturale del sottofondo e impermeabilizzazioni."`;

// ── Public types ────────────────────────────────────────────────────────────────

export type PendingQuoteData = {
  rawInput: string;
  titoloPreventivoRiga1: string;
  titoloPreventivoRiga2: string;
  numeroPreventivoData: string;
  clientData: QuoteClientData;
  companySnapshot: QuoteCompanySnapshot | null;
  descrizioneGenerale: string;
  capitoli: QuoteChapter[];
  sconto: QuoteDiscount | null;
  condizioniPagamento: string[];
  subtotale: string;
  ivaPercentuale: string;
  ivaValore: string;
  totale: string;
  note: string;
  capitolatoPro: boolean;
  templateId?: string;
};

// ── Internal helpers ────────────────────────────────────────────────────────────

function parseAiResponse(content: string, rawInput: string, profile: typeof businessProfilesTable.$inferSelect | undefined, templateId?: string): PendingQuoteData {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const aiData = JSON.parse(cleaned) as AiQuoteData;

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
      ? { percentuale: Number(scontoRaw.percentuale), importoScontato: Number(scontoRaw.importo_scontato ?? 0) }
      : null;

  const resolvedSnapshot: QuoteCompanySnapshot | null = profile
    ? {
        companyName: profile.companyName,
        vatNumber: profile.vatNumber ?? undefined,
        address: profile.address ?? undefined,
        phone: profile.phone ?? undefined,
        email: profile.email ?? undefined,
        logoUrl: profile.logoUrl ?? undefined,
      }
    : null;

  return {
    rawInput,
    titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Analisi Economica e Computo Metrico Prezzato",
    titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
    numeroPreventivoData: aiData.numero_preventivo_data ?? "",
    clientData: { nome: aiData.cliente?.nome ?? "", indirizzo: aiData.cliente?.indirizzo ?? "" },
    companySnapshot: resolvedSnapshot,
    descrizioneGenerale: aiData.descrizione_generale ?? "",
    capitoli,
    sconto,
    condizioniPagamento: aiData.condizioni_pagamento ?? [
      "30% acconto alla firma del contratto",
      "30% a completamento prima fase lavori",
      "30% a completamento seconda fase lavori",
      "10% saldo a fine lavori",
    ],
    subtotale: Number(aiData.subtotale ?? 0).toFixed(2),
    ivaPercentuale: Number(aiData.iva_percentuale ?? 22).toFixed(2),
    ivaValore: Number(aiData.iva_valore ?? 0).toFixed(2),
    totale: Number(aiData.totale ?? 0).toFixed(2),
    note: aiData.note ?? "Preventivo valido 30 giorni",
    capitolatoPro: !!(profile?.subscriptionStatus === "active" && (profile?.subscriptionPlan === "monthly_pro" || profile?.subscriptionPlan === "monthly_elite")),
    templateId,
  };
}

// ── Exported API ────────────────────────────────────────────────────────────────

/**
 * Calls the AI and returns quote data WITHOUT saving to the DB.
 * Use this for the WhatsApp preview-first flow.
 */
export async function buildQuoteFromAI({
  userId,
  rawInput,
  log,
  templateId,
  clientData,
  imageDataUrls,
}: {
  userId: string;
  rawInput: string;
  log: Logger;
  templateId?: string;
  clientData?: { nome: string; indirizzo: string };
  imageDataUrls?: string[];
}): Promise<PendingQuoteData> {
  const [profileRows, recentQuotes, catalogItems] = await Promise.all([
    db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
    db.select({ rawInput: quotesTable.rawInput, capitoli: quotesTable.capitoli, totale: quotesTable.totale })
      .from(quotesTable)
      .where(eq(quotesTable.userId, userId))
      .orderBy(desc(quotesTable.createdAt))
      .limit(5),
    db.select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
  ]);
  const [profile] = profileRows;

  const pastContext = buildPastContext(recentQuotes as { rawInput: string; capitoli: unknown; totale: string }[]);
  const catalogContext = buildCatalogContext(catalogItems);

  // Capitolato context: include for Elegante/Professionale templates
  const useCapitolato = templateId === "arosio" || templateId === "mariagrazia";

  // If client data is pre-filled, prepend it to the user message
  const clientPrefix = clientData?.nome
    ? `Cliente: ${clientData.nome}${clientData.indirizzo ? `, ${clientData.indirizzo}` : ""}.\n\n`
    : "";

  const hasImages = imageDataUrls && imageDataUrls.length > 0;

  const userContent = hasImages
    ? [
        { type: "text" as const, text: `${clientPrefix}${rawInput}` },
        ...imageDataUrls.map(img => ({
          type: "image_url" as const,
          image_url: { url: img, detail: "high" as const },
        })),
      ]
    : `${clientPrefix}${rawInput}`;

  const completion = await openai.chat.completions.create({
    model: hasImages ? "gpt-4o" : "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: AI_PROMPT },
      ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
      ...(pastContext ? [{ role: "system" as const, content: pastContext }] : []),
      ...(useCapitolato ? [{ role: "system" as const, content: CAPITOLATO_CONTEXT }] : []),
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  try {
    const result = parseAiResponse(content, rawInput, profile, templateId);
    // Override client data if pre-filled
    if (clientData?.nome) {
      result.clientData = clientData;
    }
    return result;
  } catch {
    log.error({ content }, "Failed to parse AI JSON in buildQuoteFromAI");
    throw new Error("AI returned invalid JSON");
  }
}

/**
 * Regenerates a quote by applying a natural-language correction to the current pending data.
 * Returns updated PendingQuoteData WITHOUT saving to DB.
 */
export async function regenerateWithCorrection({
  userId,
  current,
  correction,
  log,
}: {
  userId: string;
  current: PendingQuoteData;
  correction: string;
  log: Logger;
}): Promise<PendingQuoteData> {
  const [profileRows, catalogItems] = await Promise.all([
    db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)),
    db.select()
      .from(priceCatalogItemsTable)
      .where(eq(priceCatalogItemsTable.userId, userId))
      .orderBy(priceCatalogItemsTable.categoria, priceCatalogItemsTable.nome),
  ]);
  const [profile] = profileRows;
  const catalogContext = buildCatalogContext(catalogItems);

  const useCapitolato = current.templateId === "arosio" || current.templateId === "mariagrazia";

  const currentJson = JSON.stringify({
    titolo_riga1: current.titoloPreventivoRiga1,
    titolo_riga2: current.titoloPreventivoRiga2,
    numero_preventivo_data: current.numeroPreventivoData,
    cliente: current.clientData,
    descrizione_generale: current.descrizioneGenerale,
    capitoli: current.capitoli.map(cap => ({
      lettera: cap.lettera,
      titolo: cap.titolo,
      osservazione: cap.osservazione,
      voci: cap.voci.map(v => ({
        descrizione: v.descrizione,
        um: v.um,
        quantita: v.quantita,
        prezzo_unitario: v.prezzoUnitario,
        totale: v.totale,
      })),
      subtotale: cap.subtotale,
    })),
    sconto: current.sconto
      ? { percentuale: current.sconto.percentuale, importo_scontato: current.sconto.importoScontato }
      : { percentuale: 0, importo_scontato: 0 },
    condizioni_pagamento: current.condizioniPagamento,
    subtotale: Number(current.subtotale),
    iva_percentuale: Number(current.ivaPercentuale),
    iva_valore: Number(current.ivaValore),
    totale: Number(current.totale),
    note: current.note,
  });

  const correctionPrompt = `Modifica il seguente preventivo applicando questa istruzione: "${correction}"

PREVENTIVO CORRENTE (JSON):
${currentJson}

Restituisci il preventivo aggiornato COMPLETO in JSON valido con la stessa struttura. Ricalcola tutti i subtotali, l'IVA e il totale. SOLO JSON puro, nessun testo extra.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: AI_PROMPT },
      ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
      ...(useCapitolato ? [{ role: "system" as const, content: CAPITOLATO_CONTEXT }] : []),
      { role: "user", content: correctionPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  try {
    const result = parseAiResponse(content, current.rawInput, profile, current.templateId);
    return result;
  } catch {
    log.error({ content }, "Failed to parse AI JSON in regenerateWithCorrection");
    throw new Error("AI returned invalid JSON during correction");
  }
}

/**
 * Saves a PendingQuoteData to the database and returns the saved row.
 */
export async function saveQuoteToDb({
  userId,
  data,
  source,
  templateId,
}: {
  userId: string;
  data: PendingQuoteData;
  source: string;
  templateId?: string;
}): Promise<typeof quotesTable.$inferSelect> {
  const resolvedTemplateId = templateId ?? data.templateId ?? "standard";
  const numeroPreventivoData = data.numeroPreventivoData
    ? data.numeroPreventivoData
    : await generateNumeroPreventivo(userId);
  const [quote] = await db.insert(quotesTable).values({
    userId,
    rawInput: data.rawInput,
    clientData: data.clientData,
    companySnapshot: data.companySnapshot,
    descrizioneGenerale: data.descrizioneGenerale,
    items: [],
    capitoli: data.capitoli,
    sconto: data.sconto,
    condizioniPagamento: data.condizioniPagamento,
    capitolatoPro: data.capitolatoPro,
    titoloPreventivoRiga1: data.titoloPreventivoRiga1,
    titoloPreventivoRiga2: data.titoloPreventivoRiga2,
    numeroPreventivoData,
    subtotale: data.subtotale,
    ivaPercentuale: data.ivaPercentuale,
    ivaValore: data.ivaValore,
    totale: data.totale,
    note: data.note,
    status: "draft",
    source,
    templateId: resolvedTemplateId,
  }).returning();

  // Set trialStartedAt only if not already set — do NOT overwrite an existing value
  const [existingProfile] = await db
    .select({ trialStartedAt: businessProfilesTable.trialStartedAt })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.userId, userId));
  if (!existingProfile?.trialStartedAt) {
    await db
      .update(businessProfilesTable)
      .set({ trialStartedAt: new Date() })
      .where(eq(businessProfilesTable.userId, userId));
  }

  return quote!;
}

/**
 * Legacy interface: generates a quote AND saves it to DB in one step.
 * Used by the web flow and existing callers.
 */
export async function generateQuoteFromText({
  userId,
  rawInput,
  log,
  source = "web",
}: {
  userId: string;
  rawInput: string;
  log: Logger;
  source?: string;
}): Promise<typeof quotesTable.$inferSelect> {
  const data = await buildQuoteFromAI({ userId, rawInput, log });
  return saveQuoteToDb({ userId, data, source });
}

// ── Context builders ────────────────────────────────────────────────────────────

function buildPastContext(quotes: { rawInput: string; capitoli: unknown; totale: string }[]): string {
  const examples = quotes
    .filter(q => Array.isArray(q.capitoli) && (q.capitoli as QuoteChapter[]).length > 0)
    .slice(0, 3)
    .map(q => {
      const caps = q.capitoli as QuoteChapter[];
      const voci = caps.flatMap(c => c.voci).slice(0, 6);
      const lines = voci.map(v => `  - ${v.descrizione} (${v.um}): ${v.prezzoUnitario}€/unità`).join("\n");
      const tot = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(q.totale));
      return `Lavoro: "${q.rawInput.slice(0, 100).replace(/\n/g, " ")}"\nTotale: ${tot}\nPrezzi:\n${lines}`;
    });
  if (examples.length === 0) return "";
  return `STORICO PREVENTIVI (usa come riferimento per coerenza prezzi):\n\n${examples.join("\n\n---\n\n")}`;
}

function buildCatalogContext(items: { nome: string; um: string; prezzoUnitario: string; categoria: string | null; note: string | null }[]): string {
  if (items.length === 0) return "";
  return `LISTINO PREZZI PERSONALIZZATO (usa come riferimento PRIORITARIO):\n${items.map(item => `  - ${item.nome} (${item.um}): ${Number(item.prezzoUnitario).toFixed(2)}€/unità${item.categoria ? ` [${item.categoria}]` : ""}`).join("\n")}`;
}

type AiQuoteData = {
  titolo_riga1?: string;
  titolo_riga2?: string;
  numero_preventivo_data?: string;
  cliente?: { nome?: string; indirizzo?: string };
  descrizione_generale?: string;
  capitoli?: Array<{
    lettera?: string;
    titolo?: string;
    osservazione?: string;
    voci?: Array<{ descrizione?: string; um?: string; quantita?: number; prezzo_unitario?: number; totale?: number }>;
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
