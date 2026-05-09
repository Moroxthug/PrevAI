import { Card, CardContent } from "@/components/ui/card";
import { Receipt, Bell } from "lucide-react";

export default function InvoicesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Fatture</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            In arrivo
          </span>
        </div>
        <p className="text-muted-foreground mt-1">Gestione fatturazione elettronica.</p>
      </div>

      <Card>
        <CardContent className="py-20 flex flex-col items-center justify-center gap-5 text-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Receipt className="h-7 w-7 text-amber-500" />
          </div>
          <div className="max-w-md">
            <h2 className="text-xl font-bold text-gray-900">Fatturazione in arrivo</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Presto potrai creare e gestire fatture direttamente da PreventivoAI. Converti i tuoi
              preventivi in fatture elettroniche, invia via SDI e tieni traccia dei pagamenti ricevuti.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-2 w-full max-w-lg">
            {[
              { label: "Fatture elettroniche", desc: "Generazione XML SDI conforme" },
              { label: "Da preventivo", desc: "Converti preventivi approvati in fatture" },
              { label: "Scadenziario", desc: "Traccia pagamenti e scadenze" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-left">
                <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
            <Bell className="h-4 w-4 shrink-0" />
            <span>Ti avviseremo non appena questa funzionalità sarà disponibile.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
