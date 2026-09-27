import { useListQuotes, useDeleteQuote, useDuplicateQuote, useArchiveQuote, getListQuotesQueryKey } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, FileText, Trash2, Eye, Copy, Loader2, Plus, ChevronRight, Archive } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Monogram, StatusDot, shortDate } from "@/components/mobile-ui";

type StatusFilter = "all" | "draft" | "unlocked" | "pending_payment";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

function statusChip(status: string, t: (key: string) => string): { cls: string; label: string } {
  if (status === "unlocked") return { cls: "chip-green", label: t("dashboard.quotesList.statusUnlocked") };
  if (status === "pending_payment") return { cls: "chip-yellow", label: t("dashboard.quotesList.statusPending") };
  return { cls: "chip-grey", label: t("dashboard.quotesList.statusDraft") };
}

export default function QuotesList() {
  const { t } = useLanguage();
  const FILTERS: StatusFilter[] = ["all", "draft", "unlocked", "pending_payment"];
  const FILTER_LABELS: Record<StatusFilter, string> = {
    all: t("dashboard.quotesList.statusAll"),
    draft: t("dashboard.quotesList.statusDraft"),
    unlocked: t("dashboard.quotesList.statusUnlocked"),
    pending_payment: t("dashboard.quotesList.statusPending"),
  };
  const { data: quotes, isLoading } = useListQuotes();
  const deleteQuote = useDeleteQuote();
  const duplicateQuote = useDuplicateQuote();
  const archiveQuote = useArchiveQuote();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleDelete = (id: string) => {
    if (!confirm(t("dashboard.quotesList.confirmDelete"))) return;
    deleteQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: t("dashboard.quotesList.deletedToast") });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => toast({ title: t("dashboard.quotesList.deleteErrorToast"), variant: "destructive" }),
    });
  };

  const handleArchive = (id: string) => {
    archiveQuote.mutate({ id }, {
      onSuccess: () => {
        toast({ title: t("dashboard.quotesList.archivedToast") });
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
      onError: () => toast({ title: t("dashboard.quotesList.archiveErrorToast"), variant: "destructive" }),
    });
  };

  const handleDuplicate = (id: string) => {
    setDuplicatingId(id);
    duplicateQuote.mutate({ id }, {
      onSuccess: (newQuote) => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: t("dashboard.quotesList.duplicatedToast") });
        navigate(`/dashboard/quotes/${newQuote.id}`);
      },
      onError: () => toast({ title: t("dashboard.quotesList.duplicateErrorToast"), variant: "destructive" }),
      onSettled: () => setDuplicatingId(null),
    });
  };

  const filteredQuotes = (quotes ?? []).filter(q => {
    const matchesSearch =
      !searchTerm ||
      q.clientData?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.descrizioneGenerale?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const actionsMenu = (id: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="h-7 w-7 grid place-items-center rounded-md hover:bg-[var(--soft)] text-[var(--faint)]" aria-label={t("dashboard.quotesList.options")}>
          {duplicatingId === id
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <MoreVertical className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/quotes/${id}`} className="cursor-pointer w-full flex items-center text-sm">
            <Eye className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.view")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleDuplicate(id)}
          disabled={duplicatingId === id}
          className="cursor-pointer text-sm"
        >
          <Copy className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.duplicate")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleArchive(id)}
          className="cursor-pointer text-sm"
        >
          <Archive className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.archive")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => handleDelete(id)}
          className="text-destructive focus:text-destructive cursor-pointer text-sm"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("dashboard.quotesList.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* ── Phones: summary tiles, counted filters, rows grouped by month ── */
  const all = quotes ?? [];
  const countOf = (f: StatusFilter) => (f === "all" ? all.length : all.filter(q => q.status === f).length);
  const pendingSum = all.filter(q => q.status === "pending_payment").reduce((s, q) => s + q.totale, 0);
  const unlockedCount = countOf("unlocked");
  const unlockRate = all.length > 0 ? Math.round((unlockedCount / all.length) * 100) : 0;
  const euro0 = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const monthGroups: { key: string; label: string; items: typeof filteredQuotes }[] = [];
  for (const q of [...filteredQuotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())) {
    const d = new Date(q.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = monthGroups[monthGroups.length - 1];
    if (!g || g.key !== key) {
      const sameYear = d.getFullYear() === new Date().getFullYear();
      g = { key, label: d.toLocaleDateString("it-IT", sameYear ? { month: "long" } : { month: "long", year: "numeric" }), items: [] };
      monthGroups.push(g);
    }
    g.items.push(q);
  }

  const mobileList = (
    <div className="m-only mquotes">
      <h1 className="m-title m-title-lg">{t("dashboard.m.quotes.title")}</h1>

      {all.length > 0 && (
        <div className="m-tiles">
          <div className="m-sheet m-tile">
            <span>{t("dashboard.m.quotes.toCollect")}</span>
            <b>{euro0(pendingSum)}</b>
            <em className="wait">{t("dashboard.m.quotes.pendingN").replace("{n}", String(countOf("pending_payment")))}</em>
          </div>
          <div className="m-sheet m-tile">
            <span>{t("dashboard.m.quotes.unlockRate")}</span>
            <b>{unlockRate}%</b>
            <em className="ok">{t("dashboard.m.quotes.xOfY").replace("{x}", String(unlockedCount)).replace("{y}", String(all.length))}</em>
          </div>
        </div>
      )}

      <label className="m-search">
        <Search />
        <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t("dashboard.m.quotes.search")} aria-label={t("dashboard.m.quotes.search")} />
      </label>

      <div className="m-chips">
        {FILTERS.map(f => (
          <button key={f} type="button" className={cn("m-chip", statusFilter === f && "on")} onClick={() => setStatusFilter(f)}>
            {FILTER_LABELS[f]} · {countOf(f)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="m-sheet" style={{ padding: 16, marginTop: 16 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg mb-2" />)}
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="m-empty">
          <p>{t("dashboard.quotesList.noQuotesFound")}</p>
          {(searchTerm || statusFilter !== "all") && (
            <button type="button" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>{t("dashboard.quotesList.clearFilters")}</button>
          )}
        </div>
      ) : (
        monthGroups.map(g => (
          <section key={g.key}>
            <div className="m-group-head">
              <span>{g.label}</span>
              <span>{g.items.length} · {euro0(g.items.filter(q => q.status !== "draft").reduce((s, q) => s + q.totale, 0))}</span>
            </div>
            <div className="m-sheet m-list-card">
              {g.items.map(q => {
                const client = q.clientData?.nome || t("dashboard.quotesList.clientNotSpecified");
                return (
                  <div key={q.id} {...rowLink(() => navigate(`/dashboard/quotes/${q.id}`))} className="m-li">
                    <Monogram name={client} />
                    <span className="m-li-b">
                      <span className="m-li-t">{client}</span>
                      <span className="m-li-s">{q.descrizioneGenerale || t("dashboard.quotesList.noDescription")}</span>
                    </span>
                    <span className="m-li-r">
                      <span className={cn("m-li-a", q.status === "draft" && "muted")}>{q.status === "draft" ? FILTER_LABELS.draft : euro0(q.totale)}</span>
                      <span className="m-li-s"><StatusDot status={q.status} />{shortDate(q.createdAt)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );

  return (
    <>
    {mobileList}
    <div className="d-only animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.quotesList.title")}</h1>
          <p className="sub">{t("dashboard.quotesList.subtitle")}</p>
        </div>
        <div className="head-actions">
          <Link href="/dashboard/new" className="btn btn-navy">
            <Plus className="h-4 w-4" />
            {t("dashboard.quotesList.createFirstQuote")}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="pills">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={cn("pill", statusFilter === f && "on")}
                onClick={() => setStatusFilter(f)}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
          <label className="search sm grow">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t("dashboard.quotesList.searchPlaceholder")}
              aria-label={t("dashboard.quotesList.searchPlaceholder")}
            />
          </label>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-14 px-5">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-base font-medium text-foreground mb-1">{t("dashboard.quotesList.noQuotesFound")}</h3>
            {searchTerm || statusFilter !== "all" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("dashboard.quotesList.noResultsForFilters")}</p>
                <button type="button" className="cta-link mx-auto" onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>
                  {t("dashboard.quotesList.clearFilters")}
                </button>
              </div>
            ) : (
              <Link href="/dashboard/new" className="btn btn-navy btn-sm">
                {t("dashboard.quotesList.createFirstQuote")}
              </Link>
            )}
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("dashboard.quotesList.colQuote")}</th>
                  <th>{t("dashboard.quotesList.colClient")}</th>
                  <th>{t("dashboard.quotesList.colStatus")}</th>
                  <th>{t("dashboard.quotesList.colDate")}</th>
                  <th style={{ textAlign: "right" }}>{t("dashboard.quotesList.colValue")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map(quote => {
                  const chip = statusChip(quote.status, t);
                  return (
                    <tr key={quote.id} {...rowLink(() => navigate(`/dashboard/quotes/${quote.id}`))}>
                      <td>
                        <span className="cell-flex">
                          <span className="cell-ic"><FileText className="h-4 w-4" /></span>
                          <span>
                            <span className="t-strong">{quote.descrizioneGenerale || t("dashboard.quotesList.noDescription")}</span>
                            <span className="t-sub">
                              {quote.lineItemCount} {quote.lineItemCount === 1 ? t("dashboard.quotesList.lineItem") : t("dashboard.quotesList.lineItems")}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{quote.clientData?.nome || t("dashboard.quotesList.clientNotSpecified")}</td>
                      <td><span className={cn("chip", chip.cls)}>{chip.label}</span></td>
                      <td>{new Date(quote.createdAt).toLocaleDateString("it-IT")}</td>
                      <td className="t-amt" style={{ textAlign: "right" }}>
                        {quote.status === "draft" ? "—" : formatCurrency(quote.totale)}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {actionsMenu(quote.id)}
                          <ChevronRight className="chev" style={{ color: "var(--faint)" }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredQuotes.length > 0 && (
          <div className="card-foot">
            <span className="foot-note">
              {t("dashboard.quotesList.footShowing").replace("{shown}", String(filteredQuotes.length)).replace("{total}", String(quotes?.length ?? 0))}
            </span>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
