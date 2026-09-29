import type { ScheduleBlock } from "@workspace/db";
import { MARKET } from "@workspace/config";

// ── AGENDA-1 (riga 51): agenda dei lavori ────────────────────────────────────
// Portato da QuoteAI fase 75. Funzioni pure usate dalle rotte, dalla pagina
// dell'operaio e dal giro dei promemoria: niente database, quindi testabili.
// Un solo fuso (Europe/Rome): dove QuoteAI passava la provincia qui non serve.

export type BlockLike = Pick<ScheduleBlock, "id" | "collaboratorId" | "startsAt" | "endsAt">;

/** Due blocchi si sovrappongono se sono dello stesso operaio e gli intervalli si toccano dentro (i bordi che combaciano no). */
function blocksOverlap(a: Pick<BlockLike, "startsAt" | "endsAt">, b: Pick<BlockLike, "startsAt" | "endsAt">): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Doppie prenotazioni: id → id degli altri blocchi dello stesso operaio che
 * si sovrappongono. I blocchi senza operaio non sono mai in conflitto (la
 * riga "Da assegnare" è una lista di cose da fare, non una persona). O(n²)
 * per operaio: una finestra è una settimana o un giorno, non migliaia di righe.
 */
export function findConflicts(blocks: BlockLike[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const byWorker = new Map<string, BlockLike[]>();
  for (const b of blocks) {
    if (!b.collaboratorId) continue;
    const list = byWorker.get(b.collaboratorId) ?? [];
    list.push(b);
    byWorker.set(b.collaboratorId, list);
  }
  for (const list of byWorker.values()) {
    for (const a of list) {
      const hits = list.filter((b) => b.id !== a.id && blocksOverlap(a, b)).map((b) => b.id);
      if (hits.length) out.set(a.id, hits);
    }
  }
  return out;
}

const DAY_MS = 86_400_000;

/** "AAAA-MM-GG" di un istante in Italia, più l'ora locale: i due dati che servono alla regola dei promemoria. */
export function localParts(instant: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: MARKET.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** "HH:mm" locale di un istante. */
function localTime(instant: Date): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: MARKET.timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

export type ReminderKind = "tomorrow" | "today";

/**
 * Se un blocco merita un promemoria adesso, e quale:
 * - "tomorrow": comincia il giorno dopo e sono le 15:00 o più tardi (il
 *   cron della sera gira alle 16:00 UTC = 17:00 d'inverno, 18:00 d'estate);
 * - "today": comincia più tardi oggi (aggiunto ieri sera, o il cron di
 *   mezzogiorno che recupera) — meglio un avviso che niente.
 * Più avanti, già cominciato, o prima delle 15:00 del giorno prima → null.
 */
export function reminderDue(block: Pick<ScheduleBlock, "startsAt" | "reminderSentAt">, now: Date): ReminderKind | null {
  if (block.reminderSentAt) return null;
  if (block.startsAt <= now) return null;
  if (block.startsAt.getTime() - now.getTime() > 2 * DAY_MS) return null;
  const start = localParts(block.startsAt);
  const cur = localParts(now);
  if (start.day === cur.day) return "today";
  const nextDay = localParts(new Date(now.getTime() + DAY_MS)).day;
  if (start.day === nextDay && cur.hour >= 15) return "tomorrow";
  return null;
}

/** L'etichetta di un blocco: il suo titolo, altrimenti il nome del cantiere, altrimenti una parola generica. */
export function blockLabel(block: Pick<ScheduleBlock, "title">, jobName: string | null | undefined): string {
  return block.title || jobName || "Turno";
}

/** Il testo del promemoria: "Domani 7:30-16:30: Bagno Rossi, Via Roma 12. Portare il flessibile." */
export function reminderBody(params: { kind: ReminderKind; block: Pick<ScheduleBlock, "title" | "startsAt" | "endsAt" | "allDay" | "notes">; jobName: string | null; address: string | null }): string {
  const { kind, block } = params;
  const when = block.allDay ? "tutto il giorno" : `${localTime(block.startsAt)}-${localTime(block.endsAt)}`;
  const lead = kind === "tomorrow" ? "Domani" : "Oggi";
  const what = blockLabel(block, params.jobName);
  const where = params.address ? `, ${params.address}` : "";
  const notes = block.notes ? ` ${block.notes.trim()}` : "";
  return `${lead} ${when}: ${what}${where}.${notes}`;
}
