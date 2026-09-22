import { db, incentivesCatalogTable } from "@workspace/db";
import { and, lt, ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── Catalogo di default e chiusura automatica (v1) ───────────────────────────
// I bandi "a fondo perduto" esauriscono i fondi ed hanno una scadenza (sportello):
// una volta superata, senza intervento umano resterebbero "active" per sempre.
// Qui li chiudiamo in base al campo scadenza, così lo stato riflette almeno la
// data nota anche se nessuno passa a controllarli a mano.
export async function closeExpiredIncentives(): Promise<number> {
  const rows = await db
    .update(incentivesCatalogTable)
    .set({ stato: "closed" })
    .where(and(lt(incentivesCatalogTable.scadenza, new Date()), ne(incentivesCatalogTable.stato, "closed")))
    .returning({ id: incentivesCatalogTable.id });
  return rows.length;
}

// Seeder: garantisce che il catalogo contenga sempre i bonus statali e qualche
// bando regionale/comunale di esempio. In produzione le 10 righe esistono già
// (dump v1): il seed scatta solo su un DB vuoto (staging/e2e).
export async function ensureDefaultIncentives(): Promise<void> {
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
      // Placeholder mai controllati contro le fonti ufficiali: isVerifiedByAi=false e
      // lastCheckedAt=null così il primo giro del cron (verification.ts) li tratta
      // come non ancora verificati.
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
      isVerifiedByAi: false,
      lastCheckedAt: null,
      humanVerified: false,
    },
  ]);
}
