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

// ─── Hand-authored intelligence for the active Lombardia cities ───────────
// These 12 cities are the current ACTIVE_REGION (see seo-data.ts) — the only
// ones actually crawlable/indexable right now. Unlike the generic cluster
// generator above (still used as a fallback for all other, currently
// inactive, cities), these entries are written per-city using real economic
// and market character, matching the bespoke CITY_CONTEXT copy in
// seo-data.ts rather than a shared "nord-ovest" template with hash noise.
const LOMBARDIA_CITY_INTELLIGENCE: Record<string, CityIntelligence> = {
  milano: {
    priceIndex: 1.2,
    demandLevel: "CRITICAL",
    topServices: ["Riqualificazione energetica (Ecobonus)", "Ristrutturazione condomini anni '60", "Adeguamento sismico"],
    avgLeadTime: "1–3 giorni",
    localInsight:
      "Milano è il mercato più competitivo della Lombardia per interventi edili e di ristrutturazione: alta densità di condomini da riqualificare energeticamente e una committenza abituata a standard qualitativi elevati. Rispondere per primi con un preventivo professionale è spesso l'unico modo per aggiudicarsi la commessa prima della concorrenza.",
  },
  monza: {
    priceIndex: 1.12,
    demandLevel: "HIGH",
    topServices: ["Riqualificazione energetica condomini", "Restauro aree vincolate (Villa Reale)", "Arredamento su misura (distretto del mobile)"],
    avgLeadTime: "2–3 giorni",
    localInsight:
      "Monza, ormai parte della conurbazione milanese, vive la stessa pressione del capoluogo ma su scala più contenuta: la vicinanza a Milano e il distretto del mobile della Brianza sostengono una domanda costante di ristrutturazioni e allestimenti su misura. Chi risponde più in fretta al cliente si aggiudica il lavoro.",
  },
  bergamo: {
    priceIndex: 1.07,
    demandLevel: "HIGH",
    topServices: ["Ristrutturazione residenziale hinterland", "Restauro Città Alta (vincoli UNESCO)", "Efficientamento energetico"],
    avgLeadTime: "2–4 giorni",
    localInsight:
      "Bergamo ha vissuto un'espansione residenziale sostenuta dallo smart working nell'hinterland, con richieste concentrate su Seriate e Dalmine, mentre in Città Alta i vincoli UNESCO rallentano i tempi ma non riducono la domanda. La rapidità nel preventivo è un vantaggio competitivo concreto in un mercato dove i clienti confrontano più artigiani.",
  },
  brescia: {
    priceIndex: 1.0,
    demandLevel: "HIGH",
    topServices: ["Ristrutturazione capannoni industriali", "Allestimento uffici", "Riqualificazione energetica anni '70"],
    avgLeadTime: "2–4 giorni",
    localInsight:
      "Brescia, seconda città industriale della Lombardia, genera domanda sia dal residenziale sia da capannoni e uffici da riqualificare energeticamente. È un mercato dove il preventivo dettagliato — che distingua chiaramente materiali, manodopera e tempistiche — pesa quanto il prezzo nella scelta del cliente.",
  },
  varese: {
    priceIndex: 1.08,
    demandLevel: "MEDIUM",
    topServices: ["Restauro ville liberty", "Riconversione aree ex-industriali", "Ristrutturazioni di pregio"],
    avgLeadTime: "3–4 giorni",
    localInsight:
      "Varese unisce un tessuto di ville liberty da recuperare a una clientela di frontalieri con buona capacità di spesa, oltre alla vicinanza a Malpensa. È un mercato meno affollato di professionisti rispetto a Milano: chi risponde con un preventivo professionale e rapido si distingue facilmente.",
  },
  como: {
    priceIndex: 1.15,
    demandLevel: "MEDIUM",
    topServices: ["Ristrutturazione ville di lusso", "Restauro centro storico murato", "Manutenzione seconde case"],
    avgLeadTime: "3–5 giorni",
    localInsight:
      "Como ha un mercato polarizzato tra ville di pregio sul lungolago — tra le più costose della regione — e un tessuto più popolare nei quartieri collinari. La componente internazionale e le seconde case generano una domanda costante di ristrutturazioni di alta gamma, dove la professionalità del preventivo è decisiva per la fiducia del cliente.",
  },
  lecco: {
    priceIndex: 0.98,
    demandLevel: "MEDIUM",
    topServices: ["Riqualificazione ex aree industriali", "Ristrutturazione centro storico", "Cantieri in zone collinari"],
    avgLeadTime: "3–5 giorni",
    localInsight:
      "Lecco, stretta tra lago e montagne, ha cantieri spesso più complessi per via degli accessi collinari, mentre l'ex distretto industriale è in piena riqualificazione residenziale. Un preventivo chiaro su tempi e costi di accesso è ciò che distingue i professionisti più affidabili in questo mercato.",
  },
  pavia: {
    priceIndex: 0.92,
    demandLevel: "MEDIUM",
    topServices: ["Interventi rapidi bagni e cucine", "Restauro palazzi storici", "Recupero cascine e rustici"],
    avgLeadTime: "3–5 giorni",
    localInsight:
      "Pavia è una città universitaria con altissima rotazione degli affitti: chi risponde in giornata a una richiesta su bagni, cucine o impianti ha un vantaggio enorme rispetto a chi impiega giorni. Nella Lomellina agricola la domanda è più lenta ma costante, legata al recupero di cascine e rustici.",
  },
  lodi: {
    priceIndex: 0.97,
    demandLevel: "MEDIUM",
    topServices: ["Ristrutturazione appartamenti", "Restauro portici del centro storico", "Efficientamento energetico"],
    avgLeadTime: "3–5 giorni",
    localInsight:
      "Lodi cresce grazie alla vicinanza con Milano: molte famiglie si trasferiscono qui cercando prezzi più accessibili, portando con sé una domanda crescente di ristrutturazioni. È ancora un mercato meno competitivo rispetto all'hinterland milanese, dove un preventivo rapido fa davvero la differenza.",
  },
  mantova: {
    priceIndex: 0.9,
    demandLevel: "LOW",
    topServices: ["Restauro edifici vincolati", "Ristrutturazione per B&B", "Manutenzione ordinaria"],
    avgLeadTime: "5–7 giorni",
    localInsight:
      "Mantova, patrimonio UNESCO, ha un mercato più contenuto ma qualificato: gli interventi nel centro rinascimentale richiedono materiali tradizionali e tempi più lunghi per via dei vincoli, mentre il turismo culturale in crescita alimenta la domanda di ristrutturazioni per B&B. La professionalità del preventivo pesa più del prezzo in questo segmento.",
  },
  cremona: {
    priceIndex: 0.88,
    demandLevel: "LOW",
    topServices: ["Restauro centro storico vincolato", "Efficientamento energetico agroindustria", "Ristrutturazione residenziale"],
    avgLeadTime: "5–7 giorni",
    localInsight:
      "Cremona ha un mercato edilizio più contenuto, diviso tra il centro storico vincolato — legato alla tradizione liutaria — e la bassa cremonese legata all'agroindustria. La domanda è stabile ma meno urgente che nei grandi centri: un preventivo professionale e ben argomentato è ciò che convince un cliente a scegliere un artigiano rispetto a un altro.",
  },
  sondrio: {
    priceIndex: 0.85,
    demandLevel: "LOW",
    topServices: ["Recupero baite e rustici in pietra", "Ristrutturazione seconde case", "Manutenzione stagionale di montagna"],
    avgLeadTime: "6–9 giorni",
    localInsight:
      "Sondrio e la Valtellina sono un mercato di nicchia condizionato dalla stagionalità turistica e dalla morfologia montana, con cantieri che richiedono più tempo per accessi e pendenze. La domanda è concentrata su baite, rustici e seconde case: un preventivo chiaro su tempi e costi di accesso è particolarmente apprezzato in questo contesto.",
  },
};

export const CITY_INTELLIGENCE: Record<string, CityIntelligence> = Object.fromEntries(
  CITIES.map((city) => [city.slug, LOMBARDIA_CITY_INTELLIGENCE[city.slug] ?? generateCityIntelligence(city)])
);
