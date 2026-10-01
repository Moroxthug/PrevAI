import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { idbSupported, idbGetAll, idbPut, idbDelete, idbClear, OUTBOX_STORE } from "./db";
import type { EditBase } from "../sync/protocol";
import type { FieldConflict } from "../sync/merge";
import { tempIdFor, TEMP_ID_RE } from "../sync/temp-id";
import { rawFetch } from "../sync/raw-fetch";

/** SYNC-1: il replay delle modifiche in coda è un chunk a parte, caricato solo quando c'è qualcosa da inviare. */
const syncCore = () => import("../sync/replay");

// SYNC-1 (docs/PIANO-AZIONE.md riga 54, da QuoteAI 77/117): la coda di invio.
//
// Le modifiche fatte senza rete (o quando la richiesta muore per strada)
// finiscono qui e partono, in ordine, appena la rete torna. Ogni operazione
// viaggia con la propria Idempotency-Key: se il server l'aveva già eseguita,
// la risposta è la stessa e non nasce un doppione.
//
// Le operazioni stanno in IndexedDB e, in copia, in memoria per la barra di
// stato. La coda si ferma al primo errore di rete (il resto aspetta); un 4xx
// segna l'operazione "failed" (da riprovare o scartare) e la coda va avanti.
//
// Le modifiche sono quelle di lib/sync/routes.ts, messe in coda da
// lib/sync/sync-fetch.ts con la versione su cui sono state fatte. Se la riga
// è cambiata altrove, si fondono campo per campo; quando i due lati hanno
// cambiato lo stesso campo l'operazione diventa `conflict` e aspetta la
// persona (tengo la mia / tengo quella) senza fermare il resto. L'id
// provvisorio di una creazione in coda (`q_<id>`) viene sostituito con quello
// vero nelle operazioni che la seguono.

export type OutboxOp = { kind: "api"; method: string; path: string; body: string | null; key: string; base: EditBase | null };

type OutboxStatus = "pending" | "failed" | "conflict";

/** Entrambi i lati hanno cambiato lo stesso campo: la persona sceglie, campo per campo. */
export type OutboxConflict = { fields: FieldConflict[]; patch: Record<string, unknown>; current: Record<string, unknown>; version: string };

export type OutboxRow = {
  /** È anche l'Idempotency-Key inviata al server. */
  id: string;
  /** Raggruppa le righe per pagina: l'id del cantiere o della riga stessa. */
  scope: string;
  /** Etichetta breve per il pannello ("Attività aggiornata · Stuccatura"). */
  label: string;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  error: string | null;
  op: OutboxOp;
  conflict?: OutboxConflict;
};

export type OutboxSnapshot = { rows: OutboxRow[]; syncing: boolean; supported: boolean; lastSyncedAt: string | null };

const MAX_ATTEMPTS = 8;

let rows: OutboxRow[] = [];
let syncing = false;
let lastSyncedAt: string | null = null;
let loaded: Promise<void> | null = null;
let snapshot: OutboxSnapshot = { rows, syncing, supported: idbSupported(), lastSyncedAt };
const listeners = new Set<() => void>();
let queryClient: QueryClient | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  snapshot = { rows, syncing, supported: idbSupported(), lastSyncedAt };
  for (const l of listeners) l();
}

/** L'App registra il suo QueryClient, così un'operazione inviata aggiorna ciò che la pagina mostra. */
export function setOutboxQueryClient(qc: QueryClient): void {
  queryClient = qc;
}

async function ensureLoaded(): Promise<void> {
  if (!idbSupported()) return;
  if (!loaded) {
    loaded = idbGetAll<OutboxRow>(OUTBOX_STORE)
      .then((all) => {
        rows = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        emit();
      })
      .catch(() => {
        rows = [];
      });
  }
  await loaded;
}

export function newClientRef(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-${Math.random().toString(16).slice(2, 14)}`;
}

/** Una fetch che non ha raggiunto il server, o la risposta "offline" del service worker. */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const e = err as { code?: string; status?: number; name?: string };
  return e.code === "OFFLINE" || e.status === 0 || e.name === "AbortError";
}

function isRetryable(err: unknown): boolean {
  const { status = 0, code } = err as { status?: number; code?: string };
  // 409 IDEMPOTENCY_IN_PROGRESS: la stessa operazione sta ancora girando sul server (un tentativo precedente).
  return status >= 500 || status === 429 || status === 408 || code === "IDEMPOTENCY_IN_PROGRESS";
}

export async function enqueue(op: OutboxOp, opts: { id?: string; scope: string; label: string; conflict?: OutboxConflict }): Promise<OutboxRow> {
  await ensureLoaded();
  const row: OutboxRow = { id: opts.id ?? newClientRef(), scope: opts.scope, label: opts.label, createdAt: new Date().toISOString(), attempts: 0, status: opts.conflict ? "conflict" : "pending", error: null, op, conflict: opts.conflict };
  if (idbSupported()) await idbPut(OUTBOX_STORE, row);
  rows = [...rows.filter((r) => r.id !== row.id), row];
  emit();
  if (!opts.conflict && (typeof navigator === "undefined" || navigator.onLine)) scheduleFlush(250);
  return row;
}

/** La coda com'è ora (il livello di sync tiene le nuove modifiche dietro quelle più vecchie dello stesso cantiere). */
export async function queuedRows(): Promise<OutboxRow[]> {
  await ensureLoaded();
  return rows;
}

async function update(row: OutboxRow) {
  if (idbSupported()) await idbPut(OUTBOX_STORE, row);
  rows = rows.map((r) => (r.id === row.id ? row : r));
  emit();
}

async function remove(id: string) {
  if (idbSupported()) await idbDelete(OUTBOX_STORE, id);
  rows = rows.filter((r) => r.id !== id);
  emit();
}

/** All'uscita dall'account: nulla di ciò che la persona aveva in coda resta per la prossima su questo dispositivo. */
export async function clearOutbox(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  rows = [];
  loaded = Promise.resolve();
  emit();
  if (idbSupported()) await idbClear(OUTBOX_STORE).catch(() => undefined);
}

export async function discard(id: string): Promise<void> {
  await ensureLoaded();
  await remove(id);
}

/**
 * La persona ha scelto, per ogni campo cambiato da entrambi, quale valore
 * resta. Quello degli altri ovunque (e nient'altro da inviare) scarta
 * l'operazione; altrimenti riparte sulla versione che il server ha indicato.
 */
export async function resolveConflict(id: string, choice: Record<string, "mine" | "theirs">): Promise<void> {
  await ensureLoaded();
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "conflict" || !row.conflict) return;
  const { resolvePatch } = await syncCore();
  const patch = resolvePatch(row.conflict.patch, row.conflict.fields, choice);
  if (Object.keys(patch).length === 0) {
    await remove(id);
    invalidateFor(row.op);
    return;
  }
  const op = { ...row.op, body: JSON.stringify(patch), key: newClientRef(), base: { version: row.conflict.version, values: row.conflict.current } };
  await update({ ...row, op, status: "pending", attempts: 0, error: null, conflict: undefined });
  scheduleFlush(0);
}

export async function retryFailed(scope?: string): Promise<void> {
  await ensureLoaded();
  for (const r of rows) if (r.status === "failed" && (!scope || r.scope === scope)) await update({ ...r, status: "pending", attempts: 0, error: null });
  scheduleFlush(0);
}

/** Invia una modifica in coda. Vale true quando è fatta, false quando è diventata un conflitto. */
async function execute(row: OutboxRow): Promise<boolean> {
  const op = row.op;
  const { sendEdit, matchRoute, recordServerData, rowIn } = await syncCore();
  const outcome = await sendEdit({ method: op.method, path: op.path, body: op.body, key: op.key, base: op.base }, (path, init) => rawFetch(path, init), newClientRef);
  const match = matchRoute(op.method, op.path.split("?")[0]!);
  if (outcome.kind === "noop") {
    if (match?.id) await rebaseBehind(row, match.id, outcome.current);
    return true;
  }
  if (outcome.kind === "conflict") {
    await update({ ...row, status: "conflict", error: null, conflict: { fields: outcome.fields, patch: outcome.patch, current: outcome.current, version: outcome.version } });
    return false;
  }
  const res = outcome.response;
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(body.message || body.error || `Richiesta non riuscita (${res.status})`)) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : undefined;
    throw err;
  }
  recordServerData(body);
  const realId = match?.route.createdId?.(body) ?? null;
  if (realId) await swapTempId(tempIdFor(row.id), realId);
  const saved = match?.id ? rowIn(body, match.id) : null;
  if (saved && match?.id) await rebaseBehind(row, match.id, saved);
  return true;
}

/** Le modifiche successive della stessa riga ora si fanno su questa risposta (lib/sync/protocol.ts rebase). */
async function rebaseBehind(done: OutboxRow, id: string, current: Record<string, unknown>) {
  const { matchRoute, rebase } = await syncCore();
  for (const r of rows) {
    if (r.id === done.id || r.status === "conflict" || !r.op.base) continue;
    if (matchRoute(r.op.method, r.op.path.split("?")[0]!)?.id !== id) continue;
    const base = rebase(r.op.body, current);
    if (base) await update({ ...r, op: { ...r.op, base } });
  }
}

/** Una creazione in coda è andata a buon fine: le operazioni dietro di lei ora nominano la riga vera. */
async function swapTempId(tempId: string, realId: string) {
  for (const r of rows) {
    const op = r.op;
    if (!op.path.includes(tempId) && !(op.body ?? "").includes(tempId)) continue;
    await update({ ...r, op: { ...op, path: op.path.split(tempId).join(realId), body: op.body == null ? null : op.body.split(tempId).join(realId) } });
  }
}

/** Un'operazione che nomina una riga ancora da creare (la sua creazione è in coda davanti, o bloccata). */
function waitsOnCreate(row: OutboxRow): boolean {
  const text = `${row.op.path} ${row.op.body ?? ""}`;
  const refs = text.match(TEMP_ID_RE) ?? [];
  return refs.some((ref) => rows.some((r) => r.id !== row.id && tempIdFor(r.id) === ref));
}

function invalidateFor(op: OutboxOp) {
  if (!queryClient) return;
  const qc = queryClient;
  void syncCore().then(({ matchRoute, changeOf, affectsAny }) => {
    const match = matchRoute(op.method, op.path.split("?")[0]!);
    if (match) void qc.invalidateQueries({ predicate: affectsAny([changeOf(match)]) });
  });
}

/** Rimanda in ordine le operazioni in attesa. Idempotente: una seconda chiamata mentre una gira non fa nulla. */
export async function flush(): Promise<void> {
  if (syncing) return;
  await ensureLoaded();
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const pending = rows.filter((r) => r.status === "pending");
  if (pending.length === 0) return;
  syncing = true;
  emit();
  try {
    for (const queued of pending) {
      // Le operazioni precedenti di questo giro possono averla riscritta (l'id vero di una creazione).
      const row = rows.find((r) => r.id === queued.id);
      if (!row || row.status !== "pending" || waitsOnCreate(row)) continue;
      try {
        if (await execute(row)) await remove(row.id);
        lastSyncedAt = new Date().toISOString();
        invalidateFor(row.op);
      } catch (err) {
        const message = (err as Error).message || "Richiesta non riuscita";
        if (isNetworkError(err)) {
          // Ancora senza rete (o a intermittenza): ci si ferma qui, si tiene l'ordine, si riprova dopo.
          await update({ ...row, error: null });
          scheduleFlush(15_000);
          break;
        }
        if (isRetryable(err) && row.attempts + 1 < MAX_ATTEMPTS) {
          await update({ ...row, attempts: row.attempts + 1, error: message });
          scheduleFlush(Math.min(60_000, 2_000 * 2 ** row.attempts));
          break;
        }
        // Il server l'ha rifiutata (validazione, conflitto, bloccata): serve una persona.
        await update({ ...row, status: "failed", attempts: row.attempts + 1, error: message });
        invalidateFor(row.op);
      }
    }
  } finally {
    syncing = false;
    emit();
  }
}

function scheduleFlush(delayMs: number) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, delayMs);
}

let started = false;
/** Aggancia i trigger di ritorno della rete / di primo piano. Idempotente; chiamata da App.tsx. */
export function startOutbox(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => scheduleFlush(500));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush(0);
  });
  void ensureLoaded().then(() => scheduleFlush(1_000));
  // Cintura e bretelle per una coda ferma dietro un errore riprovabile.
  setInterval(() => {
    if (rows.some((r) => r.status === "pending") && !syncing) scheduleFlush(0);
  }, 45_000);
}

export function useOutbox(scope?: string): OutboxSnapshot {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      void ensureLoaded();
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
  if (!scope) return snap;
  return { ...snap, rows: snap.rows.filter((r) => r.scope === scope) };
}
