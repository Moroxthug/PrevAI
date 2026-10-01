import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, CalendarDays, Camera, ChevronRight, Clock, Loader2, MapPin, MessageSquareText, Phone, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { workerApi, type WorkerPageDto } from "@/lib/team-api";
import { Logo } from "@/components/logo";
import { ActionSheet } from "@/components/mobile/action-sheet";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { WorkerToday, mapsUrl } from "@/components/crew/worker-today";
import { WorkerChanges } from "@/components/crew/worker-changes";
import { FieldReportForm } from "@/components/crew/field-report";
import { ManualHoursForm, WorkerHoursList, isoDay } from "@/components/crew/worker-hours";

/** Resolves to {lat, lng} or null — never rejects, since a clock-in must work even without location. */
function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

function elapsedLabel(sinceIso: string, now: number) {
  const ms = Math.max(0, now - new Date(sinceIso).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

type Block = { id: string; startsAt: string; endsAt: string; allDay: boolean; notes: string };

/** Today's shift that is on now, else the next one today, else the first — with its job. */
function currentShift(data: WorkerPageDto, now: number) {
  const all = data.todayJobs.flatMap((job) => job.blocks.map((b) => ({ job, b })));
  return (
    all.find(({ b }) => !b.allDay && new Date(b.startsAt).getTime() <= now && new Date(b.endsAt).getTime() > now) ??
    all.find(({ b }) => new Date(b.endsAt).getTime() > now) ??
    all[0] ??
    null
  );
}

type Sheet = null | "job" | "report" | "hours";

/**
 * Public worker page. No login: the magic-link token identifies the worker.
 * Built for a phone on site.
 *
 * SQUADRA-1 (docs/PIANO-AZIONE.md riga 52, da QuoteAI fasi 86, 86b, 108):
 * the crew's app on one screen. **Adesso** comes first — the shift that is on
 * (or next), its address one tap to Maps, the person on site to call and the
 * shift's notes (the gate code), and Timbra entrata / uscita as the big
 * button. Then today's tasks as a checklist (a crew lead can add one), what
 * is coming up, and the week's hours. Segnala and Foto are docked at the
 * bottom and open a sheet (a photo, a note, "Bloccato", materials used); hours
 * by hand are behind ⋯. "Da quando hai guardato" is a count chip in the header.
 */
export default function WorkerTimePage() {
  const { token } = useParams<{ token: string }>();
  const { t, setLang } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["worker", token], queryFn: () => workerApi.get(token!), enabled: !!token, retry: false });
  useEffect(() => { if (data?.language) setLang("it"); }, [data?.language, setLang]);

  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationOff, setLocationOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  useDocumentTitle(`${t("worker.clockInOut")} · ${data?.companyName ?? "PrevAI"}`);

  // The timer and "which shift is on" move with the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const shift = data ? currentShift(data, now) : null;
  // What the Now card is about before anyone picks: today's shift, else the only job.
  const suggested = shift?.job.id ?? (data?.jobs.length === 1 ? data.jobs[0]!.id : "");
  useEffect(() => { if (!projectId && suggested) setProjectId(suggested); }, [projectId, suggested]);

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      setLocationOff(!loc);
      return workerApi.clockIn(token!, { projectId, milestoneId: milestoneId || null, lat: loc?.lat, lng: loc?.lng });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });
  const clockOut = useMutation({
    mutationFn: async (entryId: string) => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      return workerApi.clockOut(token!, entryId, { lat: loc?.lat, lng: loc?.lng });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });

  if (isLoading) return <div className="doc-shell flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>;
  if (error || !data) {
    const code = (error as Error & { code?: string })?.code;
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-bold" style={{ color: "var(--navy)" }}>{code === "EXPIRED" ? t("worker.expiredTitle") : t("worker.invalidTitle")}</h1>
          <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{code === "EXPIRED" ? t("worker.expiredBody") : t("worker.invalidBody")}</p>
        </div>
      </div>
    );
  }

  const running = !!data.activeEntry;
  // The job the Now card is about: the running clock's, else the one picked (or suggested).
  const nowJobId = data.activeEntry?.projectId ?? projectId;
  const nowJob = data.jobs.find((j) => j.id === nowJobId) ?? null;
  const nowToday = data.todayJobs.find((j) => j.id === nowJobId) ?? null;
  const nowBlock: Block | null = shift && shift.job.id === nowJobId ? shift.b : (nowToday?.blocks[0] ?? null);
  const address = nowToday?.address || nowJob?.address || null;
  const hm = (iso: string) => format(new Date(iso), "H:mm", { locale: it });
  const blockTime = (b: Block) => (b.allDay ? t("worker.allDay") : `${hm(b.startsAt)}–${hm(b.endsAt)}`);
  const phaseTitle = nowJob?.milestones.find((m) => m.id === milestoneId)?.title ?? "";
  const defaultJobId = data.activeEntry?.projectId ?? (nowJobId || null);
  // Today's shifts on the Now job are in the Now card; the list below is what comes after.
  const nowBlockIds = new Set((nowToday?.blocks ?? []).map((b) => b.id));
  const comingUp = data.schedule.filter((b) => !nowBlockIds.has(b.id) && new Date(b.endsAt).getTime() > now);

  const eyebrow = running ? t("worker.m.onTheClock") : nowBlock ? `${t("worker.today")} · ${blockTime(nowBlock)}` : t("worker.m.now");

  return (
    <div className="doc-shell">
      <header className="doc-head">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold truncate text-base" style={{ color: "var(--navy)" }}>{data.worker.name}</h1>
            <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{data.companyName}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <WorkerChanges token={token!} changes={data.changes} upTo={data.changesUpTo} />
            <Logo className="h-5 hide-phone" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ── Adesso ──────────────────────────────────────────────────── */}
        <section className={cn("card w-now", running && "on")} aria-labelledby="w-now-h">
          <p className="w-now-eyebrow">{running && <span className="w-live" aria-hidden="true" />}{eyebrow}</p>
          {data.jobs.length === 0 && !running ? (
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("worker.noJobs")}</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 id="w-now-h" className="w-now-title">
                  {data.activeEntry ? data.activeEntry.projectName : nowJob?.name ?? t("crew.pickJob")}
                  {(() => {
                    const ph = data.activeEntry ? data.activeEntry.milestoneTitle : phaseTitle;
                    return ph ? <span className="w-now-phase">{ph}</span> : null;
                  })()}
                </h2>
                {!running && data.jobs.length > 1 && (
                  <button type="button" className="text-link shrink-0 mt-1" onClick={() => setSheet("job")}>{t("worker.m.changeJob")}</button>
                )}
              </div>

              {running && (
                <div className="w-timer">
                  <span className="w-timer-n">{elapsedLabel(data.activeEntry!.clockInAt!, now)}</span>
                  <span className="w-timer-s">{t("worker.clockedInSince")} {format(new Date(data.activeEntry!.clockInAt!), "HH:mm")}</span>
                </div>
              )}

              {(address || nowToday?.contact || (nowToday?.blocks ?? []).some((b) => b.notes)) && (
                <ul className="w-now-rows">
                  {address && (
                    <li>
                      <a className="w-now-row" href={mapsUrl(address)} target="_blank" rel="noopener noreferrer">
                        <MapPin aria-hidden="true" /> <span className="grow">{address}</span> <span className="w-now-go">{t("worker.m.maps")}<ChevronRight aria-hidden="true" /></span>
                      </a>
                    </li>
                  )}
                  {nowToday?.contact?.phone && (
                    <li>
                      <a className="w-now-row" href={`tel:${nowToday.contact.phone.replace(/[^\d+]/g, "")}`}>
                        <Phone aria-hidden="true" /> <span className="grow">{t("crew.call")} {nowToday.contact.name}</span> <ChevronRight className="w-now-chev" aria-hidden="true" />
                      </a>
                    </li>
                  )}
                  {nowToday?.contact && !nowToday.contact.phone && (
                    <li className="w-now-row"><Phone aria-hidden="true" /> <span className="grow">{t("crew.siteContact")}: {nowToday.contact.name}</span></li>
                  )}
                  {(nowToday?.blocks ?? []).filter((b) => b.notes).map((b) => (
                    <li key={b.id} className="w-now-note">{b.notes}</li>
                  ))}
                </ul>
              )}

              {!running && nowJob && nowJob.milestones.length > 0 && (
                <div className="field">
                  <label htmlFor="worker-phase">{t("worker.phase")}</label>
                  <select id="worker-phase" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                    <option value="">{t("worker.anyPhase")}</option>
                    {nowJob.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}

              {running ? (
                <>
                  {clockOut.error && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{(clockOut.error as Error).message}</p>}
                  <button type="button" className="btn btn-navy w-full w-big" disabled={clockOut.isPending} onClick={() => clockOut.mutate(data.activeEntry!.id)}>
                    {clockOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-4 w-4 fill-current" />} {locating && clockOut.isPending ? t("worker.locating") : t("worker.clockOut")}
                  </button>
                </>
              ) : (
                <>
                  {clockIn.error && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{(clockIn.error as Error).message}</p>}
                  {locationOff && <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--yellow-dark)" }}><MapPin className="h-3 w-3" /> {t("worker.locationOff")}</p>}
                  <button type="button" className="btn btn-navy w-full w-big" disabled={!projectId || clockIn.isPending} onClick={() => clockIn.mutate()}>
                    {clockIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />} {locating && clockIn.isPending ? t("worker.locating") : t("worker.clockIn")}
                  </button>
                </>
              )}
            </>
          )}
        </section>

        <WorkerToday token={token!} jobs={data.todayJobs} canAddTasks={data.worker.canAddTasks} nowJobId={nowJobId || null} />

        {comingUp.length > 0 && (
          <section className="card p-4 space-y-1" aria-labelledby="w-next-h">
            <h2 id="w-next-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}><CalendarDays className="h-4 w-4" /> {t("worker.m.comingUp")}</h2>
            <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
              {comingUp.slice(0, 5).map((b) => {
                const s = new Date(b.startsAt);
                return (
                  <li key={b.id} className="py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold" style={{ color: isoDay(s) === data.today ? "var(--teal-dark)" : "var(--ink)" }}>{isoDay(s) === data.today ? t("worker.today") : format(s, "EEE d MMM", { locale: it })}</span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--muted-mk)" }}>{blockTime(b)}</span>
                    </div>
                    <div className="truncate" style={{ color: "var(--navy)" }}>{b.label}{b.milestoneTitle ? ` · ${b.milestoneTitle}` : ""}</div>
                    {b.address && <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{b.address}</div>}
                    {b.notes && <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{b.notes}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <WorkerHoursList token={token!} entries={data.entries} />

        <StickyActionBar label={t("worker.m.actions")}>
          <ActionSheet actions={[{ label: t("worker.m.hoursByHand"), icon: Clock, onSelect: () => setSheet("hours") }]} />
          {data.jobs.length > 0 && (
            <>
              <button type="button" className="btn btn-outline-navy secondary" onClick={() => photoInput.current?.click()}>
                <Camera className="h-4 w-4" /> {t("worker.m.photo")}
              </button>
              <button type="button" className="btn btn-navy" data-primary-action onClick={() => { setPhoto(null); setSheet("report"); }}>
                <MessageSquareText className="h-4 w-4" /> {t("worker.m.report")}
              </button>
            </>
          )}
        </StickyActionBar>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setPhoto(f);
            setSheet("report");
          }}
        />
      </main>

      <BottomSheet open={sheet === "job"} onOpenChange={(o) => !o && setSheet(null)} title={t("worker.m.pickJob")} flush>
        <ul className="lrows" role="radiogroup" aria-label={t("worker.job")}>
          {data.jobs.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                role="radio"
                aria-checked={projectId === j.id}
                className={cn("lrow", projectId === j.id && "on")}
                onClick={() => { setProjectId(j.id); setMilestoneId(""); setSheet(null); }}
              >
                <span className="lrow-main">
                  <span className="lrow-title">{j.name}</span>
                  {j.address && <span className="lrow-meta">{j.address}</span>}
                </span>
                {data.todayJobs.some((x) => x.id === j.id) && <span className="chip chip-teal">{t("worker.today")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={sheet === "report"} onOpenChange={(o) => { if (!o) { setSheet(null); setPhoto(null); } }} title={t("crew.reportTitle")}>
        <FieldReportForm token={token!} jobs={data.jobs} defaultJobId={defaultJobId} reports={data.reports} initialPhoto={photo} onSent={() => { setSheet(null); setPhoto(null); }} />
      </BottomSheet>

      <BottomSheet open={sheet === "hours"} onOpenChange={(o) => !o && setSheet(null)} title={t("worker.m.hoursByHand")}>
        <ManualHoursForm token={token!} jobs={data.jobs} defaultJobId={defaultJobId} onSaved={() => setSheet(null)} />
      </BottomSheet>
    </div>
  );
}
