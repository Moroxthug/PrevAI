import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2, Check, X, ExternalLink, Receipt, Wallet, Flag, ListTodo, Mail, Banknote, Loader2, AlertTriangle, Mic, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { assistantApi, type AssistantMessageDto, type ConversationDto, type ProposalDto, type ProposalKind } from "@/lib/assistant-api";
import { useAssistantPageContext } from "@/lib/assistant-context";
import { formatCents } from "@/lib/jobs-api";

const KIND_ICON: Record<ProposalKind, typeof Receipt> = { cost_entry: Wallet, milestone_update: Flag, task: ListTodo, invoice: Receipt, send_invoice: Mail, record_payment: Banknote };

/** The query that holds a thread: the main one (null) or an older per-job one. */
const threadKey = (threadId: string | null) => ["assistant", threadId ?? "main"];

/**
 * The assistant page: the company's threads on the left (APP-8a: the main
 * conversation first, then the older per-job ones, still readable and
 * continuable), the chat on the right.
 */
export function AssistantPanel({ className }: { className?: string }) {
  const { t } = useLanguage();
  const [threadId, setThreadId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ["assistant-threads"], queryFn: assistantApi.threads, retry: false });
  const threads = data?.conversations ?? [];
  const main = threads.find((c) => !c.projectId);
  const older = threads.filter((c) => c.projectId);
  const when = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT") : t("assistant.threadNew"));

  return (
    <div className={cn("chat-grid", className)}>
      <div className="card th-list">
        <div className="card-head"><div><h2>{t("assistant.threadsTitle")}</h2></div></div>
        <button type="button" className={cn("th-row", threadId === null && "on")} onClick={() => setThreadId(null)} aria-pressed={threadId === null}>
          <b>{t("assistant.threadCompany")}</b>
          <span>{when(main?.lastMessageAt)}</span>
        </button>
        {older.length > 0 && <p className="th-sub">{t("assistant.threadsOlder")}</p>}
        {older.map((c) => (
          <button key={c.id} type="button" className={cn("th-row", threadId === c.id && "on")} onClick={() => setThreadId(c.id)} aria-pressed={threadId === c.id}>
            <b>{c.projectName || c.title || t("assistant.threadJob")}</b>
            <span>{when(c.lastMessageAt)}</span>
          </button>
        ))}
      </div>
      <div className="card">
        <AssistantChat threadId={threadId} />
      </div>
    </div>
  );
}

/**
 * APP-8a — the conversation itself, the same everywhere: the assistant page,
 * a job's Assistente tab and the sheet that opens from the top bar. It sends
 * the screen it is on with every question, shows the answer as it is written
 * and what the assistant is looking up meanwhile, and takes dictation.
 * Writes still only happen through proposal cards the user confirms.
 */
export function AssistantChat({ threadId = null, compact, className }: { threadId?: string | null; compact?: boolean; className?: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const context = useAssistantPageContext();
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<{ user: string | null; text: string; progress: string | null } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const key = threadKey(threadId);
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => (threadId ? assistantApi.byId(threadId) : assistantApi.conversation(null)), retry: false });
  const gated = (error as (Error & { code?: string }) | null)?.code === "PLAN_REQUIRED";
  const busy = live !== null;

  useEffect(() => () => abortRef.current?.abort(), []);

  const invalidateData = () => {
    for (const k of ["job", "jobs", "job-analytics", "invoices", "invoice", "company-analytics"]) queryClient.invalidateQueries({ queryKey: [k] });
  };
  const patch = (fn: (prev: ConversationDto) => ConversationDto) => queryClient.setQueryData(key, (prev: ConversationDto | undefined) => (prev ? fn(prev) : prev));

  const ask = async (content: string) => {
    if (!data || busy) return;
    setDraft("");
    setLive({ user: content, text: "", progress: null });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await assistantApi.stream(data.conversation.id, content, context, (e) => {
        if (e.type === "delta") setLive((l) => (l ? { ...l, text: l.text + e.text, progress: null } : l));
        else if (e.type === "progress") setLive((l) => (l ? { ...l, progress: e.label } : l));
        else if (e.type === "proposal") patch((p) => ({ ...p, proposals: [...p.proposals, e.proposal] }));
        else {
          patch((p) => ({ ...p, messages: [...p.messages, e.message] }));
          // The stored copy replaces what was on screen: the question once saved, the text once the assistant's message is.
          setLive((l) => (l ? (e.message.role === "user" ? { ...l, user: null } : e.message.role === "assistant" ? { ...l, text: "" } : l) : l));
        }
      }, ctrl.signal);
    } catch (e) {
      if (!ctrl.signal.aborted) {
        toast({ title: t("assistant.error"), description: (e as Error).message, variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: key });
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLive(null);
      queryClient.invalidateQueries({ queryKey: ["assistant-threads"] });
    }
  };

  const patchProposal = (p: ProposalDto) => patch((prev) => ({ ...prev, proposals: prev.proposals.map((x) => (x.id === p.id ? p : x)) }));
  const confirm = useMutation({
    mutationFn: (id: string) => assistantApi.confirm(id),
    onSuccess: ({ proposal }) => { patchProposal(proposal); invalidateData(); toast({ title: t("assistant.applied"), description: proposal.summary }); },
    onError: (e: Error) => { toast({ title: t("assistant.applyFailed"), description: e.message, variant: "destructive" }); queryClient.invalidateQueries({ queryKey: key }); },
  });
  const dismiss = useMutation({ mutationFn: (id: string) => assistantApi.dismiss(id), onSuccess: ({ proposal }) => patchProposal(proposal) });
  const clear = useMutation({
    mutationFn: () => assistantApi.clear(data!.conversation.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ["assistant-threads"] }); },
  });

  const voice = useVoiceInput({
    onTranscribed: (text) => { setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text)); inputRef.current?.focus(); },
    onError: (message) => toast({ title: t("assistant.voiceError"), description: message, variant: "destructive" }),
  });

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [data?.messages.length, data?.proposals.length, live?.user, live?.text, live?.progress]);

  const visible = useMemo(() => (data?.messages ?? []).filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim())), [data]);
  const proposalsByMessage = useMemo(() => {
    const map = new Map<string, ProposalDto[]>();
    for (const p of data?.proposals ?? []) { const k = p.messageId ?? "orphan"; map.set(k, [...(map.get(k) ?? []), p]); }
    return map;
  }, [data]);
  // Proposal cards are attached to the tool-calling assistant turn, which is usually hidden; show them under the next visible assistant message.
  const cardsFor = (idx: number): ProposalDto[] => {
    const all = data?.messages ?? [];
    const msg = visible[idx]!;
    const pos = all.findIndex((m) => m.id === msg.id);
    const prevVisiblePos = idx > 0 ? all.findIndex((m) => m.id === visible[idx - 1]!.id) : -1;
    const out: ProposalDto[] = [];
    for (let i = prevVisiblePos + 1; i <= pos; i++) out.push(...(proposalsByMessage.get(all[i]!.id) ?? []));
    return out;
  };
  // While a turn streams, a card can arrive before the message it will sit under: show it at the end until then.
  const trailing = useMemo(() => {
    const all = data?.messages ?? [];
    const last = visible.length ? all.findIndex((m) => m.id === visible[visible.length - 1]!.id) : -1;
    return all.slice(last + 1).flatMap((m) => proposalsByMessage.get(m.id) ?? []);
  }, [data, visible, proposalsByMessage]);

  const submit = () => { const c = draft.trim(); if (c) void ask(c); };
  const kind = context.projectId ? "job" : context.quoteId ? "quote" : context.invoiceId ? "invoice" : "company";
  const suggestionKeys = { job: ["s1", "s2", "s3", "s4"], quote: ["q1", "q2", "q3"], invoice: ["i1", "i2", "i3"], company: ["c1", "c2", "c3", "c4"] }[kind];
  const suggestions = suggestionKeys.map((k) => t(`assistant.suggest.${k}`));
  const empty = data && visible.length === 0 && !live;
  const olderJobThread = Boolean(data?.conversation.projectId);

  if (gated) {
    return (
      <div className={cn("rounded-[var(--radius)] border border-navy-200 bg-navy-50 p-8 text-center", className)}>
        <Sparkles className="h-10 w-10 text-navy-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-900">{t("assistant.gatedTitle")}</h3>
        <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{t("assistant.gatedDesc")}</p>
        <Link href="/dashboard/billing" className="inline-block mt-4 text-sm font-semibold text-navy-700 hover:underline">{t("assistant.upgrade")}</Link>
      </div>
    );
  }

  return (
    <div className={cn("asst-chat", compact && "compact", className)}>
      <div className="chat-head">
        <div className="chat-head-main">
          <span className="chat-av"><Sparkles className="h-4 w-4" /></span>
          <div><b>{t("assistant.title")}</b><small>{t(`assistant.ctx.${kind}`)}</small></div>
        </div>
        {data && data.messages.length > 0 && !busy && (
          <button type="button" className="chat-clear" onClick={() => clear.mutate()} aria-label={t("assistant.clear")} disabled={clear.isPending}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> <span className="chat-clear-txt">{t("assistant.clear")}</span></button>
        )}
      </div>
      {/* AI Act art. 50: the user is told at first contact that this is an AI. */}
      <p className="chat-notice" role="note">{t("assistant.aiNotice")}</p>
      {olderJobThread && <p className="chat-notice">{t("assistant.olderThread")}</p>}

      <div ref={listRef} className="chat-body" aria-live="polite" aria-busy={busy}>
        {isLoading && <div className="bubble ai typing"><i /><i /><i /></div>}
        {empty && <div className="bubble ai">{kind === "job" ? t("assistant.emptyJob") : t("assistant.emptyCompany")}</div>}
        {visible.map((m, idx) => (
          <div key={m.id} className="contents">
            {m.role === "assistant" && cardsFor(idx).map((p) => <ProposalCard key={p.id} proposal={p} onConfirm={() => confirm.mutate(p.id)} onDismiss={() => dismiss.mutate(p.id)} busy={confirm.isPending && confirm.variables === p.id} />)}
            <Bubble message={m} />
          </div>
        ))}
        {trailing.map((p) => <ProposalCard key={p.id} proposal={p} onConfirm={() => confirm.mutate(p.id)} onDismiss={() => dismiss.mutate(p.id)} busy={confirm.isPending && confirm.variables === p.id} />)}
        {live?.user && <div className="bubble user">{live.user}</div>}
        {live && live.text && <div className="bubble ai"><Markdownish text={live.text} /></div>}
        {live && !live.text && (live.progress
          ? <div className="chat-progress"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{live.progress}…</div>
          : <div className="bubble ai typing" aria-label={t("assistant.thinking")}><i /><i /><i /></div>)}
      </div>

      {empty && (
        <div className="chat-sug">
          {suggestions.map((s) => <button key={s} type="button" className="pill" onClick={() => void ask(s)}>{s}</button>)}
        </div>
      )}

      <div className="chat-in">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={voice.isRecording ? t("assistant.listening") : voice.isTranscribing ? t("assistant.transcribing") : t("assistant.placeholder")}
          aria-label={t("assistant.placeholder")}
          disabled={!data || busy}
          enterKeyHint="send"
        />
        <button
          type="button"
          className={cn("comp-mic", voice.isRecording && "rec")}
          onClick={() => (voice.isRecording ? voice.stopRecording() : void voice.startRecording())}
          disabled={!data || busy || voice.isTranscribing}
          aria-label={voice.isRecording ? t("assistant.stopDictation") : t("assistant.dictate")}
          aria-pressed={voice.isRecording}
        >
          {voice.isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : voice.isRecording ? <><Square className="h-4 w-4" /><span className="rec-dot" /></> : <Mic className="h-4 w-4" />}
        </button>
        <button type="button" className="comp-send" onClick={submit} disabled={!draft.trim() || !data || busy} aria-label={t("assistant.send")}>
          <Send className="chev" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AssistantMessageDto }) {
  const mine = message.role === "user";
  return (
    <div className={cn("bubble", mine ? "user" : "ai")}>
      {mine ? message.content : <Markdownish text={message.content} />}
    </div>
  );
}

/** Tiny renderer: paragraphs, "- " bullets, **bold**. Enough for the assistant's prose without pulling a markdown lib. */
function Markdownish({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { list.push(m[1]!); continue; }
    flush();
    if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <>{blocks}</>;
}

function inline(s: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

function ProposalCard({ proposal, onConfirm, onDismiss, busy }: { proposal: ProposalDto; onConfirm: () => void; onDismiss: () => void; busy: boolean }) {
  const { t } = useLanguage();
  const Icon = KIND_ICON[proposal.kind] ?? Receipt;
  const p = proposal.payload;
  const details: string[] = [];
  if (proposal.kind === "cost_entry") details.push(`${formatCents(Number(p.subtotalCents))} + ${t("assistant.tax")} ${formatCents(Number(p.taxCents))} = ${formatCents(Number(p.totalCents))}`, String(p.date ?? ""), String(p.description ?? ""));
  if (proposal.kind === "record_payment") details.push(`${formatCents(Number(p.amountCents))} · ${t(`invoices.method.${String(p.method)}`)} · ${String(p.date ?? "")}`);
  if (proposal.kind === "milestone_update" && p.releasesPaymentTerm) details.push(`${t("assistant.releases")} ${String(p.releasesPaymentTerm)}`);
  if (proposal.kind === "send_invoice" && p.message) details.push(`"${String(p.message)}"`);
  const tab = proposal.kind === "cost_entry" ? "costs" : proposal.kind === "milestone_update" || proposal.kind === "task" ? "schedule" : "invoices";
  const link = proposal.resultEntityType === "invoice" && proposal.resultEntityId ? `/dashboard/invoices/${proposal.resultEntityId}` : proposal.projectId ? `/dashboard/jobs/${proposal.projectId}?tab=${tab}` : null;
  const status = proposal.status;
  return (
    <div className={cn("prop-card", status)}>
      <div className="prop-head">
        <span className="prop-ic"><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="prop-kind">{t(`assistant.kind.${proposal.kind}`)}</div>
          <div className="prop-summary">{proposal.summary}</div>
          {details.filter(Boolean).map((d, i) => <div key={i} className="prop-detail">{d}</div>)}
          {status === "failed" && proposal.error && <div className="prop-detail" style={{ color: "var(--red)" }}><AlertTriangle className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} />{proposal.error}</div>}
        </div>
      </div>
      <div className="prop-actions">
        {status === "pending" && (
          <>
            <button type="button" className="btn btn-navy btn-sm" onClick={onConfirm} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("assistant.confirm")}
            </button>
            <button type="button" className="prop-dismiss" onClick={onDismiss} disabled={busy}><X className="h-3.5 w-3.5" /> {t("assistant.dismiss")}</button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <span className="prop-status ok"><Check className="h-3.5 w-3.5" /> {t("assistant.confirmed")}</span>
            {link && <Link href={link} className="prop-dismiss"><ExternalLink className="h-3 w-3" /> {t("assistant.open")}</Link>}
          </>
        )}
        {status === "dismissed" && <span className="prop-status muted">{t("assistant.dismissed")}</span>}
        {status === "failed" && <span className="prop-status err">{t("assistant.failed")}</span>}
      </div>
    </div>
  );
}
