// A-5: articoli SEO sulle tasse del forfettario — solo i metadati (i corpi,
// che usano il motore fiscale per l'esempio, stanno in blog-fiscale.ts e non
// entrano nel bundle pubblico).
//
// Escono insieme al livello gratuito del modulo: offerta pubblica **e** regole
// revisionate (D6). Finché `contenutiFiscaliPubblicabili` è false non sono in
// BLOG_INDEX, quindi niente pagina, niente sitemap, niente link dal blog.

import { contenutiFiscaliPubblicabili } from "@workspace/config";
import type { BlogArticleMeta } from "./blog-index";

export const BLOG_FISCALE_META: readonly BlogArticleMeta[] = [
  {
    slug: "tasse-forfettario-elettricista-idraulico",
    title: "Tasse nel forfettario per elettricisti e idraulici: il calcolo con un esempio",
    seoTitle: "Tasse forfettario elettricista e idraulico: calcolo",
    metaDescription:
      "Quanto paga di tasse e contributi un elettricista o un idraulico in regime forfettario: coefficiente, imposta sostitutiva, INPS artigiani e un esempio con i numeri.",
    category: "Business",
    publishedAt: "2026-09-23",
    readingTimeMin: 6,
    relatedSectors: ["elettricista", "idraulico", "termoidraulico"],
  },
  {
    slug: "soglia-85000-forfettario-calcolo",
    title: "Soglia degli 85.000 € nel forfettario: come si calcola e cosa succede se la superi",
    seoTitle: "Soglia 85.000 € forfettario: calcolo e superamento",
    metaDescription:
      "Come si calcola la soglia degli 85.000 € del regime forfettario, cosa conta e cosa no, e cosa succede tra 85.000 e 100.000 € e oltre. Con un esempio per artigiani edili.",
    category: "Business",
    publishedAt: "2026-09-23",
    readingTimeMin: 5,
    relatedSectors: ["muratore", "edilizia", "ristrutturazione"],
  },
  {
    slug: "quanto-mettere-da-parte-tasse-forfettario",
    title: "Quanto mettere da parte ogni mese per le tasse nel forfettario",
    seoTitle: "Quanto accantonare per le tasse nel forfettario",
    metaDescription:
      "Saldo, acconti e contributi INPS: quanto accantonare su ogni incasso per non arrivare a giugno senza soldi, con un esempio per un artigiano in regime forfettario.",
    category: "Business",
    publishedAt: "2026-09-23",
    readingTimeMin: 5,
    relatedSectors: ["imbianchino", "piastrellista", "falegname"],
  },
];

export function blogFiscalePubblicabile(): boolean {
  return contenutiFiscaliPubblicabili(new Date().getFullYear());
}
