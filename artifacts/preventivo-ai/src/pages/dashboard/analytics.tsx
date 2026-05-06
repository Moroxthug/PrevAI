import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Statistiche dettagliate sui tuoi preventivi.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-violet-50 flex items-center justify-center">
          <BarChart3 className="h-8 w-8 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Prossimamente</h2>
          <p className="text-sm text-gray-400 max-w-xs">
            Le analytics avanzate — grafici di trend, conversioni, fatturato mensile — saranno disponibili nella prossima versione.
          </p>
        </div>
      </div>
    </div>
  );
}
