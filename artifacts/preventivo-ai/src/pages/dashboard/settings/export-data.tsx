import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
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
import { ACCOUNT_EXPORT_KEY, exportApi, fmtBytes, fmtDeletionDate, type AccountExportDto, type AccountExportStatus } from "@/lib/account-api";
import { ActionRow, SettingsGroup } from "./ui";

// ── GDPR-1: Tu → Il tuo accesso → Scarica i tuoi dati (art. 20) ──────────────
// Il titolare chiede lo ZIP con la password; mentre è in preparazione la
// pagina aperta lo porta avanti ogni pochi secondi (se la chiude ci pensa il
// cron e arriva un'email). Pronto: un pulsante per parte, 7 giorni.

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function ExportDataGroup() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ACCOUNT_EXPORT_KEY, queryFn: exportApi.status, staleTime: 30_000 });
  const latest = data?.exports[0];
  const preparing = latest?.stato === "in_preparazione" ? latest : null;

  // La pagina aperta porta avanti la preparazione: una parte alla volta, finché non è pronta.
  useEffect(() => {
    if (!preparing) return;
    let stop = false;
    const timer = window.setTimeout(async () => {
      try {
        const r = await exportApi.advance(preparing.id);
        if (stop) return;
        qc.setQueryData<AccountExportStatus>(ACCOUNT_EXPORT_KEY, (old) => (old ? { ...old, exports: old.exports.map((e) => (e.id === r.export.id ? r.export : e)) } : old));
        if (r.export.stato === "pronta") toast({ title: "I tuoi dati sono pronti", description: "Scarica le parti qui sotto: restano disponibili 7 giorni." });
      } catch {
        if (!stop) void qc.invalidateQueries({ queryKey: ACCOUNT_EXPORT_KEY });
      }
    }, 3000);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [preparing, qc, toast]);

  if (!data) return null;

  if (!data.available) {
    return (
      <SettingsGroup>
        <ActionRow
          label="Scarica i tuoi dati"
          help={<>Scrivi a <a href="mailto:privacy@prevai.it?subject=Copia%20dei%20miei%20dati">privacy@prevai.it</a> dall'email con cui accedi: ti mandiamo una copia di tutti i dati della tua impresa entro 30 giorni.</>}
        />
      </SettingsGroup>
    );
  }

  if (!data.canExport) {
    return (
      <SettingsGroup>
        <ActionRow
          label="Scarica i tuoi dati"
          help={<>I dati dell'impresa li scarica il titolare. Per una copia dei tuoi dati personali scrivi a <a href="mailto:privacy@prevai.it?subject=Copia%20dei%20miei%20dati">privacy@prevai.it</a>.</>}
        />
      </SettingsGroup>
    );
  }

  const ready = latest?.stato === "pronta" && latest.expiresAt && new Date(latest.expiresAt) > new Date() ? latest : null;
  const requestButton = (
    <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setOpen(true)} disabled={Boolean(preparing) || Boolean(data.nextAllowedAt)}>
      {ready ? "Chiedine una nuova" : "Prepara i miei dati"}
    </button>
  );

  return (
    <SettingsGroup>
      {preparing ? (
        <ActionRow
          label="Stiamo preparando i tuoi dati"
          help={
            preparing.fileCount === null
              ? "Raccogliamo le tabelle della tua impresa. Puoi lasciare la pagina: ti mandiamo un'email quando è pronto."
              : `File impacchettati: ${preparing.filesDone} di ${preparing.fileCount}. Puoi lasciare la pagina: ti mandiamo un'email quando è pronto.`
          }
        >
          <Loader2 className="animate-spin text-muted-foreground" aria-label="In preparazione" />
        </ActionRow>
      ) : ready ? (
        <ReadyExport exp={ready} />
      ) : (
        <ActionRow
          label="Scarica i tuoi dati"
          help={
            latest?.stato === "errore"
              ? "L'ultima preparazione non è riuscita e ci è arrivato un avviso. Puoi riprovare subito."
              : `Uno ZIP con clienti, preventivi, contratti, fatture, cantieri e tutti i tuoi file (PDF, foto, ricevute), in formati che si aprono con Excel o con qualsiasi programma. Resta scaricabile ${data.ttlDays} giorni.`
          }
        >
          {requestButton}
        </ActionRow>
      )}
      {ready && (
        <ActionRow label="Una nuova copia" help={data.nextAllowedAt ? `Puoi chiederne una nuova dal ${fmtWhen(data.nextAllowedAt)}.` : "Se nel frattempo hai aggiunto dati, preparane una aggiornata."}>
          {requestButton}
        </ActionRow>
      )}
      <ExportDialog open={open} onOpenChange={setOpen} ttlDays={data.ttlDays} />
    </SettingsGroup>
  );
}

function ReadyExport({ exp }: { exp: AccountExportDto }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const download = async (n: number) => {
    setBusy(n);
    try {
      const { url } = await exportApi.partUrl(exp.id, n);
      // Link firmato di 5 minuti con il nome del file: il browser lo scarica e resta sulla pagina.
      window.location.href = url;
    } catch (e) {
      toast({ title: "Scaricamento non riuscito", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };
  const total = exp.parts.length;
  return (
    <>
      <ActionRow
        label="I tuoi dati sono pronti"
        help={`${total === 1 ? "Un file ZIP" : `${total} file ZIP`}, ${fmtBytes(exp.totalBytes ?? 0)} in tutto. Scaricabili fino al ${fmtDeletionDate(exp.expiresAt!)}.${total > 1 ? " Scarica tutte le parti: nella prima c'è l'elenco dei file e in quale parte si trovano." : ""}`}
      />
      {exp.parts.map((p) => (
        <ActionRow
          key={p.n}
          label={p.kind === "dati" ? `Parte ${p.n} di ${total} · Tabelle` : `Parte ${p.n} di ${total} · ${p.files === 1 ? "1 file" : `${p.files} file`}`}
          help={p.kind === "dati" ? `${exp.tableCount ?? 0} tabelle in JSON e in CSV per Excel · ${fmtBytes(p.bytes)}` : fmtBytes(p.bytes)}
        >
          <button type="button" className="btn btn-sm btn-outline-navy gap-2" onClick={() => void download(p.n)} disabled={busy !== null}>
            {busy === p.n ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Scarica
          </button>
        </ActionRow>
      ))}
      {exp.skippedFiles.length > 0 && (
        <ActionRow
          label={exp.skippedFiles.length === 1 ? "1 file non incluso" : `${exp.skippedFiles.length} file non inclusi`}
          help={<>Non c'erano più o erano troppo grandi: {exp.skippedFiles.slice(0, 3).join(", ")}{exp.skippedFiles.length > 3 ? "…" : ""}. Se ti servono scrivi a <a href="mailto:privacy@prevai.it">privacy@prevai.it</a>.</>}
        />
      )}
    </>
  );
}

function ExportDialog({ open, onOpenChange, ttlDays }: { open: boolean; onOpenChange: (o: boolean) => void; ttlDays: number }) {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const request = useMutation({
    mutationFn: () => exportApi.request(password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ACCOUNT_EXPORT_KEY });
      setPassword("");
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password && !request.isPending) request.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(null); }}>
      <AlertDialogContent>
        <form onSubmit={submit} className="del-acc-form">
          <AlertDialogHeader>
            <AlertDialogTitle>Preparare una copia dei tuoi dati?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="del-acc-text">
                <p>Mettiamo in uno ZIP tutto quello che la tua impresa ha in PrevAI: le tabelle in JSON e in CSV per Excel, e tutti i file così come li hai caricati. Password, chiavi e token dei collegamenti non sono inclusi.</p>
                <p>Può volerci qualche minuto se hai molte foto. Lo scarichi da questa pagina per {ttlDays} giorni; ti avvisiamo anche per email. Dentro ci sono i dati dei tuoi clienti: conservalo con cura.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="modal-body del-acc-fields">
            <div className="field">
              <label htmlFor="exp-password">La tua password</label>
              <input id="exp-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <p className="del-acc-error" role="alert">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annulla</AlertDialogCancel>
            <button type="submit" className="btn btn-sm btn-navy" disabled={!password || request.isPending}>
              {request.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Prepara i miei dati
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
