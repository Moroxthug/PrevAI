import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { Bell, CalendarMinus, CalendarPlus, CalendarClock, Check, ListPlus, ListChecks, MessageSquareReply, PencilLine } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { workerApi, type CrewChangeDto } from "@/lib/team-api";

const ICON = {
  shift_added: CalendarPlus,
  shift_changed: CalendarClock,
  shift_removed: CalendarMinus,
  task_added: ListPlus,
  task_changed: PencilLine,
  task_done: ListChecks,
  answer: MessageSquareReply,
} as const;

/**
 * SQUADRA-1 (riga 52, da QuoteAI fasi 86b e 108) — "Da quando hai guardato"
 * on /t/:token: shifts the office added, moved or took away, tasks added or
 * changed on their jobs, and answers to their blockers. A count chip in the
 * header ("3 novità") opens the list in a sheet; it stays until the worker
 * taps "Ho visto", so a reload on a patchy connection does not lose it.
 */
export function WorkerChanges({ token, changes, upTo }: { token: string; changes: CrewChangeDto[]; upTo: string }) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  if (dismissed || changes.length === 0) return null;

  const when = (c: Extract<CrewChangeDto, { startsAt: string }>) => {
    const s = new Date(c.startsAt);
    const day = format(s, "EEE d MMM", { locale: it });
    return c.allDay ? `${day} · ${t("worker.allDay")}` : `${day} · ${format(s, "H:mm")}–${format(new Date(c.endsAt), "H:mm")}`;
  };

  const line = (c: CrewChangeDto): { head: string; detail: string | null } => {
    switch (c.kind) {
      case "shift_added":
        return { head: t("crew.change.shiftAdded"), detail: `${c.label} — ${when(c)}` };
      case "shift_changed":
        return { head: t("crew.change.shiftChanged"), detail: `${c.label} — ${when(c)}` };
      case "shift_removed":
        return { head: t("crew.change.shiftRemoved"), detail: when(c) };
      case "task_added":
        return { head: `${t("crew.change.taskAdded")} · ${c.projectName}`, detail: c.by ? `${c.title} (${c.by})` : c.title };
      case "task_changed":
        return { head: `${t("crew.change.taskChanged")} · ${c.projectName}`, detail: c.title };
      case "task_done":
        return { head: `${t("crew.change.taskDone")} · ${c.projectName}`, detail: c.by ? `${c.title} (${c.by})` : c.title };
      case "answer":
        return { head: `${t("crew.change.answer")}${c.projectName ? ` · ${c.projectName}` : ""}`, detail: c.answer ? `${c.answer}${c.by ? ` — ${c.by}` : ""}` : c.body };
    }
  };

  const gotIt = () => {
    setOpen(false);
    setDismissed(true);
    // Best effort: without signal the list simply comes back on the next load and can be dismissed then.
    workerApi.markSeen(token, upTo).catch(() => {});
  };

  return (
    <>
      <button type="button" className="w-chip" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Bell className="h-4 w-4" aria-hidden="true" /> {t("worker.m.newCount").replace("{n}", String(changes.length))}
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={t("crew.changesTitle")}
        footer={<button type="button" className="btn btn-navy" onClick={gotIt}><Check className="h-4 w-4" /> {t("crew.changesGotIt")}</button>}
      >
        <ul className="space-y-3">
          {changes.map((c) => {
            const Icon = ICON[c.kind];
            const { head, detail } = line(c);
            return (
              <li key={`${c.kind}-${"blockId" in c ? c.blockId : "taskId" in c ? c.taskId : c.reportId}`} className="flex items-start gap-2.5 text-sm">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: c.kind === "shift_removed" ? "var(--red)" : "var(--teal-dark)" }} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-medium" style={{ color: "var(--ink)" }}>{head}</div>
                  {detail && <div className="text-xs break-words" style={{ color: "var(--muted-mk)" }}>{detail}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
