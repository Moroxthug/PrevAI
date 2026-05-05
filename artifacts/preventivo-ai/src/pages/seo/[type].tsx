import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function SeoLanding() {
  const params = useParams();
  const type = params.type || "professionista";
  
  // Capitalize first letter
  const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
  
  return (
    <div className="flex flex-col min-h-screen">
      <section className="relative bg-background pt-24 pb-20 border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-4xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
            Software per Preventivi per <span className="text-primary">{formattedType}</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10">
            Crea preventivi perfetti in pochi secondi. L'intelligenza artificiale scrive le descrizioni tecniche e fa i calcoli per te. Ideale per la categoria {formattedType}.
          </p>
          <Button size="lg" className="h-14 px-8 text-lg" asChild>
            <Link href="/sign-up">
              Provalo Gratis <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="py-20 bg-muted/30 flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Perché un {formattedType} ha bisogno di PreventivoAI?</h2>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block">Zero tempo perso la sera</strong>
                    <span className="text-muted-foreground">Genera il preventivo direttamente dal cantiere o dal furgone con lo smartphone.</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block">Immagine più professionale</strong>
                    <span className="text-muted-foreground">Invia documenti ordinati, precisi e che trasmettono fiducia ai tuoi clienti.</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <strong className="block">Calcoli senza errori</strong>
                    <span className="text-muted-foreground">L'IVA e i subtotali vengono calcolati automaticamente in modo infallibile.</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="bg-card rounded-xl border shadow-lg overflow-hidden">
               <div className="bg-primary p-6 text-primary-foreground text-center">
                 <h3 className="font-bold text-xl">Pronto in 30 secondi</h3>
                 <p className="opacity-90 text-sm mt-1">Esempio di preventivo generato</p>
               </div>
               <div className="p-6 space-y-4">
                 <div className="h-4 bg-muted rounded w-3/4"></div>
                 <div className="h-4 bg-muted rounded w-1/2"></div>
                 <div className="h-4 bg-muted rounded w-5/6"></div>
                 <div className="h-4 bg-muted rounded w-2/3"></div>
                 
                 <div className="mt-8 border-t pt-4">
                   <div className="flex justify-between font-bold">
                     <span>Totale Lavori</span>
                     <span>€ 1.250,00</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}