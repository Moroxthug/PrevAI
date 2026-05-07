import { CITIES } from "./seo-data.js";
import type { CityData } from "./seo-data.js";

export interface CityIntelligence {
  priceIndex: number;
  demandLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  topServices: [string, string, string];
  localInsight: string;
  avgLeadTime: string;
}

type Cluster = "nord-ovest" | "nord-est" | "centro" | "sud" | "isole";

const REGION_TO_CLUSTER: Record<string, Cluster> = {
  "Lombardia": "nord-ovest",
  "Piemonte": "nord-ovest",
  "Liguria": "nord-ovest",
  "Valle d'Aosta": "nord-ovest",
  "Veneto": "nord-est",
  "Emilia-Romagna": "nord-est",
  "Friuli-Venezia Giulia": "nord-est",
  "Trentino-Alto Adige": "nord-est",
  "Toscana": "centro",
  "Umbria": "centro",
  "Marche": "centro",
  "Lazio": "centro",
  "Abruzzo": "sud",
  "Molise": "sud",
  "Campania": "sud",
  "Puglia": "sud",
  "Basilicata": "sud",
  "Calabria": "sud",
  "Sicilia": "isole",
  "Sardegna": "isole",
};

const MAJOR_CITY_SLUGS = new Set([
  "milano", "roma", "napoli", "torino", "bologna",
  "firenze", "genova", "palermo", "bari", "catania", "venezia", "verona",
]);

interface ClusterProfile {
  priceIndexBase: number;
  demandBase: "LOW" | "MEDIUM" | "HIGH";
  topServicesPool: [string, string, string, string, string, string];
  insightTemplates: Array<(city: string, pct: number, dir: string, demand: string) => string>;
  avgLeadTimeBase: string;
  avgLeadTimeCapital: string;
}

const CLUSTER_PROFILES: Record<Cluster, ClusterProfile> = {
  "nord-ovest": {
    priceIndexBase: 1.15,
    demandBase: "HIGH",
    topServicesPool: [
      "Ristrutturazione completa",
      "Riqualificazione energetica (Ecobonus)",
      "Impianti domotici e smart home",
      "Ristrutturazione uffici e commerciale",
      "Sostituzione serramenti a taglio termico",
      "Impianti fotovoltaici",
    ],
    insightTemplates: [
      (city, pct, dir, demand) =>
        `${city} si colloca nel mercato premium del Nord Ovest: i prezzi medi sono il ${pct}% ${dir} alla media nazionale. Domanda di mercato ${demand}: la velocità di risposta con un preventivo professionale è il fattore competitivo chiave.`,
      (city, pct, dir, demand) =>
        `Nel distretto del Nord Ovest, ${city} registra una domanda di servizi edili e artigianali ${demand}. I prezzi — il ${pct}% ${dir} alla media — rispecchiano il potere d'acquisto superiore della clientela locale.`,
      (city, _p, _d, demand) =>
        `Il tessuto produttivo e residenziale di ${city} genera domanda ${demand} di interventi su immobili privati e commerciali. In questo mercato, professionalità e rapidità del preventivo sono fattori decisivi per vincere le commesse.`,
    ],
    avgLeadTimeBase: "3–5 giorni",
    avgLeadTimeCapital: "2–4 giorni",
  },
  "nord-est": {
    priceIndexBase: 1.08,
    demandBase: "HIGH",
    topServicesPool: [
      "Ristrutturazione bagno e cucina",
      "Installazione caldaie a condensazione",
      "Pavimenti in parquet e gres porcellanato",
      "Impianti di riscaldamento a pavimento",
      "Cappotto termico e isolamento",
      "Arredamento e falegnameria su misura",
    ],
    insightTemplates: [
      (city, pct, dir, demand) =>
        `${city} appartiene al mercato nord-orientale: alta densità di imprese artigiane, clientela tecnica esigente e prezzi il ${pct}% ${dir} alla media nazionale. Domanda ${demand}.`,
      (city, pct, dir, demand) =>
        `Nel Nord Est la domanda a ${city} è ${demand}, con forte attenzione alla qualità tecnica. I prezzi si attestano il ${pct}% ${dir} alla media: il preventivo dettagliato è un fattore di differenziazione competitivo.`,
      (city, _p, _d, demand) =>
        `Il sistema manifatturiero e artigianale di ${city} si traduce in una domanda ${demand} e in una clientela che valuta la qualità del preventivo come indicatore della professionalità del fornitore.`,
    ],
    avgLeadTimeBase: "4–6 giorni",
    avgLeadTimeCapital: "3–5 giorni",
  },
  "centro": {
    priceIndexBase: 0.98,
    demandBase: "MEDIUM",
    topServicesPool: [
      "Restauro e ristrutturazione patrimonio storico",
      "Ristrutturazione appartamenti",
      "Impianti fotovoltaici",
      "Tinteggiatura e rifinitura interni",
      "Rifacimento bagno e sanitari",
      "Pratiche edilizie e perizie tecniche",
    ],
    insightTemplates: [
      (city, pct, dir, demand) =>
        `${city} presenta un mix di domanda ${demand}: residenziale privata e interventi su patrimonio storico vincolato. I prezzi si posizionano il ${pct}% ${dir} alla media nazionale.`,
      (city, _p, _d, demand) =>
        `Il mercato di ${city} è caratterizzato da domanda ${demand} e da una componente significativa di ristrutturazioni incentivate dai bonus edilizi governativi (Superbonus, Bonus Casa).`,
      (city, pct, dir, demand) =>
        `Nel Centro Italia, ${city} registra una domanda ${demand} con picchi primaverili e autunnali. I prezzi — il ${pct}% ${dir} alla media — riflettono il tessuto economico locale e la forte presenza del patrimonio edilizio storico.`,
    ],
    avgLeadTimeBase: "5–7 giorni",
    avgLeadTimeCapital: "3–6 giorni",
  },
  "sud": {
    priceIndexBase: 0.84,
    demandBase: "MEDIUM",
    topServicesPool: [
      "Efficientamento energetico (Ecobonus)",
      "Ristrutturazione con Superbonus",
      "Adeguamento sismico",
      "Installazione impianti di climatizzazione",
      "Tinteggiatura e rifinitura",
      "Manutenzione ordinaria edifici",
    ],
    insightTemplates: [
      (city, pct, dir, demand) =>
        `${city} è un mercato con domanda ${demand} e prezzi mediamente il ${pct}% ${dir} alla media nazionale. Gli incentivi statali (Superbonus, Sismabonus) sono la principale leva della domanda.`,
      (city, _p, _d, demand) =>
        `Nel Sud Italia, il mercato di ${city} è sensibile al prezzo con domanda ${demand}. La competizione è alta e il preventivo professionale è lo strumento principale per differenziarsi dalla concorrenza informale.`,
      (city, pct, dir, demand) =>
        `La domanda a ${city} è ${demand} e trainata dagli incentivi per efficientamento energetico e adeguamento sismico. Prezzi il ${pct}% ${dir} alla media: il costo-efficienza è il fattore decisivo per il cliente.`,
    ],
    avgLeadTimeBase: "7–10 giorni",
    avgLeadTimeCapital: "5–8 giorni",
  },
  "isole": {
    priceIndexBase: 0.78,
    demandBase: "LOW",
    topServicesPool: [
      "Impermeabilizzazione terrazzi e tetti",
      "Ristrutturazione residenziale costiera",
      "Efficientamento energetico",
      "Installazione condizionatori",
      "Manutenzione impianti idraulici",
      "Rifacimento pavimenti e rivestimenti",
    ],
    insightTemplates: [
      (city, pct, dir, demand) =>
        `${city} presenta caratteristiche di mercato insulare: logistica più complessa e domanda ${demand}, con prezzi il ${pct}% ${dir} alla media nazionale.`,
      (city, _p, _d, demand) =>
        `Il mercato edilizio di ${city} è influenzato dalla stagionalità turistica e da costi logistici specifici. La domanda è ${demand} con forte concentrazione nel residenziale privato e nel settore turistico-ricettivo.`,
      (city, pct, dir, demand) =>
        `A ${city} i prezzi sono il ${pct}% ${dir} alla media: un mercato accessibile per la clientela privata, con domanda ${demand} e crescente attenzione all'efficientamento energetico.`,
    ],
    avgLeadTimeBase: "8–14 giorni",
    avgLeadTimeCapital: "7–10 giorni",
  },
};

export const DEMAND_TEXT: Record<CityIntelligence["demandLevel"], string> = {
  LOW: "moderata",
  MEDIUM: "media",
  HIGH: "elevata",
  CRITICAL: "molto elevata",
};

const DEMAND_BUMP: Record<"LOW" | "MEDIUM" | "HIGH", CityIntelligence["demandLevel"]> = {
  LOW: "MEDIUM",
  MEDIUM: "HIGH",
  HIGH: "CRITICAL",
};

function h(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function generateCityIntelligence(city: CityData): CityIntelligence {
  const cluster: Cluster = REGION_TO_CLUSTER[city.region] ?? "centro";
  const profile = CLUSTER_PROFILES[cluster];

  // priceIndex: cluster base ± 0.05 driven by city slug hash
  const priceOffset = (h(city.slug) % 11 - 5) * 0.01;
  const priceIndex =
    Math.round(Math.min(1.25, Math.max(0.75, profile.priceIndexBase + priceOffset)) * 100) / 100;

  // demandLevel: base level, bumped one step for major cities
  const demandLevel: CityIntelligence["demandLevel"] = MAJOR_CITY_SLUGS.has(city.slug)
    ? DEMAND_BUMP[profile.demandBase]
    : profile.demandBase;

  // topServices: rotate pool by hash, take first 3 (unique by construction)
  const offset = h(city.slug + "s") % 6;
  const rotated = [
    ...profile.topServicesPool.slice(offset),
    ...profile.topServicesPool.slice(0, offset),
  ];
  const topServices: [string, string, string] = [rotated[0], rotated[1], rotated[2]];

  // avgLeadTime: capital cities get the faster tier
  const avgLeadTime = MAJOR_CITY_SLUGS.has(city.slug)
    ? profile.avgLeadTimeCapital
    : profile.avgLeadTimeBase;

  // localInsight: price-indexed, demand-aware, template selected by hash
  const pct = Math.round(Math.abs(priceIndex - 1.0) * 100);
  const dir = priceIndex > 1.0 ? "superiori" : "inferiori";
  const demandText = DEMAND_TEXT[demandLevel];
  const tplIdx = h(city.slug + "i") % profile.insightTemplates.length;
  const localInsight = profile.insightTemplates[tplIdx](city.name, pct, dir, demandText);

  return { priceIndex, demandLevel, topServices, localInsight, avgLeadTime };
}

export const CITY_INTELLIGENCE: Record<string, CityIntelligence> = Object.fromEntries(
  CITIES.map((city) => [city.slug, generateCityIntelligence(city)])
);
