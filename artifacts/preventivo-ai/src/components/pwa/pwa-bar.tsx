import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { Check, RefreshCw } from "lucide-react";
import { applyUpdate, registerServiceWorker, usePwa } from "@/lib/pwa";
import { discard, flush, resolveConflict, retryFailed, useOutbox, type OutboxRow } from "@/lib/offline/outbox";
import { useQueryCacheState } from "@/lib/offline/cache-state";
import { formatEur } from "@/lib/money";

/** "9:42" oggi, "26 set, 9:42" prima — nella lingua dell'app. */
function syncedTime(at: number, now = Date.now()): string {
  const d = new Date(at);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("it-IT", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

const FIELD_NAMES: Record<string, string> = {
  name: "Nome",
  title: "Titolo",
  description: "Descrizione",
  status: "Stato",
  address: "Indirizzo",
  notes: "Note",
  note: "Nota",
  plannedStart: "Inizio previsto",
  plannedEnd: "Fine prevista",
  dueDate: "Scadenza",
  startsAt: "Inizio",
  endsAt: "Fine",
  allDay: "Tutto il giorno",
  contractValueCents: "Valore del contratto",
  valueCents: "Valore",
  totalCents: "Totale",
  milestoneId: "Tappa",
  projectId: "Cantiere",
  collaboratorId: "Operaio",
  preferredChannel: "Canale preferito",
  clientName: "Cliente",
};

const STATUSES: Record<string, string> = {
  planning: "In preparazione",
  active: "In corso",
  suspended: "Sospeso",
  completed: "Concluso",
  planned: "Previsto",
  in_progress: "In corso",
  skipped: "Saltato",
  todo: "Da fare",
  done: "Fatto",
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  new: "Nuovo",
  contacted: "Contattato",
  quoted: "Preventivo inviato",
  won: "Vinto",
  lost: "Perso",
};

/** Un valore in un conflitto come lo legge una persona: date, soldi, elenchi, o il testo stesso. */
function readable(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sì" : "No";
  if (typeof v === "number" && /Cents$/.test(field)) return formatEur(v / 100);
  if (Array.isArray(v)) return `${v.length} elementi`;
  if (typeof v === "object") return "…";
  const s = String(v);
  if (field === "status" && STATUSES[s]) return STATUSES[s]!;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

function fieldName(field: string): string {
  return FIELD_NAMES[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

/**
 * SYNC-1: una modifica andata a sbattere contro una fatta su un altro
 * dispositivo. Per ogni campo cambiato da entrambi si vede cosa dice la riga
 * adesso e cosa avevi impostato tu; la persona tiene uno dei due, e la
 * modifica parte (o cade) quando ogni campo è deciso.
 */
function ConflictItem({ row }: { row: OutboxRow }) {
  const [choice, setChoice] = useState<Record<string, "mine" | "theirs">>({});
  const fields = row.conflict?.fields ?? [];
  const pick = (field: string, side: "mine" | "theirs") => {
    const next = { ...choice, [field]: side };
    setChoice(next);
    if (fields.every((f) => next[f.field])) void resolveConflict(row.id, next);
  };
  return (
    <li className="sync-conflict" data-testid="sync-conflict">
      <strong>{row.label}</strong>
      <small>Un altro dispositivo ha cambiato la stessa cosa. Scegli quale valore tenere per ogni campo.</small>
      {fields.map((f) => (
        <div key={f.field} className="sync-field">
          <div className="sync-field-name">{fieldName(f.field)}</div>
          <div className="sync-choices">
            {([["theirs", f.theirs], ["mine", f.mine]] as const).map(([side, value]) => (
              <button key={side} type="button" className="sync-choice" aria-pressed={choice[f.field] === side} onClick={() => pick(f.field, side)}>
                <span className="sync-choice-who">{side === "mine" ? "La tua modifica" : "Ora c'è"}</span>
                <span className="sync-choice-value">{readable(f.field, value)}</span>
                <span className="sync-choice-keep">{side === "mine" ? "Tieni la mia" : "Tieni questa"}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </li>
  );
}

/** Quanto resta "Aggiornato adesso" dopo il primo aggiornamento di un'app riaperta dalla copia salvata. */
const UPDATED_NOTE_MS = 2_500;

/**
 * SYNC-1: l'app si è aperta dalla copia salvata sul dispositivo. Mentre gira il
 * primo aggiornamento, una pillola discreta dice cosa mostra; quando le
 * risposte arrivano dice "Aggiornato adesso" e sparisce. Galleggia sulla
 * pagina (niente spostamenti).
 */
function FreshnessNote() {
  const cache = useQueryCacheState();
  const fetching = useIsFetching() > 0;
  const [openedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const restored = cache.restoredAt !== null;
  const synced = restored && cache.lastSyncedAt !== null && cache.lastSyncedAt >= openedAt;
  useEffect(() => {
    if (!synced || done) return;
    const id = window.setTimeout(() => setDone(true), UPDATED_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [synced, done]);
  if (!restored || done) return null;
  if (synced) {
    return <div className="fresh-note" role="status" aria-live="polite"><Check aria-hidden="true" />Aggiornato adesso</div>;
  }
  if (!fetching) return null;
  return <div className="fresh-note" role="status" aria-live="polite"><RefreshCw className="animate-spin" aria-hidden="true" />{`Dati salvati alle ${syncedTime(cache.restoredAt!)} · aggiorno…`}</div>;
}

/**
 * APP-2 + SYNC-1: le cose che l'app dice di sé, nello stile degli avvisi della
 * dashboard — niente rete (cosa si vede e da quando), modifiche in coda o in
 * invio, modifiche rifiutate (riprova o scarta), conflitti con un altro
 * dispositivo, nuova versione pronta (un tocco ricarica). Si assicura anche che
 * il service worker sia registrato quando si arriva alla dashboard senza un
 * caricamento di pagina (entrati dalla home).
 */
export function PwaBar() {
  const pwa = usePwa();
  const cache = useQueryCacheState();
  const outbox = useOutbox();
  const [open, setOpen] = useState(false);
  useEffect(() => registerServiceWorker(), []);
  const pending = outbox.rows.filter((r) => r.status === "pending");
  const failed = outbox.rows.filter((r) => r.status === "failed");
  const conflicts = outbox.rows.filter((r) => r.status === "conflict");

  if (conflicts.length > 0) {
    return (
      <div className="notice danger pwa-bar" role="status">
        <span className="grow">
          {conflicts.length === 1 ? "Una tua modifica va confermata." : `${conflicts.length} tue modifiche vanno confermate.`}
          <ul className="sync-list">{conflicts.map((r) => <ConflictItem key={r.id} row={r} />)}</ul>
        </span>
      </div>
    );
  }
  if (failed.length > 0) {
    return (
      <div className="notice danger pwa-bar" role="status">
        <span className="grow">
          {failed.length === 1 ? "Una modifica non è andata a buon fine." : `${failed.length} modifiche non sono andate a buon fine.`}
          <small>{failed[0]!.label}{failed[0]!.error ? ` — ${failed[0]!.error}` : ""}</small>
          {open && (
            <ul className="sync-list">
              {failed.map((r) => (
                <li key={r.id}>
                  <span>{r.label}{r.error ? ` — ${r.error}` : ""}</span>
                  <button type="button" className="btn btn-sm" onClick={() => void discard(r.id)}>Scarta</button>
                </li>
              ))}
            </ul>
          )}
        </span>
        <span className="actions">
          <button type="button" className="btn btn-sm btn-navy" onClick={() => void retryFailed()}>Riprova</button>
          {failed.length > 1 && <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Chiudi" : "Dettagli"}</button>}
        </span>
      </div>
    );
  }
  if (!pwa.online) {
    const at = cache.lastSyncedAt ?? cache.restoredAt;
    return (
      <div className="notice warn pwa-bar" role="status">
        <span className="grow">
          Sei offline.
          <small>
            {at ? `Vedi i dati sincronizzati alle ${syncedTime(at)}; ` : "Vedi l'ultima copia salvata su questo dispositivo; "}
            {pending.length > 0 ? `${pending.length} ${pending.length === 1 ? "modifica aspetta" : "modifiche aspettano"} di partire quando torna la rete.` : "le modifiche partono quando torna la rete."}
          </small>
        </span>
      </div>
    );
  }
  if (pending.length > 0) {
    return (
      <div className="notice info pwa-bar" role="status">
        <span className="grow">
          {outbox.syncing ? <RefreshCw className="inline animate-spin" aria-hidden="true" style={{ width: 14, height: 14, marginRight: 6 }} /> : null}
          {outbox.syncing ? `Invio ${pending.length === 1 ? "una modifica" : `${pending.length} modifiche`}…` : `${pending.length === 1 ? "Una modifica aspetta" : `${pending.length} modifiche aspettano`} di partire.`}
        </span>
        {!outbox.syncing && (
          <span className="actions">
            <button type="button" className="btn btn-sm btn-navy" onClick={() => void flush()}>Invia ora</button>
          </span>
        )}
      </div>
    );
  }
  if (pwa.updateReady) {
    return (
      <div className="notice pwa-bar" role="status">
        <span className="grow">È pronta una nuova versione di PrevAI.</span>
        <span className="actions">
          <button type="button" className="btn btn-sm btn-navy" onClick={applyUpdate}>Aggiorna</button>
        </span>
      </div>
    );
  }
  return <FreshnessNote />;
}
