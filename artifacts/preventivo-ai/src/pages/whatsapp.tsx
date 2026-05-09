import { Link, useLocation } from "wouter";
import { ArrowRight, Mic, FileText, Zap, Check, MessageCircle } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { WhatsAppChatDemo } from "@/components/whatsapp-chat-demo";

const FEATURES = [
  {
    icon: Mic,
    title: "Voce, testo o foto",
    desc: "Manda un vocale dall'auto, scrivi dal cantiere o fotografa gli appunti. L'AI capisce tutto e genera il preventivo.",
  },
  {
    icon: Zap,
    title: "Preventivo in 60 secondi",
    desc: "Capitoli, voci di costo, IVA e totali calcolati istantaneamente. Zero formule, zero Excel.",
  },
  {
    icon: FileText,
    title: "PDF consegnato in chat",
    desc: "Il documento professionale arriva direttamente su WhatsApp. Lo inoltri al cliente con un tap.",
  },
];

const HOW_IT_WORKS = [
  { num: "1", title: "Manda un vocale, testo o foto", desc: "Direttamente su WhatsApp. Descrivi il lavoro come parli con un cliente." },
  { num: "2", title: "L'AI genera l'anteprima", desc: "Capitoli, prezzi e IVA in 60 secondi. Puoi correggere o approvare subito." },
  { num: "3", title: "Ricevi il PDF in chat", desc: "Lo invii al cliente con un tap. Il preventivo viene salvato anche su prevai.it." },
];

export default function WhatsappPage() {
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead
        title="Preventivi su WhatsApp – PrevAI | Prima piattaforma italiana"
        description="Descrivi il lavoro a voce, per testo o foto su WhatsApp. PrevAI genera un preventivo professionale con PDF in 60 secondi. Prima piattaforma in Italia."
        canonical="https://www.prevai.it/whatsapp"
      />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gray-950 pt-20 pb-24">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #06b6d4, transparent)" }} />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
            <MessageCircle className="w-3.5 h-3.5" />
            NOVITÀ · Prima in Italia
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.1] mb-5">
            I tuoi preventivi,{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #34d399)" }}>
              direttamente su WhatsApp
            </span>
          </h1>

          <p className="text-lg text-gray-400 leading-relaxed mb-4 max-w-2xl mx-auto">
            Manda un vocale dal cantiere. PrevAI genera il preventivo professionale, te lo mostra in anteprima e ti invia il PDF — senza aprire nessuna app.
          </p>

          <p className="text-sm text-gray-600 mb-10 font-medium">
            Mentre i tuoi concorrenti aprono ancora Excel, i tuoi clienti già ricevono il preventivo.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-violet-900/40"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
            >
              Attiva WhatsApp Bot
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="#demo"
              className="inline-flex h-12 items-center justify-center gap-2 px-7 rounded-xl text-sm font-semibold text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white transition-all"
            >
              Guarda la demo
            </Link>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Disponibile su Piano Pro ed Elite
            </span>
            <span className="hidden sm:block text-gray-700">·</span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Attivazione immediata
            </span>
            <span className="hidden sm:block text-gray-700">·</span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-green-500" />
              Funziona con qualsiasi smartphone
            </span>
          </div>
        </div>
      </section>

      {/* ── Demo ───────────────────────────────────────────────────── */}
      <section id="demo" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              <div className="order-2 lg:order-1">
                <span className="inline-block text-violet-600 text-xs font-bold uppercase tracking-wider mb-3">Come funziona</span>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-6 leading-snug">
                  Dal vocale al PDF<br />
                  <span className="text-violet-600">senza toccare il computer</span>
                </h2>

                <div className="space-y-5">
                  {HOW_IT_WORKS.map((s) => (
                    <div key={s.num} className="flex gap-4">
                      <div className="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
                        {s.num}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
                  <span className="text-amber-500 text-lg shrink-0">⚡</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">In arrivo: fatture e solleciti automatici</p>
                    <p className="text-xs text-amber-700 mt-0.5">Sempre su WhatsApp. Stai costruendo il futuro prima degli altri.</p>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex justify-center">
                <WhatsAppChatDemo />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">Tutto quello che ti serve, in tasca</h2>
              <p className="text-gray-500 mt-2 text-sm">Il potere di prevai.it, disponibile su WhatsApp in qualsiasi momento.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 text-violet-600 bg-violet-50">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1.5">{f.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOMO / Comparison ───────────────────────────────────────── */}
      <section className="py-16 bg-gray-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
          <p className="text-gray-500 text-sm mb-4 uppercase tracking-wider font-semibold">La realtà del mercato</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 leading-snug">
            I tuoi concorrenti impiegano{" "}
            <span className="line-through text-gray-600">30–40 minuti</span>{" "}
            per fare un preventivo.<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #34d399)" }}>
              Tu ce ne metti 60 secondi.
            </span>
          </h2>
          <p className="text-gray-400 text-sm mb-10 leading-relaxed">
            Un artigiano che risponde entro un'ora ha il{" "}
            <strong className="text-white">3× più probabilità</strong> di aggiudicarsi il lavoro.<br />
            Con il bot WhatsApp, rispondi prima ancora di arrivare a casa.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
            {[
              { emoji: "😓", label: "Senza prevai", items: ["Apri Excel/Word", "Cerchi i prezzi online", "Calcoli le voci a mano", "Formatti e invii via email", "Aspetti la risposta giorni"] },
              { emoji: "⚡", label: "Con prevai + WhatsApp", items: ["Mandi un vocale", "L'AI genera il preventivo", "Approvi l'anteprima", "Il PDF arriva in chat", "Il cliente risponde in minuti"], highlight: true },
            ].map((col) => (
              <div key={col.label} className={`rounded-xl p-4 ${col.highlight ? "border border-violet-500/40 bg-violet-950/40" : "bg-gray-900"}`}>
                <p className="text-sm font-bold text-white mb-3">{col.emoji} {col.label}</p>
                <ul className="space-y-1.5">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.highlight ? "bg-green-400" : "bg-gray-600"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-full mb-4">
            <MessageCircle className="w-3 h-3" />
            WhatsApp Bot · Piano Pro ed Elite
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
            Inizia oggi. Zero configurazione.
          </h2>
          <p className="text-gray-500 text-sm mb-7 leading-relaxed">
            Collega il tuo numero WhatsApp dalle impostazioni in meno di 2 minuti. Il bot è subito attivo.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/settings" : "/sign-up?plan=monthly_pro")}
              className="inline-flex h-11 items-center justify-center gap-2 px-7 rounded-xl text-sm font-bold text-white transition-all shadow-md shadow-violet-300"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
            >
              {isSignedIn ? "Collega WhatsApp" : "Prova Gratis 7 Giorni"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/#prezzi"
              className="inline-flex h-11 items-center justify-center px-7 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:border-violet-300 transition-all"
            >
              Confronta i piani
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            7 giorni gratis · Nessuna carta richiesta · Cancella quando vuoi
          </p>
        </div>
      </section>
    </div>
  );
}
