import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   PREVAI — Widget preventivo "search bar"
   Una barra orizzontale da inserire in landing page esistenti.
   Il questionario scorre dentro la barra stessa, in 3 passi:
   1. lavoro + misure → 2. descrizione libera → 3. contatti
   → attesa → stima con range di prezzo.

   Eredità del design del sito ospite:
   · font: inherit (usa il font dello stack del sito)
   · colori via variabili CSS --pvq-* con fallback ai token
     comuni (--primary, --accent-color) e infine al blu prevai
   In futuro il setup process genererà queste variabili + logo
   azienda, e l'invio della stima passerà da Resend.
   ───────────────────────────────────────────────────────────── */

/* ══════════════ Config interventi ══════════════ */

type MeasureField = {
  key: string;          // chiave del payload `misure` per POST /api/quotes
  short: string;        // etichetta compatta mostrata nella barra
  unit: string;
  min: number;
  max: number;
};

type Intervento = {
  id: string;
  label: string;
  hintDescrizione: string; // esempio mostrato nel passo descrizione
  fields: MeasureField[];
  baseCost: number;        // stima demo — in produzione arriva dal backend
  unitCost: number;
};

const INTERVENTI: Intervento[] = [
  {
    id: "bagno", label: "Ristrutturazione bagno", baseCost: 2800, unitCost: 950,
    hintDescrizione: "es. Doccia al posto della vasca, sanitari sospesi, rivestimenti fino al soffitto…",
    fields: [
      { key: "Superficie Bagno (mq)", short: "Superficie", unit: "mq", min: 1, max: 40 },
      { key: "Altezza Pareti (m)", short: "Altezza", unit: "m", min: 2, max: 5 },
    ],
  },
  {
    id: "tinteggiatura", label: "Tinteggiatura", baseCost: 250, unitCost: 12,
    hintDescrizione: "es. Pittura lavabile bianca, una parete grigio tortora dietro il letto…",
    fields: [
      { key: "Superficie Pareti (mq)", short: "Superficie", unit: "mq", min: 5, max: 1000 },
      { key: "Altezza Pareti (m)", short: "Altezza", unit: "m", min: 2, max: 6 },
    ],
  },
  {
    id: "cartongesso", label: "Cartongesso", baseCost: 320, unitCost: 55,
    hintDescrizione: "es. Parete divisoria con porta scorrevole, controsoffitto con faretti…",
    fields: [
      { key: "Metri Lineari Parete (ml)", short: "Lunghezza", unit: "ml", min: 1, max: 200 },
      { key: "Altezza Pareti (m)", short: "Altezza", unit: "m", min: 2, max: 6 },
    ],
  },
  {
    id: "pavimenti", label: "Pavimenti e rivestimenti", baseCost: 600, unitCost: 48,
    hintDescrizione: "es. Gres effetto legno, posa dritta, rimozione del pavimento esistente…",
    fields: [
      { key: "Superficie Pavimento (mq)", short: "Superficie", unit: "mq", min: 2, max: 800 },
    ],
  },
  {
    id: "elettrico", label: "Impianto elettrico", baseCost: 1200, unitCost: 65,
    hintDescrizione: "es. Rifacimento completo con certificazione, punti luce e prese aggiuntive…",
    fields: [
      { key: "Superficie Immobile (mq)", short: "Superficie", unit: "mq", min: 10, max: 1000 },
      { key: "Punti Luce (n)", short: "Punti luce", unit: "n°", min: 1, max: 200 },
    ],
  },
  {
    id: "idraulico", label: "Impianto idraulico", baseCost: 1500, unitCost: 80,
    hintDescrizione: "es. Spostamento attacchi cucina, sostituzione tubazioni, nuovo bagno di servizio…",
    fields: [
      { key: "Punti Acqua (n)", short: "Punti acqua", unit: "n°", min: 1, max: 60 },
    ],
  },
  {
    id: "completa", label: "Ristrutturazione completa", baseCost: 8000, unitCost: 520,
    hintDescrizione: "es. Appartamento anni '70 da rifare: impianti, pavimenti, bagno e cucina…",
    fields: [
      { key: "Superficie Immobile (mq)", short: "Superficie", unit: "mq", min: 20, max: 1000 },
      { key: "Numero Locali (n)", short: "Locali", unit: "n°", min: 1, max: 30 },
    ],
  },
  {
    id: "altro", label: "Altro lavoro", baseCost: 500, unitCost: 40,
    hintDescrizione: "Descrivi il lavoro con parole tue: più dettagli dai, più la stima è precisa.",
    fields: [
      { key: "Dimensione Indicativa (mq)", short: "Dimensione", unit: "mq", min: 1, max: 1000 },
    ],
  },
];

/* ══════════════ Utility ══════════════ */

const fmtEuro = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF è sospeso nei tab in background: garantisce comunque il valore finale
    const fallback = setTimeout(() => { cancelAnimationFrame(raf); setValue(target); }, duration + 100);
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback); };
  }, [target, duration]);
  return value;
}

function stimaDemo(int: Intervento, misure: Record<string, string>) {
  const qty = parseFloat(misure[int.fields[0].key] || "") || int.fields[0].min;
  const totale = Math.round(int.baseCost + int.unitCost * qty);
  return { min: Math.round(totale * 0.9), max: Math.round(totale * 1.25) };
}

/* ══════════════ CSS della barra ══════════════
   Tutto il tema passa da variabili con fallback: il sito ospite
   può definire --pvq-accent ecc., altrimenti si usano i token
   più comuni e infine il default prevai. Il font è sempre
   ereditato dalla pagina. */

const WIDGET_CSS = `
  .pvq {
    font: inherit;
    color: inherit;
    --_accent: var(--pvq-accent, var(--primary, var(--accent-color, #4F46E5)));
    --_on-accent: var(--pvq-on-accent, #ffffff);
    --_bg: var(--pvq-bg, #ffffff);
    --_text: var(--pvq-text, #1f2430);
    --_muted: var(--pvq-muted, #6b7280);
    --_border: var(--pvq-border, rgba(15, 23, 42, 0.14));
    --_radius: var(--pvq-radius, 20px);
    --_field-bg: var(--pvq-field-bg, rgba(0, 0, 0, 0.035));
  }

  .pvq-bar {
    background: var(--_bg);
    color: var(--_text);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: 0 10px 36px -14px rgba(15, 23, 42, 0.22);
    padding: 20px;
    min-height: 150px;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    align-items: center;
    gap: 14px;
    transition: box-shadow .2s ease, border-color .2s ease;
  }
  .pvq-bar:focus-within { border-color: var(--_accent); box-shadow: 0 14px 44px -14px rgba(15,23,42,.32); }

  /* riga di intestazione del passo */
  .pvq-head {
    flex-basis: 100%;
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    margin-bottom: 2px;
  }
  .pvq-title { font-size: 17px; font-weight: 600; margin: 0; }
  .pvq-stepnum { font-size: 13px; color: var(--_muted); white-space: nowrap; }

  .pvq-select, .pvq-input, .pvq-textarea {
    font: inherit;
    font-size: 17px;
    color: var(--_text);
    background: var(--_field-bg);
    border: 1px solid transparent;
    border-radius: calc(var(--_radius) - 8px);
    padding: 16px 18px;
    outline: none;
    transition: border-color .15s ease, background .15s ease;
    min-width: 0;
  }
  .pvq-select:hover, .pvq-input:hover, .pvq-textarea:hover { border-color: var(--_border); }
  .pvq-select:focus, .pvq-input:focus, .pvq-textarea:focus { border-color: var(--_accent); background: var(--_bg); }
  .pvq-input::placeholder, .pvq-textarea::placeholder { color: var(--_muted); }
  .pvq-input[data-invalid="true"], .pvq-select[data-invalid="true"] { border-color: #dc2626; }
  .pvq-select { cursor: pointer; appearance: auto; }
  .pvq-textarea { resize: none; line-height: 1.45; }

  .pvq-measure { position: relative; width: 165px; flex: none; }
  .pvq-measure .pvq-input { width: 100%; padding-right: 46px; }
  .pvq-measure span {
    position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
    font-size: 14px; color: var(--_muted); pointer-events: none;
  }

  .pvq-btn {
    font: inherit; font-size: 17px; font-weight: 600;
    color: var(--_on-accent);
    background: var(--_accent);
    border: none; cursor: pointer;
    border-radius: calc(var(--_radius) - 8px);
    padding: 16px 30px;
    white-space: nowrap;
    transition: filter .15s ease, transform .15s ease;
  }
  .pvq-btn:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  .pvq-btn:disabled { opacity: .5; cursor: not-allowed; }

  .pvq-link {
    font: inherit; font-size: 14px; font-weight: 500;
    background: none; border: none; cursor: pointer;
    color: var(--_muted); padding: 4px 6px;
  }
  .pvq-link:hover { color: var(--_accent); }

  .pvq-note { font-size: 13px; color: var(--_muted); line-height: 1.5; }

  .pvq-check { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
  .pvq-check input { accent-color: var(--_accent); width: 16px; height: 16px; flex: none; }

  /* transizione morbida tra i passi */
  @keyframes pvqFade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  .pvq-step { animation: pvqFade .25s ease both; display: contents; }

  /* puntini di attesa */
  @keyframes pvqDot { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
  .pvq-dots span {
    display: inline-block; width: 6px; height: 6px; border-radius: 99px;
    background: var(--_accent); margin-left: 5px;
    animation: pvqDot 1.2s ease-in-out infinite;
  }
  .pvq-dots span:nth-child(2) { animation-delay: .15s; }
  .pvq-dots span:nth-child(3) { animation-delay: .3s; }

  .pvq-price { font-weight: 700; font-size: clamp(26px, 3vw, 36px); color: var(--_accent); font-variant-numeric: tabular-nums; }

  .pvq-powered {
    flex-basis: 100%;
    display: flex; align-items: center; justify-content: flex-end; gap: 7px;
    margin-top: 10px; text-decoration: none;
  }
  .pvq-powered span { font-size: 12px; color: var(--_muted); }
  .pvq-powered img { height: 20px; width: auto; display: block; opacity: .85; transition: opacity .15s ease; }
  .pvq-powered:hover img { opacity: 1; }

  @media (max-width: 720px) {
    .pvq-bar > * { flex: 1 1 100%; }
    .pvq-measure { flex: 1 1 45%; width: auto; }
    .pvq-brand-header { flex-direction: column; align-items: flex-start; gap: 8px; }
  }
`;

/* ══════════════ Widget ══════════════ */

type Phase = "lavoro" | "immobile" | "descrizione" | "contatto" | "attesa" | "stima" | "fuorizona";

const PROPRIETA = [
  { id: "proprietario", label: "Sono il proprietario" },
  { id: "acquisto", label: "Lo sto per acquistare" },
  { id: "inquilino", label: "Sono in affitto" },
  { id: "altro", label: "Altro" },
] as const;

const BUDGETS = [
  { id: "", label: "Budget indicativo (facoltativo)" },
  { id: "<5k", label: "Fino a 5.000 €" },
  { id: "5-15k", label: "5.000 – 15.000 €" },
  { id: "15-30k", label: "15.000 – 30.000 €" },
  { id: "30-60k", label: "30.000 – 60.000 €" },
  { id: ">60k", label: "Oltre 60.000 €" },
  { id: "ns", label: "Non lo so ancora" },
] as const;

const URGENZE = [
  { id: "", label: "Quando vuoi iniziare?" },
  { id: "subito", label: "Il prima possibile" },
  { id: "1-3mesi", label: "Entro 1–3 mesi" },
  { id: "3+mesi", label: "Tra più di 3 mesi" },
  { id: "valuto", label: "Sto solo valutando i costi" },
] as const;

/* ── Tracking: eventi verso dataLayer (GA4 / Meta Pixel via GTM).
     Ogni passo emette un evento: senza questi dati non si sa dove
     il funnel perde né quale campagna porta lead buoni. ── */
function track(event: string, data: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  (w.dataLayer = w.dataLayer || []).push({ event: `pvq_${event}`, ...data });
}

/* UTM passthrough: finiscono nel payload del lead */
function getUtm(): Record<string, string> {
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  return utm;
}

/* Configurazione per azienda — in futuro generata dal setup process */
export type PrevAiQuoteBarConfig = {
  prevaiUrl?: string;
  /** prova sociale mostrata sopra la barra (collegata alla scheda Google) */
  rating?: { stars: number; count: number } | null;
  /** prefissi CAP serviti (es. ["20", "21"]); null/undefined = tutta Italia */
  capServiti?: string[] | null;
  /** come mostrare il prezzo: range completo, solo "a partire da", o nascosto */
  mostraPrezzo?: "range" | "da" | "nascosto";
  /** offri l'opzione "stima su WhatsApp" nel passo contatti */
  whatsapp?: boolean;
  /** Chiave API per connettersi al backend reale */
  apiKey?: string;
  /** URL del server API di PrevAI */
  apiBaseUrl?: string;
  /** URL della privacy policy personalizzata */
  privacyUrl?: string | null;
};

export function PrevAiQuoteBar({
  prevaiUrl = "https://prevai.it",
  rating = null,
  capServiti = null,
  mostraPrezzo = "range",
  whatsapp = true,
  apiKey,
  apiBaseUrl = "http://localhost:5180",
  privacyUrl = null,
}: PrevAiQuoteBarConfig) {
  const [phase, setPhase] = useState<Phase>("lavoro");
  const [intervento, setIntervento] = useState<Intervento | null>(null);
  const [misure, setMisure] = useState<Record<string, string>>({});
  const [proprieta, setProprieta] = useState("");
  const [urgenza, setUrgenza] = useState("");
  const [cap, setCap] = useState("");
  const [budget, setBudget] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [viaWhatsapp, setViaWhatsapp] = useState(false);
  const [hp, setHp] = useState(""); // honeypot anti-bot: gli umani non lo vedono
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [touched, setTouched] = useState(false);

  // Stato per la configurazione dinamica scaricata dal server
  const [tenantConfig, setTenantConfig] = useState<{
    companyName?: string;
    logoUrl?: string;
    email?: string;
    phone?: string;
    address?: string;
    supportedCategories?: string[];
  } | null>(null);

  // Stato per il risultato del preventivo (dal backend o locale)
  const [stimaResult, setStimaResult] = useState<{ min: number; max: number } | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Caricamento configurazione dinamica
  useEffect(() => {
    if (!apiKey) return;
    fetch(`${apiBaseUrl}/api/public/config?apiKey=${apiKey}`)
      .then((r) => {
        if (!r.ok) throw new Error("Config not found");
        return r.json();
      })
      .then((data) => {
        if (data.success) {
          setTenantConfig(data);
        }
      })
      .catch((err) => {
        console.warn("Impossibile caricare la configurazione dell'impresa:", err);
      });
  }, [apiKey, apiBaseUrl]);

  // Filtra gli interventi in base a quelli supportati nel catalogo dell'impresa
  const listinoInterventi = useMemo(() => {
    if (!tenantConfig?.supportedCategories || tenantConfig.supportedCategories.length === 0) {
      return INTERVENTI;
    }
    const categories = tenantConfig.supportedCategories.map((c) => c.toLowerCase());
    return INTERVENTI.filter((i) => {
      if (i.id === "altro") return true;
      return categories.some((cat) => i.label.toLowerCase().includes(cat) || i.id.includes(cat));
    });
  }, [tenantConfig]);

  const misureValid = intervento?.fields.every((f) => {
    const v = parseFloat(misure[f.key] || "");
    return !isNaN(v) && v >= f.min && v <= f.max;
  }) ?? false;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const phoneValid = telefono.replace(/[\s+\-./]/g, "").length >= 8;
  const contactValid = nome.trim().length >= 2 && emailValid && phoneValid && privacy;

  const goTo = (p: Phase) => { setTouched(false); setPhase(p); };

  const capValid = cap === "" || /^\d{5}$/.test(cap);

  /* deep-link per le landing SEO: #preventivo=bagno (o ?pvq=bagno)
     apre la barra con l'intervento già selezionato */
  useEffect(() => {
    track("widget_view");
    const m =
      window.location.hash.match(/preventivo=([\w-]+)/) ||
      window.location.search.match(/[?&]pvq=([\w-]+)/);
    const pre = m && listinoInterventi.find((i) => i.id === m[1]);
    if (pre) setIntervento(pre);
  }, [listinoInterventi]);

  const avantiMisure = () => {
    if (!intervento || !misureValid) { setTouched(true); return; }
    track("step_lavoro", { intervento: intervento.id });
    goTo("immobile");
  };

  const avantiImmobile = () => {
    if (!proprieta || !urgenza || !capValid) { setTouched(true); return; }
    if (capServiti && cap && !capServiti.some((p) => cap.startsWith(p))) {
      track("fuori_zona", { cap });
      goTo("fuorizona");
      return;
    }
    track("step_immobile", { proprieta, urgenza, budget: budget || "n/d", cap: cap ? "sì" : "no" });
    goTo("descrizione");
  };

  const avantiDescrizione = () => {
    track("step_descrizione", { caratteri: descrizione.length });
    goTo("contatto");
  };

  const invia = () => {
    if (!contactValid) { setTouched(true); return; }
    setPhase("attesa");
    setUseFallback(false);
    setStimaResult(null);

    const isBot = hp !== "";
    if (isBot) {
      setTimeout(() => {
        setStimaResult(stimaDemo(intervento!, misure));
        setPhase("stima");
      }, 2000);
      return;
    }

    track("lead_inviato", { intervento: intervento?.id, urgenza, budget: budget || "n/d", whatsapp: viaWhatsapp, ...getUtm() });

    const rawInputText = `Richiesta Preventivo Widget per ${intervento?.label}.
Note utente: ${descrizione || "Nessuna nota aggiuntiva."}
Tipo immobile: ${proprieta}. Urgenza: ${urgenza}. CAP: ${cap || "n/d"}. Budget indicativo: ${budget || "n/d"}.`;

    const misurePayload: Record<string, number> = {};
    Object.entries(misure).forEach(([key, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        misurePayload[key] = num;
      }
    });

    if (apiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      fetch(`${apiBaseUrl}/api/public/quotes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          rawInput: rawInputText,
          clientData: {
            nome,
            email,
            phone: telefono,
          },
          misure: misurePayload,
        }),
        signal: controller.signal,
      })
        .then((r) => {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error("Chiamata fallita");
          return r.json();
        })
        .then((data) => {
          if (data.success) {
            if (data.quoteId) setQuoteId(data.quoteId);
            setStimaResult({ min: data.prezzoMinimo, max: data.prezzoMassimo });
            setPhase("stima");
          } else {
            throw new Error("Dati non validi");
          }
        })
        .catch((err) => {
          console.warn("Chiamata API fallita o timeout. Uso stima di fallback locale.", err);
          setUseFallback(true);
          setStimaResult(stimaDemo(intervento!, misure));
          setPhase("stima");
        });
    } else {
      setTimeout(() => {
        setStimaResult(stimaDemo(intervento!, misure));
        setPhase("stima");
      }, 2600);
    }
  };

  const ricomincia = () => {
    setIntervento(null); setMisure({}); setDescrizione("");
    setProprieta(""); setUrgenza(""); setCap(""); setBudget("");
    setNome(""); setEmail(""); setTelefono(""); setPrivacy(false);
    setViaWhatsapp(false); setHp(""); setQuoteId(null);
    setTouched(false); setPhase("lavoro");
    setStimaResult(null); setUseFallback(false);
  };

  return (
    <div className="pvq" style={{ width: "100%", maxWidth: 900 }}>
      <style>{WIDGET_CSS}</style>

      <div className="pvq-bar">
        {/* ── Passo 1: lavoro + misure ── */}
        {phase === "lavoro" && (
          <div className="pvq-step">
            <div className="pvq-head">
              <p className="pvq-title">Quanto costa il tuo lavoro? Scoprilo subito.</p>
              <span className="pvq-stepnum">Passo 1 di 4</span>
            </div>

            <select
              className="pvq-select"
              style={{ flex: "1 1 240px" }}
              value={intervento?.id ?? ""}
              onChange={(e) => {
                setIntervento(listinoInterventi.find((i) => i.id === e.target.value) ?? null);
                setMisure({});
                setTouched(false);
              }}
            >
              <option value="" disabled>Che lavoro devi fare?</option>
              {listinoInterventi.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>

            {intervento?.fields.map((f) => {
              const v = misure[f.key] ?? "";
              const num = parseFloat(v);
              const invalid = touched && (isNaN(num) || num < f.min || num > f.max);
              return (
                <div className="pvq-measure" key={f.key} title={`${f.short} (${f.unit})`}>
                  <input
                    className="pvq-input" type="number" inputMode="decimal"
                    placeholder={f.short} value={v} data-invalid={invalid}
                    min={f.min} max={f.max}
                    onChange={(e) => setMisure((m) => ({ ...m, [f.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && avantiMisure()}
                  />
                  <span>{f.unit}</span>
                </div>
              );
            })}

            <button className="pvq-btn" onClick={avantiMisure} disabled={!intervento}>
              Continua
            </button>

            {touched && !misureValid && intervento && (
              <p className="pvq-note" style={{ flexBasis: "100%", color: "#dc2626", margin: 0 }}>
                Controlla le misure: servono valori realistici per calcolare la stima.
              </p>
            )}
          </div>
        )}

        {/* ── Passo 2: l'immobile (qualifica del lead) ── */}
        {phase === "immobile" && (
          <div className="pvq-step">
            <div className="pvq-head">
              <p className="pvq-title">Due domande sull'immobile</p>
              <span className="pvq-stepnum">Passo 2 di 4</span>
            </div>

            <select
              className="pvq-select"
              style={{ flex: "1 1 210px", color: proprieta ? "var(--_text)" : "var(--_muted)" }}
              value={proprieta}
              data-invalid={touched && !proprieta}
              onChange={(e) => setProprieta(e.target.value)}
            >
              <option value="" disabled>Il tuo rapporto con l'immobile</option>
              {PROPRIETA.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <select
              className="pvq-select"
              style={{ flex: "1 1 200px", color: urgenza ? "var(--_text)" : "var(--_muted)" }}
              value={urgenza}
              data-invalid={touched && !urgenza}
              onChange={(e) => setUrgenza(e.target.value)}
            >
              {URGENZE.map((u) => (
                <option key={u.id} value={u.id} disabled={u.id === ""}>{u.label}</option>
              ))}
            </select>

            <div className="pvq-measure" title="CAP dell'immobile" style={{ width: 130 }}>
              <input
                className="pvq-input" inputMode="numeric" maxLength={5}
                placeholder="CAP" value={cap}
                data-invalid={touched && !capValid}
                onChange={(e) => setCap(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && avantiImmobile()}
              />
              <span>📍</span>
            </div>

            <select
              className="pvq-select"
              style={{ flex: "1 1 210px", color: budget ? "var(--_text)" : "var(--_muted)" }}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              {BUDGETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <button className="pvq-btn" onClick={avantiImmobile}>
                Continua
              </button>
              <button className="pvq-link" onClick={() => goTo("lavoro")}>
                ← Torna alle misure
              </button>
            </div>

            {touched && (!proprieta || !urgenza || !capValid) && (
              <p className="pvq-note" style={{ flexBasis: "100%", color: "#dc2626", margin: 0 }}>
                {!proprieta ? "Indica il tuo rapporto con l'immobile."
                  : !urgenza ? "Dicci quando vorresti iniziare i lavori."
                  : "Il CAP deve avere 5 cifre (oppure lascialo vuoto)."}
              </p>
            )}
          </div>
        )}

        {/* ── Passo 3: descrizione libera del lavoro ── */}
        {phase === "descrizione" && intervento && (
          <div className="pvq-step">
            <div className="pvq-head">
              <p className="pvq-title">Descrivi il lavoro con parole tue</p>
              <span className="pvq-stepnum">Passo 3 di 4 · facoltativo</span>
            </div>

            <textarea
              className="pvq-textarea"
              style={{ flex: "1 1 380px" }}
              rows={2}
              placeholder={intervento.hintDescrizione}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              autoFocus
            />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <button className="pvq-btn" onClick={avantiDescrizione}>
                Continua
              </button>
              <button className="pvq-link" onClick={() => goTo("immobile")}>
                ← Indietro
              </button>
            </div>

            <p className="pvq-note" style={{ flexBasis: "100%", margin: 0 }}>
              Più dettagli scrivi (materiali, colori, condizioni attuali), più la stima sarà precisa.
            </p>
          </div>
        )}

        {/* ── Passo 3: contatto ── */}
        {phase === "contatto" && (
          <div className="pvq-step">
            <div className="pvq-head">
              <p className="pvq-title">Dove ti mandiamo la stima?</p>
              <span className="pvq-stepnum">Passo 4 di 4</span>
            </div>

            <input className="pvq-input" style={{ flex: "1 1 170px" }} placeholder="Nome e cognome"
              autoComplete="name" value={nome} data-invalid={touched && nome.trim().length < 2}
              onChange={(e) => setNome(e.target.value)} />
            <input className="pvq-input" style={{ flex: "1 1 210px" }} type="email" placeholder="Email"
              autoComplete="email" value={email} data-invalid={touched && !emailValid}
              onChange={(e) => setEmail(e.target.value)} />
            <input className="pvq-input" style={{ flex: "1 1 170px" }} type="tel" placeholder="Telefono"
              autoComplete="tel" value={telefono} data-invalid={touched && !phoneValid}
              onChange={(e) => setTelefono(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invia()} />
            <button className="pvq-btn" onClick={invia}>Vedi la stima</button>

            {/* honeypot anti-bot: invisibile agli umani, i bot lo compilano */}
            <input
              type="text" name="azienda_sito_web" tabIndex={-1} autoComplete="off"
              value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />

            {/* micro-copy che disinnesca la paura del telefono: è qui che
                si perde la maggior parte dei lead */}
            <p className="pvq-note" style={{ flexBasis: "100%", margin: 0 }}>
              Ti chiamiamo una sola volta, per fissare il sopralluogo. Niente chiamate commerciali.
            </p>

            <div style={{ flexBasis: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {whatsapp && (
                  <label className="pvq-check pvq-note">
                    <input type="checkbox" checked={viaWhatsapp} onChange={(e) => setViaWhatsapp(e.target.checked)} />
                    <span>Mandami la stima anche su WhatsApp</span>
                  </label>
                )}
                <label className="pvq-check pvq-note">
                  <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
                  <span>
                    Accetto di essere ricontattato per il preventivo (leggi la <a href={privacyUrl || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "inherit" }}>Privacy Policy</a>).
                    {touched && !privacy && <strong style={{ color: "#dc2626" }}> Richiesto.</strong>}
                  </span>
                </label>
              </div>
              <button className="pvq-link" onClick={() => goTo("descrizione")}>
                ← Torna alla descrizione
              </button>
            </div>
          </div>
        )}

        {/* ── Fuori zona: fermato con gentilezza ── */}
        {phase === "fuorizona" && (
          <div className="pvq-step">
            <div style={{ flex: "1 1 auto", padding: "4px 8px" }}>
              <p className="pvq-title" style={{ margin: "0 0 6px" }}>Grazie dell'interesse!</p>
              <p className="pvq-note" style={{ margin: 0, maxWidth: 560 }}>
                Al momento non seguiamo lavori nella zona del CAP {cap}: preferiamo
                dirtelo subito piuttosto che farti aspettare. Un'impresa più vicina
                potrà farti un sopralluogo rapido e senza costi di trasferta.
              </p>
              <button className="pvq-link" onClick={() => goTo("immobile")} style={{ padding: "8px 0 0" }}>
                ← Ho sbagliato CAP, torna indietro
              </button>
            </div>
          </div>
        )}

        {/* ── Attesa ── */}
        {phase === "attesa" && (
          <div className="pvq-step">
            <p style={{ margin: 0, padding: "16px 8px", fontSize: 17 }}>
              Stiamo preparando la tua stima
              <span className="pvq-dots"><span /><span /><span /></span>
            </p>
          </div>
        )}

        {/* ── Stima ── */}
        {phase === "stima" && intervento && stimaResult && (
          <RisultatoInline
            intervento={intervento} misure={misure} nome={nome}
            mostraPrezzo={mostraPrezzo} viaWhatsapp={viaWhatsapp}
            onRestart={ricomincia} stimaResult={stimaResult} useFallback={useFallback}
            quoteId={quoteId} apiKey={apiKey} apiBaseUrl={apiBaseUrl}
          />
        )}

        {/* firma prevai — link backlink SEO con logo ufficiale */}
        <a
          className="pvq-powered"
          href={prevaiUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("click_powered_by")}
        >
          <span>Stima calcolata con tecnologia</span>
          <img src="/prevai-logo.png" alt="PrevAI — Preventivi Edili" />
        </a>
      </div>
    </div>
  );
}

function RisultatoInline({
  intervento, misure, nome, mostraPrezzo, viaWhatsapp, onRestart, stimaResult, useFallback, quoteId, apiKey, apiBaseUrl,
}: {
  intervento: Intervento; misure: Record<string, string>; nome: string;
  mostraPrezzo: "range" | "da" | "nascosto"; viaWhatsapp: boolean;
  onRestart: () => void;
  stimaResult: { min: number; max: number };
  useFallback: boolean;
  quoteId?: string | null;
  apiKey?: string;
  apiBaseUrl?: string;
}) {
  const minAnim = useCountUp(stimaResult.min);
  const maxAnim = useCountUp(stimaResult.max, 1300);
  useEffect(() => { track("stima_mostrata", { min: stimaResult.min, max: stimaResult.max, modo: mostraPrezzo }); }, [stimaResult, mostraPrezzo]);
  const canali = viaWhatsapp ? "via email e WhatsApp" : "via email";

  // Stato per il motore interattivo degli incentivi
  const [incentivesStep, setIncentivesStep] = useState<"hidden" | "questions" | "result">("hidden");
  const [tipoImmobile, setTipoImmobile] = useState("prima_casa");
  const [obiettivoLavori, setObiettivoLavori] = useState("ristrutturazione");
  const [fasciaIsee, setFasciaIsee] = useState("sopra_30k");
  const [regione, setRegione] = useState("Lombardia");
  const [loadingInc, setLoadingInc] = useState(false);

  // Risultati incentivi calcolati
  const [incResult, setIncResult] = useState<{
    scontoIva: number;
    bonusStataleNome: string;
    bonusStataleImporto: number;
    bandoRegionaleNome: string;
    bandoRegionaleImporto: number;
    totaleIncentivi: number;
    costoNetto: number;
  } | null>(null);

  const calcolaIncentiviLocal = () => {
    setLoadingInc(true);
    setTimeout(() => {
      const medio = Math.round((stimaResult.min + stimaResult.max) / 2);
      const isRes = tipoImmobile !== "ufficio";
      const scontoIva = isRes ? Math.round(medio * 0.10) : 0;

      let bonusStataleNome = "Bonus Ristrutturazione Edilizia 50% (Detrazione 10 anni)";
      let importoStat = Math.round(medio * 0.50);
      if (obiettivoLavori === "efficienza") {
        bonusStataleNome = "Ecobonus 65% / Conto Termico GSE (Incentivo Diretto)";
        importoStat = Math.round(medio * 0.65);
      } else if (obiettivoLavori === "barriere") {
        bonusStataleNome = "Bonus Abbattimento Barriere Architettoniche 75%";
        importoStat = Math.round(medio * 0.75);
      }
      if (importoStat > 48000) importoStat = 48000;

      let bandoRegionaleNome = "Nessun bando regionale a sportello specifico (si applicano i Bonus Statali compatibili)";
      let importoReg = 0;

      if (regione === "Lombardia") {
        bandoRegionaleNome = "⚡ Bando Efficienza e Riscaldamento Regione Lombardia 2026 (Fondo Perduto)";
        importoReg = fasciaIsee === "sotto_30k" ? 5000 : 3500;
      } else if (regione === "Piemonte") {
        bandoRegionaleNome = "⚡ Bando Sostituzione Impianti Termici ed Efficienza Piemonte (Fondo Perduto)";
        importoReg = fasciaIsee === "sotto_30k" ? 4000 : 3000;
      } else if (regione === "Emilia-Romagna") {
        bandoRegionaleNome = "⚡ Bando Solare e Rinnovabili Residenziale Emilia-Romagna (Fondo Perduto)";
        importoReg = fasciaIsee === "sotto_30k" ? 4000 : 2500;
      } else if (regione === "Veneto") {
        bandoRegionaleNome = "⚡ Bando Rigenerazione Sostenibile Veneto 2026 (Fondo Perduto)";
        importoReg = 3000;
      } else if (regione === "Lazio" || regione === "Campania" || regione === "Toscana") {
        bandoRegionaleNome = "⚡ Bando Riqualificazione ed Efficienza Energetica Residenziale";
        importoReg = 2500;
      }

      const totaleInc = importoStat + importoReg;
      const costoNetto = Math.max(Math.round(medio * 0.25), Math.round(medio - importoReg - (importoStat * 0.55) - scontoIva));

      setIncResult({
        scontoIva,
        bonusStataleNome,
        bonusStataleImporto: importoStat,
        bandoRegionaleNome,
        bandoRegionaleImporto: importoReg,
        totaleIncentivi: totaleInc,
        costoNetto,
      });
      setLoadingInc(false);
      setIncentivesStep("result");
      track("incentivi_verificati", { medio, costoNetto, regione });

      // Sincronizza all'istante all'API backend il profilo incentivi verificato per aggiornare il CRM del partner edile
      if (quoteId && apiKey && apiBaseUrl) {
        fetch(`${apiBaseUrl}/api/public/quotes/${quoteId}/incentives`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            tipoImmobile,
            obiettivoLavori,
            fasciaIsee,
            regione,
            cap: "",
            totalePreventivo: stimaResult.max,
          }),
        }).catch((err) => console.warn("Failed to sync verified incentives with backend", err));
      }
    }, 400);
  };

  return (
    <div className="pvq-step" style={{ flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 auto", padding: "4px 8px" }}>
        <p className="pvq-note" style={{ margin: 0 }}>
          {intervento.label} · stima per {nome.split(" ")[0] || "te"}
        </p>
        {mostraPrezzo === "range" && (
          <p style={{ margin: "4px 0 0" }}>
            <span className="pvq-price">{fmtEuro(minAnim)}</span>
            <span style={{ margin: "0 10px", color: "var(--_muted)" }}>–</span>
            <span className="pvq-price">{fmtEuro(maxAnim)}</span>
          </p>
        )}
        {mostraPrezzo === "da" && (
          <p style={{ margin: "4px 0 0" }}>
            <span style={{ fontSize: 15, color: "var(--_muted)" }}>a partire da </span>
            <span className="pvq-price">{fmtEuro(minAnim)}</span>
          </p>
        )}
        {mostraPrezzo === "nascosto" && (
          <p style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 600 }}>
            La tua stima dettagliata è in arrivo {canali}.
          </p>
        )}
        {useFallback && (
          <p className="pvq-note" style={{ color: "#d97706", fontWeight: "600", marginTop: "6px" }}>
            ⚠️ Connessione rallentata. Mostrata stima locale provvisoria; riceverai il preventivo ufficiale via email.
          </p>
        )}
      </div>
      <div style={{ flex: "0 1 auto", textAlign: "right" }}>
        <p className="pvq-note" style={{ margin: "0 0 6px", color: "var(--_text)", fontWeight: 600 }}>
          Ti chiamiamo entro 24 ore per un sopralluogo gratuito.
        </p>
        {mostraPrezzo !== "nascosto" && (
          <p className="pvq-note" style={{ margin: "0 0 6px" }}>
            Riceverai il dettaglio anche {canali}.
          </p>
        )}
        <button className="pvq-link" onClick={onRestart} style={{ padding: 0 }}>
          Calcola un altro lavoro
        </button>
      </div>

      {/* ── MOTORE INTERATTIVO INCENTIVI E BANDI REGIONALI/COMUNALI ── */}
      {incentivesStep === "hidden" && (
        <div style={{ flexBasis: "100%", marginTop: 14, padding: "12px 16px", background: "rgba(16, 185, 129, 0.09)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--_radius)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>🎁 INCENTIVI E BANDI REGIONALI 2026</span>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--_text)" }}>
              Scopri subito quanti fondi a fondo perduto, agevolazioni IVA e detrazioni statali puoi ottenere per questo lavoro.
            </p>
          </div>
          <button className="pvq-btn" style={{ background: "#059669", color: "#fff", padding: "8px 16px", fontSize: 13 }} onClick={() => setIncentivesStep("questions")}>
            Verifica Incentivi Ora →
          </button>
        </div>
      )}

      {incentivesStep === "questions" && (
        <div style={{ flexBasis: "100%", marginTop: 14, padding: "16px", background: "var(--_field-bg)", border: "1px solid var(--_border)", borderRadius: "var(--_radius)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 14, color: "var(--_text)" }}>Verifica rapida idoneità bandi e detrazioni (3 domande)</strong>
            <button className="pvq-link" style={{ padding: 0, fontSize: 12 }} onClick={() => setIncentivesStep("hidden")}>✕ Chiudi</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--_muted)", textTransform: "uppercase" }}>1. Tipo Immobile</label>
              <select className="pvq-input" value={tipoImmobile} onChange={(e) => setTipoImmobile(e.target.value)}>
                <option value="prima_casa">Prima Casa (Residenza principale)</option>
                <option value="seconda_casa">Seconda Casa / Casa vacanze</option>
                <option value="condominio">Condominio (o unità in condominio)</option>
                <option value="ufficio">Ufficio / Immobile commerciale</option>
              </select>
            </div>
            <div style={{ flex: "1 1 230px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--_muted)", textTransform: "uppercase" }}>2. Obiettivo Lavori</label>
              <select className="pvq-input" value={obiettivoLavori} onChange={(e) => setObiettivoLavori(e.target.value)}>
                <option value="ristrutturazione">Manutenzione / Ristrutturazione ordinaria</option>
                <option value="efficienza">Efficienza Energetica (+2 classi, infissi, caldaia/pompa di calore)</option>
                <option value="barriere">Abbattimento Barriere Architettoniche (es. doccia accessibile)</option>
              </select>
            </div>
            <div style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--_muted)", textTransform: "uppercase" }}>3. Regione dell'Immobile</label>
              <select className="pvq-input" value={regione} onChange={(e) => setRegione(e.target.value)}>
                <option value="Lombardia">Lombardia</option>
                <option value="Piemonte">Piemonte</option>
                <option value="Emilia-Romagna">Emilia-Romagna</option>
                <option value="Veneto">Veneto</option>
                <option value="Lazio">Lazio</option>
                <option value="Toscana">Toscana</option>
                <option value="Campania">Campania</option>
                <option value="Sicilia">Sicilia</option>
                <option value="Altra">Altra Regione</option>
              </select>
            </div>
            <div style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--_muted)", textTransform: "uppercase" }}>ISEE / Requisito Sociale</label>
              <select className="pvq-input" value={fasciaIsee} onChange={(e) => setFasciaIsee(e.target.value)}>
                <option value="sopra_30k">Standard (o non dichiaro)</option>
                <option value="sotto_30k">ISEE &lt; 30.000 € (Maggiorazione bandi sociali)</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button className="pvq-btn" style={{ background: "var(--_accent)", color: "var(--_on-accent)" }} onClick={calcolaIncentiviLocal} disabled={loadingInc}>
              {loadingInc ? "Verifica bandi in corso..." : "⚡ Calcola Risparmio e Costo Netto"}
            </button>
          </div>
        </div>
      )}

      {incentivesStep === "result" && incResult && (
        <div style={{ flexBasis: "100%", marginTop: 14, padding: "16px 18px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "var(--_radius)", display: "flex", flexDirection: "column", gap: 10, color: "#065f46" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(16, 185, 129, 0.2)", paddingBottom: 8 }}>
            <strong style={{ fontSize: 15 }}>🎯 Profilo Incentivi Verificato per {regione}</strong>
            <button className="pvq-link" style={{ padding: 0, fontSize: 12, color: "#059669" }} onClick={() => setIncentivesStep("questions")}>✎ Ricalcola</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            {incResult.scontoIva > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📉 Vantaggio immediato IVA residenziale (10% vs 22%):</span>
                <strong>– {fmtEuro(incResult.scontoIva)}</strong>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>🏛️ {incResult.bonusStataleNome}:</span>
              <strong>– {fmtEuro(incResult.bonusStataleImporto)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: incResult.bandoRegionaleImporto > 0 ? "#047857" : "inherit" }}>
              <span>📍 {incResult.bandoRegionaleNome}:</span>
              <strong>{incResult.bandoRegionaleImporto > 0 ? `– ${fmtEuro(incResult.bandoRegionaleImporto)}` : "Incluso nei Bonus Statali"}</strong>
            </div>
          </div>
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: "2px dashed rgba(16, 185, 129, 0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.03em" }}>Investimento Netto Stimato:</span>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#047857" }}>{fmtEuro(incResult.costoNetto)}</div>
            </div>
            <div style={{ fontSize: 11, maxWidth: 320, color: "#065f46" }}>
              ✅ Profilo incentivi abbinato alla tua richiesta. Il tecnico dell'impresa verificherà con te la fattibilità durante il sopralluogo gratuito.
            </div>
          </div>
        </div>
      )}

      <p className="pvq-note" style={{ flexBasis: "100%", margin: "10px 8px 0", fontSize: 12 }}>
        Molti interventi come questo godono di detrazioni fiscali: al sopralluogo
        ti diciamo quali spettano a te. La stima è orientativa: è il sopralluogo —
        gratuito e senza impegno — a trasformarla nel prezzo esatto, nero su bianco.
        Prezzi IVA esclusa.
      </p>
    </div>
  );
}

export default function WidgetFunnelDemo() {
  return (
    <div style={{ padding: "16px", maxWidth: 900, margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <PrevAiQuoteBar
        mostraPrezzo="range"
        whatsapp={true}
        rating={null}
      />
    </div>
  );
}


