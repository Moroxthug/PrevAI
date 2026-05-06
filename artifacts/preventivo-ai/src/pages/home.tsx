import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star } from "lucide-react";
import { useGetPlans } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { Badge } from "@/components/ui/badge";

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

  const subscriptionPlans = plans?.filter((p) => p.interval) ?? [];
  const oneshotPlans = plans?.filter((p) => !p.interval) ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white pt-28 pb-36">
        {/* Animated mesh blobs */}
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 mb-10">
            <Sparkles className="h-4 w-4" />
            L'Intelligenza Artificiale per gli Artigiani Italiani
          </div>

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
            <Link
              href="/sign-up"
              className="btn-gradient inline-flex h-14 items-center justify-center px-8 text-lg font-semibold"
            >
              Inizia Gratuitamente
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
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
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Perché scegliere{" "}
              <span className="gradient-text">prevai</span>?
            </h2>
            <p className="mt-5 text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              Progettato specificamente per le esigenze delle piccole imprese
              italiane.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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
                className="card-soft bg-white p-9 rounded-2xl flex flex-col"
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-7 text-white"
                  style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}
                >
                  {icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-gray-900">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
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

            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl blur-2xl opacity-40"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.15))" }}
              />
              <div className="relative bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden flex flex-col h-[500px]">
                <div className="border-b bg-gray-50 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">
                    Preventivo_Mario_Rossi.pdf
                  </div>
                </div>
                <div className="p-8 flex-1 overflow-hidden bg-white text-black text-sm">
                  <div className="flex justify-between mb-8 border-b pb-4">
                    <div>
                      <div className="font-bold text-xl text-blue-900">Tinteggiature Pro</div>
                      <div className="text-gray-500 mt-1">P.IVA: IT123456789</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-700">Preventivo #2024-042</div>
                      <div className="text-gray-500">Data: Oggi</div>
                    </div>
                  </div>
                  <table className="w-full text-left mb-8">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="py-2">Descrizione</th>
                        <th className="py-2 text-right">Q.tà</th>
                        <th className="py-2 text-right">Prezzo</th>
                        <th className="py-2 text-right">Totale</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      <tr className="border-b border-gray-100">
                        <td className="py-3">Tinteggiatura con pittura lavabile bianca (due mani)</td>
                        <td className="py-3 text-right">80 mq</td>
                        <td className="py-3 text-right">€ 15,00</td>
                        <td className="py-3 text-right">€ 1.200,00</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3">Rasatura parete soggiorno rovinata</td>
                        <td className="py-3 text-right">1 a corpo</td>
                        <td className="py-3 text-right">€ 250,00</td>
                        <td className="py-3 text-right">€ 250,00</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="flex justify-end border-t border-gray-800 pt-4">
                    <div className="w-48 space-y-2">
                      <div className="flex justify-between">
                        <span>Imponibile:</span>
                        <span>€ 1.450,00</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>IVA 22%:</span>
                        <span>€ 319,00</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg text-blue-900 pt-2 border-t">
                        <span>Totale:</span>
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
                    <Link
                      href="/sign-up"
                      className="btn-gradient inline-flex h-12 items-center justify-center w-full text-sm font-semibold"
                    >
                      Inizia con Pro
                    </Link>
                  ) : (
                    <Link
                      href="/sign-up"
                      className="btn-gradient-outline inline-flex h-12 items-center justify-center w-full text-sm font-semibold"
                    >
                      Inizia con Starter
                    </Link>
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
                    <Link
                      href="/sign-up"
                      className="btn-gradient inline-flex h-10 items-center justify-center w-full text-sm font-semibold"
                    >
                      Acquista
                    </Link>
                  ) : (
                    <Link
                      href="/sign-up"
                      className="btn-gradient-outline inline-flex h-10 items-center justify-center w-full text-sm font-semibold"
                    >
                      Acquista
                    </Link>
                  )}
                </div>
              );
            })}
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
