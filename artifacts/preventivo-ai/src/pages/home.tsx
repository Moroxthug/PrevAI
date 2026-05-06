import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star } from "lucide-react";
import { useGetPlans } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";

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

  useEffect(() => {
    document.title = "prevai – Preventivi Online per Artigiani e Aziende | AI in 30 Secondi";
  }, []);

  const subscriptionPlans = plans?.filter((p) => p.interval) ?? [];
  const oneshotPlans = plans?.filter((p) => !p.interval) ?? [];

  const handlePlanClick = () => {
    navigate(isSignedIn ? "/dashboard" : "/sign-up");
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-28 pb-36">
        {/* Animated mesh blobs */}
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl leading-[1.1]">
            Crea preventivi professionali in{" "}
            <span className="gradient-text">30 secondi</span> con l'AI
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-xl text-gray-500 leading-relaxed">
            Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a
            parole tue e prevai genererà un documento impeccabile, pronto da
            inviare al cliente.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Inizia Gratuitamente
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
            <Link
              href="#demo"
              className="btn-gradient-outline inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Vedi un esempio
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <ScrollSection className="py-28 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Perché scegliere{" "}
              <span className="gradient-text">prevai</span>?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Velocità Incredibile",
                desc: "Non devi più passare le serate a fare preventivi. Descrivi il lavoro dal tuo smartphone mentre sei in cantiere.",
              },
              {
                icon: <FileText className="h-6 w-6" />,
                title: "Professionalità",
                desc: "I preventivi generati sono completi di descrizioni dettagliate, quantità, unità di misura e calcolo IVA automatico.",
              },
              {
                icon: <CheckCircle2 className="h-6 w-6" />,
                title: "Zero Errori",
                desc: "Calcoli matematici sempre corretti. L'AI struttura il documento assicurandosi che non manchi nessun dettaglio importante.",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="card-soft bg-white p-10 rounded-2xl flex flex-col h-full"
              >
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mb-8 text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {icon}
                </div>
                <h3 className="text-xl font-semibold mb-4 text-gray-900 leading-snug">{title}</h3>
                <p className="text-gray-500 leading-relaxed flex-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── Demo ─────────────────────────────────────────────── */}
      <ScrollSection id="demo" className="py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6 leading-snug">
                Da un semplice testo a un{" "}
                <span className="gradient-text">documento professionale</span>.
              </h2>
              <div className="bg-gray-50 p-6 rounded-2xl mb-6 font-mono text-sm border border-gray-100 text-gray-700">
                "Devo tinteggiare un appartamento di 80mq con due mani di
                pittura lavabile bianca. Includere anche la rasatura di una
                parete rovinata in soggiorno."
              </div>
              <ArrowRight className="h-8 w-8 text-violet-500 mx-auto lg:mx-0 mb-6 rotate-90 lg:rotate-0" />
              <p className="text-lg text-gray-500 leading-relaxed">
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
              <div className="relative bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden flex flex-col h-[560px]">
                {/* Fake browser chrome */}
                <div className="border-b bg-gray-50 px-4 py-3 flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Preventivo_Mario_Rossi.pdf</div>
                </div>

                {/* Quote body — matches real app structure */}
                <div className="flex-1 overflow-hidden bg-white text-black text-[11px] p-6 select-none">
                  {/* Company header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                    <div>
                      <div className="text-base font-bold text-slate-800">Tinteggiature Pro s.r.l.</div>
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
                  <div className="text-center mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                      OFFERTA PER LAVORI DI TINTEGGIATURA
                    </div>
                    <div className="text-[9px] text-slate-500 italic mt-0.5">Appartamento via Verdi 8 — Milano</div>
                  </div>

                  {/* Client */}
                  <div className="mb-3">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Spett.le Committente</div>
                    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                      <div className="font-semibold text-slate-800">Mario Rossi</div>
                      <div className="text-slate-500 text-[10px]">Via Verdi 8, 20121 Milano (MI)</div>
                    </div>
                  </div>

                  {/* Quadro sintetico */}
                  <div className="mb-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">1. Quadro Sintetico</div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="py-1.5 px-2 text-left text-[9px] font-semibold">Capitolo</th>
                          <th className="py-1.5 px-2 text-right text-[9px] font-semibold">Importo netto</th>
                          <th className="py-1.5 px-2 text-left text-[9px] font-semibold hidden sm:table-cell">Osservazione</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="py-1.5 px-2 text-slate-700">A. Tinteggiatura pareti</td>
                          <td className="py-1.5 px-2 text-right font-medium text-slate-800">€ 1.200,00</td>
                          <td className="py-1.5 px-2 text-slate-400 italic hidden sm:table-cell">Voce ordinaria</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-1.5 px-2 text-slate-700">B. Rasatura e preparazione</td>
                          <td className="py-1.5 px-2 text-right font-medium text-slate-800">€ 250,00</td>
                          <td className="py-1.5 px-2 text-slate-400 italic hidden sm:table-cell">Voce straordinaria</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Chapter A detail */}
                  <div className="mb-3">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">2. Computo Metrico Dettagliato</div>
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-100">
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
                            <td className="py-1.5 px-2 text-slate-700">Pittura lavabile bianca (2 mani)</td>
                            <td className="py-1.5 px-1 text-center text-slate-500">mq</td>
                            <td className="py-1.5 px-1 text-center text-slate-500">80</td>
                            <td className="py-1.5 px-2 text-right text-slate-600">€ 15,00</td>
                            <td className="py-1.5 px-2 text-right font-medium text-slate-800">€ 1.200,00</td>
                          </tr>
                          <tr className="bg-slate-200">
                            <td colSpan={4} className="py-1.5 px-2 font-bold text-slate-700 text-right text-[9px]">Subtotale cap. A</td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-800">€ 1.200,00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals box */}
                  <div className="flex justify-end">
                    <div className="w-56 border border-slate-200 rounded overflow-hidden">
                      <div className="flex justify-between px-3 py-1.5 text-slate-600 border-b border-slate-100">
                        <span>Imponibile totale:</span>
                        <span className="font-medium">€ 1.450,00</span>
                      </div>
                      <div className="flex justify-between px-3 py-1.5 text-slate-600 border-b border-slate-100">
                        <span>IVA (22%):</span>
                        <span className="font-medium">€ 319,00</span>
                      </div>
                      <div className="flex justify-between px-3 py-2 bg-slate-800 text-white font-bold text-xs">
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
      <ScrollSection className="py-28 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Piani Semplici e{" "}
              <span className="gradient-text">Trasparenti</span>
            </h2>
            <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              Scegli l'abbonamento più adatto alla tua attività, oppure
              acquista un singolo preventivo.
            </p>
          </div>

          {/* Subscription plans */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-14">
            {subscriptionPlans.map((plan) => {
              const isPro = plan.id === "monthly_pro";
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-8 flex flex-col relative transition-all duration-300 ${
                    isPro
                      ? "border-2 border-violet-300 shadow-xl shadow-violet-100/60 pro-pulse"
                      : "card-soft"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span
                        className="text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                      >
                        ⭐ Più Popolare
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-6">
                    <div>
                      {isPro ? (
                        <span
                          className="text-xs font-bold px-3 py-1 rounded-full text-white mb-3 inline-block"
                          style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                        >
                          Pro
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500 mb-3 inline-block">
                          Starter
                        </span>
                      )}
                      <h3 className="text-2xl font-bold text-gray-900 mt-1">
                        {plan.name}
                      </h3>
                    </div>
                    {isPro && (
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                      >
                        <Star className="h-5 w-5 fill-current" />
                      </div>
                    )}
                  </div>

                  <div className="mb-5">
                    <span className="text-4xl font-extrabold text-gray-900">€{plan.price}</span>
                    <span className="text-gray-400">/mese</span>
                  </div>

                  {isPro && (
                    <p className="text-xs font-semibold gradient-text mb-5">
                      ✓ Accesso completo sbloccato
                    </p>
                  )}

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => {
                      const isLocked =
                        !isPro &&
                        (feature.toLowerCase().includes("illimitati") ||
                          feature.toLowerCase().includes("premium") ||
                          feature.toLowerCase().includes("foto"));
                      return (
                        <li key={i} className="flex items-start gap-2.5">
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-gray-300 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2
                              className={`h-4 w-4 shrink-0 mt-0.5 ${
                                isPro ? "text-violet-500" : "text-gray-400"
                              }`}
                            />
                          )}
                          <span
                            className={`text-sm ${
                              isLocked ? "text-gray-300 line-through" : "text-gray-600"
                            }`}
                          >
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {isPro ? (
                    <button
                      onClick={handlePlanClick}
                      className="btn-gradient inline-flex h-12 items-center justify-center w-full text-sm font-semibold"
                    >
                      Inizia con Pro
                    </button>
                  ) : (
                    <button
                      onClick={handlePlanClick}
                      className="btn-gradient-outline inline-flex h-12 items-center justify-center w-full text-sm font-semibold"
                    >
                      Inizia con Starter
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-xl mx-auto mb-10">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400 font-medium">
              oppure acquisto singolo
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* One-shot plans */}
          <div className="grid md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {oneshotPlans.map((plan) => {
              const isClean = plan.id === "oneshot_clean";
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 flex flex-col card-soft ${
                    isClean ? "border border-violet-100" : ""
                  }`}
                >
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-gray-900">€{plan.price}</span>
                    <span className="text-gray-400 text-sm"> una tantum</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isClean ? (
                    <button
                      onClick={handlePlanClick}
                      className="btn-gradient inline-flex h-10 items-center justify-center w-full text-sm font-semibold"
                    >
                      Acquista
                    </button>
                  ) : (
                    <button
                      onClick={handlePlanClick}
                      className="btn-gradient-outline inline-flex h-10 items-center justify-center w-full text-sm font-semibold"
                    >
                      Acquista
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      {/* ── Alternativa Excel/Word ───────────────────────────── */}
      <ScrollSection className="py-20 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">Niente più fogli di calcolo</span>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
                Dimentica <span className="gradient-text">Excel e Word</span>
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                I template Excel si rompono. I documenti Word non calcolano. Con prevai descrivi il lavoro a parole e in 30 secondi hai un documento professionale pronto da inviare.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { href: "/seo/modello-excel", label: "Alternativa al preventivo Excel", desc: "Niente formule. Niente errori. Solo risultati.", badge: "vs Excel" },
                { href: "/seo/modello-word", label: "Alternativa al template Word", desc: "PDF professionale in un clic, senza formattazione manuale.", badge: "vs Word" },
                { href: "/seo/come-fare-preventivo", label: "Come fare un preventivo", desc: "Guida pratica per artigiani e PMI italiane.", badge: "Guida" },
              ].map(({ href, label, desc, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-violet-200 hover:shadow-md transition-all group card-soft"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{badge}</span>
                  <h3 className="font-semibold text-gray-900 mt-3 mb-1 text-sm leading-snug group-hover:text-violet-700 transition-colors">{label}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-violet-500 font-semibold mt-3">Scopri di più <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── Per ogni settore ──────────────────────────────────── */}
      <ScrollSection className="py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-4">
              Preventivi per{" "}
              <span className="gradient-text">ogni settore</span>
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              Dall'imbianchino all'elettricista, dal giardiniere al serramentista: prevai conosce il tuo mestiere.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
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
                className="flex items-center gap-2 bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:text-violet-700 transition-colors group"
              >
                <ArrowRight className="h-3.5 w-3.5 text-violet-300 group-hover:text-violet-500 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/seo/preventivi-gratis" className="text-sm font-semibold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
              Preventivi online gratuiti <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <ScrollSection className="py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Gradient decorative ring */}
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-8"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.12))" }}
          >
            <Sparkles className="h-7 w-7 text-violet-500" />
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
            Pronto a{" "}
            <span className="gradient-text">rivoluzionare</span> la tua attività?
          </h2>
          <p className="text-xl text-gray-500 mb-12 max-w-2xl mx-auto leading-relaxed">
            Unisciti a centinaia di artigiani e professionisti italiani che
            risparmiano ore ogni settimana.
          </p>
          <Link
            href="/sign-up"
            className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold"
          >
            Crea il tuo Account Gratuito
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </ScrollSection>
    </div>
  );
}

function Sparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
