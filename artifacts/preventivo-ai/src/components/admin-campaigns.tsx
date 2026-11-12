import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// EMAIL-2: campagne email agli utenti PrevAI. Scrivi a blocchi, guardi
// l'anteprima (chiaro / scuro), mandi una prova a te stesso, poi avvii.
// L'invio va a lotti di 100: la pagina continua finché non resta nessuno;
// se la chiudi, il cron del giorno finisce il lavoro.

type Tone = "brand" | "success" | "warning" | "danger" | "info";
type Block =
  | { type: "text"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; src: string; alt: string; href?: string }
  | { type: "checklist"; items: string[] }
  | { type: "features"; items: Array<{ title: string; text: string }> }
  | { type: "callout"; text: string; tone?: Tone }
  | { type: "quote"; text: string; author?: string }
  | { type: "button"; label: string; href: string; variant?: "primary" | "dark" | "ghost" }
  | { type: "divider" }
  | { type: "prices"; title: string; note?: string; rows: Array<{ label: string; value: string }>; total?: { label: string; value: string } };
type Content = {
  subject: string;
  preheader: string;
  heading: string;
  lead?: string;
  blocks: Block[];
  cta?: { label: string; href: string };
};
type Campaign = {
  id: string;
  name: string;
  subject: string;
  content: Content;
  audience: string;
  status: "bozza" | "in_invio" | "inviata" | "annullata";
  testSentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  recipientsTotal: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
};
type Audience = { id: string; label: string; description: string };
type ListResponse = { campaigns: Campaign[]; audiences: Audience[]; senderIdentity: string | null; examples: Record<string, Content> };
type Draft = { id: string | null; name: string; audience: string; content: Content; testSentAt: string | null; status: Campaign["status"] };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
  return body as T;
}

const STATUS: Record<Campaign["status"], { label: string; cls: string }> = {
  bozza: { label: "Bozza", cls: "bg-slate-100 text-slate-600" },
  in_invio: { label: "In invio", cls: "bg-amber-50 text-amber-700" },
  inviata: { label: "Inviata", cls: "bg-emerald-50 text-emerald-700" },
  annullata: { label: "Annullata", cls: "bg-red-50 text-red-600" },
};

const BLOCK_LABEL: Record<Block["type"], string> = {
  text: "Testo",
  heading: "Titoletto",
  image: "Immagine",
  checklist: "Elenco con spunte",
  features: "Riquadri (2 per riga)",
  callout: "Box evidenziato",
  quote: "Citazione",
  button: "Pulsante",
  divider: "Separatore",
  prices: "Elenco prezzi",
};

function emptyBlock(type: Block["type"]): Block {
  switch (type) {
    case "text":
    case "heading":
      return { type, text: "" };
    case "image":
      return { type, src: "https://", alt: "" };
    case "checklist":
      return { type, items: [""] };
    case "features":
      return { type, items: [{ title: "", text: "" }] };
    case "callout":
      return { type, text: "", tone: "brand" };
    case "quote":
      return { type, text: "" };
    case "button":
      return { type, label: "", href: "https://prevai.it/dashboard", variant: "primary" };
    case "divider":
      return { type };
    case "prices":
      return { type, title: "", rows: [{ label: "", value: "" }] };
  }
}

const blank = (): Draft => ({
  id: null,
  name: "",
  audience: "tutti",
  status: "bozza",
  testSentAt: null,
  content: { subject: "", preheader: "", heading: "", lead: "", blocks: [{ type: "text", text: "" }], cta: { label: "Vai alla dashboard", href: "https://prevai.it/dashboard" } },
});

/** Drops empty optional parts so the server's validation sees clean content. */
function clean(c: Content): Content {
  const out: Content = { subject: c.subject.trim(), preheader: c.preheader.trim(), heading: c.heading.trim(), blocks: c.blocks };
  if (c.lead?.trim()) out.lead = c.lead.trim();
  if (c.cta?.label.trim() && c.cta.href.trim()) out.cta = { label: c.cta.label.trim(), href: c.cta.href.trim() };
  out.blocks = c.blocks
    .map((b) => (b.type === "checklist" ? { ...b, items: b.items.map((i) => i.trim()).filter(Boolean) } : b.type === "features" ? { ...b, items: b.items.filter((i) => i.title.trim()) } : b.type === "image" && !b.href ? { type: b.type, src: b.src, alt: b.alt } : b.type === "prices" ? cleanPrices(b) : b))
    .filter((b) => !("text" in b) || b.text.trim() !== "");
  return out;
}

const input = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200";
const btn = "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed";

export function AdminCampaigns() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["admin", "campaigns"], queryFn: () => api<ListResponse>("/api/admin/campaigns") });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [identity, setIdentity] = useState("");
  const data = list.data;

  useEffect(() => {
    if (data?.senderIdentity != null) setIdentity(data.senderIdentity);
  }, [data?.senderIdentity]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });

  async function run<T>(label: string, fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(label);
    setMsg(null);
    try {
      const r = await fn();
      if (ok) setMsg({ kind: "ok", text: ok });
      return r;
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function saveIdentity() {
    await run("identity", () => api("/api/admin/campaigns/sender-identity", { method: "PUT", body: JSON.stringify({ value: identity }) }), "Identità del mittente salvata.");
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Campagne email</h2>
          <p className="text-xs text-slate-500">Email promozionali ai tuoi utenti. Ogni email ha il link per disiscriversi; chi si disiscrive, è stato cancellato o ha fatto rimbalzare un'email non la riceve.</p>
        </div>
        {!draft && (
          <div className="flex flex-wrap gap-2">
            {data &&
              Object.entries(data.examples).map(([id, c]) => (
                <button key={id} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => setDraft({ ...blank(), name: c.subject, audience: id === "attivazione" ? "senza_preventivi" : "tutti", content: structuredClone(c) as Content })}>
                  Esempio: {id}
                </button>
              ))}
            <button className={`${btn} bg-violet-600 text-white hover:bg-violet-700`} onClick={() => setDraft(blank())}>
              Nuova campagna
            </button>
          </div>
        )}
      </div>

      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

      <div className={`rounded-2xl border p-4 ${data && !data.senderIdentity ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"}`}>
        <p className="text-sm font-semibold text-slate-800">Mittente delle email promozionali</p>
        <p className="text-xs text-slate-500 mb-2">Obbligatorio per legge (D.Lgs. 70/2003): ragione sociale, sede e P.IVA. Compare in fondo a ogni campagna. Senza, le campagne non partono.</p>
        <div className="flex gap-2">
          <input className={input} placeholder="Es. PrevAI di Mario Rossi · Via Roma 1, 20121 Milano · P.IVA 01234567890" value={identity} onChange={(e) => setIdentity(e.target.value)} />
          <button className={`${btn} bg-slate-800 text-white`} disabled={busy === "identity" || identity.trim().length < 10} onClick={saveIdentity}>
            Salva
          </button>
        </div>
      </div>

      {list.isError && <p className="text-sm text-red-600">{(list.error as Error).message}</p>}

      {draft ? (
        <Editor
          draft={draft}
          setDraft={setDraft}
          audiences={data?.audiences ?? []}
          busy={busy}
          run={run}
          onDone={() => {
            setDraft(null);
            refresh();
          }}
          refresh={refresh}
          hasIdentity={!!data?.senderIdentity}
        />
      ) : (
        <CampaignList campaigns={data?.campaigns ?? []} audiences={data?.audiences ?? []} onOpen={(c) => setDraft({ id: c.id, name: c.name, audience: c.audience, content: c.content, testSentAt: c.testSentAt, status: c.status })} />
      )}
    </div>
  );
}

function CampaignList({ campaigns, audiences, onOpen }: { campaigns: Campaign[]; audiences: Audience[]; onOpen: (c: Campaign) => void }) {
  if (campaigns.length === 0) return <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 p-6 text-center">Nessuna campagna ancora. Parti da un esempio o creane una nuova.</p>;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="text-left px-4 py-2">Campagna</th>
            <th className="text-left px-4 py-2">Pubblico</th>
            <th className="text-left px-4 py-2">Stato</th>
            <th className="text-right px-4 py-2">Inviate</th>
            <th className="text-right px-4 py-2">Data</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(c)}>
              <td className="px-4 py-3">
                <div className="font-semibold text-slate-800">{c.name}</div>
                <div className="text-xs text-slate-500 truncate max-w-xs">{c.subject}</div>
              </td>
              <td className="px-4 py-3 text-slate-600">{audiences.find((a) => a.id === c.audience)?.label ?? c.audience}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold rounded-full px-2 py-1 ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                {c.status === "bozza" ? "—" : `${c.sentCount}/${c.recipientsTotal}`}
                {c.failedCount > 0 && <span className="text-red-600"> · {c.failedCount} fallite</span>}
              </td>
              <td className="px-4 py-3 text-right text-xs text-slate-500">{new Date(c.startedAt ?? c.createdAt).toLocaleDateString("it-IT")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Editor(props: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  audiences: Audience[];
  busy: string | null;
  run: <T>(label: string, fn: () => Promise<T>, ok?: string) => Promise<T | undefined>;
  onDone: () => void;
  refresh: () => void;
  hasIdentity: boolean;
}) {
  const { draft, setDraft, audiences, busy, run, onDone, refresh, hasIdentity } = props;
  const c = draft.content;
  const editable = draft.status === "bozza";
  // A draft never saved (new, or loaded from an example) is unsaved work.
  const [dirty, setDirty] = useState(!draft.id);
  const [html, setHtml] = useState("");
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const [count, setCount] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const stop = useRef(false);

  const setContent = (patch: Partial<Content>) => {
    setDraft({ ...draft, content: { ...c, ...patch } });
    setDirty(true);
  };
  const setBlock = (i: number, b: Block) => setContent({ blocks: c.blocks.map((x, j) => (j === i ? b : x)) });
  const moveBlock = (i: number, d: -1 | 1) => {
    const bs = [...c.blocks];
    const j = i + d;
    if (j < 0 || j >= bs.length) return;
    [bs[i], bs[j]] = [bs[j]!, bs[i]!];
    setContent({ blocks: bs });
  };

  const payload = useMemo(() => clean(c), [c]);

  // Live preview (debounced).
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api<{ html: string }>("/api/admin/campaigns/preview", { method: "POST", body: JSON.stringify({ content: payload }) });
        setHtml(r.html);
        setPreviewErr(null);
      } catch (e) {
        setPreviewErr((e as Error).message === "INVALID" ? "Completa oggetto, titolo e i blocchi (i link devono iniziare con https://)." : (e as Error).message);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [payload]);

  useEffect(() => {
    setCount(null);
    api<{ count: number }>(`/api/admin/campaigns/audiences/${draft.audience}`).then((r) => setCount(r.count), () => setCount(null));
  }, [draft.audience]);

  async function save(): Promise<string | undefined> {
    const body = JSON.stringify({ name: draft.name.trim() || c.subject, audience: draft.audience, content: payload });
    const r = await run(
      "save",
      () => (draft.id ? api<{ campaign: Campaign }>(`/api/admin/campaigns/${draft.id}`, { method: "PUT", body }) : api<{ campaign: Campaign }>("/api/admin/campaigns", { method: "POST", body })),
      "Bozza salvata.",
    );
    if (!r) return undefined;
    setDraft({ ...draft, id: r.campaign.id, name: r.campaign.name, testSentAt: r.campaign.testSentAt, status: r.campaign.status });
    setDirty(false);
    refresh();
    return r.campaign.id;
  }

  async function test() {
    const id = dirty || !draft.id ? await save() : draft.id;
    if (!id) return;
    const r = await run("test", () => api<{ to: string }>(`/api/admin/campaigns/${id}/test`, { method: "POST" }));
    if (r) {
      setDraft({ ...draft, id, testSentAt: new Date().toISOString() });
      run("noop", async () => undefined, `Prova inviata a ${r.to}. Controllala sul telefono, anche in modalità scura.`);
      refresh();
    }
  }

  async function loop(id: string, first: { campaign: Campaign; progress: { remaining: number } }) {
    let r = first;
    stop.current = false;
    setProgress({ sent: r.campaign.sentCount, failed: r.campaign.failedCount, total: r.campaign.recipientsTotal });
    while (r.progress.remaining > 0 && r.campaign.status === "in_invio" && !stop.current) {
      const next = await run("process", () => api<{ campaign: Campaign; progress: { remaining: number } }>(`/api/admin/campaigns/${id}/process`, { method: "POST" }));
      if (!next) return;
      r = next;
      setProgress({ sent: r.campaign.sentCount, failed: r.campaign.failedCount, total: r.campaign.recipientsTotal });
    }
    setDraft({ ...draft, id, status: r.campaign.status });
    refresh();
    if (r.campaign.status === "inviata") run("noop", async () => undefined, `Campagna inviata: ${r.campaign.sentCount} email${r.campaign.failedCount ? `, ${r.campaign.failedCount} non partite` : ""}.`);
  }

  async function start() {
    if (!draft.id) return;
    setConfirm(false);
    const r = await run("start", () => api<{ campaign: Campaign; progress: { remaining: number } }>(`/api/admin/campaigns/${draft.id}/start`, { method: "POST" }));
    if (r) await loop(draft.id, r);
  }

  async function resume() {
    if (!draft.id) return;
    const r = await run("process", () => api<{ campaign: Campaign; progress: { remaining: number } }>(`/api/admin/campaigns/${draft.id}/process`, { method: "POST" }));
    if (r) await loop(draft.id, r);
  }

  async function cancel() {
    if (!draft.id || !window.confirm("Fermare la campagna? Chi non l'ha ancora ricevuta non la riceverà.")) return;
    stop.current = true;
    await run("cancel", () => api(`/api/admin/campaigns/${draft.id}/cancel`, { method: "POST" }), "Campagna fermata.");
    setDraft({ ...draft, status: "annullata" });
    refresh();
  }

  async function remove() {
    if (!draft.id || !window.confirm("Eliminare questa bozza?")) return;
    await run("delete", () => api(`/api/admin/campaigns/${draft.id}`, { method: "DELETE" }), "Bozza eliminata.");
    onDone();
  }

  const canStart = editable && !!draft.id && !dirty && !!draft.testSentAt && hasIdentity && (count ?? 0) > 0;
  const startHint = !draft.id || dirty ? "Salva la bozza" : !draft.testSentAt ? "Manda prima una prova a te stesso" : !hasIdentity ? "Imposta il mittente qui sopra" : count === 0 ? "Nessun destinatario" : null;

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <button className="text-sm text-slate-500 hover:text-slate-800" onClick={onDone}>
          ← Tutte le campagne
        </button>

        <fieldset disabled={!editable} className="space-y-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <Field label="Nome interno">
            <input className={input} value={draft.name} placeholder="Es. Attivazione novembre" onChange={(e) => (setDraft({ ...draft, name: e.target.value }), setDirty(true))} />
          </Field>
          <Field label="Pubblico" hint={audiences.find((a) => a.id === draft.audience)?.description}>
            <div className="flex items-center gap-3">
              <select className={input} value={draft.audience} onChange={(e) => (setDraft({ ...draft, audience: e.target.value }), setDirty(true))}>
                {audiences.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">{count == null ? "…" : `${count} persone`}</span>
            </div>
          </Field>
          <Field label="Oggetto" hint="Corto e concreto: è la prima cosa che si legge.">
            <input className={input} value={c.subject} maxLength={150} onChange={(e) => setContent({ subject: e.target.value })} />
          </Field>
          <Field label="Anteprima nella casella" hint="Il testo grigio accanto all'oggetto.">
            <input className={input} value={c.preheader} maxLength={200} onChange={(e) => setContent({ preheader: e.target.value })} />
          </Field>
          <Field label="Titolo">
            <input className={input} value={c.heading} maxLength={150} onChange={(e) => setContent({ heading: e.target.value })} />
          </Field>
          <Field label="Introduzione">
            <textarea className={input} rows={2} value={c.lead ?? ""} onChange={(e) => setContent({ lead: e.target.value })} />
          </Field>
        </fieldset>

        <fieldset disabled={!editable} className="space-y-3">
          {c.blocks.map((b, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{BLOCK_LABEL[b.type]}</span>
                <span className="flex gap-1 text-slate-400">
                  <button className="px-2 hover:text-slate-800" onClick={() => moveBlock(i, -1)} aria-label="Su">↑</button>
                  <button className="px-2 hover:text-slate-800" onClick={() => moveBlock(i, 1)} aria-label="Giù">↓</button>
                  <button className="px-2 hover:text-red-600" onClick={() => setContent({ blocks: c.blocks.filter((_, j) => j !== i) })} aria-label="Elimina">✕</button>
                </span>
              </div>
              <BlockEditor block={b} onChange={(nb) => setBlock(i, nb)} />
            </div>
          ))}
          {editable && (
            <select className={`${input} bg-slate-50`} value="" onChange={(e) => e.target.value && setContent({ blocks: [...c.blocks, emptyBlock(e.target.value as Block["type"])] })}>
              <option value="">+ Aggiungi un blocco…</option>
              {Object.entries(BLOCK_LABEL).map(([t, l]) => (
                <option key={t} value={t}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </fieldset>

        <fieldset disabled={!editable} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm grid grid-cols-2 gap-2">
          <Field label="Pulsante finale">
            <input className={input} value={c.cta?.label ?? ""} onChange={(e) => setContent({ cta: { label: e.target.value, href: c.cta?.href ?? "https://prevai.it/dashboard" } })} />
          </Field>
          <Field label="Link">
            <input className={input} value={c.cta?.href ?? ""} onChange={(e) => setContent({ cta: { label: c.cta?.label ?? "", href: e.target.value } })} />
          </Field>
        </fieldset>

        <div className="sticky bottom-3 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 p-3 shadow-lg space-y-2">
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} border border-slate-200 bg-white text-slate-700`} disabled={!!busy || !dirty} onClick={save}>
                {busy === "save" ? "Salvo…" : "Salva bozza"}
              </button>
              <button className={`${btn} border border-violet-200 bg-violet-50 text-violet-700`} disabled={!!busy || !!previewErr} onClick={test}>
                {busy === "test" ? "Invio…" : draft.testSentAt && !dirty ? "Rimanda la prova" : "Invia una prova a me"}
              </button>
              <button className={`${btn} bg-violet-600 text-white`} disabled={!canStart || !!busy} onClick={() => setConfirm(true)} title={startHint ?? ""}>
                Avvia l'invio
              </button>
              {draft.id && (
                <button className={`${btn} text-red-600 ml-auto`} disabled={!!busy} onClick={remove}>
                  Elimina
                </button>
              )}
            </div>
          )}
          {editable && startHint && <p className="text-xs text-slate-500">Per avviare: {startHint.toLowerCase()}.</p>}
          {confirm && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 space-y-2">
              <p>
                Stai per inviare <strong>«{c.subject}»</strong> a <strong>{count} persone</strong> ({audiences.find((a) => a.id === draft.audience)?.label}). Non si può annullare per chi l'ha già ricevuta.
              </p>
              <div className="flex gap-2">
                <button className={`${btn} bg-violet-600 text-white`} onClick={start}>
                  Sì, invia ora
                </button>
                <button className={`${btn} bg-white border border-slate-200 text-slate-700`} onClick={() => setConfirm(false)}>
                  Annulla
                </button>
              </div>
            </div>
          )}
          {(draft.status === "in_invio" || progress) && (
            <div className="space-y-2">
              {progress && (
                <>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-violet-600 transition-all" style={{ width: `${progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 tabular-nums">
                    {progress.sent} inviate su {progress.total}
                    {progress.failed > 0 && ` · ${progress.failed} non partite`}
                  </p>
                </>
              )}
              {draft.status === "in_invio" && (
                <div className="flex gap-2">
                  {busy !== "process" && busy !== "start" && (
                    <button className={`${btn} bg-violet-600 text-white`} onClick={resume}>
                      Continua l'invio
                    </button>
                  )}
                  <button className={`${btn} text-red-600`} onClick={cancel}>
                    Ferma la campagna
                  </button>
                </div>
              )}
            </div>
          )}
          {!editable && draft.status !== "in_invio" && <p className="text-xs text-slate-500">Campagna {STATUS[draft.status].label.toLowerCase()}: non si può più modificare.</p>}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Anteprima</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {(["light", "dark"] as const).map((s) => (
              <button key={s} className={`px-3 py-1 ${scheme === s ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`} onClick={() => setScheme(s)}>
                {s === "light" ? "Chiaro" : "Scuro"}
              </button>
            ))}
          </div>
        </div>
        {previewErr && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{previewErr}</p>}
        <iframe title="Anteprima email" srcDoc={html} sandbox="" className="w-full h-[78vh] rounded-2xl border border-slate-200 bg-white" style={{ colorScheme: scheme }} />
      </div>
    </div>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function ToneSelect({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value as Tone)}>
      <option value="brand">Viola</option>
      <option value="info">Verde acqua</option>
      <option value="success">Verde</option>
      <option value="warning">Arancio</option>
      <option value="danger">Rosso</option>
    </select>
  );
}

function BlockEditor({ block: b, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (b.type) {
    case "text":
      return <textarea className={input} rows={4} value={b.text} placeholder="Riga vuota = nuovo paragrafo. **parola** = grassetto." onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "heading":
      return <input className={input} value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "image":
      return (
        <div className="space-y-2">
          <input className={input} value={b.src} placeholder="https://… (immagine larga 1040 px)" onChange={(e) => onChange({ ...b, src: e.target.value })} />
          <input className={input} value={b.alt} placeholder="Descrizione (per chi non vede le immagini)" onChange={(e) => onChange({ ...b, alt: e.target.value })} />
          <input className={input} value={b.href ?? ""} placeholder="Link al clic (facoltativo)" onChange={(e) => onChange({ ...b, href: e.target.value || undefined })} />
        </div>
      );
    case "checklist":
      return <textarea className={input} rows={4} value={b.items.join("\n")} placeholder="Una voce per riga" onChange={(e) => onChange({ ...b, items: e.target.value.split("\n") })} />;
    case "features":
      return (
        <textarea
          className={input}
          rows={4}
          value={b.items.map((i) => `${i.title} | ${i.text}`).join("\n")}
          placeholder="Titolo | testo — un riquadro per riga"
          onChange={(e) =>
            onChange({
              ...b,
              items: e.target.value.split("\n").map((l) => {
                const [title, ...rest] = l.split("|");
                return { title: (title ?? "").trim(), text: rest.join("|").trim() };
              }),
            })
          }
        />
      );
    case "callout":
      return (
        <div className="space-y-2">
          <textarea className={input} rows={2} value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />
          <ToneSelect value={b.tone ?? "brand"} onChange={(tone) => onChange({ ...b, tone })} />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <textarea className={input} rows={2} value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />
          <input className={input} value={b.author ?? ""} placeholder="Autore (facoltativo)" onChange={(e) => onChange({ ...b, author: e.target.value || undefined })} />
        </div>
      );
    case "button":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input className={input} value={b.label} placeholder="Testo" onChange={(e) => onChange({ ...b, label: e.target.value })} />
          <input className={input} value={b.href} placeholder="https://…" onChange={(e) => onChange({ ...b, href: e.target.value })} />
        </div>
      );
    case "divider":
      return null;
    case "prices":
      return (
        <div className="space-y-2">
          <input className={input} value={b.title} placeholder="Titolo (es. Rifacimento bagno 6 m²)" onChange={(e) => onChange({ ...b, title: e.target.value })} />
          <input className={input} value={b.note ?? ""} placeholder="Nota sotto il titolo (facoltativa)" onChange={(e) => onChange({ ...b, note: e.target.value || undefined })} />
          <textarea
            className={input}
            rows={4}
            value={b.rows.map((r) => `${r.label} | ${r.value}`).join("\n")}
            placeholder="Voce | importo — una per riga"
            onChange={(e) => onChange({ ...b, rows: e.target.value.split("\n").map(splitPair).map(([label, value]) => ({ label, value })) })}
          />
          <input
            className={input}
            value={b.total ? `${b.total.label} | ${b.total.value}` : ""}
            placeholder="Totale | importo (facoltativo)"
            onChange={(e) => {
              const [label, value] = splitPair(e.target.value);
              onChange({ ...b, total: label || value ? { label, value } : undefined });
            }}
          />
        </div>
      );
  }
}

function splitPair(line: string): [string, string] {
  const [a, ...rest] = line.split("|");
  return [(a ?? "").trim(), rest.join("|").trim()];
}

function cleanPrices(b: Extract<Block, { type: "prices" }>): Block {
  const out: Extract<Block, { type: "prices" }> = { type: "prices", title: b.title.trim(), rows: b.rows.filter((r) => r.label && r.value) };
  if (b.note?.trim()) out.note = b.note.trim();
  if (b.total?.label && b.total.value) out.total = b.total;
  return out;
}
