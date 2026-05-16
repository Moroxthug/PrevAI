import { Helmet } from "react-helmet-async";

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
}

export function SeoHead({
  title,
  description,
  canonical,
  ogImage = "https://www.prevai.it/opengraph.jpg",
  noIndex = false,
  ogTitle,
  ogDescription,
  ogUrl,
  ogType = "website",
  twitterCard = "summary_large_image",
  jsonLd = [],
}: SeoHeadProps) {
  const resolvedOgImage = ogImage.startsWith("http") ? ogImage : `https://www.prevai.it${ogImage}`;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedOgUrl = ogUrl ?? canonical;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:url" content={resolvedOgUrl} />
      <meta property="og:image" content={resolvedOgImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content="it_IT" />
      <meta property="og:site_name" content="prevai" />

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
