import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Info, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ASSISTANT_ACTIONS, ASSISTANT_ACTION_DEFS, ASSISTANT_GROUPS, ASSISTANT_GROUP_LABEL, ASSISTANT_ROLE_LABEL,
  effectiveAssistantLevel, type AssistantAction, type AssistantLevel,
  ASSISTANT_VOICE_MODES, ASSISTANT_VOICE_MODE_LABEL, ASSISTANT_VOICE_RATES, type AssistantVoiceMode,
  ASSISTANT_VOICE_CONFIRM_OPTIONS,
} from "@workspace/config";
import { Speaker, browserSpeechAvailable, readVoicePrefs, useItalianVoices, useVoiceInfo, useVoicePrefs } from "@/lib/assistant-voice";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi, type ActivityItemDto, type AssistantPermissionsDto, type AssistantSettingDto } from "@/lib/assistant-api";
import { SettingsGroup, SettingsRow, SettingsSection, useSettingsDraft } from "./ui";

// ── APP-8b: Impostazioni → Assistente (docs/ASSISTENTE-PLAN.md §4) ──────────
// For each action: Lo fa / Chiede prima / Mai, for the whole company and, if
// the owner wants, narrower for one role. Money and customer actions never
// offer "Lo fa"; an action a role can't do by hand shows why instead of a
// choice. Only the owner edits; the others see what applies to them.

type Scope = AssistantSettingDto["role"];
const ROLES = Object.keys(ASSISTANT_ROLE_LABEL) as Exclude<Scope, "">[];
const LEVEL_LABEL: Record<AssistantLevel, string> = { auto: "Lo fa", ask: "Chiede prima", never: "Mai" };
const LEVEL_HELP: Record<AssistantLevel, string> = {
  auto: "Lo fa subito e ti mostra una scheda con Annulla per qualche secondo.",
  ask: "Ti mostra una scheda: non succede nulla finché non confermi.",
  never: "Non lo propone nemmeno.",
};

/** "Lo fa" on an action that can't be taken back (a phase marked done can draft its invoice) has no Annulla. */
const helpFor = (action: AssistantAction, level: AssistantLevel) =>
  level === "auto" && !ASSISTANT_ACTION_DEFS[action].undoable ? "Lo fa subito e ti mostra una scheda «fatto» (senza Annulla: si cambia dalla schermata)." : LEVEL_HELP[level];

/**
 * The draft: one entry per choice, keyed "role|action" (role "" = the whole company). A role key missing or "" = same as the company.
 * APP-8f: plus VOICE_MAX, the owner's threshold for "sì" said out loud (cents, as text).
 */
type Draft = Record<string, AssistantLevel | "" | string>;
const VOICE_MAX = "voice|max";
const euro = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as Intl.NumberFormatOptions).format(cents / 100);
const keyOf = (role: Scope, action: AssistantAction) => `${role}|${action}`;
const PERMISSIONS_KEY = ["assistant-permissions"];

function toDraft(data: AssistantPermissionsDto): Draft {
  const out: Draft = {};
  for (const s of data.settings) out[keyOf(s.role, s.action)] = s.level;
  out[VOICE_MAX] = String(data.voiceConfirmMaxCents);
  return out;
}

function toSettings(d: Draft): AssistantSettingDto[] {
  return Object.entries(d).flatMap(([k, level]) => {
    if (k === VOICE_MAX) return [];
    const [role, action] = k.split("|") as [Scope, AssistantAction];
    return level ? [{ role, action, level: level as AssistantLevel }] : [];
  });
}

/** The company-wide level of an action in the draft (its saved choice, else PrevAI's default). */
const companyLevel = (d: Draft, action: AssistantAction) => effectiveAssistantLevel(action, "owner", toSettings(d).filter((s) => s.role === ""), true);

export function AssistantSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: PERMISSIONS_KEY, queryFn: assistantApi.permissions, retry: false });
  const [scope, setScope] = useState<Scope>("");
  const source = useMemo(() => (data ? toDraft(data) : undefined), [data]);
  const { draft, set } = useSettingsDraft<Draft>(source, async (d) => {
    const saved = await assistantApi.savePermissions(toSettings(d), d[VOICE_MAX] ? Number(d[VOICE_MAX]) : undefined);
    queryClient.setQueryData(PERMISSIONS_KEY, saved);
  });
  const setLevel = (role: Scope, action: AssistantAction, level: AssistantLevel | "") => set(keyOf(role, action), level);

  const intro = "Cosa l'assistente fa da solo, cosa ti chiede prima e cosa non fa mai. Leggere i dati e rispondere lo fa sempre; il ruolo di ogni persona vince su queste scelte.";

  if (error) {
    return (
      <SettingsSection title="Assistente" intro={intro}>
        <div className="notice info" role="status"><Info aria-hidden="true" /><span className="grow">L'assistente è incluso nel piano Elite.</span></div>
      </SettingsSection>
    );
  }
  if (isLoading || !data || !draft) {
    return (
      <SettingsSection title="Assistente" intro={intro}>
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      </SettingsSection>
    );
  }

  const editable = data.available && data.canEdit;
  const roleCan = (role: Scope, action: AssistantAction) => role === "" || data.roleLimits[role].includes(action);

  return (
    <SettingsSection title="Assistente" intro={intro}>
      {!data.available && (
        <div className="notice info" role="status">
          <Info aria-hidden="true" />
          <span className="grow">
            Queste scelte si attivano con il prossimo aggiornamento di PrevAI.
            <small>Fino ad allora l'assistente chiede sempre prima di fare qualcosa.</small>
          </span>
        </div>
      )}
      {data.available && !data.canEdit && (
        <div className="notice info" role="status">
          <Info aria-hidden="true" />
          <span className="grow">
            Le decide il titolare.
            <small>Qui sotto vedi cosa vale per te.</small>
          </span>
        </div>
      )}

      <VoiceGroup />

      {/* APP-8f: sopra questa cifra un "sì" detto non basta, serve il tocco su Conferma. */}
      <SettingsGroup title="Conferma a voce" desc="Quando una scheda aspetta, l'assistente ti rilegge importo e destinatario e accetta solo un sì chiaro. Importi e destinatari restano sempre scritti sulla scheda.">
        {data.canEdit ? (
          <SettingsRow label="Basta la voce fino a" help="Sopra questa cifra serve il tocco su Conferma. Vale per tutta l'impresa." htmlFor="s-asst-voice-max">
            <select id="s-asst-voice-max" value={draft[VOICE_MAX] ?? ""} disabled={!editable} onChange={(e) => set(VOICE_MAX, e.target.value)}>
              {ASSISTANT_VOICE_CONFIRM_OPTIONS.map((c) => <option key={c} value={String(c)}>{c === 0 ? "Mai: gli importi si confermano col tocco" : euro(c)}</option>)}
            </select>
          </SettingsRow>
        ) : (
          <SettingsRow label="Basta la voce fino a" help="Sopra questa cifra serve il tocco su Conferma. La decide il titolare.">
            <span className="srow-value">{data.voiceConfirmMaxCents === 0 ? "Mai" : euro(data.voiceConfirmMaxCents)}</span>
          </SettingsRow>
        )}
      </SettingsGroup>

      {data.canEdit && (
        <SettingsGroup title="Per chi" desc="Di solito basta l'impresa intera. Un ruolo può avere regole più strette (o più larghe, ma mai oltre quello che il ruolo può fare a mano).">
          <SettingsRow label="Regole per" htmlFor="s-asst-scope">
            <select id="s-asst-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="">Tutta l'impresa</option>
              {ROLES.map((r) => <option key={r} value={r}>{ASSISTANT_ROLE_LABEL[r]}</option>)}
            </select>
          </SettingsRow>
        </SettingsGroup>
      )}

      {ASSISTANT_GROUPS.map((g) => {
        const actions = ASSISTANT_ACTIONS.filter((a) => ASSISTANT_ACTION_DEFS[a].group === g);
        return (
          <SettingsGroup key={g} title={ASSISTANT_GROUP_LABEL[g].title} desc={ASSISTANT_GROUP_LABEL[g].desc}>
            {actions.map((a) => {
              const def = ASSISTANT_ACTION_DEFS[a];
              const id = `s-asst-${a}`;
              if (!data.canEdit) {
                const lv = data.mine[a];
                return <SettingsRow key={a} label={def.label} help={helpFor(a, lv)}><span className="srow-value">{LEVEL_LABEL[lv]}</span></SettingsRow>;
              }
              if (!roleCan(scope, a)) {
                return <SettingsRow key={a} label={def.label} help="Questo ruolo non può farlo nemmeno a mano, quindi l'assistente non lo fa."><span className="srow-value">{LEVEL_LABEL.never}</span></SettingsRow>;
              }
              const own = draft[keyOf(scope, a)];
              const inherited = companyLevel(draft, a);
              const value: AssistantLevel | "" = scope === "" ? inherited : ((own || "") as AssistantLevel | "");
              const shown: AssistantLevel = value === "" ? inherited : value;
              const help = def.max === "ask" && shown === "ask" ? `${LEVEL_HELP[shown]} Non può farlo da solo.` : helpFor(a, shown);
              return (
                <SettingsRow key={a} label={def.label} help={help} htmlFor={id}>
                  <select id={id} value={value} disabled={!editable} onChange={(e) => setLevel(scope, a, e.target.value as AssistantLevel | "")}>
                    {scope !== "" && <option value="">Come per l'impresa ({LEVEL_LABEL[inherited]})</option>}
                    {def.max === "auto" && <option value="auto">{LEVEL_LABEL.auto}</option>}
                    <option value="ask">{LEVEL_LABEL.ask}</option>
                    <option value="never">{LEVEL_LABEL.never}</option>
                  </select>
                </SettingsRow>
              );
            })}
          </SettingsGroup>
        );
      })}

      <ActivityGroup />
      <UsageGroup />
    </SettingsSection>
  );
}

// ── APP-8h: Attività e uso del mese ──────────────────────────────────────────
// Ogni azione dell'assistente, chi l'ha chiesta e come: il titolare vede tutta
// l'impresa, gli altri le proprie. Annulla c'è finché c'è sulla scheda (pochi
// secondi, solo per chi l'ha chiesta); dopo si cambia dalla schermata, con Apri.

const WHEN = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ActivityGroup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<ActivityItemDto[][]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["assistant-activity"], queryFn: () => assistantApi.activity(), retry: false });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { setPages([]); setNext(data?.next ?? null); }, [data]);
  const items = [...(data?.items ?? []), ...pages.flat()];
  // Annulla sparisce da solo quando scade.
  const soonest = items.map((i) => (i.undoUntil ? new Date(i.undoUntil).getTime() : Infinity)).filter((t) => t > now).sort((a, b) => a - b)[0];
  useEffect(() => {
    if (!soonest || soonest === Infinity) return;
    const t = setTimeout(() => setNow(Date.now()), Math.max(250, soonest - Date.now()));
    return () => clearTimeout(t);
  }, [soonest]);

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await assistantApi.activity(next);
      setPages((p) => [...p, page.items]);
      setNext(page.next);
    } finally { setLoadingMore(false); }
  };
  const undo = async (item: ActivityItemDto) => {
    try {
      await assistantApi.undo(item.proposalId);
      toast({ title: "Annullata", description: item.summary });
      await queryClient.invalidateQueries({ queryKey: ["assistant-activity"] });
    } catch (e) {
      toast({ title: "Non si può annullare", description: (e as Error).message, variant: "destructive" });
      setNow(Date.now());
    }
  };

  const desc = data?.everyone
    ? "Ogni cosa che l'assistente ha fatto per l'impresa, chi l'ha chiesta e se l'ha fatta da solo o dopo una conferma."
    : "Le cose che l'assistente ha fatto per te.";
  if (isLoading) return <SettingsGroup title="Attività" desc={desc}><Skeleton className="h-24 w-full" /></SettingsGroup>;
  if (!data?.available) {
    return (
      <SettingsGroup title="Attività" desc={desc}>
        <SettingsRow label="Registro delle azioni" help="Si attiva con il prossimo aggiornamento di PrevAI."><span className="srow-value">—</span></SettingsRow>
      </SettingsGroup>
    );
  }
  return (
    <SettingsGroup title="Attività" desc={desc}>
      {items.length === 0 && <SettingsRow label="Ancora nulla" help="Quando l'assistente aggiunge un costo, prepara una bozza o manda qualcosa dopo la tua conferma, lo trovi qui."><span className="srow-value">—</span></SettingsRow>}
      {items.map((item) => {
        const canUndo = item.status === "done" && item.undoUntil && new Date(item.undoUntil).getTime() > now;
        const how = item.level === "auto" ? "da solo" : "dopo la conferma";
        const who = item.actor.mine ? "Tu" : item.actor.name;
        const help = `${item.label} · ${who} · ${WHEN.format(new Date(item.executedAt))} · ${how}${item.status === "undone" && item.undoneAt ? ` · annullata alle ${WHEN.format(new Date(item.undoneAt)).split(", ").pop()}` : ""}`;
        return (
          <SettingsRow key={item.id} label={item.summary} help={help}>
            <div className="flex flex-wrap items-center gap-2">
              {item.status === "undone" ? <span className="chip chip-grey">Annullata</span> : <span className={item.level === "auto" ? "chip chip-teal" : "chip chip-green"}>{item.level === "auto" ? "Lo fa" : "Confermata"}</span>}
              {canUndo && <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => undo(item)}>Annulla</button>}
              {!canUndo && item.status === "done" && item.link && <Link href={item.link} className="btn btn-outline-navy btn-sm">Apri</Link>}
            </div>
          </SettingsRow>
        );
      })}
      {next && (
        <div className="srow">
          <button type="button" className="btn btn-outline-navy btn-sm" onClick={more} disabled={loadingMore}>{loadingMore ? "Carico…" : "Mostra le precedenti"}</button>
        </div>
      )}
    </SettingsGroup>
  );
}

/** Quanto l'impresa ha usato l'assistente nel mese (i costi in euro li vede lo staff). */
function UsageGroup() {
  const { data } = useQuery({ queryKey: ["assistant-usage"], queryFn: assistantApi.usage, retry: false });
  if (!data) return null;
  const month = new Date(`${data.from}T12:00:00Z`).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return (
    <SettingsGroup title="Uso del mese" desc={`Da inizio ${month}, per tutta l'impresa.`}>
      <SettingsRow label="Domande all'assistente" help="Ogni domanda o richiesta conta una volta, anche se l'assistente guarda più dati per rispondere.">
        <span className="srow-value">{data.turns.toLocaleString("it-IT")}</span>
      </SettingsRow>
      <SettingsRow label="Minuti di voce" help={data.voiceMinutesIncluded === null ? "Solo la voce scelta per PrevAI; quella del dispositivo non si conta. Il limite del piano non è ancora deciso." : `Inclusi: ${data.voiceMinutesIncluded} per posto.`}>
        <span className="srow-value">{data.voiceMinutes.toLocaleString("it-IT")}</span>
      </SettingsRow>
    </SettingsGroup>
  );
}

// ── APP-8e: la voce (D17 aperta) ─────────────────────────────────────────────
// Scelte di questo dispositivo. La voce del fornitore arriva quando sul server
// c'è la sua chiave (AS-2); fino ad allora legge la voce del browser.

const MODE_HELP: Record<AssistantVoiceMode, string> = {
  off: "Risponde solo per scritto.",
  dictated: "Se detti la domanda, la risposta te la dice anche a voce.",
  always: "Detti e parte subito, senza rileggere; la risposta arriva a voce. Gli invii aspettano comunque la tua conferma.",
};
const RATE_LABEL: Record<number, string> = { 0.85: "Più lenta", 1: "Normale", 1.15: "Più veloce", 1.3: "Veloce" };
const SAMPLE = "Ciao, sono l'assistente di PrevAI. Il cantiere Rossi è nel budget: mancano da incassare 4.200 euro.";

function VoiceGroup() {
  const [prefs, setPrefs] = useVoicePrefs();
  const info = useVoiceInfo();
  const voices = useItalianVoices();
  const server = info.provider === "openai";
  const serverRef = useRef(server);
  serverRef.current = server;
  const [sample] = useState(() => new Speaker({ server: () => serverRef.current, prefs: readVoicePrefs, onSpeaking: () => {}, onFirstAudio: () => {} }));
  useEffect(() => () => sample.stop(), [sample]);
  const canSpeak = server || browserSpeechAvailable();
  const play = () => { sample.unlock(); sample.begin(); sample.enqueue(SAMPLE); sample.end(); };
  const desc = server
    ? "Ti legge la risposta frase per frase, mentre la scrive. Queste scelte valgono su questo dispositivo."
    : "Ti legge la risposta frase per frase, mentre la scrive. Per ora con la voce di questo telefono o computer: la voce scelta per PrevAI arriva con un prossimo aggiornamento. Queste scelte valgono su questo dispositivo.";
  return (
    <SettingsGroup title="Voce" desc={desc}>
      <SettingsRow label="Risposte" help={MODE_HELP[prefs.mode]} htmlFor="s-asst-voice-mode">
        <select id="s-asst-voice-mode" value={prefs.mode} onChange={(e) => setPrefs({ mode: e.target.value as AssistantVoiceMode })}>
          {ASSISTANT_VOICE_MODES.map((m) => <option key={m} value={m}>{ASSISTANT_VOICE_MODE_LABEL[m]}</option>)}
        </select>
      </SettingsRow>
      <SettingsRow label="Velocità" htmlFor="s-asst-voice-rate">
        <select id="s-asst-voice-rate" value={prefs.rate} onChange={(e) => setPrefs({ rate: Number(e.target.value) })}>
          {ASSISTANT_VOICE_RATES.map((r) => <option key={r} value={r}>{RATE_LABEL[r]}</option>)}
        </select>
      </SettingsRow>
      {!server && (
        <SettingsRow
          label="Voce del dispositivo"
          help={!browserSpeechAvailable() ? "Questo browser non sa leggere ad alta voce: le risposte restano scritte." : voices.length === 0 ? "Su questo dispositivo non c'è una voce italiana: legge con quella predefinita." : "Le voci cambiano da telefono a telefono."}
          htmlFor="s-asst-voice-name"
        >
          <select id="s-asst-voice-name" value={prefs.voiceName ?? ""} onChange={(e) => setPrefs({ voiceName: e.target.value || null })} disabled={voices.length === 0}>
            <option value="">Automatica</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
        </SettingsRow>
      )}
      {server && (
        <SettingsRow label="Minuti di voce questo mese" help={info.minutesIncluded === null ? "Contati per tutta l'impresa. Il limite del piano non è ancora deciso." : `Inclusi: ${info.minutesIncluded}. Finiti i minuti, risponde per scritto.`}>
          <span className="srow-value">{info.minutesUsed.toLocaleString("it-IT")}</span>
        </SettingsRow>
      )}
      <SettingsRow label="Interrompi parlando" help="Se parli mentre l'assistente risponde, si zittisce e ti ascolta. Se su questo dispositivo si interrompe da solo (altoparlante alto), spegnilo: resta il tasto Zittisci." htmlFor="s-asst-voice-barge">
        <select id="s-asst-voice-barge" value={prefs.bargeIn ? "on" : "off"} onChange={(e) => setPrefs({ bargeIn: e.target.value === "on" })} disabled={prefs.mode === "off"}>
          <option value="on">Sì</option>
          <option value="off">No</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Prova la voce" help="Una frase d'esempio con queste scelte.">
        <button type="button" className="btn btn-outline-navy btn-sm" onClick={play} disabled={!canSpeak}><Play className="h-3.5 w-3.5" aria-hidden="true" /> Ascolta</button>
      </SettingsRow>
    </SettingsGroup>
  );
}
