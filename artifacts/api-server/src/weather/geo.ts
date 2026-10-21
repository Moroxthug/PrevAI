// Dove sono un'impresa o un cantiere, alla città: il capoluogo di ogni provincia italiana con le sue coordinate. QuoteAI usa le circa 850 località delle previsioni di
// Environment Canada; in Italia basta il capoluogo (il meteo serve per decidere se lavorare fuori, non al metro). Nessun servizio di geocodifica: l'indirizzo nomina la
// città o la sigla della provincia, e il cantiere ha la sua provincia. Le coordinate così trovate NON si scrivono sul cantiere: in PrevAI `projects.latitude/longitude`
// è il punto preciso messo a mano (serve anche al recinto delle timbrature) e il capoluogo lo falserebbe.

import { normalizeProvince } from "@workspace/config";

export type Site = { id: string; name: string; prov: string; lat: number; lon: number };

// [sigla, capoluogo, lat, lon, altri nomi della stessa provincia con le loro coordinate]
const CAPOLUOGHI: Array<[string, string, number, number, Array<[string, number, number]>?]> = [
  ["AG", "Agrigento", 37.31, 13.58], ["AL", "Alessandria", 44.91, 8.61], ["AN", "Ancona", 43.62, 13.52], ["AO", "Aosta", 45.74, 7.32],
  ["AR", "Arezzo", 43.46, 11.88], ["AP", "Ascoli Piceno", 42.85, 13.58], ["AT", "Asti", 44.9, 8.21], ["AV", "Avellino", 40.91, 14.79],
  ["BA", "Bari", 41.12, 16.87], ["BT", "Barletta", 41.32, 16.28, [["Andria", 41.23, 16.29], ["Trani", 41.28, 16.42]]], ["BL", "Belluno", 46.14, 12.22],
  ["BN", "Benevento", 41.13, 14.78], ["BG", "Bergamo", 45.7, 9.67], ["BI", "Biella", 45.57, 8.05], ["BO", "Bologna", 44.49, 11.34],
  ["BZ", "Bolzano", 46.5, 11.35], ["BS", "Brescia", 45.54, 10.22], ["BR", "Brindisi", 40.63, 17.94], ["CA", "Cagliari", 39.22, 9.12],
  ["CL", "Caltanissetta", 37.49, 14.06], ["CB", "Campobasso", 41.56, 14.66], ["CE", "Caserta", 41.07, 14.33], ["CT", "Catania", 37.5, 15.09],
  ["CZ", "Catanzaro", 38.91, 16.59], ["CH", "Chieti", 42.35, 14.17], ["CO", "Como", 45.81, 9.09], ["CS", "Cosenza", 39.3, 16.25],
  ["CR", "Cremona", 45.13, 10.02], ["KR", "Crotone", 39.08, 17.13], ["CN", "Cuneo", 44.38, 7.54], ["EN", "Enna", 37.57, 14.28],
  ["FM", "Fermo", 43.16, 13.72], ["FE", "Ferrara", 44.84, 11.62], ["FI", "Firenze", 43.77, 11.25], ["FG", "Foggia", 41.46, 15.55],
  ["FC", "Forlì", 44.22, 12.04, [["Cesena", 44.14, 12.24]]], ["FR", "Frosinone", 41.64, 13.35], ["GE", "Genova", 44.41, 8.93], ["GO", "Gorizia", 45.94, 13.62],
  ["GR", "Grosseto", 42.76, 11.11], ["IM", "Imperia", 43.89, 8.03], ["IS", "Isernia", 41.59, 14.23], ["AQ", "L'Aquila", 42.35, 13.4],
  ["SP", "La Spezia", 44.1, 9.82], ["LT", "Latina", 41.47, 12.9], ["LE", "Lecce", 40.35, 18.17], ["LC", "Lecco", 45.86, 9.4],
  ["LI", "Livorno", 43.55, 10.31], ["LO", "Lodi", 45.31, 9.5], ["LU", "Lucca", 43.84, 10.5], ["MC", "Macerata", 43.3, 13.45],
  ["MN", "Mantova", 45.16, 10.79], ["MS", "Massa", 44.04, 10.14, [["Carrara", 44.08, 10.1]]], ["MT", "Matera", 40.67, 16.6], ["ME", "Messina", 38.19, 15.55],
  ["MI", "Milano", 45.46, 9.19], ["MO", "Modena", 44.65, 10.93], ["MB", "Monza", 45.58, 9.27], ["NA", "Napoli", 40.85, 14.27],
  ["NO", "Novara", 45.45, 8.62], ["NU", "Nuoro", 40.32, 9.33], ["OR", "Oristano", 39.9, 8.59], ["PD", "Padova", 45.41, 11.88],
  ["PA", "Palermo", 38.12, 13.36], ["PR", "Parma", 44.8, 10.33], ["PV", "Pavia", 45.19, 9.16], ["PG", "Perugia", 43.11, 12.39],
  ["PU", "Pesaro", 43.91, 12.91, [["Urbino", 43.73, 12.64]]], ["PE", "Pescara", 42.46, 14.21], ["PC", "Piacenza", 45.05, 9.69], ["PI", "Pisa", 43.72, 10.4],
  ["PT", "Pistoia", 43.93, 10.91], ["PN", "Pordenone", 45.96, 12.66], ["PZ", "Potenza", 40.64, 15.8], ["PO", "Prato", 43.88, 11.1],
  ["RG", "Ragusa", 36.93, 14.73], ["RA", "Ravenna", 44.42, 12.2], ["RC", "Reggio Calabria", 38.11, 15.65], ["RE", "Reggio Emilia", 44.7, 10.63],
  ["RI", "Rieti", 42.4, 12.86], ["RN", "Rimini", 44.06, 12.57], ["RM", "Roma", 41.9, 12.5], ["RO", "Rovigo", 45.07, 11.79],
  ["SA", "Salerno", 40.68, 14.77], ["SS", "Sassari", 40.73, 8.56], ["SV", "Savona", 44.31, 8.48], ["SI", "Siena", 43.32, 11.33],
  ["SR", "Siracusa", 37.08, 15.29], ["SO", "Sondrio", 46.17, 9.87], ["SU", "Carbonia", 39.17, 8.52, [["Iglesias", 39.31, 8.54]]], ["TA", "Taranto", 40.47, 17.24],
  ["TE", "Teramo", 42.66, 13.7], ["TR", "Terni", 42.56, 12.65], ["TO", "Torino", 45.07, 7.69], ["TP", "Trapani", 38.02, 12.51],
  ["TN", "Trento", 46.07, 11.12], ["TV", "Treviso", 45.67, 12.24], ["TS", "Trieste", 45.65, 13.78], ["UD", "Udine", 46.06, 13.24],
  ["VA", "Varese", 45.82, 8.83], ["VE", "Venezia", 45.44, 12.33, [["Mestre", 45.49, 12.24]]], ["VB", "Verbania", 45.92, 8.55], ["VC", "Vercelli", 45.32, 8.42],
  ["VR", "Verona", 45.44, 10.99], ["VV", "Vibo Valentia", 38.68, 16.1], ["VI", "Vicenza", 45.55, 11.55], ["VT", "Viterbo", 42.42, 12.11],
];

const SITES: Site[] = CAPOLUOGHI.flatMap(([prov, name, lat, lon, more], i) => [
  { id: String(i), name, prov, lat, lon },
  ...(more ?? []).map(([n, la, lo], j) => ({ id: `${i}.${j}`, name: n, prov, lat: la, lon: lo })),
]);

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Il capoluogo della provincia (sigla), o null. */
export function provinceCity(province: string | null): Site | null {
  const p = normalizeProvince(province);
  return p ? SITES.find((s) => s.prov === p && !s.id.includes(".")) ?? null : null;
}

/**
 * Il punto delle previsioni per un indirizzo: una città dell'elenco nominata nell'indirizzo (l'ultima, dopo la via; a pari posizione la più lunga), poi la sigla tra
 * parentesi o in fondo ("20100 Sesto San Giovanni (MI)"), poi la provincia data. `city` è il comune salvato a parte (la sede dell'impresa).
 */
export function siteFor(address: string | null, province: string | null, city?: string | null): Site | null {
  const text = ` ${fold([address, city].filter(Boolean).join(" "))} `;
  // With a province known, only its own towns count ("Via Roma 5" in a Milan company is not Rome).
  const prov = normalizeProvince(province);
  if (text.trim()) {
    let best: Site | null = null, bestEnd = -1, bestLen = 0;
    for (const s of SITES) {
      if (prov && s.prov !== prov) continue;
      const n = fold(s.name);
      if (n.length < 3) continue;
      const at = text.lastIndexOf(` ${n} `);
      if (at < 0) continue;
      const end = at + n.length;
      if (end > bestEnd || (end === bestEnd && n.length > bestLen)) { best = s; bestEnd = end; bestLen = n.length; }
    }
    if (best) return best;
    const sigla = /\(([A-Za-z]{2})\)|\b([A-Z]{2})\s*$/.exec((address ?? "").trim());
    const fromAddress = provinceCity(sigla?.[1] ?? sigla?.[2] ?? null);
    if (fromAddress) return fromAddress;
  }
  return provinceCity(province);
}

/** In Italia c'è un solo fuso. */
export const zoneOf = (_province?: string | null): string => "Europe/Rome";
