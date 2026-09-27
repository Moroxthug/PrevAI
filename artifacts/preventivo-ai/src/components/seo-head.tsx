import { Helmet } from "react-helmet-async";
import { MARKET } from "@workspace/config";

interface JsonLdSchema {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

interface SeoHeadProps {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  jsonLd?: JsonLdSchema[];
  noIndex?: boolean;
  /** V2-2: sito monolingua, sempre "it-IT". Conservato per compatibilità dei call site. */
  lang?: "it-IT";
  /** Non più usato (nessuna versione in altra lingua). */
  frCanonical?: string;
}

export function SeoHead({
  title,
  description,
  canonical,
  ogImage = `${MARKET.siteUrl}/opengraph.jpg`,
  noIndex = false,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd = [],
}: SeoHeadProps) {
  const resolvedOgImage = ogImage.startsWith("http") ? ogImage : `${MARKET.siteUrl}${ogImage}`;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedOgUrl = ogUrl ?? canonical;

  return (
    <Helmet htmlAttributes={{ lang: "it" }}>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* hreflang: solo it-IT (PREVAI-V2-PLAN §4 V2-6 "hreflang solo it-IT") */}
      {canonical && <link rel="alternate" hrefLang="it-IT" href={canonical} />}
      {canonical && <link rel="alternate" hrefLang="x-default" href={canonical} />}

      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={resolvedOgUrl} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content="it_IT" />
      <meta property="og:site_name" content={MARKET.brand} />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={resolvedOgImage} />

      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
