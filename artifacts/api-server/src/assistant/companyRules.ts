// POCKET-5 (riga 62, QuoteAI 128.1): le parti pure dell'assistente d'impresa dell'app (Proposte, Attività, Permessi):
// cosa vuol dire un livello, quando un messaggio può partire, e le bozze del promemoria e del sollecito, in italiano.
// Provato in companyRules.test.ts. PrevAI lavora in un solo fuso (Europe/Rome) e manda solo email.
import { RECOMMENDED_LEVELS, type CompanyAssistantLevel, type CompanyAssistantLevels } from "@workspace/db";

export type Rule = "ask" | "send" | "off";
export type RuleKey = keyof CompanyAssistantLevels;

export const LEVEL_KEYS: RuleKey[] = ["followups", "reminders", "receipts", "scheduling", "crew"];

/** Il fuso delle imprese di PrevAI: le date dei messaggi e il giorno del mese si contano qui. */
export const ZONE = "Europe/Rome";

/** I livelli di un'impresa: quelli scelti, i consigliati dove non ha scelto niente. */
export function levelsOf(stored: Partial<CompanyAssistantLevels> | null | undefined): CompanyAssistantLevels {
  const out = { ...RECOMMENDED_LEVELS };
  for (const k of LEVEL_KEYS) {
    const v = stored?.[k];
    if (v === 0 || v === 1 || v === 2) out[k] = v as CompanyAssistantLevel;
  }
  return out;
}

/** 0 chiede prima, 1 lo fa e lo dice, 2 non lo fa. */
export const ruleOf = (level: CompanyAssistantLevel): Rule => (level === 0 ? "ask" : level === 1 ? "send" : "off");

/** Minuti dalla mezzanotte, nel giorno dell'impresa. */
export type Quiet = { on: boolean; from: number; until: number; sunday: boolean };

/**
 * Se un messaggio può partire a quest'ora locale. Le ore di silenzio scavalcano la mezzanotte quando `from` è dopo
 * `until` ("dalle 20 alle 7"). `day` è 0 per la domenica, come Date#getDay.
 */
export function isQuiet(q: Quiet, day: number, minute: number): boolean {
  if (q.sunday && day === 0) return true;
  if (!q.on) return false;
  if (q.from === q.until) return false;
  return q.from > q.until ? minute >= q.from || minute < q.until : minute >= q.from && minute < q.until;
}

/** Il giorno della settimana (0 = domenica) e il minuto del giorno di un istante, nel fuso dato. */
export function localClock(at: Date, zone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: day < 0 ? 0 : day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** Il giorno di calendario di un istante nel fuso, come AAAA-MM-GG. */
export const localDay = (at: Date, zone: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** Il primo giorno del mese dopo il giorno dato (AAAA-MM-GG), come AAAA-MM-01. */
export function nextMonthStart(day: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Il nome per il saluto; vuoto quando non c'è. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

// `useGrouping: "always"`: it-IT leaves four digits ungrouped ("2340,00 €"), a client reads "2.340,00 €".
const money = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" as unknown as boolean }).format(cents / 100);
const dayIt = (d: Date, zone: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: zone }).format(d);

/** Il testo che chiede una fattura scaduta. `who` è chi lo firma. */
export function reminderDraft(p: { client: string; number: string; balanceCents: number; due: Date; link: string; who: string; zone?: string }): string {
  const hi = firstName(p.client);
  return `Buongiorno${hi ? ` ${hi}` : ""}, le ricordo che la pro-forma ${p.number} di ${money(p.balanceCents)} era in scadenza il ${dayIt(p.due, p.zone ?? ZONE)}. Può pagare con bonifico o carta qui: ${p.link}. Grazie, ${p.who}`;
}

/** Il testo che sollecita un preventivo senza risposta. */
export function followupDraft(p: { client: string; title: string; link: string; who: string }): string {
  const hi = firstName(p.client);
  return `Buongiorno${hi ? ` ${hi}` : ""}, le scrivo per il preventivo${p.title ? ` «${p.title}»` : ""}. Se vuole lo vediamo insieme o cambio i lavori, se le è utile: ${p.link}. Grazie, ${p.who}`;
}

/** Giorni interi da `then` a `now`, mai sotto 0. */
export const daysBetween = (then: Date, now: Date): number => Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));

/** Dopo quanti giorni di ritardo si prepara il primo, il secondo e il terzo promemoria: gli stessi dei promemoria automatici (invoices/math.ts). */
export { REMINDER_AFTER_DAYS as REMINDER_DRAFT_DAYS } from "../invoices/math.js";

/** Dopo quanti giorni dall'invio di un preventivo senza risposta si prepara un sollecito: il primo passo dei solleciti automatici (2, 5, 10). */
export const FOLLOWUP_DRAFT_DAYS = 2;

/** Un ordine sopra il limite (centesimi) chiede sempre. */
export const overLimit = (totalCents: number, limitCents: number): boolean => totalCents > limitCents;
