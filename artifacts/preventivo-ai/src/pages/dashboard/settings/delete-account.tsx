import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ACCOUNT_DELETION_KEY, accountApi, fmtDeletionDate } from "@/lib/account-api";
import { ActionRow, SettingsGroup } from "./ui";

// ── APP-1c: Tu → Il tuo accesso → Elimina account ─────────────────────────────
// Apple 5.1.1(v) vuole la cancellazione dentro l'app: questa pagina È l'app
// (la shell nativa carica la stessa dashboard). Ultima scheda della sezione,
// in rosso, con una finestra che chiede ELIMINA e la password. Durante i 30
// giorni la scheda diventa "Il tuo account sarà cancellato il …" con Annulla.

export function DeleteAccountGroup() {
  const { data } = useQuery({ queryKey: ACCOUNT_DELETION_KEY, queryFn: accountApi.deletionStatus, staleTime: 30_000 });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: accountApi.cancelDeletion,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ACCOUNT_DELETION_KEY });
      toast({ title: "Cancellazione annullata", description: "Il tuo account resta attivo." });
    },
    onError: (e: Error) => toast({ title: "Non è stato possibile annullare", description: e.message, variant: "destructive" }),
  });

  if (!data) return null;

  if (!data.available) {
    return (
      <SettingsGroup danger>
        <ActionRow
          label="Elimina account"
          help={<>Scrivi a <a href="mailto:privacy@prevai.it?subject=Cancellazione%20account">privacy@prevai.it</a> dall'email con cui accedi: cancelliamo l'account entro 30 giorni. <a href="/help/delete-account/">Cosa cancelliamo</a></>}
        />
      </SettingsGroup>
    );
  }

  if (data.own) {
    return (
      <SettingsGroup danger>
        <ActionRow
          label={`Il tuo account sarà cancellato il ${fmtDeletionDate(data.own.scheduledFor)}`}
          help="Fino ad allora puoi entrare, scaricare i tuoi documenti e cambiare idea. Ti mandiamo un promemoria una settimana prima."
        >
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Annulla la cancellazione
          </button>
        </ActionRow>
      </SettingsGroup>
    );
  }

  return (
    <SettingsGroup danger>
      <ActionRow
        label="Elimina account"
        help={
          data.ownsOrg
            ? `Cancella il tuo accesso e i dati della tua impresa, anche per la squadra. Hai ${data.graceDays} giorni per ripensarci.`
            : `Cancella il tuo accesso a PrevAI. I documenti dell'impresa per cui lavori restano suoi. Hai ${data.graceDays} giorni per ripensarci.`
        }
      >
        <button type="button" className="btn btn-sm btn-outline-navy app-danger" onClick={() => setOpen(true)}>
          Elimina account
        </button>
      </ActionRow>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} ownsOrg={data.ownsOrg} graceDays={data.graceDays} />
    </SettingsGroup>
  );
}

function DeleteAccountDialog({ open, onOpenChange, ownsOrg, graceDays }: { open: boolean; onOpenChange: (o: boolean) => void; ownsOrg: boolean; graceDays: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => accountApi.requestDeletion({ password, confirm: "ELIMINA", reason: reason.trim() || undefined }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ACCOUNT_DELETION_KEY });
      onOpenChange(false);
      setPassword("");
      setConfirm("");
      toast({ title: "Cancellazione programmata", description: `Il ${fmtDeletionDate(r.own.scheduledFor)}. Ti abbiamo mandato un'email con il link per annullare.` });
    },
    onError: (e: Error) => setError(e.message),
  });

  const ready = confirm.trim() === "ELIMINA" && password.length > 0 && !request.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (ready) request.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(null); }}>
      <AlertDialogContent>
        <form onSubmit={submit} className="del-acc-form">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il tuo account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="del-acc-text">
                {ownsOrg ? (
                  <p>Cancelliamo il tuo accesso e i dati della tua impresa: clienti, preventivi, cantieri con foto, listino, lead e collegamenti. La squadra perde l'accesso e gli abbonamenti non si rinnovano più.</p>
                ) : (
                  <p>Cancelliamo il tuo accesso a PrevAI. I preventivi e i documenti dell'impresa per cui lavori restano suoi.</p>
                )}
                <p>
                  Succede tra <b>{graceDays} giorni</b>: fino ad allora puoi {ownsOrg ? "scaricare una copia di tutti i tuoi dati (Scarica i tuoi dati, qui sopra)" : "scaricare i tuoi documenti"} e annullare. Per legge conserviamo solo contratti firmati e fatture, per 10 anni.{" "}
                  <a href="/help/delete-account/" target="_blank" rel="noopener">Tutti i dettagli</a>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="modal-body del-acc-fields">
            <div className="field">
              <label htmlFor="del-acc-confirm">Scrivi ELIMINA per confermare</label>
              <input id="del-acc-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            </div>
            <div className="field">
              <label htmlFor="del-acc-password">La tua password</label>
              <input id="del-acc-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="del-acc-reason">Perché te ne vai? (facoltativo)</label>
              <textarea id="del-acc-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <p className="del-acc-error" role="alert">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Tieni l'account</AlertDialogCancel>
            <button type="submit" className="btn btn-sm btn-red" disabled={!ready}>
              {request.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Elimina account
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** In cima alla dashboard durante i 30 giorni: per chi si cancella e per la sua squadra. */
export function AccountDeletionBanner() {
  const [location] = useLocation();
  const { data } = useQuery({ queryKey: ACCOUNT_DELETION_KEY, queryFn: accountApi.deletionStatus, staleTime: 5 * 60_000, retry: false });
  if (!data?.available) return null;
  if (data.own) {
    // Sulla pagina del proprio accesso la scheda dice già tutto.
    if (location.startsWith("/dashboard/settings/access")) return null;
    return (
      <div className="notice danger del-acc-banner" role="status">
        <span className="grow">
          Il tuo account sarà cancellato il {fmtDeletionDate(data.own.scheduledFor)}.
          <small>Scarica prima i documenti che vuoi tenere.</small>
        </span>
        <span className="actions">
          <Link href="/dashboard/settings/access" className="btn btn-sm btn-outline-navy">Annulla la cancellazione</Link>
        </span>
      </div>
    );
  }
  if (data.org) {
    return (
      <div className="notice warn del-acc-banner" role="status">
        <span className="grow">
          Il titolare ha chiesto di cancellare l'account dell'impresa: dal {fmtDeletionDate(data.org.scheduledFor)} non potrai più entrarci.
          <small>Se ti servono dei documenti, chiedili al titolare prima di quella data.</small>
        </span>
      </div>
    );
  }
  return null;
}
