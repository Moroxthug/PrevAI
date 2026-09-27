import { useMemo } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListClientQuotes, getListClientQuotesQueryKey, useGetBusinessProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, Phone, MapPin, MessageSquareText, Users } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { hasFeature } from "@/lib/plans";
import { formatEurWhole } from "@/lib/money";
import { jobsApi } from "@/lib/jobs-api";
import { invoicesApi } from "@/lib/invoices-api";
import { ListRow } from "@/components/mobile/list-row";
import { ScrollTabs } from "@/components/mobile/scroll-tabs";
import { StatStrip } from "@/components/mobile/stat-strip";
import { useMobileHeader } from "@/components/mobile/mobile-page-header";
import { quoteStatusChip } from "@/components/quotes/quote-status";
import { JobStatusBadge } from "@/components/jobs/badges";
import { InvoiceListRow } from "@/components/invoices/invoice-list-row";

const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
type Tab = "quotes" | "jobs" | "invoices";
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Phase 107 — the client first: name, where they are, and one tap to call,
 * text, email or find them; four numbers as a strip; then what you have with
 * them as tabs (quotes, jobs, invoices). PrevAI has no client portal, so no
 * Messages tab.
 */
export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? "";
  const { t } = useLanguage();
  const locale = it;
  const search = useSearch();
  const [, navigate] = useLocation();
  const tabParam = new URLSearchParams(search).get("tab") as Tab | null;

  const { data: quotes, isLoading } = useListClientQuotes(
    clientId,
    { query: { queryKey: getListClientQuotesQueryKey(clientId), enabled: !!clientId } }
  );
  const { data: profile } = useGetBusinessProfile();
  const hasJobs = profile ? hasFeature(profile as never, "jobs") : false;
  const hasInvoices = profile ? hasFeature(profile as never, "invoicing") : false;
  // The page URL carries the md5 of the client's quotes grouping (name, email, phone), not a client row id:
  // jobs are the ones started from these quotes or made out to the same name; invoices are those jobs'
  // plus the manual ones made out to the same name.
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: hasJobs, retry: false });
  const invoicesQ = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: hasInvoices, retry: false });

  const quoteIds = useMemo(() => new Set((quotes ?? []).map((q) => q.id)), [quotes]);
  const nameKey = norm(quotes?.[0]?.clientData?.nome);
  const jobs = useMemo(
    () => (jobsQ.data?.items ?? []).filter((j) => (j.quoteId && quoteIds.has(j.quoteId)) || (!!nameKey && norm(j.clientName) === nameKey)),
    [jobsQ.data, nameKey, quoteIds],
  );
  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  const invoices = useMemo(
    () => (invoicesQ.data?.items ?? []).filter((i) => (i.projectId ? jobIds.has(i.projectId) : !!nameKey && norm(i.clientName ?? i.customer.name) === nameKey)),
    [invoicesQ.data, nameKey, jobIds],
  );

  const totalValue = quotes?.reduce((sum, q) => sum + q.totale, 0) ?? 0;
  const won = quotes?.filter((q) => q.status === "accepted" || q.status === "unlocked") ?? [];
  const wonValue = won.reduce((sum, q) => sum + q.totale, 0);
  const owedCents = invoices.reduce((sum, i) => sum + (["sent", "viewed", "pending_confirmation", "partially_paid", "overdue"].includes(i.status) ? i.balanceCents : 0), 0);

  const latestQuote = quotes?.[0];
  const clientName = latestQuote?.clientData?.nome ?? "";
  const email = latestQuote?.clientData?.email;
  const phone = latestQuote?.clientData?.phone;
  const city = latestQuote?.clientData?.city;
  const province = latestQuote?.clientData?.province;
  const indirizzo = latestQuote?.clientData?.indirizzo;
  const partitaIva = latestQuote?.clientData?.partitaIva;
  const businessNumber = latestQuote?.clientData?.businessNumber;
  const place = city ? `${city}${province ? ` (${province})` : ""}` : "";
  const address = [indirizzo, city, province].filter(Boolean).join(", ");
  const firstQuote = quotes && quotes.length > 0 ? quotes[quotes.length - 1] : undefined;

  useMobileHeader(useMemo(() => (clientName ? { title: clientName } : null), [clientName]));

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "quotes", label: t("clients.col.quotes"), count: quotes?.length ?? 0 },
    ...(hasJobs && !jobsQ.isError ? [{ id: "jobs" as const, label: t("clients.m.jobs"), count: jobs.length }] : []),
    ...(hasInvoices && !invoicesQ.isError ? [{ id: "invoices" as const, label: t("clients.m.invoices"), count: invoices.length }] : []),
  ];
  const tab: Tab = tabs.some((x) => x.id === tabParam) ? tabParam! : "quotes";
  const setTab = (id: string) => navigate(`/dashboard/clients/${clientId}${id === "quotes" ? "" : `?tab=${id}`}`, { replace: true });

  const contact = [
    phone && { key: "call", href: `tel:${phone.replace(/[^\d+]/g, "")}`, icon: Phone, label: t("clients.m.call") },
    phone && { key: "text", href: `sms:${phone.replace(/[^\d+]/g, "")}`, icon: MessageSquareText, label: t("clients.m.text") },
    email && { key: "email", href: `mailto:${email}`, icon: Mail, label: t("clients.m.email") },
    address && { key: "map", href: mapsUrl(address), icon: MapPin, label: t("clients.m.map"), external: true },
  ].filter((x): x is { key: string; href: string; icon: typeof Phone; label: string; external?: boolean } => !!x);

  return (
    <div className="animate-in fade-in duration-500">
      <Link href="/dashboard/clients" className="back-link hide-phone"><ArrowLeft /> {t("clients.detail.back")}</Link>

      <section className="card q-hero c-hero">
        <div className="q-hero-main">
          {isLoading ? (
            <Skeleton className="h-8 w-56 rounded-md" />
          ) : (
            <>
              <div className="q-hero-eyebrow">
                <Users aria-hidden="true" />
                {place && <span>{place}</span>}
                {firstQuote && <span>{t("clients.m.since").replace("{date}", format(new Date(firstQuote.createdAt), "MMM yyyy", { locale }))}</span>}
              </div>
              <div className="c-hero-name">
                <span className="avat" aria-hidden="true">{clientName.slice(0, 2) || "??"}</span>
                <h1>{clientName || t("clients.col.client")}</h1>
              </div>
              {(email || phone) && <p className="q-hero-sub c-hero-sub">{[phone, email].filter(Boolean).join(" · ")}</p>}
            </>
          )}
          {contact.length > 0 && (
            <div className="c-acts" role="group" aria-label={t("clients.m.contact")}>
              {contact.map((c) => (
                <a key={c.key} href={c.href} className="c-act" {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                  <c.icon aria-hidden="true" />
                  <span>{c.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <StatStrip
        label={t("clients.m.numbers")}
        items={[
          { label: t("clients.col.quotes"), value: isLoading ? "—" : String(quotes?.length ?? 0), sub: won.length ? t("clients.m.wonCount").replace("{n}", String(won.length)) : undefined },
          { label: t("clients.detail.totalValue"), value: formatEurWhole(totalValue) },
          { label: t("clients.m.won"), value: formatEurWhole(wonValue), tone: wonValue > 0 ? "ok" : undefined },
          hasInvoices
            ? { label: t("clients.m.owed"), value: formatEurWhole(owedCents / 100), tone: owedCents > 0 ? "warn" : undefined }
            : { label: t("clients.m.jobs"), value: String(jobs.length) },
        ]}
      />

      {!isLoading && (partitaIva || businessNumber || (indirizzo && !city)) && (
        <div className="card">
          {partitaIva && <div className="kv"><span>{t("clients.detail.gstNumber")}</span><b>{partitaIva}</b></div>}
          {businessNumber && <div className="kv"><span>{t("clients.detail.businessNumber")}</span><b>{businessNumber}</b></div>}
          {indirizzo && <div className="kv"><span>{t("clients.detail.address")}</span><b>{indirizzo}{city ? `, ${city}` : ""}</b></div>}
        </div>
      )}

      <ScrollTabs tabs={tabs} value={tab} onChange={setTab} sticky label={t("clients.m.sections")} />

      <div className="card">
        {tab === "quotes" && (
          isLoading ? (
            <div className="p-5 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !quotes || quotes.length === 0 ? (
            <div className="card-empty">{t("clients.detail.noQuotes")}</div>
          ) : (
            <ul className="lrows" aria-label={t("clients.col.quotes")}>
              {quotes.map((q) => {
                const chip = quoteStatusChip(q as never, t);
                return (
                  <li key={q.id}>
                    <ListRow
                      href={`/dashboard/quotes/${q.id}`}
                      title={q.titoloPreventivoRiga2 || q.descrizioneGenerale || t("clients.detail.quote")}
                      meta={[format(new Date(q.createdAt), "d MMM yyyy", { locale }), q.numeroPreventivoData]}
                      amount={formatEurWhole(q.totale)}
                      end={<span className={cn("chip", chip.cls)}>{chip.label}</span>}
                    />
                  </li>
                );
              })}
            </ul>
          )
        )}
        {tab === "jobs" && (
          jobsQ.isLoading ? <div className="p-5"><Skeleton className="h-10 w-full" /></div>
          : jobs.length === 0 ? <div className="card-empty">{t("clients.m.noJobs")}</div>
          : (
            <ul className="lrows jlist" aria-label={t("clients.m.jobs")}>
              {jobs.map((j) => (
                <li key={j.id}>
                  <ListRow
                    href={j.setupStatus === "pending_review" ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`}
                    title={j.name}
                    meta={[j.address, j.nextMilestone?.title]}
                    below={
                      <span className="jlist-prog">
                        <span className="pbar" aria-hidden="true"><i style={{ width: `${j.progressPercent}%` }} /></span>
                        <span>{j.progressPercent}%</span>
                      </span>
                    }
                    amount={formatEurWhole(j.totalValueCents / 100)}
                    end={<JobStatusBadge status={j.status} pendingReview={j.setupStatus === "pending_review"} />}
                  />
                </li>
              ))}
            </ul>
          )
        )}
        {tab === "invoices" && (
          invoicesQ.isLoading ? <div className="p-5"><Skeleton className="h-10 w-full" /></div>
          : invoices.length === 0 ? <div className="card-empty">{t("clients.m.noInvoices")}</div>
          : (
            <ul className="lrows" aria-label={t("clients.m.invoices")}>
              {invoices.map((inv) => <li key={inv.id}><InvoiceListRow inv={inv} locale={locale} showClient={false} /></li>)}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
