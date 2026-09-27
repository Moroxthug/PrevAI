import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle2, Loader2, Lock, PauseCircle, XCircle } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { planLabelOf } from "../plan";
import { ActionRow, SettingsGroup } from "../ui";
import { requiredPlanFor, type AppDef } from "./catalog";
import type { AppStatus } from "./status";

/**
 * Il marchio dell'azienda da public/brands/, su un riquadro bianco, mai
 * ricolorato né deformato (object-fit: contain). I nostri strumenti, i marchi
 * il cui titolare non ci concede il logo e un file mancante hanno l'icona.
 */
export function BrandLogo({ app, size = "md" }: { app: AppDef; size?: "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const Icon = app.icon;
  const showLogo = !!app.logo && !broken;
  return (
    <span className={cn("app-logo", size === "lg" && "lg", showLogo ? app.wide && "wide" : "own")} aria-hidden="true">
      {showLogo ? <img src={`/brands/${app.logo}`} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <Icon />}
    </span>
  );
}

/** Il nome di ciò che sblocca l'app: "piano Elite", "PrevAI Fisco". */
function unlockName(app: AppDef): string {
  return app.addon ?? `piano ${planLabelOf(requiredPlanFor(app)) ?? ""}`.trim();
}

/** Collegata / Collega / Da sistemare / In pausa / In arrivo / Con il piano X. */
export function StatusPill({ app, status }: { app: AppDef; status: AppStatus }) {
  switch (status.state) {
    case "loading":
      return <span className="chip chip-grey app-pill-loading" aria-hidden="true">&nbsp;</span>;
    case "connected":
      return <span className="chip chip-green"><CheckCircle2 aria-hidden="true" />{app.section === "widget" ? "Attivo" : "Collegata"}</span>;
    case "attention":
      return <span className="chip chip-red"><AlertTriangle aria-hidden="true" />Da sistemare</span>;
    case "paused":
      return <span className="chip chip-grey"><PauseCircle aria-hidden="true" />In pausa</span>;
    case "soon":
      return <span className="chip chip-grey">In arrivo</span>;
    case "locked":
      return <span className="chip chip-grey"><Lock aria-hidden="true" />{app.addon ? app.addon : `Piano ${planLabelOf(requiredPlanFor(app)) ?? ""}`}</span>;
    default:
      return <span className="chip app-pill-connect">{app.section ? "Configura" : "Collega"}</span>;
  }
}

/**
 * Cosa serve a un'app col lucchetto. Nomina il piano (o il modulo) che la
 * aggiunge e porta a Piano e fatturazione: niente prezzi né pagamento qui
 * (le app degli store non vendono dentro l'app, APP-PLAN).
 */
export function LockNote({ app }: { app: AppDef }) {
  const plan = planLabelOf(requiredPlanFor(app));
  return (
    <SettingsGroup>
      <div className="app-lock">
        <span className="app-lock-ic"><Lock aria-hidden="true" /></span>
        <div>
          <p className="app-lock-title">Inclusa con {unlockName(app)}</p>
          <p className="app-lock-sub">
            {app.addon ? "È un modulo aggiuntivo: si attiva da Piano e fatturazione." : plan === "Elite" ? "Solo nel piano Elite." : `Nel piano ${plan} e nei piani superiori.`}
          </p>
        </div>
        <Link href="/dashboard/settings/plan" className="btn btn-sm btn-outline-navy">Vedi i piani</Link>
      </div>
    </SettingsGroup>
  );
}

export type LogRow = { id: string; ok: boolean; label: string; error?: string | null };

/** Un registro breve: prima gli errori, poi il resto, al massimo otto righe. */
export function SyncLog({ title, rows, empty }: { title: string; rows: LogRow[]; empty?: string }) {
  if (!rows.length && !empty) return null;
  const sorted = [...rows].sort((a, b) => Number(a.ok) - Number(b.ok)).slice(0, 8);
  return (
    <SettingsGroup title={title}>
      {sorted.length ? (
        <ul className="app-log">
          {sorted.map((r) => (
            <li key={r.id}>
              {r.ok ? <CheckCircle2 className="ok" aria-hidden="true" /> : <XCircle className="bad" aria-hidden="true" />}
              <span className="app-log-txt">
                <span className="app-log-label">{r.label}<span className="sr-only">: {r.ok ? "riuscito" : "non riuscito"}</span></span>
                {r.error && <span className="app-log-err">{r.error}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sgroup-pad app-muted">{empty}</p>
      )}
    </SettingsGroup>
  );
}

/** Scollega sta per ultimo, in una scheda sua, e chiede prima. */
export function DisconnectRow({ name, help, onConfirm, pending }: { name: string; help?: ReactNode; onConfirm: () => void; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsGroup danger>
      <ActionRow label={`Scollega ${name}`} help={help ?? "PrevAI smette subito di usare questo collegamento. Puoi ricollegarlo quando vuoi."}>
        <button type="button" className="btn btn-sm btn-outline-navy app-danger" onClick={() => setOpen(true)} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Scollega
        </button>
      </ActionRow>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scollegare {name}?</AlertDialogTitle>
            <AlertDialogDescription>Quello che è già passato resta com'è; da adesso PrevAI non invia né riceve più nulla da qui.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Lascia collegato</AlertDialogCancel>
            <button type="button" className="btn btn-sm btn-red" onClick={() => { setOpen(false); onConfirm(); }}>
              Scollega
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsGroup>
  );
}

/** "Account · mario@… / Ultima sincronizzazione · ieri" come righe. */
export function AccountFacts({ facts }: { facts: Array<[string, ReactNode] | false | null | undefined> }) {
  const shown = facts.filter(Boolean) as Array<[string, ReactNode]>;
  if (!shown.length) return null;
  return (
    <dl className="app-facts">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("it-IT") : null);
export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
