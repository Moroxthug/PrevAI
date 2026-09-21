// Phase 68 (QuoteAI) / V2-2: indice leggero dei settori. seo-data.ts pesa
// ~150 kB di testi per le landing; il bundle pubblico (chip mestieri in
// homepage, footer) ha bisogno solo di slug ed etichette, che vivono qui;
// seo-data.ts verifica che restino allineati (la build fallisce se divergono).
// Slug = PrevAI v1 (URL indicizzate: /preventivi/<slug>/).
export interface SectorSlugEntry {
  label: string;
  labelPlural: string;
}

export const SECTOR_SLUGS: Record<string, SectorSlugEntry> = {
  imbianchino: { label: "Imbianchino", labelPlural: "imbianchini" },
  elettricista: { label: "Elettricista", labelPlural: "elettricisti" },
  idraulico: { label: "Idraulico", labelPlural: "idraulici" },
  edilizia: { label: "Impresa Edile", labelPlural: "imprese edili" },
  ristrutturazione: { label: "Ristrutturazione", labelPlural: "ristrutturatori" },
  carpentiere: { label: "Carpentiere", labelPlural: "carpentieri" },
  falegname: { label: "Falegname", labelPlural: "falegnami" },
  termoidraulico: { label: "Termoidraulico", labelPlural: "termoidraulici" },
  freelance: { label: "Freelance", labelPlural: "freelance e consulenti" },
  geometra: { label: "Geometra", labelPlural: "geometri" },
  muratore: { label: "Muratore", labelPlural: "muratori" },
  giardiniere: { label: "Giardiniere", labelPlural: "giardinieri" },
  piastrellista: { label: "Piastrellista", labelPlural: "piastrellisti" },
  serramentista: { label: "Serramentista", labelPlural: "serramentisti" },
  tetto: { label: "Copertura e Tetto", labelPlural: "imprese di coperture" },
  condizionatori: { label: "Condizionatore", labelPlural: "installatori di climatizzatori" },
  pittore: { label: "Pittore Edile", labelPlural: "pittori edili" },
  pavimentista: { label: "Pavimentista", labelPlural: "pavimentisti" },
  "modello-excel": { label: "Preventivo Excel", labelPlural: "utenti Excel" },
  "modello-word": { label: "Preventivo Word", labelPlural: "utenti Word" },
  "come-fare-preventivo": { label: "Preventivo Professionale", labelPlural: "professionisti" },
  "preventivi-gratis": { label: "Preventivi Gratis", labelPlural: "artigiani e PMI" },
};

/** Slug QuoteAI → slug v1: usato solo per tradurre riferimenti importati (footer, TRADE_LABELS). */
export const LEGACY_SECTOR_SLUGS: Record<string, string> = {
  painter: "imbianchino",
  electrician: "elettricista",
  plumber: "idraulico",
  "general-contractor": "edilizia",
  "renovation-contractor": "ristrutturazione",
  "welder-fabricator": "carpentiere",
  "carpenter-cabinetmaker": "falegname",
  "hvac-technician": "termoidraulico",
  freelance: "freelance",
  "building-consultant": "geometra",
  mason: "muratore",
  landscaper: "giardiniere",
  "tile-installer": "piastrellista",
  "window-door-installer": "serramentista",
  roofer: "tetto",
  "air-conditioning-installer": "condizionatori",
  "decorative-painter": "pittore",
  "flooring-installer": "pavimentista",
  "excel-template": "modello-excel",
  "word-template": "modello-word",
  "how-to-quote": "come-fare-preventivo",
  "free-quote": "preventivi-gratis"
};

export function sectorLabel(slug: string, _lang?: string): string {
  return SECTOR_SLUGS[slug]?.label ?? slug;
}
