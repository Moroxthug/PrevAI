import type { IncentiveCatalogItem } from "@workspace/db";

// Parole chiave → categoriaIntervento del catalogo (valori v1). Volutamente
// semplice e deterministico (nessuna chiamata AI): basta a restringere il
// testo libero di un preventivo alle categorie usate dal catalogo senza
// aggiungere costo o latenza alla generazione. Un preventivo può ricadere in
// più categorie ("nuovi infissi e cappotto termico").
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  efficienza_energetica: ["pompa di calore", "pompe di calore", "cappotto", "isolamento termico", "coibent", "infissi", "serramenti", "finestre", "caldaia a condensazione", "solare termico", "fotovoltaic", "pannelli solari", "riqualificazione energetica", "efficientamento", "classe energetica", "climatizzazione", "termostato"],
  barriere_architettoniche: ["barriere architettoniche", "rampa", "montascale", "servoscala", "ascensore", "piattaforma elevatrice", "doccia a filo pavimento", "doccia filo pavimento", "maniglioni", "allargamento porte", "accessibilit", "disabil"],
  bagno: ["bagno", "sanitari", "box doccia", "vasca"],
  elettrico: ["impianto elettrico", "quadro elettrico", "punti luce", "cablaggio", "domotica"],
  idraulico: ["impianto idraulico", "tubazioni", "scarichi", "idraulic"],
  cartongesso: ["cartongesso", "controsoffitt", "contropareti"],
  pavimenti: ["pavimento", "pavimenti", "piastrelle", "parquet", "gres", "massetto"],
  tinteggiatura: ["tinteggiatura", "imbiancatura", "pittura", "rasatura", "verniciatura"],
  ristrutturazione: ["ristrutturazione", "manutenzione straordinaria", "demolizione", "muratura", "opere murarie", "rifacimento", "tetto", "copertura", "facciata", "cucina", "ampliamento"],
};

/**
 * Deduce le categorie d'intervento di un preventivo dal suo testo (descrizione
 * generale, titoli dei capitoli, voci). Restituisce [] quando non riconosce
 * nulla: chi chiama include comunque le voci di catalogo "tutti".
 */
export function inferInterventionCategories(text: string): string[] {
  const haystack = text.toLowerCase();
  const matched: string[] = [];
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => haystack.includes(kw))) matched.push(category);
  }
  return matched;
}

/**
 * Compatibilità categoria richiesta ↔ categoria di catalogo (regole del
 * `GET /api/public/incentives` v1): "tutti" e "ristrutturazione" valgono per
 * ogni lavoro; i lavori impiantistici/completi rientrano nell'efficienza
 * energetica; bagno e barriere nel bonus barriere architettoniche.
 */
export function categoryMatches(requested: string, catalog: string): boolean {
  if (catalog === "tutti" || catalog === requested) return true;
  if (["efficienza_energetica", "completa", "elettrico", "idraulico"].includes(requested)) {
    return catalog === "efficienza_energetica" || catalog === "ristrutturazione";
  }
  if (requested === "bagno" || requested === "barriere" || requested === "barriere_architettoniche") {
    return catalog === "barriere_architettoniche" || catalog === "ristrutturazione";
  }
  return catalog === "ristrutturazione";
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Confronto tollerante fra nomi di regione/comune ("Emilia Romagna" ~ "Emilia-Romagna", "comune di Milano" ~ "Milano"). */
export function placeMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a).replace(/[-\s]+/g, " ");
  const y = norm(b).replace(/[-\s]+/g, " ");
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export interface IncentiveMatchCriteria {
  regione: string | null;
  comune?: string | null;
  categories: string[];
}

/**
 * Filtra il catalogo sui programmi pertinenti a un preventivo: non chiusi,
 * territorialmente compatibili (statali ovunque; regionali sulla regione del
 * cantiere; comunali sul comune o, in mancanza, sulla regione) e compatibili
 * per categoria (le voci "tutti" valgono sempre; le altre devono incrociare
 * una categoria dedotta dal preventivo).
 */
export function matchIncentivesForQuote(
  catalog: IncentiveCatalogItem[],
  criteria: IncentiveMatchCriteria,
): IncentiveCatalogItem[] {
  const categories = criteria.categories.length ? criteria.categories : ["ristrutturazione"];

  return catalog.filter((item) => {
    if (item.stato === "closed") return false;

    if (item.level === "regionale") {
      if (!criteria.regione || !placeMatches(item.regione, criteria.regione)) return false;
    } else if (item.level === "comunale") {
      const byComune = criteria.comune ? placeMatches(item.comune, criteria.comune) : false;
      const byRegione = !criteria.comune && criteria.regione ? placeMatches(item.regione, criteria.regione) : false;
      if (!byComune && !byRegione) return false;
    }

    return categories.some((c) => categoryMatches(c, item.categoriaIntervento));
  });
}
