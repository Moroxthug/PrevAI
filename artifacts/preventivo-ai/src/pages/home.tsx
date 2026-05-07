import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star, Sparkles, Mic, ImagePlus, Check, X } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useGetPlans } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { useState, useRef } from "react";

function ScrollSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFade();
  return (
    <section
      id={id}
      ref={ref as React.RefObject<HTMLElement>}
      className={`fade-in-section ${className}`}
    >
      {children}
    </section>
  );
}

export default function Home() {
  const { data: plans } = useGetPlans();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const [homepageInput, setHomepageInput] = useState("");
  const homepageInputRef = useRef<HTMLInputElement>(null);

  const subscriptionPlans = plans?.filter((p) => p.interval) ?? [];
  const oneshotPlans = plans?.filter((p) => !p.interval) ?? [];

  const handlePlanClick = () => {
    navigate(isSignedIn ? "/dashboard" : "/sign-up");
  };

  const handleHomepageSubmit = () => {
    const trimmed = homepageInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem("prevai:homepage_prompt", trimmed);
    navigate(isSignedIn ? "/dashboard/new" : "/sign-up?next=/dashboard/new");
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "prevai",
    url: "https://www.prevai.it",
    description:
      "Software AI per preventivi professionali in 30 secondi. Per artigiani, PMI e freelance italiani.",
    inLanguage: "it",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://www.prevai.it/seo/{search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title="prevai – Preventivi Online per Artigiani e Aziende | AI in 30 Secondi"
        description="Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e prevai genera un preventivo professionale con IVA, voci di costo e totali in 30 secondi."
        canonical="https://www.prevai.it"
        jsonLd={[websiteJsonLd]}
      />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-10 pb-20">
        {/* Animated mesh blobs */}
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl leading-[1.1]">
            Crea preventivi professionali in{" "}
            <span className="gradient-text">30 secondi</span> con l'AI
          </h1>

          {/* ── AI Input Bar ── */}
          <div className="mt-8 mx-auto max-w-2xl">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
              {/* Upload foto — sinistra */}
              <div className="group relative shrink-0">
                <button
                  disabled
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Funzione in arrivo
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>

              {/* Input */}
              <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              <input
                ref={homepageInputRef}
                value={homepageInput}
                onChange={(e) => setHomepageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && homepageInput.trim()) handleHomepageSubmit(); }}
                placeholder="Descrivi il lavoro e ottieni un preventivo in 30 secondi..."
                className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0"
              />

              {/* Microfono — destra, prima del send */}
              <div className="group relative shrink-0">
                <button
                  disabled
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                  Funzione in arrivo
                  <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>

              {/* Send */}
              <button
                onClick={handleHomepageSubmit}
                disabled={!homepageInput.trim()}
                className="shrink-0 btn-gradient inline-flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-40 transition-all"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2.5 text-xs text-gray-400">
              7 giorni gratis · Nessuna carta richiesta
            </p>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-sm text-gray-500 leading-relaxed">
            Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a
            parole tue e prevai genererà un documento impeccabile, pronto da
            inviare al cliente.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
              className="btn-gradient inline-flex h-10 items-center justify-center px-6 text-sm font-semibold"
            >
              Inizia Gratuitamente
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <Link
              href="#demo"
              className="btn-gradient-outline inline-flex h-10 items-center justify-center px-6 text-sm font-semibold"
            >
              Vedi un esempio
            </Link>
          </div>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────── */}
      <ScrollSection className="py-14 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">Confronto</span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                prevai vs{" "}
                <span className="gradient-text">Word ed Excel</span>
              </h2>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* Header */}
              <div className="grid grid-cols-4 border-b border-gray-100">
                <div className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Funzione</div>
                {[
                  { label: "prevai", gradient: true },
                  { label: "Word", gradient: false },
                  { label: "Excel", gradient: false },
                ].map(({ label, gradient }) => (
                  <div key={label} className={`px-4 py-3.5 text-center text-sm font-bold ${gradient ? "bg-gradient-to-b from-violet-50 to-cyan-50/40" : ""}`}>
                    {gradient ? <span className="gradient-text">{label}</span> : <span className="text-gray-400">{label}</span>}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {[
                {
                  feature: "Preventivo in 30 secondi",
                  prevai: { ok: true, label: "~30 sec" },
                  word:   { ok: false, label: "30–60 min" },
                  excel:  { ok: false, label: "20–40 min" },
                },
                {
                  feature: "Upload foto del cantiere",
                  prevai: { ok: true,  label: "Integrato" },
                  word:   { ok: false, label: "Non supportato" },
                  excel:  { ok: false, label: "Non supportato" },
                },
                {
                  feature: "Descrizione vocale",
                  prevai: { ok: true,  label: "In arrivo" },
                  word:   { ok: false, label: "Non disponibile" },
                  excel:  { ok: false, label: "Non disponibile" },
                },
                {
                  feature: "Calcolo IVA automatico",
                  prevai: { ok: true,  label: "Sempre corretto" },
                  word:   { ok: false, label: "Manuale" },
                  excel:  { ok: true,  label: "Con formule" },
                },
                {
                  feature: "PDF professionale",
                  prevai: { ok: true,  label: "Con logo e branding" },
                  word:   { ok: true,  label: "Solo testo" },
                  excel:  { ok: false, label: "Layout difficile" },
                },
                {
                  feature: "Nessuna competenza richiesta",
                  prevai: { ok: true,  label: "Solo descrizione" },
                  word:   { ok: false, label: "Formattazione manuale" },
                  excel:  { ok: false, label: "Formule complesse" },
                },
              ].map(({ feature, prevai, word, excel }, rowIdx) => (
                <div key={feature} className={`grid grid-cols-4 border-b border-gray-100 last:border-0 ${rowIdx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                  <div className="px-5 py-3.5 text-sm text-gray-700 font-medium flex items-center">{feature}</div>
                  {[
                    { cell: prevai, highlight: true },
                    { cell: word,   highlight: false },
                    { cell: excel,  highlight: false },
                  ].map(({ cell, highlight }, i) => (
                    <div key={i} className={`px-4 py-3.5 flex flex-col items-center justify-center gap-0.5 ${highlight ? "bg-gradient-to-b from-violet-50/60 to-cyan-50/30" : ""}`}>
                      {cell.ok
                        ? <Check className={`h-4 w-4 ${highlight ? "text-violet-600" : "text-emerald-500"}`} />
                        : <X className="h-4 w-4 text-gray-300" />
                      }
                      <span className={`text-[11px] font-medium text-center leading-tight ${cell.ok ? (highlight ? "text-violet-700" : "text-gray-600") : "text-gray-300"}`}>
                        {cell.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
                className="btn-gradient inline-flex h-10 items-center justify-center px-6 text-sm font-semibold"
              >
                Prova prevai gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── Demo ─────────────────────────────────────────────── */}
      <ScrollSection id="demo" className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-4 leading-snug">
                Da un semplice testo a un{" "}
                <span className="gradient-text">documento professionale</span>.
              </h2>
              <div className="bg-gray-50 p-5 rounded-xl mb-4 font-mono text-sm border border-gray-100 text-gray-700">
                "Devo tinteggiare un appartamento di 80mq con due mani di
                pittura lavabile bianca. Includere anche la rasatura di una
                parete rovinata in soggiorno."
              </div>
              <ArrowRight className="h-6 w-6 text-violet-500 mx-auto lg:mx-0 mb-4 rotate-90 lg:rotate-0" />
              <p className="text-sm text-gray-500 leading-relaxed">
                Il nostro motore AI comprende il linguaggio naturale, identifica
                le singole voci di costo, stima le quantità e impagina il tutto
                in un formato standard.
              </p>
            </div>

            {/* Real quote preview — mirrors actual app UI */}
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-2xl blur-2xl opacity-40"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))" }}
              />
              <div className="relative bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden flex flex-col h-[500px]">
                {/* Fake browser chrome */}
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Preventivo_Mario_Rossi.pdf</div>
                </div>

                {/* Quote body — matches real app structure */}
                <div className="flex-1 overflow-hidden bg-white text-black text-[11px] p-5 select-none">
                  {/* Company header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Tinteggiature Pro s.r.l.</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">P.IVA: IT09876543210</div>
                      <div className="text-slate-500 text-[10px]">Via Roma 12, 20100 Milano</div>
                      <div className="text-slate-500 text-[10px]">Tel: +39 02 1234567</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Preventivo</div>
                      <div className="text-xs font-bold text-slate-700 mt-1">N. 2024-042</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Data: 06/05/2024</div>
                    </div>
                  </div>

                  {/* Document title */}
                  <div className="text-center mb-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                      OFFERTA PER LAVORI DI TINTEGGIATURA
                    </div>
                    <div className="text-[9px] text-slate-500 italic mt-0.5">Appartamento via Verdi 8 — Milano</div>
                  </div>

                  {/* Client */}
                  <div className="mb-2.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Spett.le Committente</div>
                    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
                      <div className="font-semibold text-slate-800">Mario Rossi</div>
                      <div className="text-slate-500 text-[10px]">Via Verdi 8, 20121 Milano (MI)</div>
                    </div>
                  </div>

                  {/* Quadro sintetico */}
                  <div className="mb-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">1. Quadro Sintetico</div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="py-1 px-2 text-left text-[9px] font-semibold">Capitolo</th>
                          <th className="py-1 px-2 text-right text-[9px] font-semibold">Importo netto</th>
                          <th className="py-1 px-2 text-left text-[9px] font-semibold hidden sm:table-cell">Osservazione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="py-1 px-2 text-slate-700">A. Tinteggiatura pareti</td>
                          <td className="py-1 px-2 text-right font-medium text-slate-800">€ 1.200,00</td>
                          <td className="py-1 px-2 text-slate-400 italic hidden sm:table-cell">Voce ordinaria</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-1 px-2 text-slate-700">B. Rasatura e preparazione</td>
                          <td className="py-1 px-2 text-right font-medium text-slate-800">€ 250,00</td>
                          <td className="py-1 px-2 text-slate-400 italic hidden sm:table-cell">Voce straordinaria</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Chapter A detail */}
                  <div className="mb-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">2. Computo Metrico Dettagliato</div>
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100">
                        <span className="font-bold text-slate-800 text-[10px]">A. Tinteggiatura pareti</span>
                        <span className="text-[10px] font-semibold text-slate-700">€ 1.200,00</span>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-700 text-white">
                            <th className="py-1 px-2 text-left text-[9px]">Descrizione</th>
                            <th className="py-1 px-1 text-center text-[9px] w-8">U.M.</th>
                            <th className="py-1 px-1 text-center text-[9px] w-8">Q.tà</th>
                            <th className="py-1 px-2 text-right text-[9px] w-16">P.u.</th>
                            <th className="py-1 px-2 text-right text-[9px] w-16">Totale</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="py-1 px-2 text-slate-700">Pittura lavabile bianca (2 mani)</td>
                            <td className="py-1 px-1 text-center text-slate-500">mq</td>
                            <td className="py-1 px-1 text-center text-slate-500">80</td>
                            <td className="py-1 px-2 text-right text-slate-600">€ 15,00</td>
                            <td className="py-1 px-2 text-right font-medium text-slate-800">€ 1.200,00</td>
                          </tr>
                          <tr className="bg-slate-200">
                            <td colSpan={4} className="py-1 px-2 font-bold text-slate-700 text-right text-[9px]">Subtotale cap. A</td>
                            <td className="py-1 px-2 text-right font-bold text-slate-800">€ 1.200,00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals box */}
                  <div className="flex justify-end">
                    <div className="w-52 border border-slate-200 rounded overflow-hidden">
                      <div className="flex justify-between px-3 py-1 text-slate-600 border-b border-slate-100">
                        <span>Imponibile totale:</span>
                        <span className="font-medium">€ 1.450,00</span>
                      </div>
                      <div className="flex justify-between px-3 py-1 text-slate-600 border-b border-slate-100">
                        <span>IVA (22%):</span>
                        <span className="font-medium">€ 319,00</span>
                      </div>
                      <div className="flex justify-between px-3 py-1.5 bg-slate-800 text-white font-bold text-xs">
                        <span>TOTALE</span>
                        <span>€ 1.769,00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <ScrollSection className="py-14 bg-gray-50/60" id="prezzi">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Piani Semplici e{" "}
              <span className="gradient-text">Trasparenti</span>
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              7 giorni di prova gratuita inclusi — nessuna carta richiesta.
            </p>
          </div>

          {/* Beta coupon banner */}
          <div className="max-w-3xl mx-auto mb-7">
            <div className="bg-gradient-to-r from-violet-600 to-cyan-500 rounded-xl px-4 py-3 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">🎁</span>
                <div className="min-w-0">
                  <span className="text-white font-semibold text-sm">Offerta lancio — primi 50 clienti</span>
                  <span className="text-white/80 text-xs ml-2 hidden sm:inline">50% di sconto sul primo mese</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <code className="bg-white/20 text-white font-bold text-xs px-2.5 py-1 rounded-lg tracking-wider border border-white/30">
                  BETAPREVAI
                </code>
                <button
                  onClick={handlePlanClick}
                  className="bg-white text-violet-700 font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
                >
                  Usa →
                </button>
              </div>
            </div>
          </div>

          {/* Subscription plans — 3 columns */}
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
            {subscriptionPlans.map((plan) => {
              const isPro = plan.id === "monthly_pro";
              const isElite = plan.id === "monthly_elite";
              const isStarter = plan.id === "monthly_starter";
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl p-5 flex flex-col relative transition-all duration-300 ${
                    isPro
                      ? "border-2 border-violet-300 shadow-xl shadow-violet-100/60 pro-pulse"
                      : isElite
                        ? "border-2 border-amber-300 shadow-lg shadow-amber-100/40"
                        : "card-soft"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className="text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                      >
                        ⭐ Più Popolare
                      </span>
                    </div>
                  )}
                  {isElite && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                        👑 Illimitato
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block ${
                      isPro ? "bg-violet-100 text-violet-700" : isElite ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {plan.name}
                    </span>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-extrabold text-gray-900">€{plan.price}</span>
                      <span className="text-gray-400 text-xs mb-0.5">/mese</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-5 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className={`h-3 w-3 shrink-0 mt-0.5 ${
                          isPro ? "text-violet-500" : isElite ? "text-amber-500" : "text-gray-400"
                        }`} />
                        <span className="text-xs text-gray-600 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={handlePlanClick}
                    className={`inline-flex h-9 items-center justify-center w-full text-xs font-semibold rounded-lg transition-all ${
                      isPro
                        ? "btn-gradient"
                        : isElite
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "btn-gradient-outline"
                    }`}
                  >
                    {isStarter ? "Inizia con Starter" : isPro ? "Inizia con Pro" : "Inizia con Elite"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-xl mx-auto mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">oppure acquisto singolo</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* One-shot plans */}
          <div className="grid md:grid-cols-2 gap-3 max-w-md mx-auto">
            {oneshotPlans.map((plan) => {
              const isClean = plan.id === "oneshot_clean";
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl p-4 flex flex-col card-soft ${
                    isClean ? "border border-violet-100" : ""
                  }`}
                >
                  <h3 className="text-xs font-semibold text-gray-900 mb-0.5">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-lg font-bold text-gray-900">€{plan.price}</span>
                    <span className="text-gray-400 text-[10px]"> una tantum</span>
                  </div>
                  <ul className="space-y-1 mb-4 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handlePlanClick}
                    className={`inline-flex h-8 items-center justify-center w-full text-xs font-semibold rounded-lg transition-all ${
                      isClean ? "btn-gradient" : "btn-gradient-outline"
                    }`}
                  >
                    Acquista
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      {/* ── Alternativa Excel/Word ───────────────────────────── */}
      <ScrollSection className="py-14 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">Niente più fogli di calcolo</span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-3">
                Dimentica <span className="gradient-text">Excel e Word</span>
              </h2>
              <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
                I template Excel si rompono. I documenti Word non calcolano. Con prevai descrivi il lavoro a parole e in 30 secondi hai un documento professionale pronto da inviare.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { href: "/seo/modello-excel", label: "Alternativa al preventivo Excel", desc: "Niente formule. Niente errori. Solo risultati.", badge: "vs Excel" },
                { href: "/seo/modello-word", label: "Alternativa al template Word", desc: "PDF professionale in un clic, senza formattazione manuale.", badge: "vs Word" },
                { href: "/seo/come-fare-preventivo", label: "Come fare un preventivo", desc: "Guida pratica per artigiani e PMI italiane.", badge: "Guida" },
              ].map(({ href, label, desc, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:border-violet-200 hover:shadow-md transition-all group card-soft"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{badge}</span>
                  <h3 className="font-semibold text-gray-900 mt-2.5 mb-1 text-sm leading-snug group-hover:text-violet-700 transition-colors">{label}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-violet-500 font-semibold mt-2">Scopri di più <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── Per ogni settore ──────────────────────────────────── */}
      <ScrollSection className="py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-2">
              Preventivi per{" "}
              <span className="gradient-text">ogni settore</span>
            </h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              Dall'imbianchino all'elettricista, dal giardiniere al serramentista: prevai conosce il tuo mestiere.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-w-3xl mx-auto">
            {[
              { href: "/seo/imbianchino", label: "Imbianchini" },
              { href: "/seo/elettricista", label: "Elettricisti" },
              { href: "/seo/idraulico", label: "Idraulici" },
              { href: "/seo/muratore", label: "Muratori" },
              { href: "/seo/edilizia", label: "Imprese Edili" },
              { href: "/seo/ristrutturazione", label: "Ristrutturazioni" },
              { href: "/seo/pittore", label: "Pittori Edili" },
              { href: "/seo/piastrellista", label: "Piastrellisti" },
              { href: "/seo/pavimentista", label: "Pavimentisti" },
              { href: "/seo/falegname", label: "Falegnami" },
              { href: "/seo/carpentiere", label: "Carpentieri" },
              { href: "/seo/serramentista", label: "Serramentisti" },
              { href: "/seo/tetto", label: "Coperture e Tetti" },
              { href: "/seo/condizionatori", label: "Climatizzatori" },
              { href: "/seo/giardiniere", label: "Giardinieri" },
              { href: "/seo/termoidraulico", label: "Termoidraulici" },
              { href: "/seo/freelance", label: "Freelance" },
              { href: "/seo/geometra", label: "Geometri" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:text-violet-700 transition-colors group"
              >
                <ArrowRight className="h-3 w-3 text-violet-300 group-hover:text-violet-500 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
          <div className="text-center mt-5">
            <Link href="/seo/preventivi-gratis" className="text-xs font-semibold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
              Preventivi online gratuiti <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <ScrollSection className="py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-3">
            Pronto a{" "}
            <span className="gradient-text">rivoluzionare</span> la tua attività?
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
            Unisciti a centinaia di artigiani e professionisti italiani che
            risparmiano ore ogni settimana.
          </p>
          <button
            onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
            className="btn-gradient inline-flex h-11 items-center justify-center px-8 text-sm font-semibold"
          >
            Crea il tuo Account Gratuito
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </ScrollSection>
    </div>
  );
}
