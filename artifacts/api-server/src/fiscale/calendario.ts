import { and, eq, isNull } from "drizzle-orm";
import { complianceRemindersTable, db, REMINDER_KINDS, REMINDER_RECURRENCES, type ComplianceReminder } from "@workspace/db";
import { riconcilia } from "./scadenzario.js";
import { ErroreFiscale, profiloOCrea } from "./service.js";
import { oggiItalia } from "../primanota/mese.js";

// ── POCKET-4 (riga 61, QuoteAI 127.4 Compliance): il calendario delle scadenze ─
// Una sola lista di ciò che scade, per il telefono: le scadenze fiscali dello scadenzario (F24 dell'imposta e dei contributi,
// bollo, dichiarazione — ricalcolate, mai conservate) e i promemoria che l'impresa scrive da sé (DURC, assicurazione,
// formazione…). Niente si versa da qui: «versata» registra ciò che l'impresa dichiara, come nello scadenzario del sito.

type DeadlineKind = "imposta" | "contributi" | "bollo" | "dichiarazione";
type DeadlineDto = {
  key: string; anno: number; chiave: string; kind: DeadlineKind; label: string; description: string; amountCents: number; authority: string;
  dueDate: string; filedAt: string | null; daysLeft: number; state: "filed" | "overdue" | "due_soon" | "upcoming"; hasF24: boolean;
  lines: { label: string; cents: number }[]; versatoCents: number; notReviewed: boolean;
};

const AUTHORITY: Record<DeadlineKind, string> = { imposta: "Agenzia delle Entrate", contributi: "INPS", bollo: "Agenzia delle Entrate", dichiarazione: "Agenzia delle Entrate" };
/** Quanto avanti guardiamo nel calendario e quanto indietro per le versate. */
const AVANTI = 400;
const INDIETRO = 400;

export async function calendario(userId: string) {
  const oggi = oggiItalia();
  const anno = Number(oggi.slice(0, 4));
  const [scorso, corrente] = await Promise.all([riconcilia(userId, anno - 1), riconcilia(userId, anno)]);
  const deadlines: DeadlineDto[] = [];
  const filed: DeadlineDto[] = [];
  let onTime = 0;
  let count = 0;
  for (const s of [scorso, corrente]) {
    for (const v of s.voci) {
      if (v.stato === "non_dovuta") continue;
      const kind = v.scadenza.categoria as DeadlineKind;
      const giorni = v.giorniAllaScadenza;
      const dto: DeadlineDto = {
        key: `${s.anno}:${v.scadenza.id}`, anno: s.anno, chiave: v.scadenza.id, kind, label: v.scadenza.etichetta, description: v.scadenza.descrizione, amountCents: v.scadenza.importoCents,
        authority: AUTHORITY[kind], dueDate: v.scadenza.data, filedAt: v.versataAt, daysLeft: giorni,
        state: v.stato === "versata" ? "filed" : giorni < 0 ? "overdue" : giorni <= 30 ? "due_soon" : "upcoming",
        hasF24: v.scadenza.righe.length > 0 && v.scadenza.importoCents > 0,
        lines: v.scadenza.righe.map((r) => ({ label: r.descrizione, cents: r.importoCents })), versatoCents: v.versatoCents, notReviewed: v.regoleNonRevisionate.length > 0,
      };
      if (v.stato === "versata") {
        if (giorni > -INDIETRO) filed.push(dto);
        if (v.versataAt && v.versataAt.slice(0, 4) === String(anno)) {
          count++;
          if (v.versataAt.slice(0, 10) <= v.scadenza.data) onTime++;
        }
      } else if (giorni <= AVANTI) {
        deadlines.push(dto);
      }
    }
  }
  deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
  filed.sort((a, b) => (b.filedAt ?? b.dueDate).localeCompare(a.filedAt ?? a.dueDate));
  const profilo = await profiloOCrea(userId);
  const reminders = await db.select().from(complianceRemindersTable).where(and(eq(complianceRemindersTable.userId, userId), isNull(complianceRemindersTable.doneAt)));
  return {
    enabled: true as const,
    today: oggi,
    deadlines,
    filed,
    filedThisYear: { count, onTime },
    reminders: reminders.map(serializzaPromemoria).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    presets: PRESET,
    profile: { regime: profilo.regime, gestione: profilo.gestione, riduzione: profilo.riduzione, completo: profilo.onboarding != null && Object.keys(profilo.onboarding).length > 0 },
  };
}

// ── Promemoria ──────────────────────────────────────────────────────────────

const giorniFra = (da: string, a: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000);

function serializzaPromemoria(r: ComplianceReminder) {
  const daysLeft = giorniFra(oggiItalia(), r.dueDate);
  return {
    id: r.id, kind: r.kind, preset: r.preset, title: r.title, authority: r.authority, dueDate: r.dueDate, recurrence: r.recurrence, remindDaysBefore: r.remindDaysBefore,
    notes: r.notes, lastDoneAt: r.lastDoneAt?.toISOString() ?? null, daysLeft, state: daysLeft < 0 ? ("overdue" as const) : daysLeft <= r.remindDaysBefore ? ("due_soon" as const) : ("upcoming" as const),
  };
}

/** Suggerimenti, non obblighi: quali servano a un'impresa lo sa lei (e il suo consulente). Nessuna data precompilata. */
const PRESET = [
  { id: "durc", kind: "licence", title: "DURC (regolarità contributiva)", authority: "INPS · INAIL · Cassa Edile", recurrence: "none" },
  { id: "assicurazione_rc", kind: "insurance", title: "Assicurazione RC", authority: "", recurrence: "annual" },
  { id: "assicurazione_cantiere", kind: "insurance", title: "Polizza CAR (cantiere)", authority: "", recurrence: "none" },
  { id: "sorveglianza_sanitaria", kind: "safety", title: "Visita di sorveglianza sanitaria", authority: "Medico competente", recurrence: "annual" },
  { id: "formazione_sicurezza", kind: "safety", title: "Formazione sulla sicurezza", authority: "", recurrence: "none" },
  { id: "soa", kind: "licence", title: "Attestazione SOA", authority: "Organismo di attestazione", recurrence: "none" },
  { id: "revisione_mezzi", kind: "other", title: "Revisione dei mezzi", authority: "Motorizzazione", recurrence: "none" },
] as const;

export function spostaDi(due: string, recurrence: ComplianceReminder["recurrence"]): string {
  const [y, m, d] = due.split("-").map(Number) as [number, number, number];
  const mesi = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12;
  const t = new Date(Date.UTC(y, m - 1 + mesi, 1));
  const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.toISOString().slice(0, 8)}${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

export async function aggiungiPromemoria(userId: string, p: { kind: (typeof REMINDER_KINDS)[number]; preset?: string | null; title: string; authority?: string; dueDate: string; recurrence: (typeof REMINDER_RECURRENCES)[number] }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dueDate)) throw new ErroreFiscale("data_non_valida", "Data non valida.");
  const [r] = await db.insert(complianceRemindersTable).values({ userId, kind: p.kind, preset: p.preset ?? null, title: p.title.trim().slice(0, 160), authority: (p.authority ?? "").trim().slice(0, 160), dueDate: p.dueDate, recurrence: p.recurrence }).returning();
  return serializzaPromemoria(r!);
}

/** Fatto: se si ripete passa alla prossima data, altrimenti esce dall'elenco. */
export async function promemoriaFatto(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroreFiscale("not_found", "Promemoria non trovato.");
  const [r] = await db.select().from(complianceRemindersTable).where(and(eq(complianceRemindersTable.id, id), eq(complianceRemindersTable.userId, userId)));
  if (!r) throw new ErroreFiscale("not_found", "Promemoria non trovato.");
  const now = new Date();
  if (r.recurrence === "none") {
    await db.update(complianceRemindersTable).set({ doneAt: now, lastDoneAt: now }).where(eq(complianceRemindersTable.id, id));
    return null;
  }
  const [n] = await db.update(complianceRemindersTable).set({ dueDate: spostaDi(r.dueDate, r.recurrence), lastDoneAt: now }).where(eq(complianceRemindersTable.id, id)).returning();
  return serializzaPromemoria(n!);
}
