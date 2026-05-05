import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, FileText, Zap } from "lucide-react";
import { useGetPlans } from "@workspace/api-client-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: plans } = useGetPlans();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8">
            <Sparkles className="mr-2 h-4 w-4" />
            L'Intelligenza Artificiale per gli Artigiani Italiani
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Crea preventivi professionali in <span className="text-primary">30 secondi</span> con l'AI
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-muted-foreground">
            Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e PreventivoAI genererà un documento impeccabile, pronto da inviare al cliente.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg" asChild>
              <Link href="/sign-up">
                Inizia Gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
              <Link href="#demo">Vedi un esempio</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Perché scegliere PreventivoAI?</h2>
            <p className="mt-4 text-lg text-muted-foreground">Progettato specificamente per le esigenze delle piccole imprese italiane.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Velocità Incredibile</h3>
              <p className="text-muted-foreground">Non devi più passare le serate a fare preventivi. Descrivi il lavoro dal tuo smartphone mentre sei in cantiere.</p>
            </div>
            
            <div className="bg-card p-8 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Professionalità</h3>
              <p className="text-muted-foreground">I preventivi generati sono completi di descrizioni dettagliate, quantità, unità di misura e calcolo IVA automatico.</p>
            </div>
            
            <div className="bg-card p-8 rounded-2xl border shadow-sm hover-elevate transition-all">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Zero Errori</h3>
              <p className="text-muted-foreground">Calcoli matematici sempre corretti. L'AI struttura il documento assicurandosi che non manchi nessun dettaglio importante.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-6">Da un semplice testo a un documento professionale.</h2>
              <div className="bg-muted p-6 rounded-xl mb-6 font-mono text-sm border">
                "Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile bianca. Includere anche la rasatura di una parete rovinata in soggiorno."
              </div>
              <ArrowRight className="h-8 w-8 text-primary mx-auto lg:mx-0 mb-6 rotate-90 lg:rotate-0" />
              <p className="text-lg text-muted-foreground">
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
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Piani Semplici e Trasparenti</h2>
            <p className="mt-4 text-lg text-muted-foreground">Genera preventivi illimitati. Paga solo quando vuoi sbloccare il PDF pulito o abbonati per risparmiare.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans?.map((plan) => (
              <div key={plan.id} className="bg-card rounded-2xl border shadow-sm p-6 flex flex-col hover-elevate transition-all">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold">€{plan.price}</span>
                  {plan.interval && <span className="text-muted-foreground">/{plan.interval}</span>}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  asChild 
                  variant={plan.id.includes('premium') || plan.id.includes('oneshot_clean') ? 'default' : 'outline'} 
                  className="w-full"
                >
                  <Link href="/sign-up">Inizia Ora</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">Pronto a rivoluzionare la tua attività?</h2>
          <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">Unisciti a centinaia di artigiani e professionisti italiani che risparmiano ore ogni settimana.</p>
          <Button size="lg" variant="secondary" className="h-14 px-8 text-lg" asChild>
            <Link href="/sign-up">Crea il tuo Account Gratuito</Link>
          </Button>
        </div>
      </section>
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