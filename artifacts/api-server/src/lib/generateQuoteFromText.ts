import { db, quotesTable, businessProfilesTable, priceCatalogItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
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

export async function generateQuoteFromText({
  userId,
  rawInput,
  log,
}: {
  userId: string;
  rawInput: string;
  log: Logger;
}): Promise<typeof quotesTable.$inferSelect> {
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

  const pastContext = buildPastContext(recentQuotes as { rawInput: string; capitoli: unknown; totale: string }[]);
  const catalogContext = buildCatalogContext(catalogItems);
  const isProUser = profile?.subscriptionStatus === "active" && profile?.subscriptionPlan === "monthly_pro";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: AI_PROMPT },
      ...(catalogContext ? [{ role: "system" as const, content: catalogContext }] : []),
      ...(pastContext ? [{ role: "system" as const, content: pastContext }] : []),
      { role: "user", content: rawInput },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  let aiData: AiQuoteData;
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    aiData = JSON.parse(cleaned) as AiQuoteData;
  } catch {
    log.error({ content }, "WhatsApp: Failed to parse AI JSON");
    throw new Error("AI returned invalid JSON");
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
      ? { percentuale: Number(scontoRaw.percentuale), importoScontato: Number(scontoRaw.importo_scontato ?? 0) }
      : null;

  const condizioniPagamento = aiData.condizioni_pagamento ?? [
    "30% acconto alla firma del contratto",
    "30% a completamento prima fase lavori",
    "30% a completamento seconda fase lavori",
    "10% saldo a fine lavori",
  ];

  const resolvedClientData: QuoteClientData = {
    nome: aiData.cliente?.nome ?? "",
    indirizzo: aiData.cliente?.indirizzo ?? "",
  };

  const subtotale = Number(aiData.subtotale ?? 0);
  const ivaPercentuale = Number(aiData.iva_percentuale ?? 22);
  const ivaValore = Number(aiData.iva_valore ?? 0);
  const totale = Number(aiData.totale ?? 0);

  const [quote] = await db.insert(quotesTable).values({
    userId,
    rawInput,
    clientData: resolvedClientData,
    companySnapshot: resolvedSnapshot,
    descrizioneGenerale: aiData.descrizione_generale ?? "",
    items: [],
    capitoli,
    sconto,
    condizioniPagamento,
    capitolatoPro: isProUser,
    titoloPreventivoRiga1: aiData.titolo_riga1 ?? "Analisi Economica e Computo Metrico Prezzato",
    titoloPreventivoRiga2: aiData.titolo_riga2 ?? "",
    numeroPreventivoData: aiData.numero_preventivo_data ?? "",
    subtotale: subtotale.toFixed(2),
    ivaPercentuale: ivaPercentuale.toFixed(2),
    ivaValore: ivaValore.toFixed(2),
    totale: totale.toFixed(2),
    note: aiData.note ?? "Preventivo valido 30 giorni",
    status: "draft",
  }).returning();

  if (!profile?.trialStartedAt) {
    await db.update(businessProfilesTable)
      .set({ trialStartedAt: new Date() })
      .where(eq(businessProfilesTable.userId, userId));
  }

  return quote!;
}

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
