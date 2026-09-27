import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Archive as ArchiveIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveTable } from "@/components/mobile/list-row";
import { useMediaQuery } from "@/hooks/use-media-query";

type ArchiveType = "quote" | "client" | "invoice" | "job" | "contract";
type ArchiveItem = { id: string; type: ArchiveType; label: string; archivedAt: string; archivedByName: string | null };

const RESTORE_PATH: Record<ArchiveType, string | null> = {
  quote: "/api/quotes/{id}/restore",
  invoice: "/api/invoices/{id}/restore",
  job: "/api/jobs/{id}/restore",
  contract: "/api/contracts/{id}/restore",
  client: null,
};

const QUERY_KEY = ["archive"];

async function fetchArchive(): Promise<{ items: ArchiveItem[] }> {
  const res = await fetch("/api/archive", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load archive");
  return res.json();
}

export default function ArchivePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchArchive, staleTime: 15_000 });
  const locale = it;

  const restore = useMutation({
    mutationFn: async (item: ArchiveItem) => {
      const path = RESTORE_PATH[item.type];
      if (!path) throw new Error("Not restorable");
      const res = await fetch(path.replace("{id}", item.id), { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: "{}" });
      if (!res.ok) throw new Error("Failed to restore");
    },
    onSuccess: () => {
      toast({ title: t("archive.restoredToast") });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => toast({ title: t("archive.restoreErrorToast"), variant: "destructive" }),
  });

  const items = data?.items ?? [];
  const phone = useMediaQuery("(max-width: 639.98px)");

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("archive.title")}</h1>
          <p className="sub">{t("archive.subtitle")}</p>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <ArchiveIcon className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("archive.empty")}</p>
          </div>
        ) : (
          <>
            {/* Phase 110: on a phone the record, what it is and when, with Restore on the right. */}
            <ResponsiveTable
              label={t("archive.title")}
              rows={items}
              getKey={(item) => `${item.type}:${item.id}`}
              columns={[
                { key: "rec", header: t("archive.colRecord"), mobile: "title", cell: (item) => <span className="t-strong">{item.label}</span> },
                { key: "type", header: t("archive.colType"), mobile: "meta", cell: (item) => (phone ? t(`archive.type.${item.type}`) : <span className="chip chip-grey">{t(`archive.type.${item.type}`)}</span>) },
                { key: "when", header: t("archive.colArchived"), mobile: "meta", cell: (item) => format(new Date(item.archivedAt), phone ? "PP" : "yyyy-MM-dd", { locale }) },
                { key: "by", header: t("archive.colBy"), mobile: "meta", cell: (item) => item.archivedByName || (phone ? null : "—") },
                { key: "act", header: "", mobile: "end", cell: (item) => RESTORE_PATH[item.type] && (
                  <button type="button" className="cta-link" onClick={() => restore.mutate(item)} disabled={restore.isPending}>
                    {t("archive.restore")}{phone && <span className="sr-only"> {item.label}</span>}
                  </button>
                ) },
              ]}
            />
            <div className="card-foot">
              <span className="foot-note">{t("archive.footShowing").replace("{count}", String(items.length))}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
