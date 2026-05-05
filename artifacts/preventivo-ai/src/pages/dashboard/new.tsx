import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateQuote } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";

export default function NewQuote() {
  const [input, setInput] = useState("");
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    createQuote.mutate({ data: { rawInput: input } }, {
      onSuccess: (quote) => {
        setLocation(`/dashboard/quotes/${quote.id}`);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nuovo Preventivo</h1>
        <p className="text-muted-foreground mt-1">Descrivi il lavoro in linguaggio naturale, l'intelligenza artificiale genererà un preventivo professionale strutturato.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Descrizione Lavoro</CardTitle>
          <CardDescription>Cosa devi preventivare? Sii il più dettagliato possibile su quantità, materiali e tempistiche.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="es. Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile bianca. Includere anche la rasatura di una parete rovinata in soggiorno e la pittura di 4 porte in legno smaltate di bianco."
            className="min-h-[200px] resize-none text-base p-4"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={createQuote.isPending}
          />
          
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Esempi rapidi:</span>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExampleClick("Tinteggiatura completa appartamento 100mq, inclusa rasatura soffitti e due mani di pittura traspirante. Aggiungere smaltatura 5 infissi.")}
                disabled={createQuote.isPending}
              >
                Imbianchino
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExampleClick("Rifacimento completo impianto elettrico appartamento 80mq. 50 punti luce, quadro generale nuovo, certificazione di conformità.")}
                disabled={createQuote.isPending}
              >
                Elettricista
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExampleClick("Sostituzione caldaia a condensazione 24kW inclusa rimozione vecchia, lavaggio impianto e installazione termostato smart.")}
                disabled={createQuote.isPending}
              >
                Idraulico
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            onClick={handleSubmit} 
            disabled={!input.trim() || createQuote.isPending}
            className="gap-2 bg-primary text-primary-foreground px-8"
            size="lg"
          >
            {createQuote.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Genera Preventivo
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}