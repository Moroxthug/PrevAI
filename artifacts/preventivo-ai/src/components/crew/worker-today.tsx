import { useRef, useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MapPin, Phone, Plus, Sun } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { workerApi, type CrewTaskDto, type CrewTaskStatus, type WorkerTodayJobDto } from "@/lib/team-api";

/** A maps link that opens the phone's own maps app from an address; no key, no tracking pixel. */
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const hm = (iso: string) => format(new Date(iso), "H:mm", { locale: it });

/**
 * SQUADRA-1 (riga 52, da QuoteAI fasi 86, 86b, 108) — today's tasks on
 * /t/:token: each job the worker is booked on today, when, where (a maps
 * link), who to call on site, and the tasks under it as a checklist. A worker
 * the office allowed to can add a task there too.
 *
 * The job in the Now card (`nowJobId`) already shows its address, site
 * contact and notes there, so here it is only its checklist; a second job
 * booked today keeps its own. One job: no job heading at all.
 */
export function WorkerToday({ token, jobs, canAddTasks, nowJobId }: { token: string; jobs: WorkerTodayJobDto[]; canAddTasks: boolean; nowJobId?: string | null }) {
  const { t } = useLanguage();
  // What this phone last set, until the page reloads with the server's answer.
  const [local, setLocal] = useState<Record<string, CrewTaskStatus>>({});
  const [failed, setFailed] = useState<string | null>(null);
  // Tasks added from this phone, until the page reloads with them.
  const [added, setAdded] = useState<Record<string, CrewTaskDto[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<Record<string, string>>({});
  // One id per typed task: a double tap, or a retry after a lost answer, adds it once.
  const refs = useRef<Record<string, string>>({});

  const addTask = async (jobId: string) => {
    const title = (drafts[jobId] ?? "").trim();
    if (!title || adding) return;
    setAddError((m) => ({ ...m, [jobId]: "" }));
    setAdding(jobId);
    const clientRef = (refs.current[jobId] ??= crypto.randomUUID());
    try {
      const out = await workerApi.addTask(token, jobId, { title, clientRef });
      delete refs.current[jobId];
      setAdded((m) => ({ ...m, [jobId]: [...(m[jobId] ?? []).filter((x) => x.id !== out.task.id), out.task] }));
      setDrafts((m) => ({ ...m, [jobId]: "" }));
    } catch (err) {
      setAddError((m) => ({ ...m, [jobId]: (err as Error).message }));
    } finally {
      setAdding(null);
    }
  };

  const toggle = async (taskId: string, done: boolean) => {
    const status: CrewTaskStatus = done ? "done" : "todo";
    setFailed(null);
    setLocal((m) => ({ ...m, [taskId]: status }));
    try {
      await workerApi.setTask(token, taskId, status);
    } catch {
      setFailed(taskId);
      setLocal((m) => {
        const next = { ...m };
        delete next[taskId];
        return next;
      });
    }
  };

  // The Now job with nothing to tick and nothing to add has nothing left to say here.
  const shown = jobs.filter((j) => j.id !== nowJobId || canAddTasks || j.tasks.length > 0 || (added[j.id] ?? []).length > 0);
  if (shown.length === 0) return null;
  const single = shown.length === 1;
  return (
    <section className="card p-4 space-y-3" aria-labelledby="worker-today-h">
      <h2 id="worker-today-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}>
        <Sun className="h-4 w-4" /> {single && shown[0]!.id === nowJobId ? t("worker.m.tasksTitle") : t("crew.todayTitle")}
      </h2>
      {shown.map((j) => {
        const isNow = j.id === nowJobId;
        const mine = (added[j.id] ?? []).filter((a) => !j.tasks.some((x) => x.id === a.id));
        const tasks = [...j.tasks, ...mine];
        const open = tasks.filter((x) => (local[x.id] ?? x.status) !== "done").length;
        return (
          <article key={j.id} className={single && isNow ? "space-y-2" : "rounded-xl p-3 space-y-2"} style={single && isNow ? undefined : { border: "1px solid var(--line)" }}>
            {!(single && isNow) && (
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold text-sm" style={{ color: "var(--navy)" }}>{j.name}</h3>
                <span className="text-xs tabular-nums shrink-0" style={{ color: "var(--muted-mk)" }}>
                  {j.blocks.length === 0 ? t("crew.clockedInHere") : j.blocks.map((b) => (b.allDay ? t("worker.allDay") : `${hm(b.startsAt)}–${hm(b.endsAt)}`)).join(", ")}
                </span>
              </div>
            )}
            {!isNow && (j.address || j.contact) && (
              <div className="flex flex-wrap gap-2">
                {j.address && (
                  <a className="btn btn-sm btn-outline-navy" href={mapsUrl(j.address)} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4" /> <span className="truncate max-w-[14rem]">{j.address}</span>
                  </a>
                )}
                {j.contact?.phone && (
                  <a className="btn btn-sm btn-outline-navy" href={`tel:${j.contact.phone.replace(/[^\d+]/g, "")}`}>
                    <Phone className="h-4 w-4" /> {t("crew.call")} {j.contact.name}
                  </a>
                )}
                {j.contact && !j.contact.phone && <span className="text-xs self-center" style={{ color: "var(--muted-mk)" }}>{t("crew.siteContact")}: {j.contact.name}</span>}
              </div>
            )}
            {!isNow && j.blocks.filter((b) => b.notes).map((b) => (
              <p key={b.id} className="text-xs rounded-lg px-2 py-1.5" style={{ background: "var(--soft)", color: "var(--ink)" }}>{b.notes}</p>
            ))}
            {tasks.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium mb-1" style={{ color: "var(--muted-mk)" }}>{t("crew.tasks")} · {open === 0 ? t("crew.allDone") : `${open} ${t("crew.toDo")}`}</legend>
                {tasks.map((task) => {
                  const status = local[task.id] ?? task.status;
                  const id = `task-${task.id}`;
                  return (
                    <div key={task.id} className="flex items-start gap-2.5 py-1">
                      <input id={id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={status === "done"} onChange={(e) => void toggle(task.id, e.target.checked)} />
                      <label htmlFor={id} className="text-sm leading-snug flex-1 min-w-0" style={{ color: status === "done" ? "var(--muted-mk)" : "var(--ink)", textDecoration: status === "done" ? "line-through" : undefined }}>
                        {task.title}
                        {task.milestoneTitle && <span className="block text-[11px]" style={{ color: "var(--muted-mk)" }}>{task.milestoneTitle}</span>}
                        {task.addedBy && <span className="block text-[11px]" style={{ color: "var(--muted-mk)" }}>{t("crew.addedBy").replace("{name}", task.addedBy)}</span>}
                      </label>
                    </div>
                  );
                })}
                {failed && tasks.some((x) => x.id === failed) && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{t("crew.taskFailed")}</p>}
              </fieldset>
            )}
            {canAddTasks && (
              <form
                className="flex gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addTask(j.id);
                }}
              >
                <label htmlFor={`add-task-${j.id}`} className="sr-only">{t("crew.addTaskFor").replace("{job}", j.name)}</label>
                <input id={`add-task-${j.id}`} className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2" style={{ border: "1px solid var(--line)" }} maxLength={300} value={drafts[j.id] ?? ""} onChange={(e) => { delete refs.current[j.id]; setDrafts((m) => ({ ...m, [j.id]: e.target.value })); }} placeholder={t("crew.addTaskPlaceholder")} />
                <button type="submit" className="btn btn-sm btn-outline-navy shrink-0" disabled={!(drafts[j.id] ?? "").trim() || adding === j.id}>
                  <Plus className="h-4 w-4" /> {t("crew.addTask")}
                </button>
              </form>
            )}
            {addError[j.id] && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{addError[j.id]}</p>}
          </article>
        );
      })}
    </section>
  );
}
