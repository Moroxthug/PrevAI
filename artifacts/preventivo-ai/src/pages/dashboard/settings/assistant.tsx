import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Play } from "lucide-react";
import {
  ASSISTANT_ACTIONS, ASSISTANT_ACTION_DEFS, ASSISTANT_GROUPS, ASSISTANT_GROUP_LABEL, ASSISTANT_ROLE_LABEL,
  effectiveAssistantLevel, type AssistantAction, type AssistantLevel,
  ASSISTANT_VOICE_MODES, ASSISTANT_VOICE_MODE_LABEL, ASSISTANT_VOICE_RATES, type AssistantVoiceMode,
} from "@workspace/config";
import { Speaker, browserSpeechAvailable, readVoicePrefs, useItalianVoices, useVoiceInfo, useVoicePrefs } from "@/lib/assistant-voice";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantApi, type AssistantPermissionsDto, type AssistantSettingDto } from "@/lib/assistant-api";
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

/** The draft: one entry per choice, keyed "role|action" (role "" = the whole company). A role key missing or "" = same as the company. */
type Draft = Record<string, AssistantLevel | "">;
const keyOf = (role: Scope, action: AssistantAction) => `${role}|${action}`;
const PERMISSIONS_KEY = ["assistant-permissions"];

function toDraft(data: AssistantPermissionsDto): Draft {
  const out: Draft = {};
  for (const s of data.settings) out[keyOf(s.role, s.action)] = s.level;
  return out;
}

function toSettings(d: Draft): AssistantSettingDto[] {
  return Object.entries(d).flatMap(([k, level]) => {
    const [role, action] = k.split("|") as [Scope, AssistantAction];
    return level ? [{ role, action, level }] : [];
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
    const saved = await assistantApi.savePermissions(toSettings(d));
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
              const value: AssistantLevel | "" = scope === "" ? inherited : (own || "");
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
    </SettingsSection>
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
      <SettingsRow label="Prova la voce" help="Una frase d'esempio con queste scelte.">
        <button type="button" className="btn btn-outline-navy btn-sm" onClick={play} disabled={!canSpeak}><Play className="h-3.5 w-3.5" aria-hidden="true" /> Ascolta</button>
      </SettingsRow>
    </SettingsGroup>
  );
}
