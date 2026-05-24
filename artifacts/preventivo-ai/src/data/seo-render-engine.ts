/**
 * seo-render-engine.ts
 *
 * Single source of truth for all city-page SEO data derivation.
 * Imported by BOTH scripts/prerender-seo.ts (Node.js SSG) and
 * src/pages/seo/city-landing.tsx (React runtime).
 * Guarantees full content parity between prerendered HTML and client React render.
 *
 * Rules:
 *  – No HTML template literals (prerender keeps those; React uses JSX)
 *  – No DOM / browser APIs at module scope
 *  – All functions are pure and deterministic
 */

import type { SectorData, CityData } from "./seo-data.js";
import {
  getCityTitle,
  getCityDesc,
  CITIES_BY_SLUG,
  RELATED_SECTORS,
  CITY_CONTEXT,
} from "./seo-data.js";
import { CITY_INTELLIGENCE, DEMAND_TEXT } from "./seo-intelligence.js";
import type { CityIntelligence } from "./seo-intelligence.js";

export { getCityTitle, getCityDesc };
export type { CityIntelligence, SectorData, CityData };

const BASE_URL = "https://www.prevai.it";

// ─── Deterministic hash ────────────────────────────────────────────────────

export function strHash(s: string): number {
  return s.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

// ─── OG image path ────────────────────────────────────────────────────────

const SECTOR_OG_IMAGES: Record<string, string> = {
  edilizia: "/og/edilizia.jpg",
  ristrutturazione: "/og/ristrutturazione.jpg",
  elettricista: "/og/elettricista.jpg",
  idraulico: "/og/idraulico.jpg",
  imbianchino: "/og/imbianchino.jpg",
  carpentiere: "/og/carpentiere.jpg",
  falegname: "/og/falegname.jpg",
  termoidraulico: "/og/termoidraulico.jpg",
  freelance: "/og/freelance.jpg",
  geometra: "/og/geometra.jpg",
};

export function getOgImagePath(sectorSlug: string): string {
  return SECTOR_OG_IMAGES[sectorSlug] ?? "/opengraph.jpg";
}

// ─── Intro text — 4 variants, sectorType-aware, deterministic by city.slug ─

export function getCityIntro(sector: SectorData, city: CityData): string {
  const isService = sector.sectorType === "service";
  const variants = isService
    ? [
        `Gestisci un'attività nel settore ${sector.label.toLowerCase()} a ${city.name}? prevai è il software di preventivazione con AI pensato per i professionisti del settore in ${city.region}. Descrivi il lavoro in italiano, ottieni un documento professionale in 30 secondi.`,
        `${city.name} conta migliaia di cantieri e commesse nel settore ${sector.label.toLowerCase()} ogni anno. I professionisti che usano prevai rispondono ai clienti in pochi minuti anziché in giorni, vincendo più lavori. Nessun Excel, nessun foglio di carta.`,
        `In un mercato come ${city.name} la competizione nel settore ${sector.label.toLowerCase()} è alta. Chi invia il preventivo per primo ha un vantaggio decisivo. Con prevai lo fai in 30 secondi ancora mentre sei dal cliente — direttamente dallo smartphone.`,
        `Coordinare un'attività di ${sector.label.toLowerCase()} a ${city.name} significa gestire preventivi complessi. prevai semplifica la parte amministrativa: descrivi il lavoro, l'AI genera il preventivo completo e tu ti concentri sulla qualità.`,
      ]
    : [
        `Sei un ${sector.label.toLowerCase()} a ${city.name} e perdi ore a fare preventivi su Excel o carta? prevai è il software di preventivazione con AI pensato per i professionisti del settore in ${city.region}. Descrivi il lavoro in italiano, ottieni un documento professionale in 30 secondi.`,
        `${city.name} conta migliaia di artigiani e PMI attive nel settore. I ${sector.labelPlural} che usano prevai rispondono ai clienti in pochi minuti anziché in giorni, e vincono più lavori. Nessun Excel, nessun foglio di carta.`,
        `In una città come ${city.name} la concorrenza tra ${sector.labelPlural} è alta. Chi invia il preventivo per primo ha un vantaggio decisivo. Con prevai lo fai in 30 secondi ancora mentre sei dal cliente — direttamente dallo smartphone.`,
        `Operare come ${sector.label.toLowerCase()} a ${city.name} significa gestire tanti clienti con richieste diverse. prevai semplifica la parte amministrativa: descrivi il lavoro, l'AI genera il preventivo completo e tu ti concentri sul mestiere.`,
      ];
  return variants[strHash(city.slug) % variants.length];
}

// ─── FAQ items — 4 dynamic items, unified between visible HTML and JSON-LD ─

export interface CityFaqItem {
  q: string;
  a: string;
}

export function getCityFaqItems(sector: SectorData, city: CityData): CityFaqItem[] {
  const intel = CITY_INTELLIGENCE[city.slug];
  const pricePct = intel ? Math.round(Math.abs(intel.priceIndex - 1.0) * 100) : 0;

  const priceAnswer = intel
    ? intel.priceIndex > 1.05
      ? `I prezzi per servizi di ${sector.label.toLowerCase()} a ${city.name} sono mediamente il ${pricePct}% superiori alla media nazionale. Presentare un preventivo professionale e dettagliato è essenziale per giustificare il prezzo e conquistare la fiducia del cliente.`
      : intel.priceIndex < 0.95
        ? `A ${city.name} i prezzi per ${sector.labelPlural} sono mediamente il ${pricePct}% inferiori alla media nazionale. In un mercato competitivo come questo, rispondere velocemente con un preventivo professionale è il modo più efficace per distinguersi.`
        : `I prezzi per ${sector.labelPlural} a ${city.name} si attestano in linea con la media nazionale. La velocità di risposta e la qualità del preventivo sono i fattori che fanno la differenza per vincere la commessa.`
    : `I prezzi variano in base alla complessità del lavoro e alla zona. Con prevai puoi generare preventivi professionali in 30 secondi e mostrare subito la tua competitività.`;

  const leadTimeAnswer = intel
    ? intel.demandLevel === "CRITICAL"
      ? `A ${city.name} la domanda è molto elevata: i tempi di attesa stimati sono di ${intel.avgLeadTime}. Inviare il preventivo in pochi minuti dall'ispezione — come permette prevai — aumenta significativamente le probabilità di aggiudicarsi il lavoro.`
      : intel.demandLevel === "HIGH"
        ? `Con una domanda ${DEMAND_TEXT[intel.demandLevel]} a ${city.name}, i professionisti rispondono tipicamente entro ${intel.avgLeadTime}. Inviare subito un preventivo professionale è il modo migliore per assicurarsi la commessa.`
        : intel.demandLevel === "MEDIUM"
          ? `A ${city.name} i tempi di risposta standard per ${sector.labelPlural} sono di circa ${intel.avgLeadTime}. Un preventivo professionale inviato in giornata può fare la differenza rispetto ai concorrenti.`
          : `Il mercato di ${city.name} registra una domanda ${DEMAND_TEXT[intel.demandLevel]} per questo tipo di servizio, con tempi di risposta di circa ${intel.avgLeadTime}. Professionalità e rapidità del preventivo restano fattori differenzianti importanti.`
    : `I tempi dipendono dalla disponibilità locale. Con prevai puoi rispondere a nuove richieste in 30 secondi e aumentare le tue chance di aggiudicarti ogni commessa.`;

  return [
    {
      q: `Come faccio un preventivo professionale a ${city.name}?`,
      a: `Con prevai bastano 30 secondi. Descrivi il lavoro in italiano nel campo di testo, il motore AI genera automaticamente il documento con voci di costo, quantità, prezzi unitari e IVA. Puoi scaricarlo come PDF e inviarlo subito al tuo cliente a ${city.name}.`,
    },
    {
      q: `prevai funziona per ${sector.labelPlural} a ${city.name} e in tutta la ${city.region}?`,
      a: `Sì. prevai è un'applicazione web accessibile da qualsiasi dispositivo con connessione internet. Non ci sono limitazioni geografiche: funziona a ${city.name} come in qualsiasi altra città italiana.`,
    },
    {
      q: `Quanto costano i servizi di ${sector.label.toLowerCase()} a ${city.name}?`,
      a: priceAnswer,
    },
    {
      q: `Qual è il tempo medio di risposta per ${sector.labelPlural} a ${city.name}?`,
      a: leadTimeAnswer,
    },
  ];
}

// ─── How-it-works steps (hardcoded per city, matching prerender exactly) ───

export interface HowItWorksStep {
  n: string;
  title: string;
  desc: string;
}

export function getCityHowItWorksSteps(cityName: string): HowItWorksStep[] {
  return [
    {
      n: "1",
      title: "Descrivi il lavoro",
      desc: `Dal tuo smartphone a ${cityName}, scrivi cosa devi fare nel linguaggio che usi ogni giorno. L'AI capisce la terminologia di settore.`,
    },
    {
      n: "2",
      title: "L'AI genera il preventivo",
      desc: "prevai identifica le voci di costo, stima le quantità e calcola totali e IVA in automatico. Zero errori, zero calcoli manuali.",
    },
    {
      n: "3",
      title: "Invia al cliente",
      desc: `PDF professionale in 30 secondi. Lo mandi via WhatsApp o email al tuo cliente a ${cityName} prima ancora di uscire dal cantiere.`,
    },
  ];
}

// ─── Layout & CTA variant selection (hash-based, deterministic) ────────────

export function getCityLayout(sector: SectorData, city: CityData): 0 | 1 | 2 {
  return (strHash(sector.slug + city.slug) % 3) as 0 | 1 | 2;
}

export function getCityCtaVariant(sector: SectorData, city: CityData): 0 | 1 | 2 {
  return (strHash(sector.slug + city.slug + "cta") % 3) as 0 | 1 | 2;
}

export interface CtaTexts {
  headingPrefix: string;
  headingGradient: string;
  button: string;
}

export function getCityCtaTexts(ctaVariant: 0 | 1 | 2, cityName: string): CtaTexts {
  switch (ctaVariant) {
    case 1:
      return {
        headingPrefix: `Il tuo primo PDF professionale a ${cityName} è `,
        headingGradient: "completamente gratis",
        button: "Crea account gratuito",
      };
    case 2:
      return {
        headingPrefix: "Smetti di perdere tempo. Genera il preventivo ",
        headingGradient: "mentre sei ancora dal cliente",
        button: "Prova gratis — nessun impegno",
      };
    default:
      return {
        headingPrefix: `Inizia a creare preventivi a ${cityName} `,
        headingGradient: "in 30 secondi",
        button: "Inizia Gratuitamente",
      };
  }
}

// ─── Nearby city anchors — semantic, price-aware ──────────────────────────

export interface NearbyAnchor {
  slug: string;
  name: string;
  anchorText: string;
}

export function getNearbyAnchors(sector: SectorData, city: CityData): NearbyAnchor[] {
  return city.nearbySlug
    .map((slug): NearbyAnchor | null => {
      const nearbyCity = CITIES_BY_SLUG[slug];
      if (!nearbyCity) return null;
      const nearbyIntel = CITY_INTELLIGENCE[slug];
      const anchorText = nearbyIntel
        ? nearbyIntel.priceIndex > 1.05
          ? `Preventivi ${sector.label} a ${nearbyCity.name}`
          : nearbyIntel.priceIndex < 0.95
            ? `Costi ${sector.label.toLowerCase()} a ${nearbyCity.name}`
            : `${sector.label} a ${nearbyCity.name}`
        : nearbyCity.name;
      return { slug: nearbyCity.slug, name: nearbyCity.name, anchorText };
    })
    .filter((x): x is NearbyAnchor => x !== null);
}

// ─── Osservatorio widget data ─────────────────────────────────────────────

export interface OsservatorioData {
  priceLabel: string;
  priceColorClass: string;
  demandLabel: string;
  demandColorClass: string;
  avgLeadTime: string;
  topServices: [string, string, string];
  localInsight: string;
}

export function getOsservatorioData(citySlug: string): OsservatorioData | null {
  const intel = CITY_INTELLIGENCE[citySlug];
  if (!intel) return null;
  const pct = Math.round(Math.abs(intel.priceIndex - 1.0) * 100);
  const priceLabel =
    intel.priceIndex > 1.0 ? `+${pct}%` : intel.priceIndex < 1.0 ? `\u2212${pct}%` : `\u00b10%`;
  const priceColorClass =
    intel.priceIndex > 1.05
      ? "text-amber-600"
      : intel.priceIndex < 0.95
        ? "text-green-600"
        : "text-gray-800";
  const demandLabels: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "Moderata",
    MEDIUM: "Media",
    HIGH: "Elevata",
    CRITICAL: "Molto elevata",
  };
  const demandColorClasses: Record<CityIntelligence["demandLevel"], string> = {
    LOW: "text-green-600",
    MEDIUM: "text-blue-600",
    HIGH: "text-amber-600",
    CRITICAL: "text-red-600",
  };
  return {
    priceLabel,
    priceColorClass,
    demandLabel: demandLabels[intel.demandLevel],
    demandColorClass: demandColorClasses[intel.demandLevel],
    avgLeadTime: intel.avgLeadTime,
    topServices: intel.topServices,
    localInsight: intel.localInsight,
  };
}

// ─── City context text ────────────────────────────────────────────────────

export function getCityContextText(citySlug: string): string | null {
  return CITY_CONTEXT[citySlug] ?? null;
}

// ─── Related sectors ─────────────────────────────────────────────────────

export function getCityRelatedSectors(sectorSlug: string): { slug: string; label: string }[] {
  return RELATED_SECTORS[sectorSlug] ?? [];
}

// ─── JSON-LD schemas (unified — same FAQ text as visible body) ────────────

export type JsonLdSchema = { "@context": string; "@type": string; [key: string]: unknown };

export function buildCityJsonLd(sector: SectorData, city: CityData): JsonLdSchema[] {
  const canonical = `${BASE_URL}/seo/${sector.slug}/${city.slug}/`;
  const faqItems = getCityFaqItems(sector, city);
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "prevai",
      description: `Software di preventivazione AI per ${sector.labelPlural} a ${city.name} (${city.region}).`,
      url: canonical,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "it",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "127",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `Preventivi ${sector.label} a ${city.name}`,
      description: `Software di preventivazione AI per ${sector.labelPlural} a ${city.name}`,
      serviceType: `Preventivazione ${sector.label}`,
      provider: { "@type": "Organization", name: "prevai", url: BASE_URL },
      areaServed: [
        { "@type": "City", name: city.name },
        { "@type": "State", name: city.region },
        { "@type": "Country", name: "Italia" },
      ],
      url: canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: sector.label, item: `${BASE_URL}/seo/${sector.slug}/` },
        { "@type": "ListItem", position: 3, name: city.name, item: canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

// ─── Dev content-parity verification ─────────────────────────────────────

export function verifyCityContentInDev(
  sector: SectorData,
  city: CityData,
  rendered: { intro: string; faqAnswers: string[]; ctaButton: string }
): void {
  if (typeof window === "undefined") return;
  try {
    const meta = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
    if (!meta?.DEV) return;
  } catch {
    return;
  }

  const expectedIntro = getCityIntro(sector, city);
  const expectedFaq = getCityFaqItems(sector, city);
  const expectedCta = getCityCtaTexts(getCityCtaVariant(sector, city), city.name);
  const mismatches: string[] = [];

  if (rendered.intro !== expectedIntro) mismatches.push("intro");
  rendered.faqAnswers.forEach((a, i) => {
    if (a !== expectedFaq[i]?.a) mismatches.push(`faq[${i}].answer`);
  });
  if (rendered.ctaButton !== expectedCta.button) mismatches.push("ctaButton");

  if (mismatches.length > 0) {
    console.warn(
      `[seo-render-engine] Content mismatch on /seo/${sector.slug}/${city.slug}: ` +
        mismatches.join(", ") +
        ". SeoCityLanding must consume all data exclusively from seo-render-engine.ts."
    );
  }
}
