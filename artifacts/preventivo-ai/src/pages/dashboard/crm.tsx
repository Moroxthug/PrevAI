import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Bell } from "lucide-react";

export default function CrmPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            In arrivo
          </span>
        </div>
        <p className="text-muted-foreground mt-1">Gestione relazioni con i clienti.</p>
      </div>

      <Card>
        <CardContent className="py-20 flex flex-col items-center justify-center gap-5 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Briefcase className="h-7 w-7 text-blue-500" />
          </div>
          <div className="max-w-md">
            <h2 className="text-xl font-bold text-gray-900">CRM in arrivo</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Un CRM pensato per i professionisti italiani. Tieni traccia delle trattative, gestisci i
              follow-up con i clienti e monitora lo stato di ogni lavoro dalla prima visita alla
              chiusura del contratto.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-2 w-full max-w-lg">
            {[
              { label: "Pipeline trattative", desc: "Visualizza lo stato di ogni opportunità" },
              { label: "Note & follow-up", desc: "Promemoria e note sui clienti" },
              { label: "Storico contatti", desc: "Ogni interazione registrata in un posto" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-left">
                <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Ti avviseremo non appena questa funzionalità sarà disponibile.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
