import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, X, MessageSquare, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

type Message = {
  id: number;
  role: string;
  content: string;
  createdAt: string;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SupportBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(() => {
    const saved = localStorage.getItem("prevai_support_conv_id");
    return saved ? parseInt(saved) : null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [convStatus, setConvStatus] = useState<string>("ai"); // 'ai', 'human_needed', 'human_active', 'closed'
  const [loading, setLoading] = useState(false);

  // Visitor info form
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Dragging state
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);

  // Check if admin is online
  const checkAdminOnline = async () => {
    try {
      const res = await fetch(`${BASE}/api/support/admin-status`);
      const data = await res.json();
      setIsAdminOnline(data.online);
    } catch (e) {
      console.error("Failed to check admin status", e);
    }
  };

  useEffect(() => {
    checkAdminOnline();
    const interval = setInterval(checkAdminOnline, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages if conversation exists
  const fetchMessages = async (id: number) => {
    try {
      const res = await fetch(`${BASE}/api/support/conversations/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        if (data.length > 0) {
          // Update status based on the last system message or just general flow
          // But it's better to fetch conversation details to get the actual status
          const lastMsg = data[data.length - 1];
          // We can fetch conversation details too if needed
        }
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  };

  // Poll conversation messages if chat is open
  useEffect(() => {
    if (!conversationId || !isOpen) return;

    fetchMessages(conversationId);
    const interval = setInterval(() => {
      fetchMessages(conversationId);
      // Let's also fetch conversation status
      fetch(`${BASE}/api/support/conversations`)
        .then(r => r.json())
        .then(list => {
          const current = list.find((c: any) => c.id === conversationId);
          if (current) {
            setConvStatus(current.status);
          }
        })
        .catch(err => console.error(err));
    }, 3000);

    return () => clearInterval(interval);
  }, [conversationId, isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Start new conversation
  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/support/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorName, visitorEmail, visitorPhone }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
        setConvStatus(data.status);
        localStorage.setItem("prevai_support_conv_id", data.id.toString());
        setShowOnboarding(false);
        // Add initial greeting message
        await fetchMessages(data.id);
      }
    } catch (err) {
      console.error("Failed to start conversation", err);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText("");

    let activeId = conversationId;

    // If no conversation yet, start one silently as guest
    if (!activeId) {
      try {
        const res = await fetch(`${BASE}/api/support/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorName: "Ospite" }),
        });
        if (res.ok) {
          const data = await res.json();
          activeId = data.id;
          setConversationId(data.id);
          setConvStatus(data.status);
          localStorage.setItem("prevai_support_conv_id", data.id.toString());
        } else {
          return;
        }
      } catch (err) {
        console.error(err);
        return;
      }
    }

    // Append message locally immediately
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/support/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: textToSend }),
      });
      if (res.ok) {
        const data = await res.json();
        setConvStatus(data.status);
        if (data.aiMessage) {
          setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), data.userMessage, data.aiMessage]);
        } else {
          setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), data.userMessage]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Request Human Operator
  const handleRequestHuman = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/support/conversations/${conversationId}/request-human`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setConvStatus("human_needed");
        fetchMessages(conversationId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (isOpen) return; // Disable dragging when open
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - dragPos.x,
      y: e.clientY - dragPos.y,
    };
    if (buttonRef.current) {
      buttonRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    setDragPos({ x: newX, y: newY });

    // Check if close to bottom-left corner of the window
    // Default position is bottom-right: so bottom-left is x near -window.innerWidth and y near 0 (depending on starting pos)
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (buttonRect) {
      const isNearBottomLeft =
        buttonRect.left < 200 &&
        window.innerHeight - buttonRect.bottom < 200;
      setIsOverDismissZone(isNearBottomLeft);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (buttonRef.current) {
      buttonRef.current.releasePointerCapture(e.pointerId);
    }

    if (isOverDismissZone) {
      setIsDismissed(true);
      setIsOverDismissZone(false);
    }
  };

  if (isDismissed) {
    // Show a very tiny restore trigger in the bottom right corner
    return (
      <button
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-2 right-2 w-4 h-4 bg-gray-400/50 hover:bg-violet-600 rounded-full cursor-pointer transition-all duration-300 z-[9999] opacity-40 hover:opacity-100"
        title="Ripristina Supporto Chat"
      />
    );
  }

  return (
    <>
      <style>{`
        @keyframes wave-arm {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes float-bot {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        .robot-arm {
          transform-origin: 16px 20px;
          animation: wave-arm 2s ease-in-out infinite;
        }
        .robot-body {
          animation: float-bot 3s ease-in-out infinite;
        }
      `}</style>

      {/* Dismiss target zone in bottom-left when dragging */}
      {isDragging && (
        <div
          className={`fixed bottom-6 left-6 w-32 h-32 rounded-full border-4 border-dashed flex flex-col items-center justify-center transition-all duration-300 z-[9998] ${
            isOverDismissZone
              ? "bg-red-500/20 border-red-500 scale-110 text-red-500 font-bold"
              : "bg-gray-100/10 border-gray-400/50 text-gray-400"
          }`}
        >
          <X className="h-8 w-8 mb-1 animate-bounce" />
          <span className="text-[10px] uppercase tracking-wider text-center px-2">Trascina qui per chiudere</span>
        </div>
      )}

      {/* Floating Chat Button */}
      <button
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={() => {
          if (!isDragging) {
            setIsOpen(!isOpen);
            if (!conversationId) {
              setShowOnboarding(true);
            }
          }
        }}
        style={{
          transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
          touchAction: "none",
        }}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xl hover:shadow-violet-500/30 transition-all duration-300 z-[9999] hover:scale-105 active:scale-95 flex items-center justify-center border border-white/20 ${
          isOpen ? "rotate-90 bg-slate-800" : ""
        }`}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <svg
            width="28"
            height="28"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="robot-body"
          >
            {/* Robot Head */}
            <rect x="6" y="8" width="20" height="14" rx="3" fill="currentColor" />
            {/* Eyes */}
            <circle cx="11" cy="14" r="2" fill="#000" />
            <circle cx="11" cy="14" r="0.75" fill="#fff" />
            <circle cx="21" cy="14" r="2" fill="#000" />
            <circle cx="21" cy="14" r="0.75" fill="#fff" />
            {/* Mouth */}
            <path d="M13 18 H19" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
            {/* Antennas */}
            <rect x="15" y="4" width="2" height="4" fill="currentColor" />
            <circle cx="16" cy="3" r="2" fill="#FFE248" />
            {/* Ears / Sidebolts */}
            <rect x="4" y="13" width="2" height="4" rx="0.5" fill="currentColor" />
            <rect x="26" y="13" width="2" height="4" rx="0.5" fill="currentColor" />
            {/* Waving Arm */}
            <path
              d="M26 15 C28 12 30 12 30 9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="robot-arm"
            />
          </svg>
        )}
      </button>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          style={{
            transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
          }}
          className="fixed bottom-24 right-6 w-96 h-[500px] rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden z-[9999] transition-all duration-300 animate-in slide-in-from-bottom-5"
        >
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Supporto AI PrevAI</h3>
                <span className="text-[10px] text-violet-100 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isAdminOnline ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                  {isAdminOnline ? "Operatore Online" : "Solo AI Attiva"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conversationId && convStatus !== "human_needed" && convStatus !== "human_active" && isAdminOnline && (
                <button
                  onClick={handleRequestHuman}
                  disabled={loading}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-xs font-semibold rounded transition"
                  title="Parla con un operatore reale"
                >
                  Parla con Umano
                </button>
              )}
              {conversationId && (
                <button
                  onClick={() => {
                    if (confirm("Vuoi iniziare una nuova chat?")) {
                      localStorage.removeItem("prevai_support_conv_id");
                      setConversationId(null);
                      setMessages([]);
                      setConvStatus("ai");
                      setShowOnboarding(true);
                    }
                  }}
                  className="p-1 hover:bg-white/20 rounded"
                  title="Nuova Chat"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {showOnboarding ? (
              <form onSubmit={handleStartConversation} className="space-y-3 p-2 bg-white rounded-xl border border-slate-100 shadow-sm animate-in fade-in">
                <div className="text-center pb-2">
                  <Sparkles className="h-8 w-8 text-violet-500 mx-auto mb-1 animate-pulse" />
                  <h4 className="font-semibold text-slate-800 text-sm">Avvia una sessione di supporto</h4>
                  <p className="text-xs text-slate-500">Inserisci i tuoi dati per ricevere assistenza anche da un operatore umano.</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome</label>
                  <input
                    type="text"
                    required
                    placeholder="Il tuo nome"
                    value={visitorName}
                    onChange={e => setVisitorName(e.target.value)}
                    className="w-full mt-0.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="la-tua@email.com"
                    value={visitorEmail}
                    onChange={e => setVisitorEmail(e.target.value)}
                    className="w-full mt-0.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Telefono (Opzionale)</label>
                  <input
                    type="tel"
                    placeholder="333 1234567"
                    value={visitorPhone}
                    onChange={e => setVisitorPhone(e.target.value)}
                    className="w-full mt-0.5 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  {loading ? "Avvio in corso..." : "Inizia Chat"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowOnboarding(false)}
                  className="w-full py-1 text-slate-500 hover:text-slate-700 text-xs text-center"
                >
                  Continua come Ospite
                </button>
              </form>
            ) : (
              <>
                {/* Greeting msg */}
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <div className="p-2.5 rounded-2xl rounded-tl-none bg-white border border-slate-100 shadow-sm max-w-[80%] text-xs text-slate-700">
                    Ciao! Sono l'assistente AI di PrevAI. Come posso aiutarti oggi con preventivi o computi metrici?
                  </div>
                </div>

                {/* Status indicator badge */}
                {convStatus === "human_needed" && (
                  <div className="p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs text-center flex items-center gap-1.5 justify-center">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    In attesa che un operatore umano si colleghi...
                  </div>
                )}
                {convStatus === "human_active" && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs text-center flex items-center gap-1.5 justify-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    Operatore umano connesso alla chat.
                  </div>
                )}
                {convStatus === "closed" && (
                  <div className="p-2 bg-gray-100 border border-gray-200 text-gray-500 rounded-lg text-xs text-center">
                    Questa sessione di chat è stata chiusa.
                  </div>
                )}

                {/* Messages list */}
                {messages.map(msg => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={msg.id} className={`flex gap-2 ${isUser ? "justify-end" : ""}`}>
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <Bot className="h-3.5 w-3.5 text-violet-600" />
                        </div>
                      )}
                      <div
                        className={`p-2.5 rounded-2xl text-xs max-w-[80%] shadow-sm ${
                          isUser
                            ? "bg-violet-600 text-white rounded-tr-none"
                            : "bg-white border border-slate-100 text-slate-700 rounded-tl-none"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {isUser && (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </>
            )}
          </div>

          {/* Chat Footer */}
          {!showOnboarding && convStatus !== "closed" && (
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Scrivi un messaggio..."
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="p-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 text-white rounded-xl transition flex items-center justify-center shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
