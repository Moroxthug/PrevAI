import { Router } from "express";
import { db, incentivesCatalogTable, quotesTable, businessProfilesTable, readQuoteClientData, type QuoteClientData } from "@workspace/db";
import { eq, ne, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { sendWidgetLeadNotification, sendWidgetClientConfirmationEmail } from "../lib/email.js";
import { ensureDefaultIncentives } from "../incentives/seed.js";
import { categoryMatches, placeMatches } from "../incentives/matching.js";
import { calcolaIncentiviPreventivo, riepilogoIncentivi } from "../incentives/calc.js";

// ── Incentivi e bandi: endpoint del widget v1 (V2-4) ─────────────────────────
// Il widget `public/widget.js` è già installato sui siti dei clienti e chiama
// questi due endpoint con questo esatto contratto (query `regione`/`comune`/
// `categoria`; body `tipoImmobile`/`obiettivoLavori`/`fasciaIsee`/`regione`/
// `cap`/`totalePreventivo`): la forma delle risposte non va cambiata. La
// logica di calcolo è in `incentives/calc.ts`, il catalogo in `incentives/seed.ts`.

const router = Router();

const publicIncentivesLimiter = ipRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Troppe richieste. Riprova tra poco.",
});

const calcLimiter = ipRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Limite orario di verifiche incentivi raggiunto. Riprova più tardi.",
});

// GET /api/public/incentives — anteprima dei bandi attivi per regione/comune/categoria
router.get("/public/incentives", publicIncentivesLimiter, async (req, res) => {
  try {
    await ensureDefaultIncentives();

    const regioneParam = req.query.regione ? String(req.query.regione).trim() : null;
    const comuneParam = req.query.comune ? String(req.query.comune).trim() : null;
    const categoriaParam = req.query.categoria ? String(req.query.categoria).trim() : null;

    const allIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"))
      .orderBy(desc(incentivesCatalogTable.level), incentivesCatalogTable.titolo);

    const filtered = allIncentives
      .filter((inc) => {
        if (inc.level === "statale") return true;
        if (inc.level === "regionale") return !regioneParam || placeMatches(inc.regione, regioneParam);
        if (inc.level === "comunale") {
          if (!comuneParam && !regioneParam) return true;
          return (comuneParam && placeMatches(inc.comune, comuneParam)) || (regioneParam && placeMatches(inc.regione, regioneParam));
        }
        return true;
      })
      .filter((inc) => !categoriaParam || categoryMatches(categoriaParam, inc.categoriaIntervento));

    res.json({ success: true, count: filtered.length, incentives: filtered });
  } catch (err) {
    logger.error({ err }, "Error fetching public incentives");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes/:quoteId/incentives — calcola i bonus sul preventivo,
// li salva nel preventivo e avvisa impresa e cliente via email
router.post("/public/quotes/:quoteId/incentives", calcLimiter, async (req, res) => {
  try {
    const quoteId = req.params.quoteId as string;
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, quoteId));
    if (!quote) {
      res.status(404).json({ error: "Preventivo non trovato." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).slice(0, 80) : undefined);

    await ensureDefaultIncentives();
    const catalog = await db.select().from(incentivesCatalogTable).where(ne(incentivesCatalogTable.stato, "closed"));

    const result = calcolaIncentiviPreventivo({
      totaleLavori: Number(body.totalePreventivo) || Number(quote.totale) || 0,
      tipoImmobile: str("tipoImmobile"),
      obiettivoLavori: str("obiettivoLavori"),
      fasciaIsee: str("fasciaIsee"),
      regione: str("regione"),
      cap: str("cap"),
      catalog,
    });

    const currentClientData = (quote.clientData as QuoteClientData | null) ?? { nome: "", indirizzo: "" };
    await db
      .update(quotesTable)
      .set({ clientData: { ...currentClientData, incentivesData: result.incentivesData }, updatedAt: new Date() })
      .where(eq(quotesTable.id, quoteId));

    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, quote.userId));
    const cd = readQuoteClientData(currentClientData);
    const prezzoMinimo = (Number(quote.totale) * 0.9).toFixed(2);
    const prezzoMassimo = (Number(quote.totale) * 1.25).toFixed(2);

    if (profile?.email) {
      sendWidgetLeadNotification({
        toEmail: profile.email,
        companyName: profile.companyName,
        clientName: cd.nome || "Lead Widget",
        clientEmail: cd.email || "Nessuna email fornita",
        clientPhone: cd.phone || "Nessun telefono fornito",
        rawInput: quote.rawInput || "",
        totale: quote.totale,
        prezzoMinimo,
        prezzoMassimo,
        incentivesSummary: riepilogoIncentivi(result, { perImpresa: true }),
      }).catch((err) => logger.error({ err }, "Failed to send incentives notification to contractor"));
    }

    if (profile && cd.email && cd.email.includes("@")) {
      sendWidgetClientConfirmationEmail({
        toEmail: cd.email,
        userId: quote.userId,
        companyLogoUrl: profile.logoUrl ?? null,
        clientName: cd.nome || "Cliente",
        companyName: profile.companyName,
        companyPhone: profile.phone ?? null,
        companyEmail: profile.email ?? null,
        prezzoMinimo,
        prezzoMassimo,
        incentivesSummary: riepilogoIncentivi(result, { perImpresa: false }),
      }).catch((err) => logger.error({ err }, "Failed to send incentives confirmation to client"));
    }

    res.json({
      success: true,
      quoteId,
      totaleLavori: result.totaleLavori,
      scontoIvaStimato: result.scontoIvaStimato,
      bonusStataleApplicato: result.incentivesData.bonusStataleApplicato,
      bonusStataleHumanVerified: result.bonusStataleHumanVerified,
      bandoRegionaleApplicato: result.incentivesData.bandoRegionaleApplicato,
      bandoRegionaleHumanVerified: result.bandoRegionaleHumanVerified,
      esborsoImmediatoStimato: result.esborsoImmediatoStimato,
      detrazioneFiscaleDecennale: result.detrazioneFiscaleDecennale,
      detrazioneFiscaleAnnua: result.detrazioneFiscaleAnnua,
    });
  } catch (err) {
    logger.error({ err }, "Error calculating incentives for quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
