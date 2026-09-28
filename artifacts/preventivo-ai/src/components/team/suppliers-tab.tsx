import { useEffect, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { telefonoPerChiamata } from "@workspace/config";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ListRow } from "@/components/mobile/list-row";
import { RowMore } from "@/components/mobile/row-more";
import { useToast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { teamApi, type SupplierDto, type SupplierEdit } from "@/lib/team-api";

/**
 * APP-8g (row 38) — the supplier book in Squadra → Fornitori: the company, the
 * trade, referente and notes, phone and email. The assistant finds numbers here
 * ("chiama Marco di Edilceramiche"), and the SdI purchase invoices match
 * suppliers by name or by the P. IVA written in the notes.
 */
export function SuppliersTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: teamApi.suppliers });
  const [editing, setEditing] = useState<{ open: boolean; item: SupplierDto | null }>({ open: false, item: null });
  const remove = useMutation({
    mutationFn: (id: string) => teamApi.deleteSupplier(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const phone = useMediaQuery("(max-width: 640px)");
  const items = data ?? [];
  const del = (s: SupplierDto) => { if (confirm(t("team.suppliers.deleteConfirm").replace("{name}", s.name))) remove.mutate(s.id); };
  const tel = (s: SupplierDto) => telefonoPerChiamata(s.phone);

  return (
    <div className="card">
      <div className="toolbar">
        <p className="foot-note m-0">{t("team.suppliers.intro")}</p>
        <div className="grow">
          <button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, item: null })}><Plus className="h-4 w-4" /> {t("team.suppliers.add")}</button>
        </div>
      </div>
      {isLoading ? <div className="p-5"><Skeleton className="h-24 w-full rounded-[var(--radius-mk)]" /></div> : items.length === 0 ? (
        <div className="card-empty">{t("team.suppliers.empty")}</div>
      ) : phone ? (
        <ul className="lrows" aria-label={t("team.tab.suppliers")}>
          {items.map((s) => (
            <li key={s.id} className="lrow-split">
              <ListRow
                className="wrap-meta"
                lead={<span className="cell-ic"><Truck className="h-4 w-4" /></span>}
                title={s.name}
                meta={[s.category, s.contactInfo, tel(s)?.display ?? s.phone]}
                onClick={() => setEditing({ open: true, item: s })}
              />
              <RowMore label={t("team.m.rowActions").replace("{name}", s.name)} actions={[
                tel(s) && { label: t("team.suppliers.call"), icon: Phone, onSelect: () => window.location.assign(`tel:${tel(s)!.dial}`) },
                { label: t("team.suppliers.edit"), icon: Pencil, onSelect: () => setEditing({ open: true, item: s }) },
                { label: t("team.suppliers.delete"), icon: Trash2, danger: true, separated: true, onSelect: () => del(s) },
              ]} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("team.suppliers.name")}</th>
                <th>{t("team.suppliers.category")}</th>
                <th>{t("team.suppliers.contactInfo")}</th>
                <th>{t("team.suppliers.phone")}</th>
                <th>{t("team.suppliers.email")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const n = tel(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="cell-flex">
                        <span className="cell-ic"><Truck className="h-4 w-4" /></span>
                        <span className="t-strong">{s.name}</span>
                      </span>
                    </td>
                    <td>{s.category ? <span className="chip chip-grey">{s.category}</span> : <span className="t-sub">—</span>}</td>
                    <td><span className="t-sub">{s.contactInfo || "—"}</span></td>
                    <td>{n ? <a className="text-link" href={`tel:${n.dial}`}>{n.display}</a> : <span className="t-sub">{s.phone || "—"}</span>}</td>
                    <td>{s.email ? <a className="text-link" href={`mailto:${s.email}`}>{s.email}</a> : <span className="t-sub">—</span>}</td>
                    <td>
                      <div className="row-act">
                        <button type="button" className="ic-btn" title={t("team.suppliers.edit")} onClick={() => setEditing({ open: true, item: s })}><Pencil /></button>
                        <button type="button" className="ic-btn danger" title={t("team.suppliers.delete")} onClick={() => del(s)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot"><span className="foot-note">{t("team.suppliers.hint")}</span></div>
      <SupplierDialog item={editing.item} open={editing.open} onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))} />
    </div>
  );
}

function SupplierDialog({ item, open, onOpenChange }: { item: SupplierDto | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SupplierEdit>({ name: "", category: "", contactInfo: "", phone: "", email: "" });
  useEffect(() => {
    if (!open) return;
    setForm({ name: item?.name ?? "", category: item?.category ?? "", contactInfo: item?.contactInfo ?? "", phone: item?.phone ?? "", email: item?.email ?? "" });
  }, [open, item]);
  const phoneBad = !!form.phone.trim() && !telefonoPerChiamata(form.phone);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), category: form.category.trim(), contactInfo: form.contactInfo.trim(), phone: form.phone.trim(), email: form.email.trim() };
      return item ? teamApi.updateSupplier(item.id, body) : teamApi.addSupplier(body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["suppliers"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const set = (k: keyof SupplierEdit) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{item ? t("team.suppliers.edit") : t("team.suppliers.add")}</DialogTitle><DialogDescription>{t("team.suppliers.dialogDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field"><label htmlFor="sup-name">{t("team.suppliers.name")}</label><input id="sup-name" value={form.name} onChange={set("name")} placeholder={t("team.suppliers.namePlaceholder")} autoFocus maxLength={200} /></div>
            <div className="field"><label htmlFor="sup-cat">{t("team.suppliers.category")}</label><input id="sup-cat" value={form.category} onChange={set("category")} placeholder={t("team.suppliers.categoryPlaceholder")} maxLength={120} /></div>
            <div className="field full"><label htmlFor="sup-info">{t("team.suppliers.contactInfo")}</label><input id="sup-info" value={form.contactInfo} onChange={set("contactInfo")} placeholder={t("team.suppliers.contactInfoPlaceholder")} maxLength={1000} /></div>
            <div className="field">
              <label htmlFor="sup-phone">{t("team.suppliers.phone")}</label>
              <input id="sup-phone" type="tel" inputMode="tel" autoComplete="off" value={form.phone} onChange={set("phone")} placeholder="333 123 4567" maxLength={40} aria-invalid={phoneBad} aria-describedby={phoneBad ? "sup-phone-err" : undefined} />
              {phoneBad && <p id="sup-phone-err" className="field-hint" style={{ color: "var(--red)" }}>{t("team.suppliers.phoneBad")}</p>}
            </div>
            <div className="field"><label htmlFor="sup-email">{t("team.suppliers.email")}</label><input id="sup-email" type="email" autoComplete="off" value={form.email} onChange={set("email")} maxLength={254} /></div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
