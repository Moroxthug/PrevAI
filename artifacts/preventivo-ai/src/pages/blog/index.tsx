import { Link } from "wouter";
import { BLOG_ARTICLES, BLOG_LIST_TITLE, BLOG_LIST_DESCRIPTION } from "@/data/blog-data";
import { SeoHead } from "@/components/seo-head";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  Professioni: "bg-violet-50 text-violet-700",
  Prezzi: "bg-cyan-50 text-cyan-700",
  Consigli: "bg-amber-50 text-amber-700",
  Tool: "bg-green-50 text-green-700",
  Innovazione: "bg-blue-50 text-blue-700",
  Business: "bg-rose-50 text-rose-700",
};

const BASE_URL = "https://www.prevai.it";

export default function BlogPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title={BLOG_LIST_TITLE}
        description={BLOG_LIST_DESCRIPTION}
        canonical={`${BASE_URL}/blog`}
      />
      <nav aria-label="Percorso di navigazione" className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center text-sm text-gray-500 flex-wrap gap-1">
            <li><Link href="/" className="hover:text-violet-600 transition-colors">Home</Link></li>
            <li aria-hidden="true" className="mx-1.5 text-gray-300">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">Blog</li>
          </ol>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-violet-50/60 to-cyan-50/30 pt-16 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 border border-violet-200 px-4 py-1.5 text-sm font-medium text-violet-700 mb-6">
            Approfondimenti
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4 leading-tight">
            Guide e consigli per <span className="gradient-text">artigiani e PMI</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            {BLOG_LIST_DESCRIPTION}
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_ARTICLES.map((article) => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {article.category}
                    </span>
                    <span className="text-xs text-gray-400">{article.readingTimeMin} min</span>
                  </div>
                  <h2 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-violet-700 transition-colors flex-1">
                    {article.title}
                  </h2>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-3">
                    {article.metaDescription}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                    <time className="text-xs text-gray-400" dateTime={article.publishedAt}>
                      {formatDate(article.publishedAt)}
                    </time>
                    <span className="text-xs font-semibold text-violet-600 group-hover:translate-x-0.5 transition-transform">
                      Leggi →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-t border-gray-100 mt-auto">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-2xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Pronto a creare preventivi in <span className="gradient-text">30 secondi</span>?
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.
          </p>
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-12 items-center justify-center px-8 text-sm font-semibold"
          >
            Inizia Gratuitamente
          </Link>
        </div>
      </section>
    </div>
  );
}
