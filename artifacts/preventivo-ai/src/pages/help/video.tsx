// POCKET-7 (riga 64): la raccolta dei video brevi dell'aiuto, /help/video/. Prerenderizzata come le altre
// pagine dell'aiuto; ogni video porta anche all'articolo che lo spiega per esteso.
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { HELP_VIDEOS } from "@/data/help-videos";
import { findHelpArticle } from "@/data/help-articles";
import { HelpVideoPlayer } from "@/components/help-video";
import { SeoHead } from "@/components/seo-head";
import { useLanguage } from "@/i18n/LanguageContext";

const BASE_URL = "https://prevai.it";
const TITLE = "Video: PrevAI in pochi minuti";
const DESCRIPTION = "Brevi video muti con i sottotitoli: il primo preventivo, l'app in un minuto, il bonifico. Registrati dall'app PrevAI.";

export default function HelpVideosPage() {
  const { t, lang } = useLanguage();
  const canonical = `${BASE_URL}/help/video/`;
  const jsonLd = [
    {
      "@context": "https://schema.org" as const,
      "@type": "CollectionPage" as const,
      name: TITLE,
      description: DESCRIPTION,
      url: canonical,
      inLanguage: lang,
      hasPart: HELP_VIDEOS.map((v) => ({
        "@type": "VideoObject" as const,
        name: v.title,
        description: v.sub,
        thumbnailUrl: `${BASE_URL}/video/${v.file}.jpg`,
        contentUrl: `${BASE_URL}/video/${v.file}.mp4`,
        uploadDate: "2026-10-23",
        duration: `PT${Math.floor(v.secs / 60)}M${v.secs % 60}S`,
      })),
    },
    {
      "@context": "https://schema.org" as const,
      "@type": "BreadcrumbList" as const,
      itemListElement: [
        { "@type": "ListItem" as const, position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem" as const, position: 2, name: t("help.breadcrumb"), item: `${BASE_URL}/help/` },
        { "@type": "ListItem" as const, position: 3, name: "Video", item: canonical },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead title={`${TITLE} | prevai`} description={DESCRIPTION} canonical={canonical} jsonLd={jsonLd} />
      <div className="wrap">
        <nav aria-label={t("seo.city.breadcrumbAria")} className="crumbs">
          <Link href="/">{t("blog.breadcrumbHome")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href="/help/">{t("help.breadcrumb")}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">Video</span>
        </nav>
      </div>
      <header className="wrap" style={{ maxWidth: 780, paddingBlock: "clamp(12px, 2vw, 24px) clamp(28px, 3.5vw, 44px)" }}>
        <p className="eyebrow grey" style={{ marginBottom: 14 }}>{t("help.eyebrow")}</p>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 14 }}>{TITLE}</h1>
        <p className="lead" style={{ maxWidth: "none" }}>{DESCRIPTION}</p>
      </header>
      <main className="flex-1 wrap" style={{ paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="grid lg:grid-cols-2 gap-6">
          {HELP_VIDEOS.map((v) => {
            const article = findHelpArticle(v.article);
            return (
              <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <HelpVideoPlayer video={v} />
                {article ? (
                  <Link href={`/help/${article.slug}/`} className="cta-link" style={{ fontSize: 13.5 }}>
                    {article.title[lang]} <ArrowRight className="chev h-4 w-4" />
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
