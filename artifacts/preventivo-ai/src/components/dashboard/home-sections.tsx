// APP-7 (docs/PIANO-AZIONE.md riga 31, da QuoteAI Phase 132) — the home
// sections that only some roles have: the jobs going on and the week's hours
// (capocantiere), the invoices to collect (ufficio, contabile) and the next tax
// deadline (contabile, titolare). Each reads a list the rest of the app already
// serves, with that route's own permission check; a section whose read fails
// (no plan feature, no add-on) quietly stays out of the way.
import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ListRow } from "@/components/mobile/list-row";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents, jobsApi } from "@/lib/jobs-api";
import { invoicesApi, type InvoiceStatus } from "@/lib/invoices-api";
import { teamApi } from "@/lib/team-api";
import { fiscaleApi } from "@/lib/fiscale-api";

const fill = (s: string, vars: Record<string, string | number>) => Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
const PRIMI = 5;

function SectionCard({ id, title, href, linkLabel, children }: { id: string; title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="card" aria-labelledby={`${id}-h`} data-testid={`home-${id}`}>
      <div className="today-head">
        <h2 id={`${id}-h`}>{title}</h2>
        {href && linkLabel && (
          <Link href={href} className="cta-link today-link">
            {linkLabel} <ArrowRight className="chev" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Loading() {
  return <div className="px-4 pb-4 space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="today-empty"><CheckCircle2 aria-hidden="true" /> {text}</p>;
}

/* ─── Cantieri in corso ───────────────────────────────────────────────────── */

export function JobsSection() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, staleTime: 60_000 });
  const jobs = useMemo(
    () =>
      (data?.items ?? [])
        .filter((j) => !j.archivedAt && (j.status === "active" || j.status === "planning"))
        .sort((a, b) => (a.status === b.status ? (a.plannedEnd ?? "9").localeCompare(b.plannedEnd ?? "9") : a.status === "active" ? -1 : 1)),
    [data],
  );
  if (isError) return null;
  return (
    <SectionCard id="jobs" title={t("home.jobs.title")} href="/dashboard/jobs" linkLabel={t("home.viewAll")}>
      {isLoading ? <Loading /> : jobs.length === 0 ? <Empty text={t("home.jobs.empty")} /> : (
        <ul className="lrows">
          {jobs.slice(0, PRIMI).map((j) => (
            <li key={j.id}>
              <ListRow
                href={`/dashboard/jobs/${j.id}`}
                title={j.name}
                meta={[j.clientName, j.address]}
                end={<span className={j.status === "active" ? "chip chip-teal" : "chip chip-grey"}>{j.status === "active" ? fill(t("home.jobs.progress"), { pct: j.progressPercent }) : t("jobs.status.planning")}</span>}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─── Ore della settimana ─────────────────────────────────────────────────── */

export function HoursSection() {
  const { t } = useLanguage();
  const from = useMemo(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"), []);
  const { data, isLoading, isError } = useQuery({ queryKey: ["team", "time-entries", "week", from], queryFn: () => teamApi.timeEntries({ from }), staleTime: 60_000 });
  const people = useMemo(() => {
    const by = new Map<string, { name: string; hours: number; toApprove: number; last: string | null }>();
    for (const e of data?.items ?? []) {
      if (e.status === "rejected") continue;
      const p = by.get(e.workerId) ?? { name: e.workerName ?? "—", hours: 0, toApprove: 0, last: null };
      p.hours += e.hours;
      if (e.status === "submitted") p.toApprove += 1;
      if (e.projectName && (!p.last || (e.date ?? "") > p.last)) p.last = e.projectName;
      by.set(e.workerId, p);
    }
    return [...by.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [data]);
  if (isError) return null;
  const total = people.reduce((s, [, p]) => s + p.hours, 0);
  const hours = (h: number) => fill(t("home.hours.h"), { h: Math.round(h * 10) / 10 });
  return (
    <SectionCard id="hours" title={t("home.hours.title")} href="/dashboard/team?tab=time" linkLabel={t("home.hours.open")}>
      {isLoading ? <Loading /> : people.length === 0 ? <Empty text={t("home.hours.empty")} /> : (
        <>
          <p className="home-sub">{fill(t("home.hours.total"), { hours: hours(total), people: fill(t(people.length === 1 ? "today.ny.peopleOne" : "today.ny.peopleMany"), { n: people.length }) })}</p>
          <ul className="lrows">
            {people.slice(0, PRIMI).map(([id, p]) => (
              <li key={id}>
                <ListRow
                  href="/dashboard/team?tab=time"
                  title={p.name}
                  meta={[p.last, p.toApprove > 0 ? fill(t("home.hours.toApprove"), { n: p.toApprove }) : null]}
                  amount={hours(p.hours)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

/* ─── Da incassare ────────────────────────────────────────────────────────── */

const OPEN: InvoiceStatus[] = ["sent", "viewed", "partially_paid", "overdue", "pending_confirmation"];

export function InvoicesSection() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, staleTime: 60_000 });
  const open = useMemo(() => (data?.items ?? []).filter((i) => OPEN.includes(i.status) && !i.creditNoteForId).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [data]);
  if (isError) return null;
  const today = new Date().toISOString().slice(0, 10);
  const drafts = data?.stats.drafts ?? 0;
  return (
    <SectionCard id="invoices" title={t("home.invoices.title")} href="/dashboard/invoices" linkLabel={t("home.viewAll")}>
      {isLoading ? <Loading /> : (
        <>
          {data && (
            <p className="home-sub">
              {fill(t("home.invoices.summary"), { amount: formatCents(data.stats.outstandingCents) })}
              {data.stats.overdueCents > 0 && <> · <span className="home-bad">{fill(t("home.invoices.overdue"), { amount: formatCents(data.stats.overdueCents) })}</span></>}
              {drafts > 0 && <> · <Link href="/dashboard/invoices" className="home-inline-link">{fill(t(drafts === 1 ? "home.invoices.draftsOne" : "home.invoices.draftsMany"), { n: drafts })}</Link></>}
            </p>
          )}
          {open.length === 0 ? <Empty text={t("home.invoices.empty")} /> : (
            <ul className="lrows">
              {open.slice(0, PRIMI).map((i) => {
                const late = i.dueDate.slice(0, 10) < today;
                return (
                  <li key={i.id}>
                    <ListRow
                      href={`/dashboard/invoices/${i.id}`}
                      title={i.clientName || i.customer?.name || i.number}
                      meta={[i.clientName || i.customer?.name ? i.number : null, fill(t("home.invoices.due"), { date: format(new Date(i.dueDate), "d MMM", { locale: it }) })]}
                      amount={formatCents(i.balanceCents)}
                      end={<span className={late ? "chip chip-red" : "chip chip-grey"}>{t(`invoices.status.${late && i.status !== "pending_confirmation" ? "overdue" : i.status}`)}</span>}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </SectionCard>
  );
}

/* ─── Scadenze fiscali ────────────────────────────────────────────────────── */

export function FiscoSection() {
  const { t } = useLanguage();
  const anno = new Date().getFullYear();
  // Only with the Fisco add-on: without it the route answers 403 and the section stays away.
  const { data, isLoading, isError } = useQuery({ queryKey: ["fiscale", "scadenzario", anno], queryFn: () => fiscaleApi.scadenzario(anno), staleTime: 10 * 60_000, retry: false });
  if (isError) return null;
  const next = data?.prossima;
  const open = (data?.voci ?? []).filter((v) => !v.versataAt).slice(0, 3);
  return (
    <SectionCard id="fisco" title={t("home.fisco.title")} href="/dashboard/scadenzario" linkLabel={t("home.fisco.open")}>
      {isLoading ? <Loading /> : !next ? <Empty text={t("home.fisco.empty")} /> : (
        <>
          <p className="home-sub">
            {fill(t("home.fisco.total"), { amount: formatCents(data!.totaleApertoCents) })}
            {data!.scaduteCents > 0 && <> · <span className="home-bad">{fill(t("home.fisco.late"), { amount: formatCents(data!.scaduteCents) })}</span></>}
          </p>
          <ul className="lrows">
            {open.map((v) => (
              <li key={v.scadenza.id}>
                <ListRow
                  href="/dashboard/scadenzario"
                  title={v.scadenza.etichetta}
                  meta={[format(new Date(v.scadenza.data), "d MMMM", { locale: it }), v.scaduta ? t("home.fisco.isLate") : v.giorniAllaScadenza === 0 ? t("today.today") : fill(t(v.giorniAllaScadenza === 1 ? "home.fisco.inOne" : "home.fisco.inMany"), { n: v.giorniAllaScadenza })]}
                  amount={formatCents(v.scadenza.importoCents)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
