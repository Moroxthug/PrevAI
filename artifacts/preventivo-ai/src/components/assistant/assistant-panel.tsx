import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2, Check, X, ExternalLink, Receipt, Wallet, Flag, ListTodo, Mail, Banknote, Loader2, AlertTriangle, Mic, Square, Undo2, FileText, Send as SendIcon, FileSignature, MessageSquare, UserPen, StickyNote, Pencil, RotateCcw, WifiOff, Volume2, VolumeX, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useOnline } from "@/hooks/use-quote-draft";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { assistantApi, type AssistantMessageDto, type ConversationDto, type ProposalDto, type ProposalKind } from "@/lib/assistant-api";
import { useAssistantPageContext } from "@/lib/assistant-context";
import { formatCents } from "@/lib/jobs-api";
import { ASSISTANT_UNDO_SECONDS, SentenceChunker, classifyVoiceReply, voiceConfirmation, voiceNeedsTap } from "@workspace/config";
import { useBargeIn, useSpeaker, useVoiceInfo, useVoicePrefs } from "@/lib/assistant-voice";
import { useMediaQuery } from "@/hooks/use-media-query";
import { VoiceNoteSheet } from "@/components/jobs/voice-note-sheet";
import { CallQr } from "./call-qr";

const KIND_ICON: Record<ProposalKind, typeof Receipt> = { cost_entry: Wallet, milestone_update: Flag, task: ListTodo, invoice: Receipt, send_invoice: Mail, record_payment: Banknote, draft_quote: FileText, send_quote: SendIcon, send_contract: FileSignature, reply_lead: MessageSquare, message_client: Mail, update_client: UserPen, job_note: StickyNote, call: Phone };

/** APP-8g: a phone or tablet opens the dialer; a computer shows the number and a QR. */
const touchDevice = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
const openDialer = (p: ProposalDto) => { if (touchDevice() && typeof p.payload.phone === "string") window.location.assign(`tel:${p.payload.phone}`); };

/** The page a done card opens (APP-8c adds quotes, contracts, leads, clients, job notes). */
function proposalLink(p: ProposalDto): string | null {
  if (p.kind === "call") return null; // the card has its own Chiama button
  const id = p.resultEntityId;
  if (id && p.resultEntityType === "invoice") return `/dashboard/invoices/${id}`;
  if (id && p.resultEntityType === "quote") return `/dashboard/quotes/${id}`;
  if (id && p.resultEntityType === "contract") return `/dashboard/contracts/${id}`;
  if (p.resultEntityType === "lead") return "/dashboard/leads";
  if (p.resultEntityType === "client") return "/dashboard/clients";
  if (p.kind === "message_client") return null;
  const tab = p.kind === "cost_entry" ? "costs" : p.kind === "milestone_update" || p.kind === "task" ? "schedule" : p.kind === "job_note" ? null : "invoices";
  return p.projectId ? `/dashboard/jobs/${p.projectId}${tab ? `?tab=${tab}` : ""}` : null;
}

/** APP-8f: the last card that ran by itself and can still be undone ("annulla" said or typed). */
function undoableNow(proposals: readonly ProposalDto[]): ProposalDto | null {
  const now = Date.now();
  const live = proposals.filter((p) => p.status === "confirmed" && p.auto && p.undoUntil && new Date(p.undoUntil).getTime() > now && now - new Date(p.resolvedAt ?? p.createdAt).getTime() < ASSISTANT_UNDO_SECONDS * 1000);
  return live[live.length - 1] ?? null;
}

const euro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions).format(cents / 100);

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
      <div className={cn("card th-list", older.length > 0 && "has-older")} role="group" aria-label={t("assistant.threadsTitle")}>
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
 * Writes happen through cards: confirmed by the person, or — APP-8b, when the
 * owner chose "Lo fa" for that action — carried out at once with Annulla.
 */
export function AssistantChat({ threadId = null, compact, startDictation, className }: { threadId?: string | null; compact?: boolean; startDictation?: boolean; className?: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const context = useAssistantPageContext();
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<{ user: string | null; text: string; progress: string | null } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [, navigate] = useLocation();
  // APP-8d — the states around a turn: the question that failed (Riprova), the one kept while offline, the card being changed.
  const online = useOnline();
  const [failed, setFailed] = useState<{ content: string; message: string } | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProposalDto | null>(null);
  // APP-8g — after a call: the dictated note (on the job of the call), and the spoken "Aggiungo una nota?" waiting for a yes.
  const [noteFor, setNoteFor] = useState<{ job: { id: string; name: string }; text: string } | null>(null);
  const [askNote, setAskNote] = useState<ProposalDto | null>(null);
  const lastCall = useRef<{ proposal: ProposalDto; left: boolean } | null>(null);
  // APP-8e — the answer out loud: "Conversazione a voce" always, "A voce quando detti" when the question came from the microphone.
  const [voicePrefs, setVoicePrefs] = useVoicePrefs();
  // Always read: it also carries the owner's threshold for a "sì" said out loud (APP-8f).
  const voiceInfo = useVoiceInfo();
  const { speaker, speaking } = useSpeaker(voiceInfo.provider === "openai");
  const dictatedRef = useRef(false);
  const lastOnMode = useRef(voicePrefs.mode === "off" ? "dictated" : voicePrefs.mode);
  if (voicePrefs.mode !== "off") lastOnMode.current = voicePrefs.mode;

  const key = threadKey(threadId);
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => (threadId ? assistantApi.byId(threadId) : assistantApi.conversation(null)), retry: false });
  const gated = (error as (Error & { code?: string }) | null)?.code === "PLAN_REQUIRED";
  const busy = live !== null;

  useEffect(() => () => abortRef.current?.abort(), []);

  const invalidateData = () => {
    for (const k of ["job", "jobs", "job-analytics", "invoices", "invoice", "company-analytics", "leads", "job-notes"]) queryClient.invalidateQueries({ queryKey: [k] });
    // APP-8c: quotes, clients and contracts live under the generated client's "/api/…" keys.
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && /^\/api\/(quotes|clients|contracts)/.test(q.queryKey[0]) });
  };
  const patch = (fn: (prev: ConversationDto) => ConversationDto) => queryClient.setQueryData(key, (prev: ConversationDto | undefined) => (prev ? fn(prev) : prev));

  const ask = async (content: string, spoken = voicePrefs.mode === "always") => {
    if (!data || busy) return;
    setDraft("");
    dictatedRef.current = false;
    setFailed(null);
    // Offline: kept and asked when the network is back. Whatever it leads to, a send still waits for Conferma.
    if (!online) { setQueued(content); return; }
    setLive({ user: content, text: "", progress: null });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const chunker = spoken ? new SentenceChunker() : null;
    if (chunker) { speaker.begin(); try { performance.mark("asst-voice:sent"); } catch { /* old browsers */ } }
    // APP-8c: open_screen — go there once the answer is over (leaving the page closes the panel, which would stop it).
    const nav = { to: null as string | null };
    const newCards: ProposalDto[] = [];
    try {
      await assistantApi.stream(data.conversation.id, content, context, (e) => {
        if (e.type === "delta") {
          setLive((l) => (l ? { ...l, text: l.text + e.text, progress: null } : l));
          for (const sentence of chunker?.push(e.text) ?? []) speaker.enqueue(sentence);
        }
        else if (e.type === "progress") setLive((l) => (l ? { ...l, progress: e.label } : l));
        else if (e.type === "navigate") nav.to = e.path;
        else if (e.type === "proposal") {
          patch((p) => ({ ...p, proposals: [...p.proposals, e.proposal] }));
          newCards.push(e.proposal);
          if (e.proposal.auto && e.proposal.status === "confirmed") invalidateData();
        }
        else {
          patch((p) => ({ ...p, messages: [...p.messages, e.message] }));
          // The stored copy replaces what was on screen: the question once saved, the text once the assistant's message is.
          setLive((l) => (l ? (e.message.role === "user" ? { ...l, user: null } : e.message.role === "assistant" ? { ...l, text: "" } : l) : l));
        }
      }, ctrl.signal);
    } catch (e) {
      // A stop is not an error; anything else leaves a Riprova under the conversation.
      if (!ctrl.signal.aborted) setFailed({ content, message: (e as Error).message });
    } finally {
      // What is left of the answer is said too, unless it was stopped.
      if (chunker && !ctrl.signal.aborted) {
        for (const sentence of chunker.flush()) speaker.enqueue(sentence);
        speaker.end();
        // APP-8f: one card waiting from this answer → the essentials read back, and (Conversazione a voce) the microphone opens for the answer.
        const waiting = newCards.filter((p) => p.status === "pending");
        const stillPending = (queryClient.getQueryData<ConversationDto>(key)?.proposals ?? []).filter((p) => p.status === "pending");
        if (waiting.length === 1 && stillPending.length === 1) {
          const v = voiceConfirmation(waiting[0]!, voiceInfo.confirmMaxCents);
          speaker.say(v.say);
          if (voicePrefs.mode === "always" && !v.needsTap) speaker.afterSpeech(() => handlers.current.listenForReply(waiting[0]!.id));
        }
      }
      if (abortRef.current === ctrl) abortRef.current = null;
      setLive(null);
      // After a stop or an error, what the server kept (the question, anything already written) is the truth.
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["assistant-threads"] });
      if (nav.to && !ctrl.signal.aborted) navigate(nav.to);
    }
  };

  const patchProposal = (p: ProposalDto) => patch((prev) => ({ ...prev, proposals: prev.proposals.map((x) => (x.id === p.id ? p : x)) }));
  // APP-8f: out loud only when the answers are (the person is listening, maybe not looking).
  const sayIfVoice = (text: string) => { if (voicePrefs.mode !== "off") speaker.say(text); };
  const confirm = useMutation({
    mutationFn: ({ id, via, voiceProof }: { id: string; via: "tap" | "voice"; voiceProof?: string }) => assistantApi.confirm(id, via, voiceProof),
    onSuccess: ({ proposal }, { via }) => {
      patchProposal(proposal);
      // APP-8g: the phone opens (a tap already opened it); no toast, the card shows the number.
      if (proposal.kind === "call") { if (via === "voice") openDialer(proposal); lastCall.current = { proposal, left: false }; return; }
      invalidateData(); toast({ title: t("assistant.applied"), description: proposal.summary }); if (via === "voice") sayIfVoice(t("assistant.voiceDone"));
    },
    onError: (e: Error, { via }) => { toast({ title: t("assistant.applyFailed"), description: e.message, variant: "destructive" }); if (via === "voice") sayIfVoice(e.message); queryClient.invalidateQueries({ queryKey: key }); },
  });
  const dismiss = useMutation({ mutationFn: (id: string) => assistantApi.dismiss(id), onSuccess: ({ proposal }) => patchProposal(proposal) });
  // APP-8b: Annulla on a card the assistant carried out by itself.
  const undo = useMutation({
    mutationFn: (id: string) => assistantApi.undo(id),
    onSuccess: ({ proposal }) => { patchProposal(proposal); invalidateData(); toast({ title: t("assistant.undoneToast"), description: proposal.summary }); sayIfVoice(t("assistant.voiceUndone")); },
    onError: (e: Error) => { toast({ title: t("assistant.undoFailed"), description: e.message, variant: "destructive" }); queryClient.invalidateQueries({ queryKey: key }); },
  });
  const card = (p: ProposalDto) => <ProposalCard key={p.id} proposal={p} onNote={() => addCallNote(p)} onConfirm={() => { if (p.kind === "call") openDialer(p); confirm.mutate({ id: p.id, via: "tap" }); }} onDismiss={() => dismiss.mutate(p.id)} onUndo={() => undo.mutate(p.id)} onEdit={() => startEdit(p)} offline={!online} editing={editing?.id === p.id} hint={pending.length === 1 && pending[0]!.id === p.id ? yesHint(p) : null} busy={(confirm.isPending && confirm.variables?.id === p.id) || (undo.isPending && undo.variables === p.id)} />;
  const clear = useMutation({
    mutationFn: () => assistantApi.clear(data!.conversation.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ["assistant-threads"] }); },
  });

  /**
   * APP-8f — a short answer to a waiting card, said or typed. Only a clear yes
   * confirms (by voice: not above the owner's threshold — the server checks
   * again); a clear no sets the card aside; "annulla" takes back the last thing
   * done by itself. Anything else returns false and goes to the assistant.
   */
  const answerCard = (text: string, via: "tap" | "voice", voiceProof?: string): boolean => {
    if (editing || !online) return false;
    const reply = classifyVoiceReply(text);
    if (reply === "other") return false;
    // APP-8g: "Aggiungo una nota sulla chiamata?" — sì opens the note, no lets it go.
    if (askNote && pending.length === 0 && (reply === "yes" || reply === "no")) {
      if (reply === "yes") addCallNote(askNote);
      setAskNote(null);
      return true;
    }
    if (pending.length === 1) {
      const p = pending[0]!;
      if (reply === "yes") {
        if (via === "voice" && voiceNeedsTap(p, voiceInfo.confirmMaxCents)) {
          const msg = t("assistant.tapNeeded");
          toast({ title: msg, description: p.summary });
          sayIfVoice(msg);
        } else confirm.mutate({ id: p.id, via, voiceProof });
        return true;
      }
      dismiss.mutate(p.id);
      sayIfVoice(t("assistant.voiceDismissed"));
      return true;
    }
    if (reply === "undo" && pending.length === 0) {
      const u = undoableNow(data?.proposals ?? []);
      if (u) { undo.mutate(u.id); return true; }
    }
    return false;
  };

  const onTranscribed = (text: string, voiceProof?: string) => {
    if (!draft.trim() && answerCard(text, "voice", voiceProof)) return;
    // "Conversazione a voce": what was said goes at once (sends still wait for Conferma); otherwise it is read over first.
    if (voicePrefs.mode === "always" && !editing && !draft.trim()) { void ask(text, true); return; }
    dictatedRef.current = true;
    setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text));
    inputRef.current?.focus();
  };
  // The recorder calls back long after it started: always the latest state.
  const handlers = useRef({ onTranscribed, listenForReply: (_id: string) => {} });
  handlers.current.onTranscribed = onTranscribed;
  const voice = useVoiceInput({
    onTranscribed: (text, voiceProof) => handlers.current.onTranscribed(text, voiceProof),
    onError: (message) => toast({ title: t("assistant.voiceError"), description: message, variant: "destructive" }),
  });
  // Hands-free: after the question, listen once; it stops by itself after a pause and is dropped if nobody answers.
  handlers.current.listenForReply = (id: string) => {
    const still = (queryClient.getQueryData<ConversationDto>(key)?.proposals ?? []).find((p) => p.id === id);
    if (still?.status !== "pending" || voice.isRecording || voice.isTranscribing || abortRef.current) return;
    void voice.startRecording({ autoStop: true, waitMs: 8000 });
  };
  // APP-8f: speaking over the assistant silences it (and stops the answer being written); what is said next is recorded.
  useBargeIn(speaking && voicePrefs.mode !== "off" && voicePrefs.bargeIn && !voice.isRecording && !voice.isTranscribing, (stream) => {
    stop();
    void voice.startRecording({ stream, autoStop: true, speaking: true });
  });

  // Instant while an answer is being written (a smooth scroll per word falls behind), smooth otherwise; also for the state lines of APP-8d.
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: busy ? "auto" : "smooth" }); }, [busy, data?.messages.length, data?.proposals.length, live?.user, live?.text, live?.progress, failed, queued]);

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

  const pending = (data?.proposals ?? []).filter((p) => p.status === "pending");
  const submit = () => {
    const c = draft.trim();
    if (!c || busy) return;
    speaker.unlock(); // a tap or Enter: lets iOS play the answer later
    // "sì" with exactly one card waiting is that card's Conferma ("no" sets it aside, "annulla" undoes); anything else goes to the assistant.
    if (answerCard(c, "tap")) { setDraft(""); return; }
    if (editing) {
      // Modifica: the old card is set aside and the assistant proposes a new one with the change.
      dismiss.mutate(editing.id);
      setEditing(null);
      void ask(t("assistant.editPrefix").replace("{summary}", editing.summary) + c, voicePrefs.mode === "always" || (voicePrefs.mode === "dictated" && dictatedRef.current));
      return;
    }
    void ask(c, voicePrefs.mode === "always" || (voicePrefs.mode === "dictated" && dictatedRef.current));
  };
  // Stop: the answer being written and the voice reading it.
  const stop = () => { abortRef.current?.abort(); speaker.stop(); };
  const mic = () => {
    if (voice.isRecording) { try { performance.mark("asst-voice:silence"); } catch { /* old browsers */ } voice.stopRecording(); return; }
    // Speaking over the assistant: the microphone silences it first.
    speaker.stop();
    speaker.unlock();
    void voice.startRecording();
  };
  const toggleVoice = () => { if (voicePrefs.mode === "off") { speaker.unlock(); setVoicePrefs({ mode: lastOnMode.current }); } else { speaker.stop(); setVoicePrefs({ mode: "off" }); } };
  const startEdit = (p: ProposalDto) => { setEditing(p); inputRef.current?.focus(); };
  // What the waiting card says under its buttons: how to answer it (APP-8f: by voice, or the tap above the threshold).
  const yesHint = (p: ProposalDto): string => {
    if (voicePrefs.mode === "off") return t("assistant.sayYes");
    if (!voiceNeedsTap(p, voiceInfo.confirmMaxCents)) return t("assistant.sayYesVoice");
    return voiceInfo.confirmMaxCents > 0 && (typeof p.payload.amountCents === "number" || typeof p.payload.totalCents === "number")
      ? t("assistant.tapAbove").replace("{amount}", euro(voiceInfo.confirmMaxCents))
      : t("assistant.tapOnly");
  };

  // APP-8g — the note after a call: dictated on the job of the call, or (no job known) written to the assistant, which asks which job.
  const addCallNote = (p: ProposalDto) => {
    setAskNote(null);
    const name = String(p.payload.name ?? "");
    const jobId = typeof p.payload.projectId === "string" ? p.payload.projectId : null;
    if (jobId) { setNoteFor({ job: { id: jobId, name: String(p.payload.projectName ?? "") }, text: t("assistant.call.notePrefix").replace("{name}", name) }); return; }
    setDraft(t("assistant.call.chatPrefix").replace("{name}", name));
    inputRef.current?.focus();
  };
  // Back from the call (the page was hidden, now it is seen again): the question out loud, and in Conversazione a voce the microphone for the answer.
  const afterCallRef = useRef(() => {});
  afterCallRef.current = () => {
    const c = lastCall.current;
    if (!c) return;
    if (document.visibilityState === "hidden") { c.left = true; return; }
    if (!c.left) return;
    lastCall.current = null;
    setAskNote(c.proposal);
    if (voicePrefs.mode === "off") return;
    speaker.say(t("assistant.call.askNote"));
    if (voicePrefs.mode === "always") speaker.afterSpeech(() => { if (!voice.isRecording && !voice.isTranscribing) void voice.startRecording({ autoStop: true, waitMs: 8000 }); });
  };
  useEffect(() => {
    const onVisibility = () => afterCallRef.current();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Back online: the question kept meanwhile goes now.
  useEffect(() => {
    if (online && queued && data && !busy) { const q = queued; setQueued(null); void ask(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, queued, data, busy]);
  // "Chiedi o detta" on Oggi: the microphone there opens the panel already listening.
  const dictateOnce = useRef(Boolean(startDictation));
  useEffect(() => {
    if (dictateOnce.current && data && !gated) { dictateOnce.current = false; void voice.startRecording(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, gated]);
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
    <div className={cn("asst-chat", compact && "compact", className)} onKeyDown={(e) => { if (e.key === "Escape" && (busy || speaking)) { e.preventDefault(); e.stopPropagation(); stop(); } }}>
      <div className="chat-head">
        <div className="chat-head-main">
          <span className="chat-av"><Sparkles className="h-4 w-4" /></span>
          <div><b>{t("assistant.title")}</b><small>{t(`assistant.ctx.${kind}`)}</small></div>
        </div>
        <div className="chat-head-tools">
        <button type="button" className="chat-clear" onClick={toggleVoice} aria-pressed={voicePrefs.mode !== "off"} aria-label={voicePrefs.mode === "off" ? t("assistant.voiceOn") : t("assistant.voiceOff")} title={voicePrefs.mode === "off" ? t("assistant.voiceOn") : t("assistant.voiceOff")}>
          {voicePrefs.mode === "off" ? <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        {data && data.messages.length > 0 && !busy && (
          <button type="button" className="chat-clear" onClick={() => clear.mutate()} aria-label={t("assistant.clear")} disabled={clear.isPending}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> <span className="chat-clear-txt">{t("assistant.clear")}</span></button>
        )}
        </div>
      </div>
      {/* AI Act art. 50: the user is told at first contact that this is an AI. */}
      <p className="chat-notice" role="note">{t("assistant.aiNotice")}</p>
      {olderJobThread && <p className="chat-notice">{t("assistant.olderThread")}</p>}

      <div ref={listRef} className="chat-body" aria-live="polite" aria-busy={busy}>
        {isLoading && <div className="bubble ai typing"><i /><i /><i /></div>}
        {empty && <div className="bubble ai">{kind === "job" ? t("assistant.emptyJob") : t("assistant.emptyCompany")}</div>}
        {visible.map((m, idx) => (
          <div key={m.id} className="contents">
            {m.role === "assistant" && cardsFor(idx).map(card)}
            <Bubble message={m} />
          </div>
        ))}
        {trailing.map(card)}
        {live?.user && <div className="bubble user">{live.user}</div>}
        {live && live.text && <div className="bubble ai"><Markdownish text={live.text} /></div>}
        {live && !live.text && (live.progress
          ? <div className="chat-progress"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{live.progress}…</div>
          : <div className="bubble ai typing" aria-label={t("assistant.thinking")}><i /><i /><i /></div>)}
        {queued && (
          <>
            <div className="bubble user">{queued}</div>
            <div className="chat-state" role="status"><WifiOff className="h-3.5 w-3.5" aria-hidden="true" /><span>{t("assistant.offlineQueued")}</span></div>
          </>
        )}
        {failed && !live && (
          <div className="chat-state err" role="alert">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{failed.message || t("assistant.error")}</span>
            <button type="button" className="prop-dismiss" onClick={() => void ask(failed.content)} disabled={!online}><RotateCcw className="h-3 w-3" aria-hidden="true" /> {t("assistant.retry")}</button>
          </div>
        )}
      </div>

      {!online && !queued && <p className="chat-state bar" role="status"><WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> {t("assistant.offline")}</p>}

      {empty && !queued && (
        <div className="chat-sug">
          {suggestions.map((s) => <button key={s} type="button" className="pill" onClick={() => { speaker.unlock(); void ask(s); }}>{s}</button>)}
        </div>
      )}

      {editing && (
        <div className="chat-editing">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t("assistant.editingLabel")} <b>{editing.summary}</b></span>
          <button type="button" className="prop-dismiss" onClick={() => setEditing(null)} aria-label={t("assistant.editCancel")}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      )}

      <div className="chat-in">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            else if (e.key === "Escape" && editing) { e.preventDefault(); e.stopPropagation(); setEditing(null); }
          }}
          placeholder={voice.isRecording ? t("assistant.listening") : voice.isTranscribing ? t("assistant.transcribing") : editing ? t("assistant.editPlaceholder") : t("assistant.placeholder")}
          aria-label={t("assistant.placeholder")}
          disabled={!data}
          readOnly={busy}
          enterKeyHint="send"
        />
        <button
          type="button"
          className={cn("comp-mic", voice.isRecording && "rec")}
          onClick={mic}
          disabled={!data || busy || voice.isTranscribing}
          aria-label={voice.isRecording ? t("assistant.stopDictation") : t("assistant.dictate")}
          aria-pressed={voice.isRecording}
        >
          {voice.isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : voice.isRecording ? <><Square className="h-4 w-4" /><span className="rec-dot" /></> : <Mic className="h-4 w-4" />}
        </button>
        {busy || speaking ? (
          // Stop: the server stops the model when the answer is abandoned; what it already kept stays.
          <button type="button" className="comp-send" onClick={stop} aria-label={busy ? t("assistant.stop") : t("assistant.stopVoice")} title={busy ? t("assistant.stop") : t("assistant.stopVoice")}>
            <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="comp-send" onClick={submit} disabled={!draft.trim() || !data} aria-label={t("assistant.send")}>
            <Send className="chev" />
          </button>
        )}
      </div>
      <VoiceNoteSheet job={noteFor?.job ?? null} initialText={noteFor?.text} onClose={() => setNoteFor(null)} onSaved={() => setNoteFor(null)} />
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

/** Seconds left to press Annulla: what the server allows, never more than ASSISTANT_UNDO_SECONDS from when this card was first drawn. */
function useUndoSecondsLeft(undoUntil: string | null): number {
  const [shownAt] = useState(() => Date.now());
  const end = undoUntil ? Math.min(new Date(undoUntil).getTime(), shownAt + ASSISTANT_UNDO_SECONDS * 1000) : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!end || now >= end) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [end, now]);
  return end ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
}

function ProposalCard({ proposal, onConfirm, onDismiss, onUndo, onEdit, onNote, offline, editing, hint, busy }: { proposal: ProposalDto; onConfirm: () => void; onDismiss: () => void; onUndo: () => void; onEdit: () => void; onNote: () => void; offline: boolean; editing: boolean; hint: string | null; busy: boolean }) {
  const { t } = useLanguage();
  const touch = useMediaQuery("(pointer: coarse)");
  const isCall = proposal.kind === "call";
  const undoLeft = useUndoSecondsLeft(proposal.status === "confirmed" && proposal.auto ? proposal.undoUntil : null);
  const Icon = KIND_ICON[proposal.kind] ?? Receipt;
  const p = proposal.payload;
  const details: string[] = [];
  if (proposal.kind === "cost_entry") details.push(`${formatCents(Number(p.subtotalCents))} + ${t("assistant.tax")} ${formatCents(Number(p.taxCents))} = ${formatCents(Number(p.totalCents))}`, String(p.date ?? ""), String(p.description ?? ""));
  if (proposal.kind === "record_payment") details.push(`${formatCents(Number(p.amountCents))} · ${t(`invoices.method.${String(p.method)}`)} · ${String(p.date ?? "")}`);
  if (proposal.kind === "milestone_update" && p.releasesPaymentTerm) details.push(`${t("assistant.releases")} ${String(p.releasesPaymentTerm)}`);
  if ((proposal.kind === "send_invoice" || proposal.kind === "send_contract") && p.message) details.push(`"${String(p.message)}"`);
  // APP-8c: what the person must see before a send — a new address, the quote unlock, the text of an email.
  if (proposal.kind === "send_quote") {
    if (p.newAddress) details.push(t("assistant.detail.newAddress"));
    if (p.unlock === "plan") details.push(t("assistant.detail.unlockPlan"));
    if (p.unlock === "trial") details.push(t("assistant.detail.unlockTrial"));
    if (p.followUps) details.push(t("assistant.detail.followUps"));
  }
  if (proposal.kind === "reply_lead") details.push(t("assistant.detail.leadTemplate"));
  if (proposal.kind === "draft_quote") details.push(t("assistant.detail.draftQuote"));
  if (isCall) details.push(p.projectName ? t("assistant.call.noteOn").replace("{job}", String(p.projectName)) : t("assistant.call.never"));
  const body = proposal.kind === "message_client" || (proposal.kind === "job_note" && String(p.body ?? "").length > 90) ? String(p.body ?? "") : "";
  const link = proposalLink(proposal);
  const status = proposal.status;
  return (
    <div className={cn("prop-card", status, editing && "editing")} role="group" aria-label={`${t(`assistant.kind.${proposal.kind}`)}: ${proposal.summary}`}>
      <div className="prop-head">
        <span className="prop-ic"><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="prop-kind">{t(`assistant.kind.${proposal.kind}`)}</div>
          <div className="prop-summary">{proposal.summary}</div>
          {details.filter(Boolean).map((d, i) => <div key={i} className="prop-detail">{d}</div>)}
          {body && <div className="prop-body">{body}</div>}
          {isCall && status === "confirmed" && !touch && typeof p.phone === "string" && (
            <div className="prop-call">
              <CallQr dial={p.phone} label={t("assistant.call.scan")} />
              <span className="prop-detail">{t("assistant.call.scan")}</span>
            </div>
          )}
          {status === "failed" && proposal.error && <div className="prop-detail" style={{ color: "var(--red)" }}><AlertTriangle className="h-3 w-3" style={{ display: "inline", marginRight: 4 }} />{proposal.error}</div>}
        </div>
      </div>
      <div className="prop-actions">
        {status === "pending" && (
          <>
            <button type="button" className="btn btn-navy btn-sm" onClick={onConfirm} disabled={busy || offline} title={offline ? t("assistant.offlineConfirm") : undefined}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCall ? <Phone className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {isCall ? t(touch ? "assistant.call.dial" : "assistant.call.show") : t("assistant.confirm")}
            </button>
            <button type="button" className="prop-dismiss" onClick={onEdit} disabled={busy || editing} aria-pressed={editing}><Pencil className="h-3 w-3" /> {t("assistant.edit")}</button>
            <button type="button" className="prop-dismiss" onClick={onDismiss} disabled={busy}><X className="h-3.5 w-3.5" /> {t("assistant.dismiss")}</button>
            {hint && !offline && <span className="prop-yes">{hint}</span>}
          </>
        )}
        {status === "confirmed" && isCall && typeof p.phone === "string" && (
          <>
            <a href={`tel:${p.phone}`} className={cn("btn btn-sm", touch ? "btn-navy" : "btn-outline-navy")}><Phone className="h-3.5 w-3.5" /> {t("assistant.call.again").replace("{phone}", String(p.phoneDisplay ?? p.phone))}</a>
            <button type="button" className="prop-dismiss" onClick={onNote}><StickyNote className="h-3 w-3" /> {t("assistant.call.note")}</button>
          </>
        )}
        {status === "confirmed" && !isCall && (
          <>
            <span className="prop-status ok"><Check className="h-3.5 w-3.5" /> {proposal.auto ? t("assistant.done") : t("assistant.confirmed")}</span>
            {undoLeft > 0 && (
              <button type="button" className="prop-dismiss" onClick={onUndo} disabled={busy}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} {t("assistant.undo")} <span className="prop-undo-left" aria-hidden="true">{undoLeft}</span>
              </button>
            )}
            {link && <Link href={link} className="prop-dismiss"><ExternalLink className="h-3 w-3" /> {t("assistant.open")}</Link>}
          </>
        )}
        {status === "dismissed" && <span className="prop-status muted">{t("assistant.dismissed")}</span>}
        {status === "undone" && <span className="prop-status muted">{t("assistant.undone")}</span>}
        {status === "failed" && <span className="prop-status err">{t("assistant.failed")}</span>}
      </div>
    </div>
  );
}
