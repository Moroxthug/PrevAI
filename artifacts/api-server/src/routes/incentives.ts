import { Router } from "express";
import { db, incentivesCatalogTable, quotesTable, businessProfilesTable } from "@workspace/db";
import { eq, and, ne, or, desc, lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireAdmin } from "./admin.js";
import { sendWidgetLeadNotification, sendWidgetClientConfirmationEmail } from "../lib/email.js";
import { runIncentivesVerification } from "../lib/incentivesVerification.js";

const router = Router();

// I bandi "a fondo perduto" esauriscono i fondi ed hanno una scadenza (sportello):
// una volta superata, senza intervento umano restano marcati "active" per sempre.
// Qui li chiudiamo automaticamente in base al campo scadenza, così lo stato riflette
// almeno la data nota anche se nessuno passa a controllarli manualmente.
async function closeExpiredIncentives() {
  await db
    .update(incentivesCatalogTable)
    .set({ stato: "closed" })
    .where(and(lt(incentivesCatalogTable.scadenza, new Date()), ne(incentivesCatalogTable.stato, "closed")));
}

// Funzione di seeder automatico per garantire che il catalogo contenga sempre incentivi statali, regionali e comunali
async function ensureDefaultIncentives() {
  await closeExpiredIncentives();

  const existingCount = await db.select().from(incentivesCatalogTable);
  if (existingCount.length > 0) return;

  logger.info("Seeding default incentives catalog (Statali, Regionali, Comunali)...");
  await db.insert(incentivesCatalogTable).values([
    {
      level: "statale",
      codice: "BONUS_CASA_50",
      titolo: "Bonus Ristrutturazione Edilizia 50%",
      descrizione: "Detrazione fiscale del 50% in 10 quote annuali di pari importo per interventi di manutenzione straordinaria e ristrutturazione edilizia residenziale.",
      regione: null,
      comune: null,
      categoriaIntervento: "tutti",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "50.00",
      massimaleSpesa: "96000.00",
      massimaleContributo: "48000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.agenziaentrate.gov.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "ECOBONUS_65",
      titolo: "Ecobonus Riqualificazione Energetica 65%",
      descrizione: "Detrazione IRPEF/IRES fino al 65% in 10 anni per interventi di miglioramento energetico (cappotto termico, sostituzione infissi, pompe di calore, solare termico).",
      regione: null,
      comune: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "65.00",
      massimaleSpesa: "100000.00",
      massimaleContributo: "65000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.enea.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "CONTO_TERMICO_30",
      titolo: "Conto Termico GSE (Incentivo Diretto in Conto Capitale)",
      descrizione: "Rimborso diretto sul conto corrente bancario entro 90 giorni dal GSE fino al 65% della spesa per la sostituzione di impianti di climatizzazione invernale con pompe di calore o solare termico.",
      regione: null,
      comune: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "conto_termico_gse",
      percentualeMassima: "65.00",
      massimaleSpesa: "50000.00",
      massimaleContributo: "15000.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.gse.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "statale",
      codice: "BARRIERE_75",
      titolo: "Bonus Abbattimento Barriere Architettoniche 75%",
      descrizione: "Detrazione del 75% per lavori finalizzati all'eliminazione delle barriere architettoniche in edifici esistenti (adeguamento bagni con doccia filo pavimento, allargamento porte, rampe, ascensori).",
      regione: null,
      comune: null,
      categoriaIntervento: "barriere_architettoniche",
      tipoAgevolazione: "detrazione_10_anni",
      percentualeMassima: "75.00",
      massimaleSpesa: "50000.00",
      massimaleContributo: "37500.00",
      stato: "active",
      fonteUfficialeUrl: "https://www.agenziaentrate.gov.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "LOMBARDIA_EFF_2026",
      titolo: "Bando Efficienza Energetica e Riscaldamento Regione Lombardia 2026",
      descrizione: "Contributo a fondo perduto fino a 5.000 € a sportello per cittadini residenti in Lombardia che effettuano interventi di efficientamento energetico (+2 classi o installazione pompe di calore).",
      regione: "Lombardia",
      comune: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "50.00",
      massimaleSpesa: "20000.00",
      massimaleContributo: "5000.00",
      requisitiIseeMax: "45000.00",
      // Data indicativa di chiusura sportello (placeholder, da confermare: vedi punto 3
      // del TODO). Senza scadenza il bando non può mai essere auto-marcato "closed"
      // quando i fondi a sportello si esauriscono.
      scadenza: new Date("2026-12-31T23:59:59Z"),
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.lombardia.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "PIEMONTE_CALDAIE",
      titolo: "Bando Sostituzione Impianti Termici Regione Piemonte",
      descrizione: "Contributo regionale a fondo perduto fino a 3.500 € cumulabile con Conto Termico per rottamazione vecchi generatori e installazione di pompe di calore ad alta efficienza.",
      regione: "Piemonte",
      comune: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "40.00",
      massimaleSpesa: "15000.00",
      massimaleContributo: "3500.00",
      scadenza: new Date("2026-12-31T23:59:59Z"), // placeholder, da confermare (vedi punto 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.piemonte.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "EMILIA_SOLARE",
      titolo: "Bando Solare e Rinnovabili per Residenziale Emilia-Romagna",
      descrizione: "Incentivo a fondo perduto per l'installazione di sistemi fotovoltaici e accumulo su edifici residenziali in Emilia-Romagna.",
      regione: "Emilia-Romagna",
      comune: null,
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "40.00",
      massimaleSpesa: "12000.00",
      massimaleContributo: "4000.00",
      scadenza: new Date("2026-11-30T23:59:59Z"), // placeholder, da confermare (vedi punto 3)
      stato: "active",
      fonteUfficialeUrl: "https://energia.regione.emilia-romagna.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "regionale",
      codice: "VENETO_BORGHI",
      titolo: "Bando Rigenerazione e Ristrutturazione Sostenibile Veneto 2026",
      descrizione: "Contributo a fondo perduto per la riqualificazione di immobili residenziali nei comuni e borghi del Veneto ad alta valenza storico-ambientale.",
      regione: "Veneto",
      comune: null,
      categoriaIntervento: "ristrutturazione",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "35.00",
      massimaleSpesa: "25000.00",
      massimaleContributo: "4500.00",
      scadenza: new Date("2026-12-31T23:59:59Z"), // placeholder, da confermare (vedi punto 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.regione.veneto.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "comunale",
      codice: "MILANO_FACCIATE_2026",
      titolo: "Bando Comune di Milano - Rinnovo Facciate ed Efficienza Condominiale/Residenziale",
      descrizione: "Incentivo comunale a sportello fino a 3.000 € per interventi di isolamento termico e ripristino facciate nel territorio del Comune di Milano.",
      regione: "Lombardia",
      comune: "Milano",
      categoriaIntervento: "tutti",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "30.00",
      massimaleSpesa: "15000.00",
      massimaleContributo: "3000.00",
      scadenza: new Date("2026-10-31T23:59:59Z"), // placeholder, da confermare (vedi punto 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.comune.milano.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
    {
      level: "comunale",
      codice: "BOLOGNA_GREEN",
      titolo: "Bando Verde Urbano e Resilienza Energetica Comune di Bologna",
      descrizione: "Contributo fino a 2.500 € a fondo perduto per infissi ad alto isolamento, coperture verdi e riduzione dell'isola di calore urbana.",
      regione: "Emilia-Romagna",
      comune: "Bologna",
      categoriaIntervento: "efficienza_energetica",
      tipoAgevolazione: "fondo_perduto",
      percentualeMassima: "35.00",
      massimaleSpesa: "10000.00",
      massimaleContributo: "2500.00",
      scadenza: new Date("2026-12-15T23:59:59Z"), // placeholder, da confermare (vedi punto 3)
      stato: "active",
      fonteUfficialeUrl: "https://www.comune.bologna.it",
      // Dati placeholder inseriti al primo avvio, mai controllati contro le fonti
      // ufficiali: isVerifiedByAi parte a false e lastCheckedAt a null così il
      // primo giro del cron (vedi lib/incentivesVerification.ts) li tratta come
      // non ancora verificati, invece di dichiararli falsamente già confermati.
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
  ]);
}

// GET /api/public/incentives - Restituisce gli incentivi attivi filtrati per regione/comune/categoria
router.get("/public/incentives", async (req, res) => {
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

    // Filtra lato server per massima flessibilità
    const filtered = allIncentives.filter(inc => {
      // Filtro per livello e zona
      if (inc.level === "statale") return true;
      if (inc.level === "regionale") {
        if (!regioneParam) return true;
        return inc.regione?.toLowerCase().includes(regioneParam.toLowerCase()) ||
               regioneParam.toLowerCase().includes(inc.regione?.toLowerCase() || "");
      }
      if (inc.level === "comunale") {
        if (!comuneParam && !regioneParam) return true;
        const matchComune = comuneParam && inc.comune?.toLowerCase().includes(comuneParam.toLowerCase());
        const matchRegione = regioneParam && inc.regione?.toLowerCase().includes(regioneParam.toLowerCase());
        return matchComune || matchRegione;
      }
      return true;
    }).filter(inc => {
      // Filtro per categoria
      if (!categoriaParam || inc.categoriaIntervento === "tutti") return true;
      if (categoriaParam === "efficienza_energetica" || categoriaParam === "completa" || categoriaParam === "elettrico" || categoriaParam === "idraulico") {
        return inc.categoriaIntervento === "efficienza_energetica" || inc.categoriaIntervento === "tutti" || inc.categoriaIntervento === "ristrutturazione";
      }
      if (categoriaParam === "bagno" || categoriaParam === "barriere") {
        return inc.categoriaIntervento === "barriere_architettoniche" || inc.categoriaIntervento === "tutti" || inc.categoriaIntervento === "ristrutturazione";
      }
      return inc.categoriaIntervento === "ristrutturazione" || inc.categoriaIntervento === "tutti";
    });

    res.json({
      success: true,
      count: filtered.length,
      incentives: filtered,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching public incentives");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/public/quotes/:quoteId/incentives - Calcola i bonus sul preventivo e aggiorna il lead
router.post("/public/quotes/:quoteId/incentives", async (req, res) => {
  try {
    const quoteId = req.params.quoteId;
    const apiKeyHeader = req.headers["x-api-key"] || req.query.apiKey;
    
    // Trova il preventivo
    const [quote] = await db
      .select()
      .from(quotesTable)
      .where(eq(quotesTable.id, quoteId));

    if (!quote) {
      res.status(404).json({ error: "Preventivo non trovato." });
      return;
    }

    const {
      tipoImmobile = "prima_casa",
      obiettivoLavori = "ristrutturazione",
      fasciaIsee = "sopra_30k",
      regione = "",
      cap = "",
      totalePreventivo,
    } = req.body;

    const totaleLavori = Number(totalePreventivo) || Number(quote.totale) || 0;

    // 1. Calcolo Sconto IVA Agevolata (10% per residenziale prima/seconda casa vs 22% ordinaria)
    const isResidenziale = tipoImmobile === "prima_casa" || tipoImmobile === "seconda_casa" || tipoImmobile === "condominio";
    const scontoIvaStimato = isResidenziale ? Math.round(totaleLavori * 0.10) : 0; // Risparmio netto ~10% sull'imponibile

    // 2. Calcolo Bonus Statale compatibile
    // La detrazione IRPEF su cui si basano Ristrutturazione/Ecobonus è riservata
    // alle persone fisiche su immobili ad uso abitativo: un ufficio/immobile
    // commerciale non rientra. Tra prima e seconda casa l'aliquota piena si
    // applica solo alla prima casa/condominio; sulla seconda casa è ridotta
    // (aliquota indicativa, da confermare quando si formalizzano le regole
    // normative reali — vedi punto 3 del TODO). Il bonus barriere architettoniche
    // resta invece invariato: la normativa non lo limita alla sola prima casa.
    const isUfficio = tipoImmobile === "ufficio";
    const isSecondaCasa = tipoImmobile === "seconda_casa";

    let bonusStataleApplicato = "Bonus Ristrutturazione Edilizia 50% (Detrazione 10 anni)";
    let bonusStataleCodice = "BONUS_CASA_50";
    let percentualeBonusStatale = 0.50;
    let percentualeSecondaCasa = 0.36;

    if (obiettivoLavori === "efficienza" || obiettivoLavori === "efficienza_energetica") {
      bonusStataleApplicato = "Ecobonus 65% / Conto Termico GSE (Incentivo Diretto)";
      bonusStataleCodice = "ECOBONUS_65";
      percentualeBonusStatale = 0.65;
      percentualeSecondaCasa = 0.50;
    } else if (obiettivoLavori === "barriere" || obiettivoLavori === "barriere_architettoniche") {
      bonusStataleApplicato = "Bonus Abbattimento Barriere Architettoniche 75%";
      bonusStataleCodice = "BARRIERE_75";
      percentualeBonusStatale = 0.75;
      percentualeSecondaCasa = 0.75; // la normativa non riduce questo bonus per seconda casa
    }

    const bonusBarriere = bonusStataleCodice === "BARRIERE_75";
    if (isUfficio && !bonusBarriere) {
      bonusStataleApplicato = `${bonusStataleApplicato} — non applicabile: detrazione riservata a immobili ad uso abitativo`;
      percentualeBonusStatale = 0;
    } else if (isSecondaCasa && !bonusBarriere) {
      percentualeBonusStatale = percentualeSecondaCasa;
      bonusStataleApplicato = `${bonusStataleApplicato} — aliquota ridotta ${Math.round(percentualeSecondaCasa * 100)}% per seconda casa`;
    }

    let importoBonusStatale = Math.round(totaleLavori * percentualeBonusStatale);

    // Limita al massimale standard
    if (importoBonusStatale > 48000) importoBonusStatale = 48000;

    // 3. Match con Bando Regionale o Comunale
    await ensureDefaultIncentives();
    const allIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    // Stato di verifica del bonus statale applicato: riflette se un admin
    // ha controllato a mano la relativa voce di catalogo (vedi humanVerified).
    const bonusStataleRecord = allIncentives.find(inc => inc.codice === bonusStataleCodice);
    const bonusStataleHumanVerified = bonusStataleRecord?.humanVerified ?? false;

    let bandoRegionaleApplicato = "Nessun bando regionale a sportello specifico individuato (si applicano i Bonus Statali)";
    let importoBandoRegionale = 0;
    let bandoRegionaleHumanVerified: boolean | null = null;

    if (regione || cap) {
      const matchReg = allIncentives.find(inc =>
        (inc.level === "regionale" || inc.level === "comunale") &&
        ((regione && inc.regione?.toLowerCase().includes(regione.toLowerCase())) ||
         (regione && regione.toLowerCase().includes(inc.regione?.toLowerCase() || "")) ||
         (inc.comune && cap.startsWith("20") && inc.comune.toLowerCase() === "milano") ||
         (inc.comune && cap.startsWith("40") && inc.comune.toLowerCase() === "bologna"))
      );

      if (matchReg) {
        bandoRegionaleApplicato = `${matchReg.titolo} (${matchReg.tipoAgevolazione === 'fondo_perduto' ? 'Fondo Perduto' : 'Contributo'})`;
        importoBandoRegionale = Number(matchReg.massimaleContributo) || 3000;
        bandoRegionaleHumanVerified = matchReg.humanVerified;
        if (fasciaIsee === "sotto_30k") {
          importoBandoRegionale = Math.round(importoBandoRegionale * 1.25); // Maggiorazione sociale ISEE
        }
      }
    }

    // Esborso immediato: solo ciò che riduce davvero il pagamento in fase di lavori
    // (fondo perduto e IVA agevolata). Le detrazioni fiscali si recuperano in 10 anni
    // di dichiarazione dei redditi e NON vanno sottratte come sconto cassa.
    const esborsoImmediatoStimato = Math.max(0, Math.round(totaleLavori - importoBandoRegionale - scontoIvaStimato));
    const detrazioneFiscaleAnnua = Math.round(importoBonusStatale / 10);

    const incentivesData = {
      tipoImmobile,
      obiettivoLavori,
      fasciaIsee,
      regione,
      cap,
      bonusStataleApplicato: `${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")})`,
      bonusStataleHumanVerified,
      bandoRegionaleApplicato: importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : bandoRegionaleApplicato,
      bandoRegionaleHumanVerified,
      scontoIvaStimato,
      esborsoImmediatoStimato,
      detrazioneFiscaleDecennale: importoBonusStatale,
      detrazioneFiscaleAnnua,
    };

    // Aggiorna il preventivo con le risposte incentivi
    const currentClientData = quote.clientData || { nome: "", indirizzo: "" };
    const updatedClientData = {
      ...currentClientData,
      incentivesData,
    };

    await db
      .update(quotesTable)
      .set({
        clientData: updatedClientData,
        updatedAt: new Date(),
      })
      .where(eq(quotesTable.id, quoteId));

    // Notifica email all'impresa (se abbiamo trovato l'email del partner)
    const [profile] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.userId, quote.userId));

    if (profile && profile.email) {
      sendWidgetLeadNotification({
        toEmail: profile.email,
        companyName: profile.companyName,
        clientName: currentClientData.nome || "Lead Widget",
        clientEmail: currentClientData.email || "Nessuna email fornita",
        clientPhone: currentClientData.phone || "Nessun telefono fornito",
        rawInput: quote.rawInput || "",
        totale: quote.totale,
        prezzoMinimo: (Number(quote.totale) * 0.9).toFixed(2),
        prezzoMassimo: (Number(quote.totale) * 1.25).toFixed(2),
        incentivesSummary: `🏛️ STIMA PRELIMINARE AGEVOLAZIONI (da confermare in sede di sopralluogo tecnico e fiscale):\n` +
          `• Immobile: ${tipoImmobile} | Obiettivo: ${obiettivoLavori} | ISEE: ${fasciaIsee}\n` +
          `• Bonus Statale Compatibile: ${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")}, detrazione IRPEF in 10 quote annuali da ~€${detrazioneFiscaleAnnua.toLocaleString("it-IT")})\n` +
          `• Bando Regionale/Comunale: ${importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : 'Nessuno a sportello'}\n` +
          `• Risparmio IVA 10%: ~€${scontoIvaStimato.toLocaleString("it-IT")}\n` +
          `👉 ESBORSO IMMEDIATO STIMATO (esclusa detrazione, recuperata in 10 anni): ~€${esborsoImmediatoStimato.toLocaleString("it-IT")}`
      }).catch(err => {
        logger.error({ err }, "Failed to send updated incentives email notification to contractor");
      });
    }

    // Notifica email al cliente finale, se ha fornito un indirizzo, con il riepilogo incentivi incluso
    const clientEmail = currentClientData.email;
    if (clientEmail && clientEmail.includes("@") && profile) {
      sendWidgetClientConfirmationEmail({
        toEmail: clientEmail,
        clientName: currentClientData.nome || "Cliente",
        companyName: profile.companyName,
        companyPhone: profile.phone ?? null,
        companyEmail: profile.email ?? null,
        prezzoMinimo: (Number(quote.totale) * 0.9).toFixed(2),
        prezzoMassimo: (Number(quote.totale) * 1.25).toFixed(2),
        incentivesSummary: `Immobile: ${tipoImmobile} | Obiettivo: ${obiettivoLavori}\n` +
          `• Bonus Statale Compatibile: ${bonusStataleApplicato} (~€${importoBonusStatale.toLocaleString("it-IT")}, detrazione IRPEF in 10 quote annuali da ~€${detrazioneFiscaleAnnua.toLocaleString("it-IT")})\n` +
          `• Bando Regionale/Comunale: ${importoBandoRegionale > 0 ? `${bandoRegionaleApplicato} (~€${importoBandoRegionale.toLocaleString("it-IT")})` : 'Nessuno a sportello'}\n` +
          `• Risparmio IVA 10%: ~€${scontoIvaStimato.toLocaleString("it-IT")}\n` +
          `• Esborso immediato stimato (esclusa detrazione, recuperata in 10 anni): ~€${esborsoImmediatoStimato.toLocaleString("it-IT")}`,
      }).catch(err => {
        logger.error({ err }, "Failed to send incentives confirmation email to client");
      });
    }

    res.json({
      success: true,
      quoteId,
      totaleLavori,
      scontoIvaStimato,
      bonusStataleApplicato: incentivesData.bonusStataleApplicato,
      bonusStataleHumanVerified,
      bandoRegionaleApplicato: incentivesData.bandoRegionaleApplicato,
      bandoRegionaleHumanVerified,
      esborsoImmediatoStimato,
      detrazioneFiscaleDecennale: importoBonusStatale,
      detrazioneFiscaleAnnua,
    });
  } catch (err) {
    logger.error({ err }, "Error calculating incentives for quote");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================================
// ROTTE ADMIN PER LA GESTIONE E CRON AI
// ==========================================

// GET /api/admin/incentives - Lista completa per la dashboard admin
router.get("/admin/incentives", requireAdmin, async (_req, res) => {
  try {
    await ensureDefaultIncentives();
    const list = await db
      .select()
      .from(incentivesCatalogTable)
      .orderBy(incentivesCatalogTable.level, incentivesCatalogTable.titolo);
    res.json({ success: true, count: list.length, incentives: list });
  } catch (err) {
    logger.error({ err }, "Error fetching admin incentives catalog");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/incentives - Aggiunta manuale o custom di un bando
router.post("/admin/incentives", requireAdmin, async (req, res) => {
  try {
    const {
      level = "regionale",
      codice,
      titolo,
      descrizione,
      regione = null,
      comune = null,
      categoriaIntervento = "tutti",
      tipoAgevolazione = "fondo_perduto",
      percentualeMassima = "50.00",
      massimaleSpesa = null,
      massimaleContributo = null,
      requisitiIseeMax = null,
      stato = "active",
      fonteUfficialeUrl = null,
    } = req.body;

    if (!codice || !titolo || !descrizione) {
      res.status(400).json({ error: "I campi codice, titolo e descrizione sono obbligatori." });
      return;
    }

    const [inserted] = await db
      .insert(incentivesCatalogTable)
      .values({
        level,
        codice,
        titolo,
        descrizione,
        regione,
        comune,
        categoriaIntervento,
        tipoAgevolazione,
        percentualeMassima: String(percentualeMassima),
        massimaleSpesa: massimaleSpesa ? String(massimaleSpesa) : null,
        massimaleContributo: massimaleContributo ? String(massimaleContributo) : null,
        requisitiIseeMax: requisitiIseeMax ? String(requisitiIseeMax) : null,
        stato,
        fonteUfficialeUrl,
        isVerifiedByAi: false,
      })
      .returning();

    res.status(201).json({ success: true, incentive: inserted });
  } catch (err) {
    logger.error({ err }, "Error creating admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/incentives/:id - Modifica di un bando esistente
router.patch("/admin/incentives/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      level,
      codice,
      titolo,
      descrizione,
      regione,
      comune,
      categoriaIntervento,
      tipoAgevolazione,
      percentualeMassima,
      massimaleSpesa,
      massimaleContributo,
      requisitiIseeMax,
      stato,
      fonteUfficialeUrl,
      humanVerified,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (level !== undefined) updates.level = level;
    if (codice !== undefined) updates.codice = codice;
    if (titolo !== undefined) updates.titolo = titolo;
    if (descrizione !== undefined) updates.descrizione = descrizione;
    if (regione !== undefined) updates.regione = regione;
    if (comune !== undefined) updates.comune = comune;
    if (categoriaIntervento !== undefined) updates.categoriaIntervento = categoriaIntervento;
    if (tipoAgevolazione !== undefined) updates.tipoAgevolazione = tipoAgevolazione;
    if (percentualeMassima !== undefined) updates.percentualeMassima = String(percentualeMassima);
    if (massimaleSpesa !== undefined) updates.massimaleSpesa = massimaleSpesa ? String(massimaleSpesa) : null;
    if (massimaleContributo !== undefined) updates.massimaleContributo = massimaleContributo ? String(massimaleContributo) : null;
    if (requisitiIseeMax !== undefined) updates.requisitiIseeMax = requisitiIseeMax ? String(requisitiIseeMax) : null;
    if (stato !== undefined) updates.stato = stato;
    if (fonteUfficialeUrl !== undefined) updates.fonteUfficialeUrl = fonteUfficialeUrl;
    // humanVerified: unico modo per marcare un bando come controllato a mano
    // da un admin contro la fonte ufficiale (a differenza di isVerifiedByAi,
    // che riflette solo l'esito euristico del cron AI).
    if (humanVerified !== undefined) updates.humanVerified = Boolean(humanVerified);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nessun campo da aggiornare." });
      return;
    }

    const [updated] = await db
      .update(incentivesCatalogTable)
      .set(updates)
      .where(eq(incentivesCatalogTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Bando non trovato." });
      return;
    }

    res.json({ success: true, incentive: updated });
  } catch (err) {
    logger.error({ err }, "Error updating admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/incentives/:id - Eliminazione di un bando
router.delete("/admin/incentives/:id", requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await db.delete(incentivesCatalogTable).where(eq(incentivesCatalogTable.id, id));
    res.json({ success: true, deletedId: id });
  } catch (err) {
    logger.error({ err }, "Error deleting admin incentive");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/incentives/cron-sync - Esegue il Daily AI Incentive Agent (Verifica e Aggiornamento)
router.post("/admin/incentives/cron-sync", requireAdmin, async (_req, res) => {
  try {
    logger.info("Executing Daily AI Incentive Agent verification...");
    await ensureDefaultIncentives();

    const activeIncentives = await db
      .select()
      .from(incentivesCatalogTable)
      .where(ne(incentivesCatalogTable.stato, "closed"));

    const outcome = await runIncentivesVerification(activeIncentives);

    res.json({
      success: true,
      verifiedCount: outcome.updatedCount,
      sourcesFetched: outcome.sourcesFetched,
      sourcesTotal: outcome.sourcesTotal,
      summary: outcome.summary,
      disclaimer: outcome.disclaimer,
    });
  } catch (err) {
    logger.error({ err }, "Error running daily AI incentive sync");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
