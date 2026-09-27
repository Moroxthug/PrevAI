import { useListClients } from "@workspace/api-client-react";
import { rowLink } from "@/lib/row-link";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Users, Search, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Monogram } from "@/components/mobile-ui";

const formatCurrency = (v: number, _lang: string) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

export default function ClientsPage() {
  const { data: clients, isLoading } = useListClients();
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { t, lang } = useLanguage();

  const filtered = (clients ?? []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.clientName.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
  });

  const totalQuotes = (clients ?? []).reduce((sum, c) => sum + c.quoteCount, 0);

  /* ── Phones: same premium list as the quotes screen ── */
  const all = clients ?? [];
  const activeCount = all.filter(c => c.unlockedCount > 0).length;
  const totalValue = all.reduce((s, c) => s + c.totalValue, 0);
  const mobileList = (
    <div className="m-only mquotes">
      <h1 className="m-title m-title-lg">{t("clients.title")}</h1>
      {all.length > 0 && (
        <div className="m-tiles">
          <div className="m-sheet m-tile">
            <span>{t("clients.m.total")}</span>
            <b>{formatCurrency(totalValue, lang)}</b>
            <em className="ok">{t("clients.m.quotesN").replace("{n}", String(totalQuotes))}</em>
          </div>
          <div className="m-sheet m-tile">
            <span>{t("clients.m.active")}</span>
            <b>{activeCount}</b>
            <em className="wait">{t("clients.m.prospectsN").replace("{n}", String(all.length - activeCount))}</em>
          </div>
        </div>
      )}
      <label className="m-search">
        <Search />
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("clients.search")} aria-label={t("clients.search")} />
      </label>
      {isLoading ? (
        <div className="m-sheet" style={{ padding: 16, marginTop: 16 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg mb-2" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="m-empty">
          <p>{t("clients.empty.title")}</p>
          <Link href="/dashboard/new" className="m-empty-cta">{t("clients.empty.cta")}</Link>
        </div>
      ) : (
        <div className="m-sheet m-list-card" style={{ marginTop: 16 }}>
          {filtered.map(client => (
            <div key={client.id} {...rowLink(() => navigate(`/dashboard/clients/${client.id}`))} className="m-li">
              <Monogram name={client.clientName} />
              <span className="m-li-b">
                <span className="m-li-t">{client.clientName}</span>
                <span className="m-li-s">{client.city ? client.city + (client.province ? ` (${client.province})` : "") : (client.indirizzo || client.email || client.phone || "—")}</span>
              </span>
              <span className="m-li-r">
                <span className="m-li-a">{formatCurrency(client.totalValue, lang)}</span>
                <span className="m-li-s">{client.quoteCount === 1 ? t("clients.m.oneQuote") : t("clients.m.quotesN").replace("{n}", String(client.quoteCount))}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
    {mobileList}
    <div className="d-only animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("clients.title")}</h1>
          <p className="sub">{t("clients.subtitle")}</p>
        </div>
        <div className="head-actions">
          <Link href="/dashboard/new" className="btn btn-navy">
            <Plus className="h-4 w-4" />
            {t("clients.add")}
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <label className="search sm">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("clients.search")}
              aria-label={t("clients.search")}
            />
          </label>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 px-5">
            <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="font-semibold text-foreground">{t("clients.empty.title")}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              {t("clients.empty.desc")}
            </p>
            <Link href="/dashboard/new" className="btn btn-navy btn-sm">{t("clients.empty.cta")}</Link>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("clients.col.client")}</th>
                  <th>{t("clients.col.contact")}</th>
                  <th>{t("clients.col.quotes")}</th>
                  <th>{t("clients.col.lifetime")}</th>
                  <th>{t("clients.col.status")}</th>
                  <th>{t("clients.col.lastActivity")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => {
                  const status = client.unlockedCount > 0
                    ? { cls: "chip-green", label: t("clients.status.active") }
                    : { cls: "chip-teal", label: t("clients.status.prospect") };
                  return (
                    <tr key={client.id} {...rowLink(() => navigate(`/dashboard/clients/${client.id}`))}>
                      <td>
                        <span className="cell-flex">
                          <span className="avat">{client.clientName.slice(0, 2)}</span>
                          <span>
                            <span className="t-strong">{client.clientName}</span>
                            <span className="t-sub">
                              {client.city ? client.city + (client.province ? ` (${client.province})` : "") : (client.indirizzo || "—")}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>{client.email || client.phone || "—"}</td>
                      <td>{client.quoteCount}</td>
                      <td className="t-amt">{formatCurrency(client.totalValue, lang)}</td>
                      <td><span className={cn("chip", status.cls)}>{status.label}</span></td>
                      <td>
                        <span className="flex items-center gap-2 justify-between">
                          {new Date(client.lastQuoteDate).toLocaleDateString("it-IT")}
                          <ChevronRight className="chev" style={{ color: "var(--faint)" }} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="card-foot">
            <span className="foot-note">
              {t("clients.foot").replace("{clients}", filtered.length === 1 ? t("clients.count.one") : t("clients.count.many").replace("{n}", String(filtered.length))).replace("{quotes}", String(totalQuotes))}
            </span>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
