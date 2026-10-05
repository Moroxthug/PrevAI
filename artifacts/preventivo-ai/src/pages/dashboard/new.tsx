import { useState, useRef, useCallback, useEffect } from "react";
import { trackAppEvent } from "@/lib/app-beta";
import { useLocation } from "wouter";
import { useCreateQuote, useGetBusinessProfile, useGetSubscription } from "@workspace/api-client-react";
import { Sparkles, ImagePlus, Loader2, X, User, Lock, FileText, FileSpreadsheet, Plus, WifiOff, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientMemory } from "@/hooks/use-client-memory";
import type { SavedClient } from "@/hooks/use-client-memory";
import ManualQuoteBuilder from "@/components/manual-quote-builder";
import { PriceCatalogSection } from "@/components/price-catalog-section";
import { MicButton } from "@/components/mic-button";
import { useLanguage } from "@/i18n/LanguageContext";
import { ScrollTabs } from "@/components/mobile/scroll-tabs";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { QuoteOptions, parseTarget } from "@/components/quotes/quote-options";
import { useAuth } from "@/hooks/use-auth";
import { useOnline, useQuoteDraft } from "@/hooks/use-quote-draft";

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE_MB = 5;
const MAX_DOC_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const MAX_DOC_SIZE_BYTES = MAX_DOC_SIZE_MB * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

function getExamples(t: (key: string) => string) {
  return [
    { label: t("dashboard.new.examples.painter.label"), text: t("dashboard.new.examples.painter.text") },
    { label: t("dashboard.new.examples.electrician.label"), text: t("dashboard.new.examples.electrician.text") },
    { label: t("dashboard.new.examples.plumber.label"), text: t("dashboard.new.examples.plumber.text") },
    { label: t("dashboard.new.examples.renovation.label"), text: t("dashboard.new.examples.renovation.text") },
    { label: t("dashboard.new.examples.mason.label"), text: t("dashboard.new.examples.mason.text") },
  ];
}

function getMaxPhotos(plan: string | null | undefined, isActive: boolean): number {
  if (!isActive) return 0;
  if (plan === "monthly_elite") return 5;
  if (plan === "monthly_pro") return 3;
  if (plan === "monthly_starter") return 1;
  return 0;
}

interface ClientForm {
  nome: string;
  indirizzo: string;
  city: string;
  postalCode: string;
  province: string;
  businessNumber: string;
  partitaIva: string;
}
const emptyClient: ClientForm = {
  nome: "", indirizzo: "", city: "", postalCode: "", province: "", businessNumber: "", partitaIva: "",
};

// ─── Shared client selector used in both tabs ───────────────────────────────
interface ClientSelectorProps {
  clientMode: "none" | "saved" | "new";
  setClientMode: (m: "none" | "saved" | "new") => void;
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  clientForm: ClientForm;
  setClientForm: (fn: (prev: ClientForm) => ClientForm) => void;
  rememberClient: boolean;
  setRememberClient: (v: boolean) => void;
  savedClients: SavedClient[];
  selectSavedClient: (c: SavedClient) => void;
  clearClient: () => void;
  disabled?: boolean;
}

function ClientSelector({
  clientMode, setClientMode, selectedClientId,
  clientForm, setClientForm, rememberClient, setRememberClient,
  savedClients, selectSavedClient, clearClient, disabled,
}: ClientSelectorProps) {
  const { t } = useLanguage();
  const field = (key: keyof ClientForm, label: string, placeholder: string, opts?: { maxLength?: number; upper?: boolean; full?: boolean }) => (
    <div className={cn("field", opts?.full && "full")}>
      <label>{label}</label>
      <input
        placeholder={placeholder}
        value={clientForm[key]}
        onChange={e => { const v = opts?.upper ? e.target.value.toUpperCase() : e.target.value; setClientForm(f => ({ ...f, [key]: v })); }}
        disabled={disabled}
        maxLength={opts?.maxLength}
      />
    </div>
  );
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.new.client.label")}{clientForm.nome && <span className="chip chip-grey">{clientForm.nome}</span>}</h2>
          <p className="sub">{t("dashboard.new.client.optional")}</p>
        </div>
      </div>

      {savedClients.length > 0 && clientMode !== "new" && (
        <div className="pick-row">
          {savedClients.slice(0, 6).map(c => (
            <button key={c.id} type="button" onClick={() => selectSavedClient(c)} className={cn("pill", selectedClientId === c.id && "on")}>
              <User /> {c.nome}
            </button>
          ))}
          <button type="button" onClick={() => setClientMode("new")} className="pill dashed">
            <Plus /> {t("dashboard.new.client.addNew")}
          </button>
        </div>
      )}

      {clientMode === "saved" && selectedClientId && (
        <div className="pick-sub">
          <span>{[clientForm.indirizzo, clientForm.city, clientForm.province].filter(Boolean).join(", ") || t("dashboard.new.client.noAddress")}</span>
          <button type="button" onClick={clearClient} className="text-link danger">{t("dashboard.new.client.remove")}</button>
        </div>
      )}

      {savedClients.length === 0 && clientMode === "none" && (
        <div style={{ padding: 22 }}>
          <button type="button" onClick={() => setClientMode("new")} className="add-dashed">
            <Plus /> {t("dashboard.new.client.addClientData")}
          </button>
        </div>
      )}

      {clientMode === "new" && (
        <>
          <div className="form-grid tight animate-in fade-in slide-in-from-top-1 duration-200" style={{ borderTop: "1px solid var(--soft)" }}>
            {field("nome", t("dashboard.new.client.nameLabel"), t("dashboard.new.client.namePlaceholder"), { full: true })}
            {field("indirizzo", t("dashboard.new.client.addressLabel"), t("dashboard.new.client.addressPlaceholder"), { full: true })}
            {field("city", t("dashboard.new.client.city"), "Milano")}
            <div className="grid grid-cols-2 gap-2">
              {field("province", t("dashboard.new.client.province"), "MI", { maxLength: 2, upper: true })}
              {field("postalCode", t("dashboard.new.client.postalCode"), "20121", { maxLength: 5 })}
            </div>
            {field("businessNumber", t("dashboard.new.client.businessNumber"), "RSSMRA80A01F205X", { maxLength: 16, upper: true })}
            {field("partitaIva", t("dashboard.new.client.partitaIva"), "01234567890", { maxLength: 13 })}
          </div>
          <div className="card-foot">
            <label className="chk-row">
              <input type="checkbox" checked={rememberClient} onChange={e => setRememberClient(e.target.checked)} />
              {t("dashboard.new.client.remember")}
            </label>
            <button type="button" onClick={clearClient} className="text-link">{t("dashboard.new.client.cancel")}</button>
          </div>
        </>
      )}
    </section>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function NewQuote() {
  const { t } = useLanguage();
  const EXAMPLES = getExamples(t);
  const [activeTab, setActiveTab] = useState<"ai" | "manual" | "listino">("ai");

  const [input, setInput] = useState("");
  const [templateId, setTemplateId] = useState<"standard" | "arosio" | "mariagrazia">("standard");
  const [targetTotalEur, setTargetTotalEur] = useState<string>("");
  // Phones only: layout + target amount sit behind "Opzioni" so the job
  // description is the first thing on screen. Desktop always shows them.
  const [, setLocation] = useLocation();
  const createQuote = useCreateQuote();
  const { data: profile } = useGetBusinessProfile();
  const { data: subscription } = useGetSubscription();
  // Chi ha Pro o Elite parte dal layout Professionale (capitolato tecnico); la scelta resta sua:
  // se la cambia, o se la bozza ne aveva una, il default non la tocca.
  const templateChosen = useRef(false);
  const proPlan = !!subscription?.isActive && (subscription.plan === "monthly_pro" || subscription.plan === "monthly_elite");
  useEffect(() => {
    if (proPlan && !templateChosen.current) setTemplateId("arosio");
  }, [proPlan]);
  const chooseTemplate = (id: "standard" | "arosio" | "mariagrazia") => { templateChosen.current = true; setTemplateId(id); };
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clients: savedClients, upsertClient } = useClientMemory();

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);

  const maxPhotos = getMaxPhotos(subscription?.plan, !!subscription?.isActive);
  const photoAllowed = maxPhotos > 0;

  const [clientMode, setClientMode] = useState<"none" | "saved" | "new">("none");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClient);
  const [rememberClient, setRememberClient] = useState(false);

  // APP-4a: what you type is kept on this phone until the quote is written
  // (a dropped connection on site loses nothing). Opened from the home
  // composer or a client page, the page starts from that instead.
  const { userId } = useAuth();
  const online = useOnline();
  const [cameWithContent] = useState(() => {
    try { return !!sessionStorage.getItem("prevai:homepage_prompt") || !!sessionStorage.getItem("prevai:selected_client"); } catch { return false; }
  });
  const draft = useQuoteDraft({
    userId,
    skipRestore: cameWithContent,
    value: { input, templateId, targetTotalEur, clientMode, selectedClientId, clientForm },
    isEmpty: (d) => !d.input.trim() && !d.clientForm.nome.trim(),
    onRestore: (d) => {
      setInput(d.input ?? "");
      if (d.templateId && d.templateId !== "standard") { templateChosen.current = true; setTemplateId(d.templateId); }
      setTargetTotalEur(d.targetTotalEur ?? "");
      setClientMode(d.clientMode ?? "none");
      setSelectedClientId(d.selectedClientId ?? null);
      setClientForm({ ...emptyClient, ...d.clientForm });
    },
  });
  const discardDraft = () => {
    draft.clear();
    setInput("");
    setTargetTotalEur("");
    setClientMode("none");
    setSelectedClientId(null);
    setClientForm(emptyClient);
  };

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem("prevai:homepage_prompt");
    if (savedPrompt) {
      sessionStorage.removeItem("prevai:homepage_prompt");
      setInput(savedPrompt);
    }
    const savedClient = sessionStorage.getItem("prevai:selected_client");
    if (savedClient) {
      sessionStorage.removeItem("prevai:selected_client");
      try {
        const c = JSON.parse(savedClient) as SavedClient;
        setClientMode("saved");
        setSelectedClientId(c.id);
        setClientForm({
          nome: c.nome, indirizzo: c.indirizzo || "", city: c.city || "",
          postalCode: c.postalCode || "", province: c.province || "",
          businessNumber: c.businessNumber || "", partitaIva: c.partitaIva || "",
        });
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const totalAttachments = photos.length + docs.length;
    const remaining = MAX_ATTACHMENTS - totalAttachments;
    if (remaining <= 0) {
      toast({ title: fmt(t("dashboard.new.toast.maxAttachmentsTitle"), { max: MAX_ATTACHMENTS }), description: t("dashboard.new.toast.maxAttachmentsDesc"), variant: "destructive" });
      return;
    }
    const validImages: File[] = [];
    const validDocs: File[] = [];
    for (const file of arr.slice(0, remaining)) {
      const isImage = ALLOWED_TYPES.includes(file.type) || !!file.name.toLowerCase().match(/\.(heic|heif)$/);
      const isDoc = ALLOWED_DOC_TYPES.includes(file.type);
      if (!isImage && !isDoc) {
        toast({ title: t("dashboard.new.toast.unsupportedFormatTitle"), description: fmt(t("dashboard.new.toast.unsupportedFormatDesc"), { name: file.name }), variant: "destructive" });
        continue;
      }
      if (isImage && file.size > MAX_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: fmt(t("dashboard.new.toast.fileTooLargePhotoDesc"), { name: file.name, maxSize: MAX_SIZE_MB }), variant: "destructive" });
        continue;
      }
      if (isDoc && file.size > MAX_DOC_SIZE_BYTES) {
        toast({ title: t("dashboard.new.toast.fileTooLargeTitle"), description: fmt(t("dashboard.new.toast.fileTooLargeDocDesc"), { name: file.name, maxSize: MAX_DOC_SIZE_MB }), variant: "destructive" });
        continue;
      }
      if (isImage) validImages.push(file);
      if (isDoc) validDocs.push(file);
    }
    const imagePreviews = validImages.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...validImages]);
    setPhotoPreviews(prev => [...prev, ...imagePreviews]);
    setDocs(prev => [...prev, ...validDocs]);
  }, [photos.length, docs.length, toast, t]);

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const removeDoc = (idx: number) => {
    setDocs(prev => prev.filter((_, i) => i !== idx));
  };

  const getClientData = () => {
    const f = clientForm;
    if (!f.nome.trim()) return undefined;
    return {
      nome: f.nome.trim(),
      indirizzo: f.indirizzo.trim(),
      ...(f.city.trim() && { city: f.city.trim() }),
      ...(f.postalCode.trim() && { postalCode: f.postalCode.trim() }),
      ...(f.province.trim() && { province: f.province.trim() }),
      ...(f.businessNumber.trim() && { businessNumber: f.businessNumber.trim() }),
      ...(f.partitaIva.trim() && { partitaIva: f.partitaIva.trim() }),
    };
  };

  const handleAiSubmit = () => {
    if (!input.trim() || isAiSubmitting) return;
    if (!online) {
      toast({ title: t("dashboard.new.offline.title"), description: t("dashboard.new.offline.desc") });
      return;
    }
    const clientData = getClientData();
    if (rememberClient && clientData) upsertClient(clientData);

    const companySnapshot = profile
      ? {
          companyName: profile.companyName || "",
          ...(profile.vatNumber && { vatNumber: profile.vatNumber }),
          ...(profile.address && { address: profile.address }),
          ...(profile.phone && { phone: profile.phone }),
          ...(profile.email && { email: profile.email }),
          ...(profile.logoUrl && { logoUrl: profile.logoUrl }),
        }
      : undefined;

    const allAttachments = [...photos, ...docs];
    const parsedTarget = parseTarget(targetTotalEur);
    createQuote.mutate(
      {
        data: {
          rawInput: input,
          clientData: clientData ? JSON.stringify(clientData) : undefined,
          companySnapshot: companySnapshot ? JSON.stringify(companySnapshot) : undefined,
          images: allAttachments.length > 0 ? allAttachments : undefined,
          templateId,
          targetTotalEur: parsedTarget,
        },
      },
      {
        onSuccess: (quote) => { draft.clear(); trackAppEvent("quote_created", { entityId: quote.id }); setLocation(`/dashboard/quotes/${quote.id}`); },
        onError: (err: unknown) => {
          const e = err as { status?: number; data?: { error?: string; code?: string } };
          if (e.status === 429) {
            toast({ title: t("dashboard.new.toast.quotaReachedTitle"), description: e.data?.code === "AI_BUDGET" && e.data.error ? e.data.error : t("dashboard.new.toast.quotaReachedDesc"), variant: "destructive" });
          } else if ((e.status === 422 || e.status === 400) && e.data?.error) {
            toast({ title: t("dashboard.new.toast.cannotGenerateTitle"), description: e.data.error, variant: "destructive" });
          } else if (!e.status || !navigator.onLine) {
            // No answer at all: the connection dropped. The draft is still on the phone.
            toast({ title: t("dashboard.new.offline.lostTitle"), description: t("dashboard.new.offline.desc"), variant: "destructive" });
          } else {
            toast({ title: t("dashboard.new.toast.genericErrorTitle"), description: t("dashboard.new.toast.genericErrorDesc"), variant: "destructive" });
          }
        },
      }
    );
  };

  const isAiSubmitting = createQuote.isPending;
  const canAiSubmit = input.trim().length > 0 && !isAiSubmitting;

  const selectSavedClient = (c: SavedClient) => {
    setSelectedClientId(c.id);
    setClientMode("saved");
    setClientForm({
      nome: c.nome, indirizzo: c.indirizzo || "", city: c.city || "",
      postalCode: c.postalCode || "", province: c.province || "",
      businessNumber: c.businessNumber || "", partitaIva: c.partitaIva || "",
    });
  };

  const clearClient = () => {
    setClientMode("none");
    setSelectedClientId(null);
    setClientForm(emptyClient);
  };

  const isPro = subscription?.isActive && (subscription.plan === "monthly_pro" || subscription.plan === "monthly_elite");

  const planPhotoLabel = !subscription?.isActive
    ? null
    : subscription.plan === "monthly_starter"
      ? t("dashboard.new.plan.starter")
      : subscription.plan === "monthly_pro"
        ? t("dashboard.new.plan.pro")
        : t("dashboard.new.plan.elite");

  const clientData = getClientData();

  const attachmentsFull = photos.length + docs.length >= MAX_ATTACHMENTS;

  return (
    <div className="animate-in fade-in duration-300" style={{ maxWidth: 760, marginInline: "auto" }}>
      <div className="page-head">
        <div>
          <h1>{t("dashboard.new.title")}</h1>
          <p className="sub">{t("dashboard.new.subtitle")}</p>
        </div>
      </div>

      {/* ── Mode switch (APP-1d: one scrolling line, never wrapping) ── */}
      <ScrollTabs
        label={t("quotes.m.modes")}
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
        tabs={[
          { id: "ai", label: t("dashboard.new.tabAi") },
          { id: "manual", label: t("dashboard.new.tabManual") },
          { id: "listino", label: t("dashboard.new.tabCatalog") },
        ]}
      />

      {/* ══ AI TAB ══════════════════════════════════════════════════════════
          APP-1d: the box the page is for comes first, then who it is for,
          then the options as one line. */}
      {activeTab === "ai" && (
        <div className="stack animate-in fade-in duration-200">
          {!online && (
            <div className="notice warn" role="status" data-testid="new-quote-offline">
              <WifiOff aria-hidden="true" />
              <span className="grow">
                {t("dashboard.new.offline.title")}
                <small>{t("dashboard.new.offline.desc")}</small>
              </span>
            </div>
          )}
          {draft.restoredAt !== null && online && (
            <div className="notice info" role="status" data-testid="new-quote-draft">
              <History aria-hidden="true" />
              <span className="grow">
                {fmt(t("dashboard.new.draft.restored"), { time: new Date(draft.restoredAt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}
                <small>{t("dashboard.new.draft.noFiles")}</small>
              </span>
              <span className="actions">
                <button type="button" className="btn btn-sm btn-outline-navy" onClick={discardDraft}>{t("dashboard.new.draft.discard")}</button>
              </span>
            </div>
          )}
          <div className="card composer comp-box">
            <label htmlFor="new-quote-describe" className="sr-only">{t("dashboard.new.inputPlaceholder")}</label>
            <textarea
              id="new-quote-describe"
              value={input}
              rows={4}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                // Enter is a new line in a box this size; Ctrl/⌘+Enter writes the quote.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canAiSubmit) {
                  e.preventDefault();
                  handleAiSubmit();
                }
              }}
              placeholder={t("dashboard.new.inputPlaceholder")}
              disabled={isAiSubmitting}
            />

            {/* Photo strip */}
            {photos.length > 0 && (
              <div className="att-strip">
                {photoPreviews.map((src, idx) => (
                  <div key={idx} className="att-thumb">
                    <img src={src} alt={`${t("dashboard.new.photoAlt")} ${idx + 1}`} />
                    <button type="button" onClick={() => removePhoto(idx)} disabled={isAiSubmitting} className="att-x" aria-label={t("dashboard.new.client.remove")}>
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Document strip */}
            {docs.length > 0 && (
              <div className="att-strip">
                {docs.map((file, idx) => (
                  <div key={idx} className="att-doc">
                    {file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? <FileSpreadsheet className="ic" /> : <FileText className="ic" />}
                    <span>{file.name}</span>
                    <button type="button" onClick={() => removeDoc(idx)} disabled={isAiSubmitting} className="att-x" aria-label={t("dashboard.new.client.remove")}>
                      <X />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tools inside the box: photo, microphone */}
            <div className="comp-tools">
              {photoAllowed ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAiSubmitting || attachmentsFull || photos.length >= maxPhotos}
                  title={fmt(t("dashboard.new.attachTooltip"), { maxPhotos, maxTotal: MAX_ATTACHMENTS })}
                  aria-label={fmt(t("dashboard.new.attachTooltip"), { maxPhotos, maxTotal: MAX_ATTACHMENTS })}
                  className="comp-mic"
                >
                  <ImagePlus className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <span className="comp-lock" title={t("dashboard.new.paidPlanOnly")} aria-label={t("dashboard.new.paidPlanOnly")} role="img">
                  <Lock className="h-4 w-4" />
                </span>
              )}
              <MicButton
                disabled={isAiSubmitting}
                onTranscribed={text => setInput(prev => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              />
            </div>
            {photoAllowed && photos.length === 0 && docs.length === 0 && (
              <div className="comp-hint">{planPhotoLabel} {t("dashboard.new.photoHintSuffix")}</div>
            )}

            {!input.trim() && (
              <div className="comp-ex">
                <span className="eyebrow">{t("dashboard.new.examplesLabel")}</span>
                {EXAMPLES.map(ex => (
                  <button key={ex.label} type="button" onClick={() => setInput(ex.text)} disabled={isAiSubmitting} className="pill">
                    {ex.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,.docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            disabled={isAiSubmitting}
          />

          {/* Client selector for AI tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
            disabled={isAiSubmitting}
          />

          <QuoteOptions
            templateId={templateId}
            onTemplate={chooseTemplate}
            isPro={!!isPro}
            onProRequired={() => toast({ title: t("dashboard.new.toast.proRequiredTitle"), description: t("dashboard.new.toast.proRequiredDesc"), variant: "destructive" })}
            target={targetTotalEur}
            onTarget={setTargetTotalEur}
            disabled={isAiSubmitting}
          />

          <StickyActionBar label={t("dashboard.new.title")}>
            <button type="button" className="btn btn-navy" onClick={handleAiSubmit} disabled={!canAiSubmit || !online} data-primary-action>
              {isAiSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : !online ? <WifiOff className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {isAiSubmitting ? t("quotes.m.writing") : !online ? t("dashboard.new.offline.button") : t("quotes.m.writeQuote")}
            </button>
          </StickyActionBar>
        </div>
      )}

      {/* ══ MANUAL TAB ══════════════════════════════════════════════════════ */}
      {activeTab === "manual" && (
        <div className="stack animate-in fade-in duration-200">
          {/* Client selector for manual tab */}
          <ClientSelector
            clientMode={clientMode}
            setClientMode={setClientMode}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientForm={clientForm}
            setClientForm={setClientForm}
            rememberClient={rememberClient}
            setRememberClient={setRememberClient}
            savedClients={savedClients}
            selectSavedClient={selectSavedClient}
            clearClient={clearClient}
          />

          <ManualQuoteBuilder
            clientData={clientData}
            profileData={profile ?? undefined}
          />
        </div>
      )}

      {/* ══ LISTINO TAB ═════════════════════════════════════════════════════ */}
      {activeTab === "listino" && (
        <div className="animate-in fade-in duration-200">
          <PriceCatalogSection />
        </div>
      )}
    </div>
  );
}
