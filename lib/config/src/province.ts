/**
 * Province italiane (sigla automobilistica) e regioni. La colonna `province`
 * ereditata da QuoteAI conserva qui la sigla della provincia (MI, RM, …);
 * la regione si ricava da `regioneDiProvincia` (serve agli incentivi v1).
 */
export const REGIONI = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria",
  "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana", "Trentino-Alto Adige",
  "Umbria", "Valle d'Aosta", "Veneto",
] as const;
export type Regione = (typeof REGIONI)[number];

export type Provincia = { sigla: string; nome: string; regione: Regione };

export const PROVINCE_ITALIANE: readonly Provincia[] = [
  { sigla: "AG", nome: "Agrigento", regione: "Sicilia" },
  { sigla: "AL", nome: "Alessandria", regione: "Piemonte" },
  { sigla: "AN", nome: "Ancona", regione: "Marche" },
  { sigla: "AO", nome: "Aosta", regione: "Valle d'Aosta" },
  { sigla: "AR", nome: "Arezzo", regione: "Toscana" },
  { sigla: "AP", nome: "Ascoli Piceno", regione: "Marche" },
  { sigla: "AT", nome: "Asti", regione: "Piemonte" },
  { sigla: "AV", nome: "Avellino", regione: "Campania" },
  { sigla: "BA", nome: "Bari", regione: "Puglia" },
  { sigla: "BT", nome: "Barletta-Andria-Trani", regione: "Puglia" },
  { sigla: "BL", nome: "Belluno", regione: "Veneto" },
  { sigla: "BN", nome: "Benevento", regione: "Campania" },
  { sigla: "BG", nome: "Bergamo", regione: "Lombardia" },
  { sigla: "BI", nome: "Biella", regione: "Piemonte" },
  { sigla: "BO", nome: "Bologna", regione: "Emilia-Romagna" },
  { sigla: "BZ", nome: "Bolzano", regione: "Trentino-Alto Adige" },
  { sigla: "BS", nome: "Brescia", regione: "Lombardia" },
  { sigla: "BR", nome: "Brindisi", regione: "Puglia" },
  { sigla: "CA", nome: "Cagliari", regione: "Sardegna" },
  { sigla: "CL", nome: "Caltanissetta", regione: "Sicilia" },
  { sigla: "CB", nome: "Campobasso", regione: "Molise" },
  { sigla: "CE", nome: "Caserta", regione: "Campania" },
  { sigla: "CT", nome: "Catania", regione: "Sicilia" },
  { sigla: "CZ", nome: "Catanzaro", regione: "Calabria" },
  { sigla: "CH", nome: "Chieti", regione: "Abruzzo" },
  { sigla: "CO", nome: "Como", regione: "Lombardia" },
  { sigla: "CS", nome: "Cosenza", regione: "Calabria" },
  { sigla: "CR", nome: "Cremona", regione: "Lombardia" },
  { sigla: "KR", nome: "Crotone", regione: "Calabria" },
  { sigla: "CN", nome: "Cuneo", regione: "Piemonte" },
  { sigla: "EN", nome: "Enna", regione: "Sicilia" },
  { sigla: "FM", nome: "Fermo", regione: "Marche" },
  { sigla: "FE", nome: "Ferrara", regione: "Emilia-Romagna" },
  { sigla: "FI", nome: "Firenze", regione: "Toscana" },
  { sigla: "FG", nome: "Foggia", regione: "Puglia" },
  { sigla: "FC", nome: "Forlì-Cesena", regione: "Emilia-Romagna" },
  { sigla: "FR", nome: "Frosinone", regione: "Lazio" },
  { sigla: "GE", nome: "Genova", regione: "Liguria" },
  { sigla: "GO", nome: "Gorizia", regione: "Friuli-Venezia Giulia" },
  { sigla: "GR", nome: "Grosseto", regione: "Toscana" },
  { sigla: "IM", nome: "Imperia", regione: "Liguria" },
  { sigla: "IS", nome: "Isernia", regione: "Molise" },
  { sigla: "AQ", nome: "L'Aquila", regione: "Abruzzo" },
  { sigla: "SP", nome: "La Spezia", regione: "Liguria" },
  { sigla: "LT", nome: "Latina", regione: "Lazio" },
  { sigla: "LE", nome: "Lecce", regione: "Puglia" },
  { sigla: "LC", nome: "Lecco", regione: "Lombardia" },
  { sigla: "LI", nome: "Livorno", regione: "Toscana" },
  { sigla: "LO", nome: "Lodi", regione: "Lombardia" },
  { sigla: "LU", nome: "Lucca", regione: "Toscana" },
  { sigla: "MC", nome: "Macerata", regione: "Marche" },
  { sigla: "MN", nome: "Mantova", regione: "Lombardia" },
  { sigla: "MS", nome: "Massa-Carrara", regione: "Toscana" },
  { sigla: "MT", nome: "Matera", regione: "Basilicata" },
  { sigla: "ME", nome: "Messina", regione: "Sicilia" },
  { sigla: "MI", nome: "Milano", regione: "Lombardia" },
  { sigla: "MO", nome: "Modena", regione: "Emilia-Romagna" },
  { sigla: "MB", nome: "Monza e Brianza", regione: "Lombardia" },
  { sigla: "NA", nome: "Napoli", regione: "Campania" },
  { sigla: "NO", nome: "Novara", regione: "Piemonte" },
  { sigla: "NU", nome: "Nuoro", regione: "Sardegna" },
  { sigla: "OR", nome: "Oristano", regione: "Sardegna" },
  { sigla: "PD", nome: "Padova", regione: "Veneto" },
  { sigla: "PA", nome: "Palermo", regione: "Sicilia" },
  { sigla: "PR", nome: "Parma", regione: "Emilia-Romagna" },
  { sigla: "PV", nome: "Pavia", regione: "Lombardia" },
  { sigla: "PG", nome: "Perugia", regione: "Umbria" },
  { sigla: "PU", nome: "Pesaro e Urbino", regione: "Marche" },
  { sigla: "PE", nome: "Pescara", regione: "Abruzzo" },
  { sigla: "PC", nome: "Piacenza", regione: "Emilia-Romagna" },
  { sigla: "PI", nome: "Pisa", regione: "Toscana" },
  { sigla: "PT", nome: "Pistoia", regione: "Toscana" },
  { sigla: "PN", nome: "Pordenone", regione: "Friuli-Venezia Giulia" },
  { sigla: "PZ", nome: "Potenza", regione: "Basilicata" },
  { sigla: "PO", nome: "Prato", regione: "Toscana" },
  { sigla: "RG", nome: "Ragusa", regione: "Sicilia" },
  { sigla: "RA", nome: "Ravenna", regione: "Emilia-Romagna" },
  { sigla: "RC", nome: "Reggio Calabria", regione: "Calabria" },
  { sigla: "RE", nome: "Reggio Emilia", regione: "Emilia-Romagna" },
  { sigla: "RI", nome: "Rieti", regione: "Lazio" },
  { sigla: "RN", nome: "Rimini", regione: "Emilia-Romagna" },
  { sigla: "RM", nome: "Roma", regione: "Lazio" },
  { sigla: "RO", nome: "Rovigo", regione: "Veneto" },
  { sigla: "SA", nome: "Salerno", regione: "Campania" },
  { sigla: "SS", nome: "Sassari", regione: "Sardegna" },
  { sigla: "SV", nome: "Savona", regione: "Liguria" },
  { sigla: "SI", nome: "Siena", regione: "Toscana" },
  { sigla: "SR", nome: "Siracusa", regione: "Sicilia" },
  { sigla: "SO", nome: "Sondrio", regione: "Lombardia" },
  { sigla: "SU", nome: "Sud Sardegna", regione: "Sardegna" },
  { sigla: "TA", nome: "Taranto", regione: "Puglia" },
  { sigla: "TE", nome: "Teramo", regione: "Abruzzo" },
  { sigla: "TR", nome: "Terni", regione: "Umbria" },
  { sigla: "TO", nome: "Torino", regione: "Piemonte" },
  { sigla: "TP", nome: "Trapani", regione: "Sicilia" },
  { sigla: "TN", nome: "Trento", regione: "Trentino-Alto Adige" },
  { sigla: "TV", nome: "Treviso", regione: "Veneto" },
  { sigla: "TS", nome: "Trieste", regione: "Friuli-Venezia Giulia" },
  { sigla: "UD", nome: "Udine", regione: "Friuli-Venezia Giulia" },
  { sigla: "VA", nome: "Varese", regione: "Lombardia" },
  { sigla: "VE", nome: "Venezia", regione: "Veneto" },
  { sigla: "VB", nome: "Verbano-Cusio-Ossola", regione: "Piemonte" },
  { sigla: "VC", nome: "Vercelli", regione: "Piemonte" },
  { sigla: "VR", nome: "Verona", regione: "Veneto" },
  { sigla: "VV", nome: "Vibo Valentia", regione: "Calabria" },
  { sigla: "VI", nome: "Vicenza", regione: "Veneto" },
  { sigla: "VT", nome: "Viterbo", regione: "Lazio" },
];

const BY_SIGLA = new Map(PROVINCE_ITALIANE.map((p) => [p.sigla, p]));

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’\-\s]+/g, " ").trim().toUpperCase();
}
const BY_NOME = new Map(PROVINCE_ITALIANE.map((p) => [fold(p.nome), p]));

/** Alias storici e varianti d'uso comune. */
const ALIASI: Record<string, string> = {
  "REGGIO NELL EMILIA": "RE", "REGGIO DI CALABRIA": "RC", "PESARO URBINO": "PU", "MONZA BRIANZA": "MB",
  "MONZA": "MB", "FORLI": "FC", "CESENA": "FC", "CARRARA": "MS", "MASSA": "MS", "BARLETTA": "BT", "ANDRIA": "BT",
  "TRANI": "BT", "URBINO": "PU", "VERBANIA": "VB", "CARBONIA": "SU", "IGLESIAS": "SU", "OGLIASTRA": "NU",
  "OLBIA": "SS", "TEMPIO": "SS", "MEDIO CAMPIDANO": "SU", "AOSTE": "AO", "BOZEN": "BZ", "ROME": "RM", "MILAN": "MI",
  "TURIN": "TO", "FLORENCE": "FI", "VENICE": "VE", "NAPLES": "NA", "GENOA": "GE",
};

export function isProvinceCode(value: unknown): value is string {
  return typeof value === "string" && BY_SIGLA.has(value);
}

/** Normalizza un input libero ("milano", "Mi", "prov. di Roma") nella sigla. */
export function normalizeProvince(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const up = raw.toUpperCase();
  if (BY_SIGLA.has(up)) return up;
  const f = fold(raw.replace(/^(PROV\.?|PROVINCIA)\s+(DI\s+)?/i, "").replace(/^\((.*)\)$/, "$1"));
  const byNome = BY_NOME.get(f);
  if (byNome) return byNome.sigla;
  return ALIASI[f] ?? null;
}

export function provinceName(sigla: string | null | undefined): string {
  return (sigla && BY_SIGLA.get(sigla.toUpperCase())?.nome) || sigla || "";
}

export function regioneDiProvincia(sigla: string | null | undefined): Regione | null {
  return (sigla && BY_SIGLA.get(sigla.toUpperCase())?.regione) || null;
}

/** Riconosce sia la sigla che il nome per esteso. */
export function normalizeRegione(value: string | null | undefined): Regione | null {
  if (!value) return null;
  const f = fold(value);
  return REGIONI.find((r) => fold(r) === f) ?? null;
}

/** CAP italiano: 5 cifre. */
export const CAP_REGEX = /^\d{5}$/;
/** Partita IVA: 11 cifre. */
export const PARTITA_IVA_REGEX = /^(IT)?\d{11}$/i;
/** Codice fiscale persona fisica (16 alfanumerici) o numerico (11 cifre, enti). */
export const CODICE_FISCALE_REGEX = /^([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]|\d{11})$/i;
/** Codice destinatario SDI (7 alfanumerici). */
export const CODICE_SDI_REGEX = /^[A-Z0-9]{7}$/i;

export function isValidPartitaIva(value: string): boolean {
  const v = value.replace(/^IT/i, "").trim();
  if (!/^\d{11}$/.test(v)) return false;
  // Algoritmo di Luhn "italiano" (art. 35 DPR 633/72): controllo sull'11ª cifra.
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let n = Number(v[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
