// ── APP-8f: conferma a voce, interruzione, annulla (docs/ASSISTENTE-PLAN.md) ──
// Quando una scheda aspetta, l'assistente rilegge l'essenziale ("Invio la
// fattura PF-2026-0042, settemilacentododici euro, a Marco Venturi per
// email?") e accetta solo un sì chiaro. Tutto il resto — "sì, anzi no",
// "aspetta", "mandala a Luca" — lascia la scheda in attesa e va all'assistente
// come una domanda qualsiasi. Sopra la soglia scelta dal titolare la voce non
// basta: serve il tocco su Conferma. Regole condivise da server e app.

import { spokenText } from "./assistente-voce";

// ── Numeri in lettere ────────────────────────────────────────────────────────

const UNITS = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

function below100(n: number): string {
  if (n < 20) return UNITS[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  const u = n % 10;
  if (u === 0) return t;
  // ventuno, ventotto: the vowel falls before uno and otto.
  return (u === 1 || u === 8 ? t.slice(0, -1) : t) + UNITS[u]!;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hs = h === 0 ? "" : h === 1 ? "cento" : UNITS[h]! + "cento";
  if (r === 0) return hs;
  const rs = below100(r);
  // centotto, centottanta.
  return hs && rs.startsWith("ott") ? hs.slice(0, -1) + rs : hs + rs;
}

/** A whole number in Italian words, as it is said: 7112 → "settemilacentododici", 2300000 → "due milioni trecentomila". */
export function numeroInLettere(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zero";
  const parts: string[] = [];
  const big = (size: number, one: string, many: string) => {
    const k = Math.floor(n / size);
    if (k > 0) parts.push(k === 1 ? one : `${below1000Group(k)} ${many}`);
    n %= size;
  };
  big(1_000_000_000, "un miliardo", "miliardi");
  big(1_000_000, "un milione", "milioni");
  const k = Math.floor(n / 1000);
  const rest = n % 1000;
  let small = k === 0 ? "" : k === 1 ? "mille" : below1000(k) + "mila";
  if (rest) small += below1000(rest);
  if (small) parts.push(small);
  // The accent only at the end of the word: ventitré, centotré, milletré (but ventitremila).
  const out = parts.join(" ").replace(/(\S)tre$/, "$1tré");
  return value < 0 ? `meno ${out}` : out;
}

/** Up to 999 groups of millions or billions ("due milioni", "centoventi milioni"). */
function below1000Group(n: number): string {
  return n >= 1000 ? numeroInLettere(n) : below1000(n);
}

/** An amount in cents as it is said: 711200 → "settemilacentododici euro", 150 → "un euro e cinquanta". */
export function importoInLettere(cents: number): string {
  const c = Math.round(Math.abs(cents));
  const euro = Math.floor(c / 100);
  const cent = c % 100;
  const euroWords = euro === 1 ? "un euro" : euro >= 1_000_000 && euro % 1_000_000 === 0 ? `${numeroInLettere(euro)} di euro` : `${numeroInLettere(euro)} euro`;
  if (cent === 0) return euroWords;
  if (euro === 0) return cent === 1 ? "un centesimo" : `${numeroInLettere(cent)} centesimi`;
  return `${euroWords} e ${numeroInLettere(cent)}`;
}

// ── La soglia del titolare ───────────────────────────────────────────────────

/** Stored as a row of assistant_permissions (action = this key, role '', level = the cents): no migration. */
export const ASSISTANT_VOICE_CONFIRM_SETTING = "voice_confirm_max";
/** Proposta del piano: fino a 5.000 € basta la voce, sopra serve il tocco. */
export const ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS = 500_000;
/** The choices in Impostazioni → Assistente (0 = la voce non conferma mai un importo). */
export const ASSISTANT_VOICE_CONFIRM_OPTIONS = [0, 100_000, 200_000, 500_000, 1_000_000, 2_000_000] as const;

export function parseVoiceConfirmMax(level: string | null | undefined): number {
  const n = Number(level);
  return (ASSISTANT_VOICE_CONFIRM_OPTIONS as readonly number[]).includes(n) ? n : ASSISTANT_VOICE_CONFIRM_DEFAULT_CENTS;
}

// ── La domanda di conferma ───────────────────────────────────────────────────

/** APP-8f: what the voice confirmation reads back (amount, document, recipient), put on the card payload by the server — never by the model. */
export const voiceFacts = (amountCents: number, docNumber: string | null | undefined, recipientName: string | null | undefined) => ({ amountCents: Math.round(amountCents), docNumber: docNumber || null, recipientName: recipientName || null });

/** Cards that move money or reach a customer with an amount: without a known amount the voice is not enough. */
const AMOUNT_KINDS = new Set(["send_invoice", "send_quote", "send_contract", "record_payment", "cost_entry"]);

export type VoiceConfirmCard = { kind: string; summary: string; payload: Record<string, unknown> };
export type VoiceConfirmation = { say: string; amountCents: number | null; needsTap: boolean };

/** The amount a card is about, in cents, or null (APP-8f: set on the payload by the server when the card is made). */
export function cardAmountCents(card: Pick<VoiceConfirmCard, "payload">): number | null {
  const p = card.payload;
  for (const k of ["amountCents", "totalCents"]) {
    const v = p[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  }
  return null;
}

/** Whether the voice may confirm this card, or it takes a tap (above the owner's threshold, or an amount card without its amount). */
export function voiceNeedsTap(card: VoiceConfirmCard, maxCents: number): boolean {
  const amount = cardAmountCents(card);
  if (amount === null) return AMOUNT_KINDS.has(card.kind);
  return amount > maxCents;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** What the assistant says while the card waits: the essentials, then how to answer. */
export function voiceConfirmation(card: VoiceConfirmCard, maxCents: number): VoiceConfirmation {
  const p = card.payload;
  const amountCents = cardAmountCents(card);
  const needsTap = voiceNeedsTap(card, maxCents);
  const amount = amountCents !== null ? importoInLettere(amountCents) : null;
  const to = str(p.recipientName) ?? str(p.clientName) ?? str(p.name);
  const doc = str(p.docNumber);
  const withAmount = (s: string) => (amount ? `${s}, ${amount},` : s);
  let q: string;
  switch (card.kind) {
    case "send_invoice": q = `${withAmount(`Invio la fattura${doc ? ` ${doc}` : ""}`)} a ${to ?? "il cliente"} per email?`; break;
    case "send_quote": q = `${withAmount(`Invio il preventivo${doc ? ` ${doc}` : ""}`)} a ${to ?? "il cliente"} per email?`; break;
    case "send_contract": q = `${withAmount(`Invio il contratto${doc ? ` ${doc}` : ""}`)} a ${to ?? "il cliente"} da firmare?`; break;
    case "record_payment": q = `Registro un incasso di ${amount ?? "questo importo"}${doc ? ` sulla fattura ${doc}` : ""}?`; break;
    case "cost_entry": q = `Aggiungo un costo di ${amount ?? "questo importo"}${str(p.vendor) ? ` di ${str(p.vendor)}` : ""}?`; break;
    case "reply_lead": q = `Mando ${to ? `a ${to} ` : ""}il messaggio di ricontatto?`; break;
    case "message_client": q = `Mando l'email${str(p.subject) ? ` "${str(p.subject)}"` : ""}${to ? ` a ${to}` : ""}?`; break;
    default: q = `${spokenText(card.summary.replace(/<[^>]*>/g, "")).replace(/[.\s]+$/, "")}. Confermo?`;
  }
  q = q.replace(/\s+/g, " ").replace(/ a il /g, " al ");
  const how = !needsTap
    ? "Di' sì per confermare."
    : amountCents === null || maxCents === 0
      ? "Per confermare tocca Conferma sullo schermo."
      : `È sopra i ${importoInLettere(maxCents)}: per confermare tocca Conferma sullo schermo.`;
  return { say: `${q} ${how}`, amountCents, needsTap };
}

// ── La risposta ──────────────────────────────────────────────────────────────

export type VoiceReply = "yes" | "no" | "undo" | "other";

const YES_WORDS = "sì|si|ok|okay|certo|va bene|d accordo|vai|vai pure|conferma|confermo|confermato|procedi|mandala|mandalo|mandale|mandali|inviala|invialo|inviale|registralo|registrala|fallo|falla";
const YES = new RegExp(`^(?:(?:${YES_WORDS}) )*(?:${YES_WORDS})(?: grazie)?$`);
const NO = /^(?:no(?: no)*(?: grazie)?|no,? ?lascia (?:stare|perdere)|lascia (?:stare|perdere)|non (?:mandarla|mandarlo|inviarla|inviarlo|farlo|farla)|niente)$/;
const UNDO = /^(?:annulla|annullala|annullalo|annullale|annullali|annulla tutto|torna indietro)$/;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|[^a-zà-ù])s[iíì]['’]?(?=$|[^a-zà-ù])/g, "$1sì")
    .replace(/[.,!?;:"«»“”…()\-–—]/g, " ")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * APP-8f — what a reply to a waiting card means. Only a short, clear yes is
 * "yes"; a clear no is "no" (the card is set aside, nothing happens); "annulla"
 * is "undo" (the last thing done by itself, inside its few seconds). Anything
 * mixed or longer — "sì, anzi no", "sì ma aspetta", "mandala a Luca" — is
 * "other": the card stays as it is and the words go to the assistant.
 */
export function classifyVoiceReply(text: string): VoiceReply {
  const t = normalize(text);
  if (!t || t.split(" ").length > 5) return "other";
  if (YES.test(t)) return "yes";
  if (NO.test(t)) return "no";
  if (UNDO.test(t)) return "undo";
  return "other";
}
