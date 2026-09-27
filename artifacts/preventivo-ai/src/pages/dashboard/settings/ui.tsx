import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

// ── APP-1b (come QuoteAI Phase 102): il vocabolario delle Impostazioni ──────
// Ogni sezione è una SettingsSection (titolo + una frase su cosa controlla)
// fatta di schede SettingsGroup con righe SettingsRow (etichetta e aiuto a
// sinistra, il campo a destra; impilati sul telefono) e ToggleRow (tutta la
// riga è l'interruttore). I campi non si salvano da soli: la sezione tiene
// una bozza (useSettingsDraft) e la pagina mostra una sola barra
// "Modifiche non salvate — Annulla / Salva" finché la bozza è diversa.
// Le azioni che non sono campi (carica il logo, collega un'app, rigenera la
// chiave) restano pulsanti che agiscono subito.

/** Sotto questa larghezza l'elenco è una schermata a sé e una sezione si apre come pagina. */
const SETTINGS_SINGLE_PANE = "(max-width: 859.98px)";

/**
 * Vero sotto 860 px. Letto in modo sincrono al primo render (a differenza di
 * useMediaQuery, che parte da false): /dashboard/settings su schermo largo
 * rimanda a una sezione, e un telefono non deve mai prendere quel rimando.
 */
export function useSinglePane(): boolean {
  const [single, setSingle] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(SETTINGS_SINGLE_PANE).matches);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(SETTINGS_SINGLE_PANE);
    setSingle(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setSingle(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return single;
}

export type DraftRegistration = {
  dirty: boolean;
  valid: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
};

type DraftCtx = { register: (r: DraftRegistration | null) => void };
const DraftContext = createContext<DraftCtx | null>(null);

/** Il lato pagina: quale sezione (se c'è) ha modifiche non salvate, e come salvarle o scartarle. */
export function useDraftHost() {
  const [reg, setReg] = useState<DraftRegistration | null>(null);
  const ctx = useMemo<DraftCtx>(() => ({ register: setReg }), []);
  return { reg, DraftProvider: DraftContext.Provider, ctx };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * I valori modificabili di una sezione. `source` è ciò che ha il server
 * (undefined mentre carica); le modifiche restano in `draft` finché la barra
 * le salva con `save(draft, saved)`. Se i valori del server cambiano sotto
 * (un'altra scheda, un refetch) una bozza non toccata li segue; una bozza
 * modificata resta com'è.
 */
export function useSettingsDraft<T>(
  source: T | undefined,
  save: (draft: T, saved: T) => Promise<void>,
  validate?: (draft: T) => boolean,
) {
  const ctx = useContext(DraftContext);
  const [saved, setSaved] = useState<T | undefined>(source);
  const [draft, setDraft] = useState<T | undefined>(source);
  const [saving, setSaving] = useState(false);
  const sourceKey = source === undefined ? null : JSON.stringify(source);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    if (source === undefined) return;
    setDraft((d) => (d === undefined || same(d, savedRef.current) ? source : d));
    setSaved(source);
    // sourceKey sta per source: un oggetto nuovo con gli stessi valori non è un cambiamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  const dirty = draft !== undefined && saved !== undefined && !same(draft, saved);
  const valid = draft === undefined || !validate || validate(draft);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft((d) => (d === undefined ? d : { ...d, [key]: value }));
  }, []);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  // Le sezioni passano una closure nuova a ogni render; il ref tiene stabile doSave (e la registrazione).
  const saveRef = useRef(save);
  saveRef.current = save;
  const doSave = useCallback(async () => {
    const d = draftRef.current;
    const s = savedRef.current;
    if (d === undefined || s === undefined) return true;
    setSaving(true);
    try {
      await saveRef.current(d, s);
      setSaved(d);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);
  const discard = useCallback(() => setDraft(savedRef.current), []);

  const register = ctx?.register;
  useEffect(() => {
    register?.({ dirty, valid, saving, save: doSave, discard });
  }, [register, dirty, valid, saving, doSave, discard]);
  useEffect(() => () => register?.(null), [register]);

  return { draft, set, setDraft, dirty, saving };
}

/** La barra fissa che compare solo mentre la sezione aperta ha modifiche non salvate. */
export function SaveBar({ reg }: { reg: DraftRegistration | null }) {
  if (!reg?.dirty) return null;
  return (
    <>
      <div className="savebar-spacer" aria-hidden="true" />
      <div className="savebar" role="region" aria-label="Modifiche non salvate">
        <span className="savebar-msg">
          <span className="savebar-dot" aria-hidden="true" />
          {reg.valid ? "Modifiche non salvate" : "Correggi i campi segnati"}
        </span>
        <button type="button" className="btn btn-sm secondary" onClick={reg.discard} disabled={reg.saving}>
          Annulla
        </button>
        <button type="button" className="btn btn-sm btn-navy" data-primary-action onClick={() => void reg.save()} disabled={reg.saving || !reg.valid}>
          {reg.saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Salva
        </button>
      </div>
    </>
  );
}

/** Una sezione: il nome e una frase su cosa controlla, poi le sue schede. */
export function SettingsSection({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  const single = useSinglePane();
  const Heading = single ? "h1" : "h2";
  return (
    <section className="sset" aria-labelledby="settings-section-title">
      <header className="sset-head">
        <Heading id="settings-section-title">{title}</Heading>
        <p>{intro}</p>
      </header>
      <div className="sset-body">{children}</div>
    </section>
  );
}

/** Una scheda di righe, con titolo facoltativo. `danger` segna la zona delle azioni irreversibili. */
export function SettingsGroup({ title, desc, children, danger, action }: { title?: string; desc?: ReactNode; children: ReactNode; danger?: boolean; action?: ReactNode }) {
  // Un livello sotto il titolo della sezione: h3 sotto l'h2 su schermo largo, h2 sotto l'h1 sul telefono.
  const Heading = useSinglePane() ? "h2" : "h3";
  return (
    <div className={cn("card sgroup", danger && "sgroup-danger")}>
      {(title || action) && (
        <div className="sgroup-head">
          <div>
            {title && <Heading>{title}</Heading>}
            {desc && <p>{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Etichetta e aiuto a sinistra, il campo a destra (impilati sotto 640 px). */
export function SettingsRow({ label, help, htmlFor, error, children }: { label: string; help?: ReactNode; htmlFor?: string; error?: string | null; children: ReactNode }) {
  const helpId = useId();
  return (
    <div className="srow">
      <div className="srow-txt">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="srow-label">{label}</span>}
        {help && <p id={helpId}>{help}</p>}
      </div>
      <div className="srow-field field">
        {children}
        {error && <p className="field-err" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** Un interruttore su tutta la riga: un tocco ovunque sulla riga lo cambia. */
export function ToggleRow({ label, help, checked, onChange, disabled }: { label: string; help?: ReactNode; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const labelId = useId();
  const helpId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={help ? helpId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="srow srow-toggle"
    >
      <span className="srow-txt">
        <span id={labelId} className="srow-label">{label}</span>
        {help && <span id={helpId} className="srow-help">{help}</span>}
      </span>
      <span className={cn("tgl", checked && "on")} aria-hidden="true" />
    </button>
  );
}

/** Righe che non sono campi: una riga di testo e un pulsante d'azione a destra. */
export function ActionRow({ label, help, children }: { label: string; help?: ReactNode; children?: ReactNode }) {
  return (
    <div className="srow srow-action">
      <div className="srow-txt">
        <span className="srow-label">{label}</span>
        {help && <p>{help}</p>}
      </div>
      {children && <div className="srow-act">{children}</div>}
    </div>
  );
}

// Phase 65: un'integrazione senza registrazione lato server risponde
// `available: false`; al posto del pulsante Collega si dice perché.
export function NotAvailableNote() {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="integration-not-available">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium text-foreground">{t("dashboard.settings.integrations.notAvailableTitle")}</p>
        <p className="mt-0.5">{t("dashboard.settings.integrations.notAvailableDesc")}</p>
      </div>
    </div>
  );
}
