import { ArrowRight, Sparkles, Check, Shield, Cpu, Euro } from "lucide-react";

export function Preview() {
  return (
    <div className="min-h-screen bg-white font-sans antialiased text-gray-900">
      <style>{`
        .gradient-text {
          background: linear-gradient(135deg, #7C3AED, #06B6D4);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .btn-gradient {
          background: linear-gradient(135deg, #7C3AED, #06B6D4);
          color: white;
          border-radius: 9999px;
          transition: transform .15s ease, box-shadow .15s ease;
          box-shadow: 0 8px 24px -8px rgba(124,58,237,.5);
        }
        .btn-gradient:hover { transform: translateY(-1px); box-shadow: 0 12px 28px -8px rgba(124,58,237,.6); }
        .card-soft { box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 4px 12px -4px rgba(0,0,0,.06); }
      `}</style>

      {/* ───────── CONTEXTO: fine sezione Pricing (esistente) ───────── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Piani Semplici e Trasparenti</h2>
            <p className="text-gray-500 mt-2">7 giorni di prova gratuita inclusi — nessuna carta richiesta.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Starter", price: "€19" },
              { name: "Pro", price: "€49", highlight: true },
              { name: "Elite", price: "€59" },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl p-6 bg-white card-soft border ${p.highlight ? "border-violet-200" : "border-gray-100"}`}
              >
                <div className="text-sm font-medium text-gray-500 mb-3">{p.name}</div>
                <div className="text-3xl font-bold">{p.price} <span className="text-base font-normal text-gray-400">/mese</span></div>
                <ul className="mt-5 space-y-2 text-sm text-gray-600">
                  {["Preventivi inclusi", "PDF puliti", "Logo aziendale"].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" /> {f}</li>
                  ))}
                </ul>
                <button className={`mt-6 w-full h-11 rounded-full font-semibold text-sm ${p.highlight ? "btn-gradient" : "bg-gray-900 text-white"}`}>
                  Inizia con {p.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          ▼▼▼  NUOVA SEZIONE PROPOSTA  ▼▼▼
          (qui inizia il blocco che aggiungerei alla home reale)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="border-y-2 border-dashed border-violet-300 bg-violet-50/40">
        <div className="container mx-auto px-6 max-w-4xl py-2 text-center text-[11px] uppercase tracking-widest text-violet-600 font-bold">
          ↓ nuova sezione proposta ↓
        </div>
      </div>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 border border-violet-100 px-4 py-1.5 text-xs font-medium text-violet-700 mb-5">
              <Sparkles className="h-3 w-3" /> Approfondimento
            </div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Cos'è prevai e a chi serve</h2>
          </div>

          <div className="space-y-6 text-gray-600 leading-relaxed text-[15px]">
            <p>
              <strong className="text-gray-900">prevai</strong> è il primo software italiano che usa l'intelligenza
              artificiale per trasformare una descrizione in linguaggio naturale in un preventivo professionale completo.
              È pensato per artigiani, professionisti tecnici e piccole imprese che ogni settimana devono inviare offerte
              ai clienti — imbianchini, elettricisti, idraulici, muratori, fabbri, falegnami, imprese di ristrutturazione e
              tutti i mestieri del settore edile e impiantistico. L'obiettivo è semplice: ridurre il tempo per fare un
              preventivo da 30-60 minuti a 30 secondi, senza rinunciare alla qualità del documento finale.
            </p>

            <div className="grid md:grid-cols-3 gap-4 my-10">
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <Euro className="h-5 w-5 text-violet-600 mb-3" />
                <div className="font-semibold text-gray-900 text-sm mb-1">IVA italiana integrata</div>
                <p className="text-xs text-gray-500 leading-relaxed">Calcolo automatico IVA 10%, 22% e regime forfettario.</p>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <Shield className="h-5 w-5 text-violet-600 mb-3" />
                <div className="font-semibold text-gray-900 text-sm mb-1">Dati su server europei</div>
                <p className="text-xs text-gray-500 leading-relaxed">Stripe per i pagamenti, cookie crittografati.</p>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <Cpu className="h-5 w-5 text-violet-600 mb-3" />
                <div className="font-semibold text-gray-900 text-sm mb-1">AI addestrata in italiano</div>
                <p className="text-xs text-gray-500 leading-relaxed">Lessico tecnico edile e impiantistico italiano.</p>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 pt-4">Come funziona davvero</h3>
            <p>
              Apri prevai dal tuo smartphone direttamente in cantiere o da casa la sera. Descrivi il lavoro come lo
              racconteresti a un collega: <em>«Tinteggiatura appartamento 80mq, due mani di lavabile bianca, rasatura
              parete bagno»</em>. In trenta secondi il motore AI costruisce un preventivo strutturato in capitoli, con
              voci di costo, unità di misura (metri quadri, ore, corpo), prezzi unitari di mercato italiano e calcolo IVA
              automatico. Puoi modificare ogni voce, sostituire i prezzi con il tuo listino personale, aggiungere o
              togliere capitoli. Quando sei pronto scarichi il PDF, lo invii via WhatsApp o email, e il documento viene
              archiviato nella tua area personale per future modifiche.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 pt-4">Perché funziona meglio di Excel o dei software tradizionali</h3>
            <p>
              I software di preventivazione tradizionali sono pensati per l'ufficio: richiedono installazione,
              configurazione iniziale di listini e codici, una formazione di ore. Excel è gratuito ma costringe a partire
              ogni volta da un foglio bianco o da un template costruito anni fa. prevai elimina entrambi i problemi: non
              c'è nulla da installare (basta un browser), non serve configurare nulla all'inizio (l'AI conosce già i prezzi
              medi) e ogni preventivo nasce già strutturato. In media i nostri utenti dichiarano un risparmio di 4-6 ore
              a settimana, tempo che torna in cantiere o in famiglia.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 pt-4">Sicurezza e fiscalità italiana</h3>
            <p>
              Tutti i dati sono ospitati su server europei, le sessioni sono protette da cookie crittografati e i pagamenti
              passano da Stripe. La gestione fiscale segue le regole italiane: IVA al 10% per ristrutturazioni residenziali,
              22% per nuovi impianti, esenzione automatica per il regime forfettario. I dati aziendali (P.IVA, codice
              fiscale, codice SDI per fatturazione elettronica) vengono memorizzati una volta e applicati ad ogni
              preventivo.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 pt-4">Quanto costa iniziare</h3>
            <p>
              La registrazione è gratuita e il primo preventivo si genera senza inserire la carta di credito. Da lì puoi
              scegliere: pago un preventivo singolo (29€) quando serve, oppure attivo un abbonamento mensile (Starter 19€
              con 10 preventivi, Pro 49€ con 60 preventivi, Elite 59€ illimitati). Il piano si cambia o si disdice in
              qualsiasi momento dall'area cliente. Migliaia di professionisti italiani usano già prevai ogni settimana.
            </p>
          </div>
        </div>
      </section>

      <div className="border-y-2 border-dashed border-violet-300 bg-violet-50/40">
        <div className="container mx-auto px-6 max-w-4xl py-2 text-center text-[11px] uppercase tracking-widest text-violet-600 font-bold">
          ↑ fine nuova sezione ↑
        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════
          ▲▲▲  FINE NUOVA SEZIONE  ▲▲▲
         ═══════════════════════════════════════════════════════════════ */}

      {/* ───────── CONTEXTO: CTA finale esistente ───────── */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Pronto a creare il tuo primo preventivo <span className="gradient-text">in 30 secondi</span>?
          </h2>
          <p className="text-lg text-gray-500 mb-10">
            Nessuna carta di credito. Nessun impegno. Il tuo primo preventivo è gratis.
          </p>
          <button className="btn-gradient inline-flex h-14 items-center justify-center px-10 text-lg font-semibold">
            Inizia gratuitamente <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
