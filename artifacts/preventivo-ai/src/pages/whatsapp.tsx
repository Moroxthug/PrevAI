import { Link, useLocation } from "wouter";
import { ArrowRight, Mic, FileText, Zap, Check, MessageCircle } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef } from "react";

// ── Chat animation data ────────────────────────────────────────────────────────

type MsgFrom = "bot" | "user";
type MsgKind = "text" | "voice" | "preview" | "pdf" | "typing";

interface ChatMsg {
  id: string;
  from: MsgFrom;
  kind: MsgKind;
  text?: string;
  time?: string;
}

const PREVIEW_DATA = {
  title: "Tinteggiatura App. 90mq – Milano",
  chapters: [
    { label: "A. Preparazione superfici", amt: "€ 450,00" },
    { label: "B. Tinteggiatura pareti", amt: "€ 980,00" },
    { label: "C. Smaltatura 3 porte", amt: "€ 390,00" },
  ],
  subtotale: "€ 1.820,00",
  iva: "€ 400,40",
  totale: "€ 2.220,40",
};

type Phase = {
  action: "addMsg" | "setTyping" | "clearTyping" | "reset";
  delay: number;
  msg?: ChatMsg;
};

function t(h: number, m: number) {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

const PHASES: Phase[] = [
  { action: "addMsg", delay: 400, msg: { id: "u1", from: "user", kind: "voice", text: "0:08", time: t(9, 41) } },
  { action: "setTyping", delay: 500 },
  { action: "addMsg", delay: 1100, msg: { id: "b1", from: "bot", kind: "text", text: "⏳ Sto generando il tuo preventivo, attendi qualche secondo...", time: t(9, 41) } },
  { action: "setTyping", delay: 600 },
  { action: "addMsg", delay: 2800, msg: { id: "b2", from: "bot", kind: "preview", time: t(9, 42) } },
  { action: "clearTyping", delay: 0 },
  { action: "addMsg", delay: 700, msg: { id: "b3", from: "bot", kind: "text", text: "✅ Ecco la tua anteprima!\n\n📝 Rispondi con correzioni (es. \"aggiungi pulizia finale\") oppure scrivi *OK* per procedere.", time: t(9, 42) } },
  { action: "addMsg", delay: 2000, msg: { id: "u2", from: "user", kind: "text", text: "ok", time: t(9, 42) } },
  { action: "setTyping", delay: 600 },
  { action: "addMsg", delay: 1000, msg: { id: "b4", from: "bot", kind: "text", text: "👤 Ho trovato un cliente già salvato:\n\n*Mario Rossi* — Via Garibaldi 12, Milano\n\nConfermi? Oppure inserisci altri dati.", time: t(9, 43) } },
  { action: "clearTyping", delay: 0 },
  { action: "addMsg", delay: 1600, msg: { id: "u3", from: "user", kind: "text", text: "Mario Rossi va bene", time: t(9, 43) } },
  { action: "setTyping", delay: 600 },
  { action: "addMsg", delay: 1800, msg: { id: "b5", from: "bot", kind: "text", text: "✅ *Preventivo salvato!*\n\n📋 Tinteggiatura App. 90mq\n💶 Totale: *€ 2.220,40* (IVA 22%)\n\n👉 prevai.it/dashboard/quotes/...", time: t(9, 43) } },
  { action: "clearTyping", delay: 0 },
  { action: "addMsg", delay: 600, msg: { id: "b6", from: "bot", kind: "pdf", text: "preventivo-tinteggiatura-app-90mq.pdf", time: t(9, 43) } },
  { action: "reset", delay: 4000 },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Waveform() {
  const heights = [3, 6, 10, 14, 10, 16, 8, 12, 6, 9, 14, 10, 6, 10, 8];
  return (
    <div className="flex items-center gap-[2px] h-4">
      {heights.map((h, i) => (
        <div key={i} className="w-[2px] rounded-full bg-current opacity-70" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}

function BotAvatar({ size = 8 }: { size?: number }) {
  return (
    <img
      src="/prevai-icon.png"
      alt="PrevAI"
      className={`w-${size} h-${size} rounded-full object-cover shrink-0 shadow-sm`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    />
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-1.5 mb-2 animate-in fade-in duration-200">
      <BotAvatar size={6} />
      <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

function PreviewCard() {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden w-[200px] text-[8px]">
      <div className="bg-violet-700 px-2 py-1.5 text-white font-bold text-[9px] flex items-center gap-1">
        <FileText className="w-2.5 h-2.5 shrink-0" />
        PREVENTIVO
      </div>
      <div className="px-2 py-1.5 space-y-1">
        <p className="font-semibold text-gray-800 text-[8px] leading-tight">{PREVIEW_DATA.title}</p>
        <div className="border-t border-gray-100 pt-1 space-y-0.5">
          {PREVIEW_DATA.chapters.map((c, i) => (
            <div key={i} className="flex justify-between text-gray-600">
              <span className="truncate flex-1 pr-1">{c.label}</span>
              <span className="font-mono font-semibold text-gray-800 shrink-0">{c.amt}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 pt-1 space-y-0.5">
          <div className="flex justify-between text-gray-500">
            <span>Imponibile</span><span className="font-mono">{PREVIEW_DATA.subtotale}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>IVA 22%</span><span className="font-mono">{PREVIEW_DATA.iva}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 text-[9px] pt-0.5">
            <span>TOTALE</span><span className="font-mono">{PREVIEW_DATA.totale}</span>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-2 py-1 text-[7px] text-gray-400 text-center">
        Generato con Prevai · prevai.it
      </div>
    </div>
  );
}

function PdfBubble({ filename }: { filename: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm flex items-center gap-2 px-2.5 py-2 w-[210px] border border-gray-100">
      <div className="w-8 h-9 bg-red-100 rounded flex flex-col items-center justify-center shrink-0">
        <div className="w-3.5 h-4 bg-red-500 rounded-sm flex items-center justify-center">
          <span className="text-white font-bold text-[5px]">PDF</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-semibold text-gray-800 truncate">{filename}</p>
        <p className="text-[7px] text-gray-400">48 KB · PDF</p>
      </div>
      <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
        <ArrowRight className="w-2.5 h-2.5 text-violet-600" />
      </div>
    </div>
  );
}

function formatChatText(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith("*") && p.endsWith("*")
            ? <strong key={j}>{p.slice(1, -1)}</strong>
            : <span key={j}>{p}</span>
        )}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isBot = msg.from === "bot";

  if (isBot && msg.kind === "preview") {
    return (
      <div className="flex items-end gap-1.5 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <BotAvatar size={6} />
        <div>
          <PreviewCard />
          {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 ml-1">{msg.time}</p>}
        </div>
      </div>
    );
  }

  if (isBot && msg.kind === "pdf") {
    return (
      <div className="flex items-end gap-1.5 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <BotAvatar size={6} />
        <div>
          <PdfBubble filename={msg.text ?? "preventivo.pdf"} />
          {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 ml-1">{msg.time}</p>}
        </div>
      </div>
    );
  }

  if (!isBot && msg.kind === "voice") {
    return (
      <div className="flex flex-col items-end mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-[#d9fdd3] rounded-2xl rounded-br-sm px-2.5 py-1.5 shadow-sm flex items-center gap-2 max-w-[160px]">
          <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
            <Mic className="w-3 h-3 text-white" />
          </div>
          <div className="text-[#075e54]">
            <Waveform />
          </div>
          <span className="text-[8px] font-mono text-gray-500 shrink-0">{msg.text}</span>
        </div>
        {msg.time && <p className="text-[7px] text-gray-400 mt-0.5 mr-1">{msg.time}</p>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isBot ? "items-start" : "items-end"}`}>
      <div className={`flex items-end gap-1.5 ${isBot ? "" : "flex-row-reverse"}`}>
        {isBot && <BotAvatar size={6} />}
        <div
          className={`px-2.5 py-1.5 rounded-2xl shadow-sm text-[9px] leading-relaxed max-w-[200px] ${
            isBot
              ? "bg-white text-gray-800 rounded-bl-sm"
              : "bg-[#d9fdd3] text-gray-900 rounded-br-sm"
          }`}
        >
          {formatChatText(msg.text ?? "")}
        </div>
      </div>
      {msg.time && (
        <p className={`text-[7px] text-gray-400 mt-0.5 ${isBot ? "ml-8" : "mr-1"}`}>{msg.time}</p>
      )}
    </div>
  );
}

// ── Main chat demo component ────────────────────────────────────────────────────

function WhatsAppChatDemo() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const [phase, setPhase] = useState(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase >= PHASES.length) return;
    const p = PHASES[phase]!;

    const timer = setTimeout(() => {
      if (p.action === "addMsg" && p.msg) {
        setMessages(prev => [...prev, p.msg!]);
        setBotTyping(false);
      } else if (p.action === "setTyping") {
        setBotTyping(true);
      } else if (p.action === "clearTyping") {
        setBotTyping(false);
      } else if (p.action === "reset") {
        setMessages([]);
        setBotTyping(false);
        setPhase(-1);
        return;
      }
      setPhase(prev => prev + 1);
    }, p.delay);

    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== -1) return;
    const t = setTimeout(() => setPhase(0), 50);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, botTyping]);

  return (
    <div className="relative mx-auto" style={{ width: 280 }}>
      {/* Phone frame */}
      <div className="relative bg-gray-900 rounded-[36px] p-[10px] shadow-2xl border border-gray-700">
        {/* Notch */}
        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-b-xl z-20 flex items-center justify-center">
          <div className="w-10 h-2 bg-black rounded-full" />
        </div>

        {/* Screen */}
        <div className="bg-white rounded-[28px] overflow-hidden" style={{ height: 520 }}>
          {/* WhatsApp header */}
          <div className="bg-[#075e54] px-3 pt-7 pb-2 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/20 shrink-0">
              <img src="/prevai-icon.png" alt="PrevAI" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[12px] leading-tight">PrevAI</p>
              <p className="text-white/60 text-[9px]">Bot WhatsApp · online</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1 h-1 rounded-full bg-white/40" />
              <div className="w-1 h-1 rounded-full bg-white/40" />
              <div className="w-1 h-1 rounded-full bg-white/40" />
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={chatContainerRef}
            className="flex flex-col px-2 py-2 overflow-y-auto"
            style={{
              height: 420,
              background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\"), #efeae2",
            }}
          >
            {messages.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {botTyping && <TypingIndicator />}
          </div>

          {/* Input bar */}
          <div className="bg-[#f0f2f5] px-2 py-1.5 flex items-center gap-1.5 border-t border-gray-200">
            <div className="flex-1 bg-white rounded-full px-2.5 py-1.5 text-[9px] text-gray-400">
              Scrivi un messaggio...
            </div>
            <div className="w-6 h-6 rounded-full bg-[#075e54] flex items-center justify-center shrink-0">
              <Mic className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Glow */}
      <div
        className="absolute -inset-6 rounded-full blur-3xl opacity-20 pointer-events-none -z-10"
        style={{ background: "radial-gradient(ellipse, #7c3aed 0%, transparent 70%)" }}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

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
        {/* Background gradient orbs */}
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

          {/* Social proof */}
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

              {/* Left: text */}
              <div className="order-2 lg:order-1">
                <span className="inline-block text-violet-600 text-xs font-bold uppercase tracking-wider mb-3">Come funziona</span>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-6 leading-snug">
                  Dal vocale al PDF<br />
                  <span className="text-violet-600">senza toccare il computer</span>
                </h2>

                <div className="space-y-5">
                  {[
                    { num: "1", title: "Manda un vocale, testo o foto", desc: "Direttamente su WhatsApp. Descrivi il lavoro come parli con un cliente." },
                    { num: "2", title: "L'AI genera l'anteprima", desc: "Capitoli, prezzi e IVA in 60 secondi. Puoi correggere o approvare subito." },
                    { num: "3", title: "Ricevi il PDF in chat", desc: "Lo invii al cliente con un tap. Il preventivo viene salvato anche su prevai.it." },
                  ].map((s) => (
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

              {/* Right: phone */}
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

      {/* keyframe for typing dots */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
