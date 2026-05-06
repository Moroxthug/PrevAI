import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star, Sparkles as SparklesIcon } from "lucide-react";
import { useGetPlans } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { Badge } from "@/components/ui/badge";

function ScrollSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useScrollFade();
  return (
    <section id={id} ref={ref as React.RefObject<HTMLElement>} className={`fade-in-section ${className}`}>
      {children}
    </section>
  );
}

export default function Home() {
  const { data: plans } = useGetPlans();

  const subscriptionPlans = plans?.filter(p => p.interval) ?? [];
  const oneshotPlans = plans?.filter(p => !p.interval) ?? [];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-28 pb-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-10">
            <Sparkles className="mr-2 h-4 w-4" />
            L'Intelligenza Artificiale per gli Artigiani Italiani
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl leading-tight">
            Crea preventivi professionali in <span className="text-primary">30 secondi</span> con l'AI
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-xl text-muted-foreground leading-relaxed">
            Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e prevai genererà un documento impeccabile, pronto da inviare al cliente.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg transition-all hover:scale-105" asChild>
              <Link href="/sign-up">
                Inizia Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg transition-all hover:bg-muted" asChild>
              <Link href="#demo">Vedi un esempio</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <ScrollSection className="py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Perché scegliere prevai?</h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">Progettato specificamente per le esigenze delle piccole imprese italiane.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-9 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-7">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Velocità Incredibile</h3>
              <p className="text-muted-foreground leading-relaxed">Non devi più passare le serate a fare preventivi. Descrivi il lavoro dal tuo smartphone mentre sei in cantiere.</p>
            </div>
            
            <div className="bg-card p-9 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-7">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Professionalità</h3>
              <p className="text-muted-foreground leading-relaxed">I preventivi generati sono completi di descrizioni dettagliate, quantità, unità di misura e calcolo IVA automatico.</p>
            </div>
            
            <div className="bg-card p-9 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-7">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Zero Errori</h3>
              <p className="text-muted-foreground leading-relaxed">Calcoli matematici sempre corretti. L'AI struttura il documento assicurandosi che non manchi nessun dettaglio importante.</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* Demo Section */}
      <ScrollSection id="demo" className="py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-6 leading-snug">Da un semplice testo a un documento professionale.</h2>
              <div className="bg-muted p-6 rounded-xl mb-6 font-mono text-sm border">
                "Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile bianca. Includere anche la rasatura di una parete rovinata in soggiorno."
              </div>
              <ArrowRight className="h-8 w-8 text-primary mx-auto lg:mx-0 mb-6 rotate-90 lg:rotate-0" />
              <p className="text-lg text-muted-foreground leading-relaxed">
                Il nostro motore AI comprende il linguaggio naturale, identifica le singole voci di costo, stima le quantità e impagina il tutto in un formato standard.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur-xl opacity-50" />
              <div className="relative bg-card rounded-xl border shadow-xl overflow-hidden flex flex-col h-[500px]">
                <div className="border-b bg-muted/50 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-muted-foreground ml-4">Preventivo_Mario_Rossi.pdf</div>
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
                      <div className="flex justify-between"><span>Imponibile:</span> <span>€ 1.450,00</span></div>
                      <div className="flex justify-between text-gray-500"><span>IVA 22%:</span> <span>€ 319,00</span></div>
                      <div className="flex justify-between font-bold text-lg text-blue-900 pt-2 border-t"><span>Totale:</span> <span>€ 1.769,00</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* Pricing Section */}
      <ScrollSection className="py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Piani Semplici e Trasparenti</h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">Scegli l'abbonamento più adatto alla tua attività, oppure acquista un singolo preventivo.</p>
          </div>

          {/* Subscription Plans */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-16">
            {subscriptionPlans.map((plan) => {
              const isPro = plan.id === "monthly_pro";
              return (
                <div
                  key={plan.id}
                  className={`bg-card rounded-2xl border p-8 flex flex-col hover-elevate transition-all relative ${
                    isPro
                      ? "border-primary shadow-lg pro-pulse"
                      : "shadow-sm"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow">
                        Più popolare
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <Badge
                        variant={isPro ? "default" : "secondary"}
                        className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                          isPro ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isPro ? "⭐ Pro" : "Starter"}
                      </Badge>
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                    </div>
                    {isPro && (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Star className="h-5 w-5 fill-current" />
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-extrabold">€{plan.price}</span>
                    <span className="text-muted-foreground">/mese</span>
                  </div>

                  {isPro && (
                    <div className="mb-4 text-xs font-semibold text-primary uppercase tracking-widest">
                      ✓ Accesso completo sbloccato
                    </div>
                  )}

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => {
                      const isLocked = !isPro && (
                        feature.toLowerCase().includes("illimitati") ||
                        feature.toLowerCase().includes("premium") ||
                        feature.toLowerCase().includes("foto")
                      );
                      return (
                        <li key={i} className="flex items-start gap-2">
                          {isLocked ? (
                            <Lock className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${isPro ? "text-primary" : "text-muted-foreground"}`} />
                          )}
                          <span className={`text-sm ${isLocked ? "text-muted-foreground/50 line-through" : ""}`}>{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Button
                    asChild
                    variant={isPro ? "default" : "outline"}
                    className={`w-full h-12 transition-all hover:scale-105 ${isPro ? "shadow-md" : ""}`}
                  >
                    <Link href="/sign-up">{isPro ? "Inizia con Pro" : "Inizia con Starter"}</Link>
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-xl mx-auto mb-12">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground font-medium">oppure acquisto singolo</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* One-shot Plans */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {oneshotPlans.map((plan) => {
              const isClean = plan.id === "oneshot_clean";
              return (
                <div
                  key={plan.id}
                  className={`bg-card rounded-xl border p-6 flex flex-col hover-elevate transition-all ${
                    isClean ? "border-primary/30" : ""
                  }`}
                >
                  <h3 className="text-base font-semibold mb-1">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-2xl font-bold">€{plan.price}</span>
                    <span className="text-muted-foreground text-sm"> una tantum</span>
                  </div>
                  <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={isClean ? "default" : "outline"}
                    className="w-full transition-all hover:scale-105"
                  >
                    <Link href="/sign-up">Acquista</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      {/* CTA Section */}
      <ScrollSection className="py-28 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">Pronto a rivoluzionare la tua attività?</h2>
          <p className="text-xl opacity-90 mb-12 max-w-2xl mx-auto leading-relaxed">Unisciti a centinaia di artigiani e professionisti italiani che risparmiano ore ogni settimana.</p>
          <Button size="lg" variant="secondary" className="h-14 px-8 text-lg transition-all hover:scale-105" asChild>
            <Link href="/sign-up">Crea il tuo Account Gratuito</Link>
          </Button>
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
