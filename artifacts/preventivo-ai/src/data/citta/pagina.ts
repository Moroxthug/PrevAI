// Composizione della pagina città × mestiere: title, description, intro,
// sezioni (da moduli.ts), FAQ e collegamenti. Usata dalla pagina React
// (pages/seo/city-landing.tsx, renderizzata a build time) e dallo script di
// prerender per l'<head>.

import { SECTORS, CITY_SECTORS } from "../seo-data";
import { BLOG_INDEX, SECTOR_ARTICLES } from "../blog-index";
import { MODELLI_WORD, type ModelloWord } from "../modelli-word";
import { FATTI_CITTA, type FattiCitta, num } from "./fatti";
import { PROFILI_CITTA, type ProfiloCitta } from "./profili";
import { MESTIERI, sezioniPerPagina, type Sezione } from "./moduli";

const SITE = "https://prevai.it";

/** Città con pagine attive: tutte quelle con dati verificati e profilo. */
export const CITTA_ATTIVE: string[] = Object.keys(FATTI_CITTA);
for (const s of CITTA_ATTIVE) if (!PROFILI_CITTA[s]) throw new Error(`citta: manca il profilo di "${s}" in profili.ts`);

/** Mestieri con pagina città: quelli locali che hanno un modulo dedicato. */
export const MESTIERI_CITTA: string[] = CITY_SECTORS.filter((s) => MESTIERI[s]);

export function haPaginaCitta(settore: string, citta: string): boolean {
  return MESTIERI_CITTA.includes(settore) && CITTA_ATTIVE.includes(citta);
}

export interface PaginaCitta {
  settore: string;
  etichetta: string;
  f: FattiCitta;
  p: ProfiloCitta;
  title: string;
  description: string;
  h1: string;
  sottotitolo: string;
  intro: string;
  sezioni: Sezione[];
  faq: { q: string; a: string }[];
  vicine: { slug: string; nome: string }[];
  altriMestieri: { slug: string; label: string }[];
  articoli: { slug: string; title: string; category: string; readingTimeMin: number }[];
  modello?: ModelloWord;
  canonical: string;
  jsonLd: { "@context": string; "@type": string; [k: string]: unknown }[];
}

/** Ordine di vicinanza: stessa regione prima, poi le altre città attive. */
function cittaVicine(f: FattiCitta): { slug: string; nome: string }[] {
  const altre = CITTA_ATTIVE.filter((s) => s !== f.slug).map((s) => FATTI_CITTA[s]);
  const stessaRegione = altre.filter((c) => c.regione === f.regione);
  const resto = altre.filter((c) => c.regione !== f.regione).sort((a, b) => b.popolazione - a.popolazione);
  return [...stessaRegione, ...resto].slice(0, 6).map((c) => ({ slug: c.slug, nome: c.nome }));
}

function scegliTitle(label: string, nome: string, ganci: string[]): string {
  const suffisso = " | prevai";
  const candidati = [
    ...ganci.map((g) => `Preventivo ${label} a ${nome}: ${g}`),
    ...ganci.map((g) => `${label} a ${nome}: ${g}`),
    `Preventivo ${label} a ${nome}: voci e regole locali`,
  ];
  const ok = candidati.find((c) => c.length + suffisso.length <= 66);
  return (ok ?? `Preventivo ${label} a ${nome}`) + suffisso;
}

function tagliaDescrizione(s: string): string {
  if (s.length <= 158) return s;
  const cut = s.slice(0, 155);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

export function paginaCitta(settore: string, citta: string): PaginaCitta | null {
  if (!haPaginaCitta(settore, citta)) return null;
  const s = SECTORS[settore];
  const f = FATTI_CITTA[citta];
  const p = PROFILI_CITTA[citta];
  const m = MESTIERI[settore];
  const sezioni = sezioniPerPagina({ f, p, settore });
  const ganci = sezioni.map((x) => x.gancio).filter((g): g is string => Boolean(g));

  const title = scegliTitle(s.label, f.nome, ganci);
  const fatti = ganci.slice(0, 2).join(", ");
  const description = tagliaDescrizione(
    `${s.label} a ${f.nome}: ${fatti || "regole locali"}. Dati del comune con le fonti e voci del preventivo, pronto in PDF in 30 secondi.`,
  );

  const intro = `Cosa cambia per ${m.lavoro} a ${f.nome}: ${fatti || "accessi e regole del centro"}. Qui trovi i dati del comune con le fonti, le regole che toccano il preventivo e le voci da non dimenticare.`;

  const faq = sezioni.map((x) => x.faq).filter((q): q is { q: string; a: string } => Boolean(q)).slice(0, 4);

  const altriMestieri = MESTIERI_CITTA.filter((x) => x !== settore)
    .map((x) => ({ slug: x, label: SECTORS[x].label, peso: sezioniPerPagina({ f, p, settore: x })[0]?.peso ?? 0 }))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 6)
    .map(({ slug, label }) => ({ slug, label }));

  const articoli = (SECTOR_ARTICLES[settore] ?? [])
    .map((slug) => BLOG_INDEX.find((a) => a.slug === slug))
    .filter((a): a is (typeof BLOG_INDEX)[number] => Boolean(a))
    .slice(0, 3)
    .map(({ slug, title, category, readingTimeMin }) => ({ slug, title, category, readingTimeMin }));

  const modello = MODELLI_WORD.find((x) => x.settore === settore);
  const canonical = `${SITE}/preventivi/${settore}/${citta}/`;

  const jsonLd: PaginaCitta["jsonLd"] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title.replace(/ \| prevai$/, ""),
      description,
      url: canonical,
      inLanguage: "it",
      about: { "@type": "City", name: f.nome, containedInPlace: { "@type": "AdministrativeArea", name: f.regione } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: s.label, item: `${SITE}/preventivi/${settore}/` },
        { "@type": "ListItem", position: 3, name: f.nome, item: canonical },
      ],
    },
  ];
  if (faq.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
    });
  }

  return {
    settore,
    etichetta: s.label,
    f,
    p,
    title,
    description,
    h1: `${s.label} a ${f.nome}`,
    sottotitolo: `${f.regione} · provincia di ${f.provincia} · ${num(f.popolazione)} abitanti`,
    intro,
    sezioni,
    faq,
    vicine: cittaVicine(f),
    altriMestieri,
    articoli,
    modello,
    canonical,
    jsonLd,
  };
}
