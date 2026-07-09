import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight, CheckCircle2, Sparkles, Mic, ImagePlus, Check, X,
  ChevronDown, Shield, Cpu, Euro, Star,
} from "lucide-react";
import { WhatsAppChatDemo } from "../../whatsapp-chat-demo";
const DemoPlayer = lazy(() => import("../../demo/DemoPlayer"));

/* ─────────────────────────────────────────────────────────────
   PREVAI — Redesign Homepage
   Contenuti originali invariati · Palette: viola #7C3AED →
   indigo #4F46E5 → ciano #06B6D4 · secondario ambra
   ───────────────────────────────────────────────────────────── */

const CSS = `
  .pv-root { font-family: 'Inter', 'Inter Variable', system-ui, sans-serif; --color-bg-light: #faf9ff; }
  .gradient-bg { background: linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4); }

  /* ── Effetto "prevai" — shimmer animato su tutto il sito ── */
  @keyframes pvShimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .prevai-word {
    display: inline-block;
    background: linear-gradient(110deg, #7C3AED 10%, #4F46E5 30%, #06B6D4 50%, #4F46E5 70%, #7C3AED 90%);
    background-size: 250% auto;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: pvShimmer 5s ease-in-out infinite;
    font-weight: 800;
  }
  .gradient-text {
    background: linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4);
    background-size: 200% auto;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: pvShimmer 6s ease-in-out infinite;
  }

  /* ── Bottoni gradient (colori originali) ── */
  .btn-gradient {
    background: linear-gradient(135deg, #7C3AED, #4F46E5, #06B6D4);
    background-size: 200% auto; color: #fff; border-radius: 9999px; border: none;
    transition: background-position .4s ease, transform .2s ease, box-shadow .2s ease;
    box-shadow: 0 4px 20px rgba(124,58,237,.30);
  }
  .btn-gradient:hover { background-position: right center; transform: translateY(-2px); box-shadow: 0 10px 32px rgba(124,58,237,.45); }
  .btn-outline {
    background: #fff; border-radius: 9999px; position: relative; color: #7C3AED;
    border: 1.5px solid #ddd6fe; transition: all .2s ease;
  }
  .btn-outline:hover { transform: translateY(-2px); border-color: #a78bfa; box-shadow: 0 6px 18px rgba(124,58,237,.15); }

  /* ── Hero 3D ── */
  .hero-3d-stage { perspective: 1400px; }
  @keyframes pvFloat {
    0%, 100% { transform: rotateY(-14deg) rotateX(8deg) translateY(0); }
    50% { transform: rotateY(-8deg) rotateX(5deg) translateY(-16px); }
  }
  .hero-doc {
    transform-style: preserve-3d;
    animation: pvFloat 7s ease-in-out infinite;
    transition: transform .3s ease-out;
    will-change: transform;
  }
  .hero-doc-layer { transform: translateZ(40px); }
  @keyframes pvOrb {
    0%, 100% { transform: translate(0,0) scale(1); }
    33% { transform: translate(30px,-40px) scale(1.15); }
    66% { transform: translate(-25px,25px) scale(.9); }
  }
  .orb { position: absolute; border-radius: 9999px; filter: blur(90px); opacity: .14; animation: pvOrb 12s ease-in-out infinite; pointer-events: none; }
  @keyframes pvChipFloat {
    0%, 100% { transform: translateZ(70px) translateY(0); }
    50% { transform: translateZ(70px) translateY(-10px); }
  }
  .float-chip { animation: pvChipFloat 4.5s ease-in-out infinite; transform-style: preserve-3d; }
  .hero-grid {
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(124,58,237,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,58,237,.06) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(ellipse 75% 65% at 50% 40%, black 30%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse 75% 65% at 50% 40%, black 30%, transparent 75%);
  }

  /* ── Transizioni di sezione (scroll reveal) ── */
  .pv-reveal { opacity: 0; transform: translateY(28px); transition: opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
  .pv-reveal.pv-in { opacity: 1; transform: translateY(0); }
  .pv-reveal-d1 { transition-delay: .08s; } .pv-reveal-d2 { transition-delay: .16s; } .pv-reveal-d3 { transition-delay: .24s; }

  /* ── Card ── */
  .card-soft { box-shadow: 0 2px 8px rgba(0,0,0,.04), 0 0 1px rgba(0,0,0,.06); transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
  .card-lift:hover { transform: translateY(-4px); box-shadow: 0 16px 36px -12px rgba(124,58,237,.18); border-color: #ddd6fe !important; }
  .plan-glow { position: relative; }
  .plan-glow::before {
    content: ''; position: absolute; inset: -1.5px; border-radius: inherit; z-index: -1;
    background: linear-gradient(135deg, #7C3AED, #06B6D4); opacity: .8;
  }
  @keyframes pvPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.25);} 50% { box-shadow: 0 0 0 10px rgba(124,58,237,0);} }
  .ai-bar-glow { animation: pvPulse 3s ease-in-out infinite; }
`;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("pv-in")),
      { threshold: 0.12 }
    );
    el.querySelectorAll(".pv-reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ── Mini PDF (contenuto originale della demo preventivo) ── */
function PdfMock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`bg-white text-black select-none ${compact ? "text-[9px] p-4" : "text-[11px] p-5"}`}>
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2.5 mb-2.5">
        <div>
          <div className={`font-bold text-slate-800 ${compact ? "text-[11px]" : "text-sm"}`}>Tinteggiature Pro s.r.l.</div>
          <div className="text-slate-500 text-[9px] mt-0.5">P.IVA: IT09876543210</div>
          <div className="text-slate-500 text-[9px]">Via Roma 12, 20100 Milano</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Preventivo</div>
          <div className="text-[10px] font-bold text-slate-700 mt-0.5">N. 2024-042</div>
          <div className="text-[9px] text-slate-500">Data: 06/05/2024</div>
        </div>
      </div>
      <div className="text-center mb-2">
        <div className="text-[9px] font-bold uppercase tracking-wide text-slate-800">OFFERTA PER LAVORI DI TINTEGGIATURA</div>
        <div className="text-[8px] text-slate-500 italic">Appartamento via Verdi 8 — Milano</div>
      </div>
      <table className="w-full mb-2">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="py-0.5 px-1.5 text-left text-[8px] font-semibold">Capitolo</th>
            <th className="py-0.5 px-1.5 text-right text-[8px] font-semibold">Importo netto</th>
          </tr>
        </thead>
        <tbody>
          <tr><td className="py-0.5 px-1.5 text-slate-700">A. Tinteggiatura pareti</td><td className="py-0.5 px-1.5 text-right font-medium text-slate-800">€ 1.200,00</td></tr>
          <tr className="bg-slate-50"><td className="py-0.5 px-1.5 text-slate-700">B. Rasatura e preparazione</td><td className="py-0.5 px-1.5 text-right font-medium text-slate-800">€ 250,00</td></tr>
        </tbody>
      </table>
      <div className="flex justify-end">
        <div className="w-44 border border-slate-200 rounded overflow-hidden">
          <div className="flex justify-between px-2 py-0.5 text-slate-600 border-b border-slate-100 text-[9px]"><span>Imponibile totale:</span><span className="font-medium">€ 1.450,00</span></div>
          <div className="flex justify-between px-2 py-0.5 text-slate-600 border-b border-slate-100 text-[9px]"><span>IVA (22%):</span><span className="font-medium">€ 319,00</span></div>
          <div className="flex justify-between px-2 py-1 bg-slate-800 text-white font-bold text-[10px]"><span>TOTALE</span><span>€ 1.769,00</span></div>
        </div>
      </div>
    </div>
  );
}

const TESTIMONIALS = [
  { name: "Marco R.", role: "Imbianchino", text: "Faccio il doppio dei preventivi in metà tempo. Prima ci mettevo un'ora, adesso 2 minuti. I clienti sono sorpresi dalla qualità del documento." },
  { name: "Giulia T.", role: "Titolare, Termoidraulica srl", text: "Ho vinto 2 lavori nel primo giorno solo perché ho risposto prima dei concorrenti. prevai mi ha dato un vantaggio enorme sulla concorrenza." },
  { name: "Luca S.", role: "Elettricista", text: "Il PDF è professionale come quello di una grande azienda. I clienti non chiedono più sconti — si fidano subito di più." },
  { name: "Antonio B.", role: "Muratore", text: "Uso prevai dal telefono direttamente in cantiere. In 3 minuti ho il preventivo pronto da mandare su WhatsApp. Prima me lo dimenticavo." },
  { name: "Sara M.", role: "Gestione Immobiliare", text: "Non sono artigiana ma coordino molti interventi. prevai mi ha tolto ore di burocrazia ogni settimana — l'adozione è stata immediata." },
  { name: "Roberto C.", role: "Falegname", text: "Ho alzato i prezzi del 15% senza perdere lavori. Quando il cliente vede un preventivo ben strutturato, la fiducia aumenta automaticamente." },
];

export function Preview() {
  const rootRef = useReveal();
  const docRef = useRef<HTMLDivElement>(null);
  const [sectorsOpen, setSectorsOpen] = useState(false);

  /* Tilt 3D del documento al movimento del mouse */
  const onHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = docRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.animationPlayState = "paused";
    el.style.transform = `rotateY(${-14 + x * 18}deg) rotateX(${8 - y * 14}deg) translateY(-8px)`;
  };
  const onHeroLeave = () => {
    const el = docRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.animationPlayState = "running";
  };

  return (
    <div ref={rootRef} className="pv-root min-h-screen bg-white text-gray-900 antialiased">
      <style>{CSS}</style>

      {/* ── Navbar glass ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between max-w-6xl">
          <span className="text-xl prevai-word">prevai</span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 font-medium">
            <a className="hover:text-violet-600 transition-colors cursor-pointer">Come funziona</a>
            <a className="hover:text-violet-600 transition-colors cursor-pointer">Prezzi</a>
            <a className="hover:text-violet-600 transition-colors cursor-pointer">WhatsApp</a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-1.5 transition-colors">Accedi</button>
            <button className="btn-gradient h-8 px-4 text-xs font-semibold inline-flex items-center">Inizia gratis</button>
          </div>
        </div>
      </header>

      {/* ── SEZIONE 1: Hero con scena 3D ── */}
      <section className="relative overflow-hidden pt-16 pb-20" onMouseMove={onHeroMove} onMouseLeave={onHeroLeave}>
        <div className="hero-grid" />
        <div className="orb w-96 h-96 -top-20 -left-20" style={{ background: "#7C3AED" }} />
        <div className="orb w-80 h-80 top-32 -right-16" style={{ background: "#06B6D4", animationDelay: "-4s" }} />
        <div className="orb w-72 h-72 bottom-0 left-1/3" style={{ background: "#4F46E5", animationDelay: "-8s", opacity: .22 }} />

        <div className="container mx-auto px-4 sm:px-6 max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Copy — contenuto originale */}
            <div className="text-center lg:text-left">
              <span className="pv-reveal inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-5">
                <Sparkles className="h-3 w-3" /> AI addestrata in italiano
              </span>
              <h1 className="pv-reveal pv-reveal-d1 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
                Crea preventivi professionali<br />
                in <span className="gradient-text">30 secondi</span> con l'AI
              </h1>
              <p className="pv-reveal pv-reveal-d2 text-base text-gray-500 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Descrivi il lavoro a parole tue — <span className="prevai-word text-base">prevai</span> genera un preventivo professionale con voci di costo, quantità e IVA. Pronto da inviare al cliente.
              </p>

              {/* AI bar originale */}
              <div className="pv-reveal pv-reveal-d2 ai-bar-glow flex items-center gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-2xl px-4 py-3 shadow-lg shadow-violet-100/50 mb-3 max-w-lg mx-auto lg:mx-0">
                <ImagePlus className="h-4 w-4 text-gray-300 shrink-0" />
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                <input
                  placeholder="Descrivi il lavoro e ottieni un preventivo in 30 secondi..."
                  className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0"
                />
                <Mic className="h-4 w-4 text-gray-300 shrink-0" />
                <button className="shrink-0 btn-gradient inline-flex h-9 w-9 items-center justify-center rounded-full">
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p className="pv-reveal pv-reveal-d3 text-xs text-gray-400 mb-7">7 giorni gratis · Nessuna carta richiesta</p>

              <div className="pv-reveal pv-reveal-d3 flex justify-center lg:justify-start gap-3">
                <button className="btn-gradient inline-flex h-11 items-center px-6 text-sm font-semibold">
                  Inizia gratis <ArrowRight className="ml-1.5 h-4 w-4" />
                </button>
                <button className="btn-outline inline-flex h-11 items-center px-6 text-sm font-semibold">
                  Vedi i piani
                </button>
              </div>
            </div>

            {/* Scena 3D: documento fluttuante */}
            <div className="hero-3d-stage hidden lg:flex justify-center items-center relative h-[440px]">
              <div ref={docRef} className="hero-doc relative w-[340px]">
                {/* ombra proiettata */}
                <div className="absolute -bottom-14 left-8 right-8 h-8 rounded-[50%] bg-violet-900/20 blur-xl" style={{ transform: "translateZ(-60px)" }} />
                {/* documento */}
                <div className="hero-doc-layer rounded-2xl overflow-hidden border border-gray-100 shadow-2xl shadow-violet-200/60 bg-white">
                  <div className="bg-gray-900 px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="text-[10px] font-medium text-gray-400 ml-2">Preventivo_Mario_Rossi.pdf</div>
                  </div>
                  <PdfMock compact />
                </div>
                {/* chip fluttuanti */}
                <div className="float-chip absolute -left-16 top-10 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /></div>
                  <div className="text-[11px] font-semibold text-gray-700">IVA calcolata</div>
                </div>
                <div className="float-chip absolute -right-14 top-40 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2" style={{ animationDelay: "-2s" }}>
                  <div className="h-6 w-6 rounded-lg bg-violet-50 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-violet-500" /></div>
                  <div className="text-[11px] font-semibold text-gray-700">Generato in 30 sec</div>
                </div>
                <div className="float-chip absolute -left-10 bottom-2 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2" style={{ animationDelay: "-3.2s" }}>
                  <div className="h-6 w-6 rounded-lg bg-cyan-50 flex items-center justify-center"><Euro className="h-3.5 w-3.5 text-cyan-500" /></div>
                  <div className="text-[11px] font-semibold text-gray-700">€ 1.769,00 totale</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 2: Demo video ── */}
      <section className="py-10 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="pv-reveal rounded-2xl overflow-hidden border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="bg-gray-900 px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="text-[11px] font-medium text-gray-400 ml-2">prevai.it — demo</div>
            </div>
            <div className="aspect-video relative overflow-hidden">
              <Suspense fallback={<div className="w-full h-full bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
                <DemoPlayer loop />
              </Suspense>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">Demo dal vivo — nessun effetto, nessun montaggio</p>
        </div>
      </section>

      {/* ── SEZIONE 3: WhatsApp teaser ── */}
      <section className="pv-reveal relative overflow-hidden cursor-pointer group" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)" }}>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-9 relative z-10">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.118 1.532 5.845L0 24l6.348-1.51A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.5-5.18-1.373L2 22l1.415-4.664A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Novità</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-500">Prima in Italia</span>
                </div>
                <p className="text-white font-bold text-base sm:text-lg leading-snug">
                  Fai i preventivi direttamente da{" "}
                  <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #25D366, #a78bfa)" }}>WhatsApp</span>
                </p>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Vocale, testo o foto → PDF professionale in 60 secondi. Senza aprire nessuna app.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 group-hover:gap-3 transition-all">
              <span className="text-sm font-semibold text-violet-300 group-hover:text-white transition-colors">Scopri come funziona</span>
              <ArrowRight className="h-4 w-4 text-violet-400 group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 4: Come funziona ── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* WhatsApp chat demo animata originale */}
            <div className="pv-reveal flex justify-center">
              <WhatsAppChatDemo />
            </div>

            <div>
              <h2 className="pv-reveal text-2xl font-bold tracking-tight mb-7 leading-snug">
                Dal vocale al PDF<br />
                <span className="gradient-text">senza toccare il computer</span>
              </h2>
              <div className="space-y-5 mb-8">
                {[
                  { num: "1", title: "Manda un vocale, testo o foto", desc: "Direttamente su WhatsApp. Descrivi il lavoro come parli con un cliente." },
                  { num: "2", title: "L'AI genera l'anteprima", desc: "Capitoli, prezzi e IVA in 60 secondi. Puoi correggere o approvare subito." },
                  { num: "3", title: "Ricevi il PDF in chat", desc: "Lo invii al cliente con un tap. Il preventivo viene salvato anche su prevai.it." },
                ].map((s, i) => (
                  <div key={s.num} className={`pv-reveal pv-reveal-d${i + 1} flex gap-4`}>
                    <div className="w-9 h-9 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white shadow-lg shadow-violet-200" style={{ background: "linear-gradient(135deg, #7c3aed, #4F46E5)" }}>{s.num}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a className="pv-reveal inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors cursor-pointer group">
                Scopri tutta la funzionalità <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 5: Demo preventivo ── */}
      <section className="py-16 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #fff, #faf9ff 50%, #fff)" }}>
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="pv-reveal text-2xl font-bold tracking-tight mb-5 leading-snug">
                Da un semplice testo a un <span className="gradient-text">documento professionale</span>.
              </h2>
              <div className="pv-reveal pv-reveal-d1 bg-white p-5 rounded-2xl mb-4 font-mono text-sm border border-violet-100 text-gray-700 shadow-md shadow-violet-100/40">
                "Devo tinteggiare un appartamento di 80mq con due mani di pittura lavabile bianca. Includere anche la rasatura di una parete rovinata in soggiorno."
              </div>
              <ArrowRight className="pv-reveal pv-reveal-d2 h-6 w-6 text-violet-500 mx-auto lg:mx-0 mb-4 rotate-90 lg:rotate-0" />
              <p className="pv-reveal pv-reveal-d2 text-sm text-gray-500 leading-relaxed">
                Il nostro motore AI comprende il linguaggio naturale, identifica le singole voci di costo, stima le quantità e impagina il tutto in un formato standard.
              </p>
            </div>
            <div className="pv-reveal pv-reveal-d1 relative">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-violet-200/40 overflow-hidden card-lift card-soft">
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Preventivo_Mario_Rossi.pdf</div>
                </div>
                <PdfMock />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 6: Prezzi ── */}
      <section className="py-20 bg-white" id="prezzi">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="pv-reveal text-2xl font-bold">Piani Semplici e Trasparenti</h2>
            <p className="pv-reveal pv-reveal-d1 mt-2 text-sm text-gray-500 max-w-xl mx-auto">7 giorni di prova gratuita inclusi — nessuna carta richiesta.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
            {[
              { name: "Starter", price: "19", features: ["10 preventivi al mese", "PDF con riga prevai.it", "Template Standard", "1 foto per preventivo"], cta: "Inizia con Starter", badge: null },
              { name: "Pro", price: "49", features: ["60 preventivi al mese", "PDF puliti senza watermark", "Tutti i template", "3 foto per preventivo"], cta: "Inizia con Pro", badge: "⭐ Più Popolare", pro: true },
              { name: "Elite", price: "59", features: ["Preventivi illimitati", "PDF puliti senza watermark", "Tutti i template", "5 foto per preventivo"], cta: "Inizia con Elite", badge: "👑 Illimitato", elite: true },
            ].map((plan) => (
              <div key={plan.name} className={`bg-white rounded-2xl p-6 flex flex-col relative card-soft card-lift ${plan.pro ? "plan-glow shadow-xl shadow-violet-200/50" : plan.elite ? "border-2 border-amber-300" : "border border-gray-200"}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap border ${plan.elite ? "text-amber-600 bg-amber-50 border-amber-100" : "text-violet-600 bg-violet-50 border-violet-100"}`}>{plan.badge}</span>
                  </div>
                )}
                <div className="mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${plan.pro ? "bg-violet-100 text-violet-700" : plan.elite ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{plan.name}</span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-extrabold">€{plan.price}</span>
                    <span className="text-gray-400 text-xs mb-1">/mese</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${plan.pro ? "text-violet-500" : plan.elite ? "text-amber-500" : "text-gray-400"}`} />
                      <span className="text-xs text-gray-600 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
                <button className={`inline-flex h-10 items-center justify-center w-full text-xs font-semibold rounded-full transition-all ${plan.pro ? "btn-gradient" : plan.elite ? "bg-amber-500 hover:bg-amber-600 text-white" : "btn-outline"}`}>{plan.cta}</button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 max-w-xl mx-auto mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">oppure acquisto singolo</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid md:grid-cols-2 gap-3 max-w-md mx-auto">
            {[
              { name: "Preventivo singolo (watermark)", price: "9" },
              { name: "Preventivo singolo pulito", price: "29", clean: true },
            ].map((p) => (
              <div key={p.name} className={`bg-white rounded-2xl p-4 flex flex-col border card-soft card-lift ${p.clean ? "border-violet-100" : "border-gray-200"}`}>
                <h3 className="text-xs font-semibold mb-0.5">{p.name}</h3>
                <div className="mb-3"><span className="text-lg font-bold">€{p.price}</span><span className="text-gray-400 text-[10px]"> una tantum</span></div>
                <button className={`inline-flex h-8 items-center justify-center w-full text-xs font-semibold rounded-full ${p.clean ? "btn-gradient" : "btn-outline"}`}>Acquista</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEZIONE 7: Confronto prevai vs Word/Excel ── */}
      <section className="py-16 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="text-center mb-8">
            <h2 className="pv-reveal text-2xl font-bold tracking-tight">
              <span className="prevai-word text-2xl">prevai</span> vs <span className="gradient-text">Word ed Excel</span>
            </h2>
          </div>
          <div className="pv-reveal pv-reveal-d1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg shadow-gray-200/60">
            <div className="grid grid-cols-4 border-b border-gray-100">
              <div className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Funzione</div>
              <div className="px-4 py-3.5 text-center text-sm font-bold bg-gradient-to-b from-violet-50 to-cyan-50/40"><span className="prevai-word text-sm">prevai</span></div>
              <div className="px-4 py-3.5 text-center text-sm font-bold text-gray-400">Word</div>
              <div className="px-4 py-3.5 text-center text-sm font-bold text-gray-400">Excel</div>
            </div>
            {[
              { feature: "Preventivo in 30 secondi", prevai: { ok: true, label: "~30 sec" }, word: { ok: false, label: "30–60 min" }, excel: { ok: false, label: "20–40 min" } },
              { feature: "Upload foto del cantiere", prevai: { ok: true, label: "Integrato" }, word: { ok: false, label: "Non supportato" }, excel: { ok: false, label: "Non supportato" } },
              { feature: "Descrizione vocale", prevai: { ok: true, label: "In arrivo" }, word: { ok: false, label: "Non disponibile" }, excel: { ok: false, label: "Non disponibile" } },
              { feature: "Calcolo IVA automatico", prevai: { ok: true, label: "Sempre corretto" }, word: { ok: false, label: "Manuale" }, excel: { ok: true, label: "Con formule" } },
              { feature: "PDF professionale", prevai: { ok: true, label: "Con logo e branding" }, word: { ok: true, label: "Solo testo" }, excel: { ok: false, label: "Layout difficile" } },
              { feature: "Nessuna competenza richiesta", prevai: { ok: true, label: "Solo descrizione" }, word: { ok: false, label: "Formattazione manuale" }, excel: { ok: false, label: "Formule complesse" } },
            ].map(({ feature, prevai, word, excel }, rowIdx) => (
              <div key={feature} className={`grid grid-cols-4 border-b border-gray-100 last:border-0 ${rowIdx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                <div className="px-5 py-3.5 text-sm text-gray-700 font-medium flex items-center">{feature}</div>
                {[{ cell: prevai, hl: true }, { cell: word, hl: false }, { cell: excel, hl: false }].map(({ cell, hl }, i) => (
                  <div key={i} className={`px-4 py-3.5 flex flex-col items-center justify-center gap-0.5 ${hl ? "bg-gradient-to-b from-violet-50/60 to-cyan-50/30" : ""}`}>
                    {cell.ok ? <Check className={`h-4 w-4 ${hl ? "text-violet-600" : "text-emerald-500"}`} /> : <X className="h-4 w-4 text-gray-300" />}
                    <span className={`text-[11px] font-medium text-center leading-tight ${cell.ok ? (hl ? "text-violet-700" : "text-gray-600") : "text-gray-300"}`}>{cell.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button className="pv-reveal btn-gradient inline-flex h-11 items-center justify-center px-7 text-sm font-semibold">
              Prova prevai gratis <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 8: Testimonianze ── */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="pv-reveal text-2xl font-bold tracking-tight">Cosa dicono i professionisti</h2>
            <div className="pv-reveal pv-reveal-d1 flex items-center justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
              <span className="text-sm text-gray-500 ml-2">4,9 / 5</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className={`pv-reveal pv-reveal-d${(i % 3) + 1} bg-white rounded-2xl border border-gray-100 p-5 card-soft card-lift`}>
                <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />)}</div>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7C3AED, #06B6D4)" }}>{t.name[0]}</div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{t.name}</div>
                    <div className="text-[10px] text-gray-400">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEZIONE 9: Excel/Word alternativa ── */}
      <section className="py-16 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="text-center mb-8">
            <span className="pv-reveal inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">Niente più fogli di calcolo</span>
            <h2 className="pv-reveal pv-reveal-d1 text-2xl sm:text-3xl font-bold tracking-tight mb-3">
              Dimentica <span className="gradient-text">Excel e Word</span>
            </h2>
            <p className="pv-reveal pv-reveal-d2 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              I template Excel si rompono. I documenti Word non calcolano. Con <span className="prevai-word text-sm">prevai</span> descrivi il lavoro a parole e in 30 secondi hai un documento professionale pronto da inviare.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: "Alternativa al preventivo Excel", desc: "Niente formule. Niente errori. Solo risultati.", badge: "vs Excel" },
              { label: "Alternativa al template Word", desc: "PDF professionale in un clic, senza formattazione manuale.", badge: "vs Word" },
              { label: "Come fare un preventivo", desc: "Guida pratica per artigiani e PMI italiane.", badge: "Guida" },
            ].map(({ label, desc, badge }, i) => (
              <div key={label} className={`pv-reveal pv-reveal-d${i + 1} bg-white rounded-2xl border border-gray-100 p-5 card-soft card-lift cursor-pointer group`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{badge}</span>
                <h3 className="font-semibold text-gray-900 mt-3 mb-1 text-sm leading-snug group-hover:text-violet-700 transition-colors">{label}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                <span className="inline-flex items-center gap-1 text-xs text-violet-500 font-semibold mt-3">Scopri di più <ArrowRight className="h-3 w-3" /></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEZIONE 10: Settori collassabili ── */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-3xl">
          <button onClick={() => setSectorsOpen((v) => !v)} className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            <span>Preventivi per ogni settore e città</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${sectorsOpen ? "rotate-180" : ""}`} />
          </button>
          {sectorsOpen && (
            <div className="pt-2 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-4">
                {["Imbianchini", "Elettricisti", "Idraulici", "Muratori", "Imprese Edili", "Ristrutturazioni", "Pittori Edili", "Piastrellisti", "Pavimentisti", "Falegnami", "Carpentieri", "Serramentisti", "Coperture e Tetti", "Climatizzatori", "Giardinieri", "Termoidraulici", "Freelance", "Geometri"].map((label) => (
                  <a key={label} className="text-xs text-gray-500 hover:text-violet-600 py-1 px-2 rounded hover:bg-violet-50 transition-colors cursor-pointer">{label}</a>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Principali città</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Roma", "Milano", "Napoli", "Torino", "Bologna", "Firenze", "Palermo", "Bari", "Venezia", "Verona"].map((city) => (
                    <a key={city} className="text-xs text-gray-400 hover:text-violet-600 hover:bg-violet-50 px-2 py-0.5 rounded transition-colors cursor-pointer">{city}</a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SEZIONE 11: Cos'è prevai ── */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="text-center mb-10">
            <span className="pv-reveal inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Sparkles className="h-3 w-3" /> Approfondimento
            </span>
            <h2 className="pv-reveal pv-reveal-d1 text-2xl sm:text-3xl font-bold tracking-tight">
              Cos'è <span className="prevai-word text-3xl">prevai</span> e a chi serve
            </h2>
          </div>
          <div className="space-y-5 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
            <p className="pv-reveal">
              <strong className="text-gray-900">prevai</strong> è il primo software italiano che usa l'intelligenza artificiale per trasformare una descrizione in linguaggio naturale in un preventivo professionale completo. È pensato per artigiani, professionisti tecnici e piccole imprese che ogni settimana devono inviare offerte ai clienti — imbianchini, elettricisti, idraulici, muratori, fabbri, falegnami, imprese di ristrutturazione e tutti i mestieri del settore edile e impiantistico. L'obiettivo è semplice: ridurre il tempo per fare un preventivo da 30-60 minuti a 30 secondi, senza rinunciare alla qualità del documento finale.
            </p>
            <div className="grid sm:grid-cols-3 gap-4 my-8">
              {[
                { Icon: Euro, title: "IVA italiana integrata", desc: "Calcolo automatico IVA 10%, 22% e regime forfettario." },
                { Icon: Shield, title: "Dati su server europei", desc: "Stripe per i pagamenti, cookie crittografati." },
                { Icon: Cpu, title: "AI addestrata in italiano", desc: "Lessico tecnico edile e impiantistico italiano." },
              ].map(({ Icon, title, desc }, i) => (
                <div key={title} className={`pv-reveal pv-reveal-d${i + 1} rounded-2xl bg-gray-50 border border-gray-100 p-4 card-lift card-soft`}>
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-2" style={{ background: "linear-gradient(135deg, rgba(124,58,237,.12), rgba(6,182,212,.12))" }}>
                    <Icon className="h-4.5 w-4.5 text-violet-600" />
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1">{title}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <h3 className="pv-reveal text-lg font-semibold text-gray-900 pt-3">Come funziona davvero</h3>
            <p className="pv-reveal">
              Apri prevai dal tuo smartphone direttamente in cantiere o da casa la sera. Descrivi il lavoro come lo racconteresti a un collega: <em>«Tinteggiatura appartamento 80mq, due mani di lavabile bianca, rasatura parete bagno»</em>. In trenta secondi il motore AI costruisce un preventivo strutturato in capitoli, con voci di costo, unità di misura (metri quadri, ore, corpo), prezzi unitari di mercato italiano e calcolo IVA automatico. Puoi modificare ogni voce, sostituire i prezzi con il tuo listino personale, aggiungere o togliere capitoli. Quando sei pronto scarichi il PDF, lo invii via WhatsApp o email, e il documento viene archiviato nella tua area personale per future modifiche.
            </p>
            <h3 className="pv-reveal text-lg font-semibold text-gray-900 pt-3">Perché funziona meglio di Excel o dei software tradizionali</h3>
            <p className="pv-reveal">
              I software di preventivazione tradizionali sono pensati per l'ufficio: richiedono installazione, configurazione iniziale di listini e codici, una formazione di ore. Excel è gratuito ma costringe a partire ogni volta da un foglio bianco o da un template costruito anni fa. prevai elimina entrambi i problemi: non c'è nulla da installare (basta un browser), non serve configurare nulla all'inizio (l'AI conosce già i prezzi medi) e ogni preventivo nasce già strutturato. In media i nostri utenti dichiarano un risparmio di 4-6 ore a settimana, tempo che torna in cantiere o in famiglia.
            </p>
            <h3 className="pv-reveal text-lg font-semibold text-gray-900 pt-3">Sicurezza e fiscalità italiana</h3>
            <p className="pv-reveal">
              Tutti i dati sono ospitati su server europei, le sessioni sono protette da cookie crittografati e i pagamenti passano da Stripe. La gestione fiscale segue le regole italiane: IVA al 10% per ristrutturazioni residenziali, 22% per nuovi impianti, esenzione automatica per il regime forfettario. I dati aziendali (P.IVA, codice fiscale, codice SDI per fatturazione elettronica) vengono memorizzati una volta e applicati ad ogni preventivo.
            </p>
            <h3 className="pv-reveal text-lg font-semibold text-gray-900 pt-3">Quanto costa iniziare</h3>
            <p className="pv-reveal">
              La registrazione è gratuita e il primo preventivo si genera senza inserire la carta di credito. Da lì puoi scegliere: pago un preventivo singolo (29€) quando serve, oppure attivo un abbonamento mensile (Starter 19€ con 10 preventivi, Pro 49€ con 60 preventivi, Elite 59€ illimitati). Il piano si cambia o si disdice in qualsiasi momento dall'area cliente. Migliaia di professionisti italiani usano già prevai ogni settimana.
            </p>
          </div>
        </div>
      </section>

      {/* ── SEZIONE 12: CTA finale ── */}
      <section className="py-20 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 55%, #0a1628 100%)" }}>
        <div className="orb w-96 h-96 -top-24 left-1/4" style={{ background: "#7C3AED", opacity: .25 }} />
        <div className="orb w-72 h-72 bottom-0 right-1/4" style={{ background: "#06B6D4", opacity: .2, animationDelay: "-5s" }} />
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="pv-reveal text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
            Pronto a rivoluzionare la tua attività?
          </h2>
          <p className="pv-reveal pv-reveal-d1 text-sm text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
            Unisciti a centinaia di artigiani e professionisti italiani che risparmiano ore ogni settimana.
          </p>
          <button className="pv-reveal pv-reveal-d2 btn-gradient inline-flex h-12 items-center justify-center px-9 text-sm font-semibold">
            Crea il tuo Account Gratuito <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="container mx-auto px-4 max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="prevai-word text-lg">prevai</span>
          <p className="text-xs text-gray-400">© 2026 prevai — Preventivi professionali con l'AI</p>
        </div>
      </footer>
    </div>
  );
}

export default Preview;
