// Dati verificati dei comuni con pagina città (/preventivi/:settore/:citta).
// Ogni numero ha una fonte pubblica, riportata in pagina:
//   - popolazione: ISTAT, stima al 1/1/2026 (via tuttitalia.it, ottobre 2026);
//   - altitudine della casa comunale, zona climatica e gradi giorno: DPR 412/1993,
//     tabella A aggiornata (via tuttitalia.it);
//   - zona sismica: classificazione regionale (OPCM 3274/2003 e delibere
//     regionali successive; via tuttitalia.it);
//   - zona di carico neve: NTC 2018 §3.4.2 (D.M. 17/1/2018), per provincia;
//   - limiti di trasmittanza: D.M. 6/8/2020 "Requisiti", Allegato E.
// Niente indici di prezzo o livelli di domanda inventati: se un dato non c'è
// qui, la pagina non lo mostra.

export type ZonaClimatica = "A" | "B" | "C" | "D" | "E" | "F";
export type ZonaNeve = "I-Alpina" | "I-Mediterranea" | "II" | "III";

export interface FattiCitta {
  slug: string;
  nome: string;
  provincia: string;
  regione: string;
  popolazione: number;
  altitudine: number;
  zonaClimatica: ZonaClimatica;
  gradiGiorno: number;
  /** 1 (alta) … 4 (bassa). Roma ha sottozone per municipio: vedi sismicaNota. */
  zonaSismica: 1 | 2 | 3 | 4;
  sismicaEtichetta?: string;
  sismicaNota?: string;
  zonaNeve: ZonaNeve;
}

export const FATTI_CITTA: Record<string, FattiCitta> = Object.fromEntries(
  ([
    // Lombardia
    { slug: "milano", nome: "Milano", provincia: "MI", regione: "Lombardia", popolazione: 1362863, altitudine: 138, zonaClimatica: "E", gradiGiorno: 2404, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "bergamo", nome: "Bergamo", provincia: "BG", regione: "Lombardia", popolazione: 120629, altitudine: 262, zonaClimatica: "E", gradiGiorno: 2533, zonaSismica: 3, zonaNeve: "I-Alpina" },
    { slug: "brescia", nome: "Brescia", provincia: "BS", regione: "Lombardia", popolazione: 201342, altitudine: 161, zonaClimatica: "E", gradiGiorno: 2410, zonaSismica: 2, zonaNeve: "I-Alpina" },
    { slug: "como", nome: "Como", provincia: "CO", regione: "Lombardia", popolazione: 83035, altitudine: 213, zonaClimatica: "E", gradiGiorno: 2228, zonaSismica: 4, zonaNeve: "I-Alpina" },
    { slug: "cremona", nome: "Cremona", provincia: "CR", regione: "Lombardia", popolazione: 71093, altitudine: 61, zonaClimatica: "E", gradiGiorno: 2389, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "lecco", nome: "Lecco", provincia: "LC", regione: "Lombardia", popolazione: 47326, altitudine: 216, zonaClimatica: "E", gradiGiorno: 2383, zonaSismica: 3, zonaNeve: "I-Alpina" },
    { slug: "lodi", nome: "Lodi", provincia: "LO", regione: "Lombardia", popolazione: 45643, altitudine: 83, zonaClimatica: "E", gradiGiorno: 2592, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "mantova", nome: "Mantova", provincia: "MN", regione: "Lombardia", popolazione: 50215, altitudine: 32, zonaClimatica: "E", gradiGiorno: 2388, zonaSismica: 3, zonaNeve: "II" },
    { slug: "monza", nome: "Monza", provincia: "MB", regione: "Lombardia", popolazione: 123672, altitudine: 178, zonaClimatica: "E", gradiGiorno: 2404, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "pavia", nome: "Pavia", provincia: "PV", regione: "Lombardia", popolazione: 71811, altitudine: 88, zonaClimatica: "E", gradiGiorno: 2623, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "sondrio", nome: "Sondrio", provincia: "SO", regione: "Lombardia", popolazione: 21495, altitudine: 317, zonaClimatica: "E", gradiGiorno: 2755, zonaSismica: 3, zonaNeve: "I-Alpina" },
    { slug: "varese", nome: "Varese", provincia: "VA", regione: "Lombardia", popolazione: 79100, altitudine: 389, zonaClimatica: "E", gradiGiorno: 2652, zonaSismica: 4, zonaNeve: "I-Mediterranea" },
    // Altre regioni
    {
      slug: "roma", nome: "Roma", provincia: "RM", regione: "Lazio", popolazione: 2745062, altitudine: 43, zonaClimatica: "D", gradiGiorno: 1415, zonaSismica: 2,
      sismicaEtichetta: "2B / 3A / 3B",
      sismicaNota: "Roma è divisa in sottozone per municipio (D.G.R. Lazio 387/2009, modificata dalla D.G.R. 571/2019): 2B per i municipi IV–IX, 3A per i municipi I–III e X–XV, 3B per l'isola amministrativa del municipio XV.",
      zonaNeve: "III",
    },
    { slug: "napoli", nome: "Napoli", provincia: "NA", regione: "Campania", popolazione: 905050, altitudine: 42, zonaClimatica: "C", gradiGiorno: 1034, zonaSismica: 2, zonaNeve: "III" },
    { slug: "torino", nome: "Torino", provincia: "TO", regione: "Piemonte", popolazione: 855654, altitudine: 258, zonaClimatica: "E", gradiGiorno: 2617, zonaSismica: 3, zonaNeve: "I-Alpina" },
    { slug: "bologna", nome: "Bologna", provincia: "BO", regione: "Emilia-Romagna", popolazione: 391473, altitudine: 74, zonaClimatica: "E", gradiGiorno: 2259, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "firenze", nome: "Firenze", provincia: "FI", regione: "Toscana", popolazione: 361625, altitudine: 64, zonaClimatica: "D", gradiGiorno: 1821, zonaSismica: 3, zonaNeve: "II" },
    { slug: "genova", nome: "Genova", provincia: "GE", regione: "Liguria", popolazione: 566247, altitudine: 34, zonaClimatica: "D", gradiGiorno: 1435, zonaSismica: 3, zonaNeve: "II" },
    { slug: "venezia", nome: "Venezia", provincia: "VE", regione: "Veneto", popolazione: 249385, altitudine: 11, zonaClimatica: "E", gradiGiorno: 2345, zonaSismica: 3, zonaNeve: "II" },
    { slug: "palermo", nome: "Palermo", provincia: "PA", regione: "Sicilia", popolazione: 626273, altitudine: 27, zonaClimatica: "B", gradiGiorno: 751, zonaSismica: 2, zonaNeve: "III" },
    { slug: "catania", nome: "Catania", provincia: "CT", regione: "Sicilia", popolazione: 296984, altitudine: 19, zonaClimatica: "B", gradiGiorno: 833, zonaSismica: 2, zonaNeve: "III" },
    { slug: "bari", nome: "Bari", provincia: "BA", regione: "Puglia", popolazione: 316248, altitudine: 17, zonaClimatica: "C", gradiGiorno: 1185, zonaSismica: 3, zonaNeve: "II" },
    { slug: "verona", nome: "Verona", provincia: "VR", regione: "Veneto", popolazione: 255139, altitudine: 64, zonaClimatica: "E", gradiGiorno: 2468, zonaSismica: 2, zonaNeve: "II" },
    { slug: "trieste", nome: "Trieste", provincia: "TS", regione: "Friuli-Venezia Giulia", popolazione: 198622, altitudine: 16, zonaClimatica: "E", gradiGiorno: 2102, zonaSismica: 3, zonaNeve: "II" },
    { slug: "padova", nome: "Padova", provincia: "PD", regione: "Veneto", popolazione: 208202, altitudine: 28, zonaClimatica: "E", gradiGiorno: 2383, zonaSismica: 3, zonaNeve: "II" },
    { slug: "modena", nome: "Modena", provincia: "MO", regione: "Emilia-Romagna", popolazione: 184361, altitudine: 47, zonaClimatica: "E", gradiGiorno: 2258, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "perugia", nome: "Perugia", provincia: "PG", regione: "Umbria", popolazione: 162384, altitudine: 484, zonaClimatica: "E", gradiGiorno: 2289, zonaSismica: 2, zonaNeve: "II" },
    { slug: "salerno", nome: "Salerno", provincia: "SA", regione: "Campania", popolazione: 125323, altitudine: 10, zonaClimatica: "C", gradiGiorno: 994, zonaSismica: 2, zonaNeve: "III" },
    { slug: "cagliari", nome: "Cagliari", provincia: "CA", regione: "Sardegna", popolazione: 145981, altitudine: 10, zonaClimatica: "C", gradiGiorno: 990, zonaSismica: 4, zonaNeve: "III" },
    { slug: "ancona", nome: "Ancona", provincia: "AN", regione: "Marche", popolazione: 100151, altitudine: 38, zonaClimatica: "D", gradiGiorno: 1688, zonaSismica: 2, zonaNeve: "I-Mediterranea" },
    { slug: "reggio-calabria", nome: "Reggio Calabria", provincia: "RC", regione: "Calabria", popolazione: 167925, altitudine: 21, zonaClimatica: "B", gradiGiorno: 772, zonaSismica: 1, zonaNeve: "III" },
    { slug: "sassari", nome: "Sassari", provincia: "SS", regione: "Sardegna", popolazione: 120231, altitudine: 207, zonaClimatica: "C", gradiGiorno: 1185, zonaSismica: 4, zonaNeve: "III" },
    { slug: "messina", nome: "Messina", provincia: "ME", regione: "Sicilia", popolazione: 216458, altitudine: 12, zonaClimatica: "B", gradiGiorno: 707, zonaSismica: 1, zonaNeve: "III" },
    { slug: "parma", nome: "Parma", provincia: "PR", regione: "Emilia-Romagna", popolazione: 199450, altitudine: 70, zonaClimatica: "E", gradiGiorno: 2502, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
    { slug: "reggio-emilia", nome: "Reggio Emilia", provincia: "RE", regione: "Emilia-Romagna", popolazione: 172921, altitudine: 68, zonaClimatica: "E", gradiGiorno: 2560, zonaSismica: 3, zonaNeve: "I-Mediterranea" },
  ] as FattiCitta[]).map((f) => [f.slug, f]),
);

// ─── Regole derivate (testi di legge, uguali per tutti i comuni della zona) ──

/** DPR 74/2013 art. 4: periodo e ore massime di accensione del riscaldamento. */
export const RISCALDAMENTO: Record<ZonaClimatica, { dal: string; al: string; ore: number | null }> = {
  A: { dal: "1 dicembre", al: "15 marzo", ore: 6 },
  B: { dal: "1 dicembre", al: "31 marzo", ore: 8 },
  C: { dal: "15 novembre", al: "31 marzo", ore: 10 },
  D: { dal: "1 novembre", al: "15 aprile", ore: 12 },
  E: { dal: "15 ottobre", al: "15 aprile", ore: 14 },
  F: { dal: "nessun limite", al: "nessun limite", ore: null },
};

/** D.M. 6/8/2020, Allegato E: trasmittanza massima (W/m²K) per le detrazioni. */
export const TRASMITTANZA_MAX: Record<ZonaClimatica, { coperture: number; pavimenti: number; pareti: number; finestre: number }> = {
  A: { coperture: 0.27, pavimenti: 0.4, pareti: 0.38, finestre: 2.6 },
  B: { coperture: 0.27, pavimenti: 0.4, pareti: 0.38, finestre: 2.6 },
  C: { coperture: 0.27, pavimenti: 0.3, pareti: 0.3, finestre: 1.75 },
  D: { coperture: 0.22, pavimenti: 0.28, pareti: 0.26, finestre: 1.67 },
  E: { coperture: 0.2, pavimenti: 0.25, pareti: 0.23, finestre: 1.3 },
  F: { coperture: 0.19, pavimenti: 0.23, pareti: 0.22, finestre: 1.0 },
};

/** OPCM 3519/2006: accelerazione orizzontale di picco su suolo rigido (10% in 50 anni). */
export const SISMICA_AG: Record<1 | 2 | 3 | 4, string> = {
  1: "oltre 0,25 g",
  2: "tra 0,15 e 0,25 g",
  3: "tra 0,05 e 0,15 g",
  4: "fino a 0,05 g",
};

/** NTC 2018 §3.4.2: carico neve di riferimento al suolo qsk (kN/m²). */
export function caricoNeve(zona: ZonaNeve, altitudine: number): number {
  const sopra = altitudine > 200;
  switch (zona) {
    case "I-Alpina": return sopra ? 1.39 * (1 + (altitudine / 728) ** 2) : 1.5;
    case "I-Mediterranea": return sopra ? 1.35 * (1 + (altitudine / 602) ** 2) : 1.5;
    case "II": return sopra ? 0.85 * (1 + (altitudine / 481) ** 2) : 1.0;
    case "III": return sopra ? 0.51 * (1 + (altitudine / 481) ** 2) : 0.6;
  }
}

/** Formula testuale del carico neve, per mostrarla accanto al risultato. */
export function formulaNeve(zona: ZonaNeve, altitudine: number): string {
  if (altitudine <= 200) return `zona ${zona}, quota fino a 200 m`;
  const [k, d] = zona === "I-Alpina" ? ["1,39", "728"] : zona === "I-Mediterranea" ? ["1,35", "602"] : zona === "II" ? ["0,85", "481"] : ["0,51", "481"];
  return `${k} × [1 + (${altitudine}/${d})²]`;
}

export function num(n: number, dec = 0): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export const FONTI_CITTA = [
  "Popolazione: ISTAT, stima al 1° gennaio 2026",
  "Zona climatica, gradi giorno, altitudine: D.P.R. 412/1993, tabella A aggiornata",
  "Periodo di riscaldamento: D.P.R. 74/2013, art. 4",
  "Zona sismica: classificazione regionale (OPCM 3274/2003 e successive)",
  "Carico neve: NTC 2018, §3.4.2 (D.M. 17/1/2018)",
  "Trasmittanze per le detrazioni: D.M. 6/8/2020, Allegato E",
];
