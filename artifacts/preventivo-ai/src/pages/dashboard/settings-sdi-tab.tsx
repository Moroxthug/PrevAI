import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Circle, Copy, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sdiApi, type PatchSdiSettings } from "@/lib/sdi-api";

// A-1: configurazione del modulo Fatture SDI.
// L'ordine non è casuale: prima i dati fiscali (senza, ogni fattura viene
// scartata), poi il regime, poi l'intermediario, la delega e infine il codice
// destinatario da registrare nel portale dell'Agenzia. Il ciclo passivo resta
// per ultimo perché è una scelta facoltativa e revocabile.

const STATI: Record<string, { testo: string; colore: string }> = {
  non_configurato: { testo: "Non configurato", colore: "var(--muted-mk)" },
  in_configurazione: { testo: "Configurazione da completare", colore: "var(--yellow-dark)" },
  attivo: { testo: "Attivo — le fatture sono documenti fiscali", colore: "var(--green)" },
  sospeso: { testo: "Sospeso", colore: "var(--red)" },
};

export function SdiTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tokenApi, setTokenApi] = useState("");
  const [segretoWebhook, setSegretoWebhook] = useState("");

  const settings = useQuery({ queryKey: ["sdi", "settings"], queryFn: () => sdiApi.settings(), retry: false });
  const onboarding = useQuery({ queryKey: ["sdi", "onboarding"], queryFn: () => sdiApi.onboarding(), retry: false });

  const salva = useMutation({
    mutationFn: (patch: PatchSdiSettings) => sdiApi.updateSettings(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sdi"] });
      toast({ title: "Impostazioni salvate" });
    },
    onError: (err: Error) => toast({ title: "Salvataggio non riuscito", description: err.message, variant: "destructive" }),
  });

  if (settings.isLoading) return <div className="card p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (settings.isError) {
    return (
      <div className="card card-empty">
        Il modulo PrevAI Fisco non è attivo su questo account: le fatture restano pro-forma.
        <br />
        <Link href="/dashboard/settings?tab=billing" className="text-link">Vedi i piani</Link>
      </div>
    );
  }

  const s = settings.data!.settings;
  const stato = STATI[s.stato] ?? STATI.non_configurato;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Fatturazione elettronica (SdI)</h2>
            <p className="sub">Emissione, ricevute e conservazione delle fatture verso il Sistema di Interscambio.</p>
          </div>
          <span className="badge" style={{ color: stato.colore }}>{stato.testo}</span>
        </div>

        <div className="act-body space-y-3">
          {s.requisitiMancanti.length > 0 && (
            <div className="notice warn" style={{ alignItems: "flex-start" }}>
              <AlertTriangle />
              <div className="grow">
                <strong>Prima di emettere serve ancora:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  {s.requisitiMancanti.map((r) => (
                    <li key={r.campo}>{r.messaggio}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="sdi-regime">Regime fiscale dichiarato in fattura</label>
            <select id="sdi-regime" value={s.regimeFiscale} onChange={(e) => salva.mutate({ regimeFiscale: e.target.value, completa: ["regime"] })}>
              {Object.entries(settings.data!.regimi).map(([codice, nome]) => (
                <option key={codice} value={codice}>
                  {codice} — {nome}
                </option>
              ))}
            </select>
            <p className="hint">Gli artigiani forfettari usano RF19: in fattura non si espone IVA e ogni riga porta la natura N2.2 con la dicitura di legge.</p>
          </div>

          <div className="field">
            <label htmlFor="sdi-provider">Intermediario</label>
            <select id="sdi-provider" value={s.provider} onChange={(e) => salva.mutate({ provider: e.target.value as PatchSdiSettings["provider"] })}>
              <option value="simulato">Simulato (prova, nessun invio reale)</option>
              <option value="openapi">Openapi.it</option>
            </select>
            <p className="hint">PrevAI non è un canale accreditato presso l'Agenzia delle Entrate: la trasmissione e la firma le fa un intermediario accreditato.</p>
          </div>

          {s.provider !== "simulato" && (
            <>
              <div className="field">
                <label htmlFor="sdi-token">Token API dell'intermediario</label>
                <div className="field inline">
                  <input
                    id="sdi-token"
                    type="password"
                    className="flex-1 min-w-0"
                    placeholder={s.credenzialiPresenti ? "•••••••• (salvato)" : "Incolla il token"}
                    value={tokenApi}
                    onChange={(e) => setTokenApi(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-navy"
                    disabled={!tokenApi || salva.isPending}
                    onClick={() => {
                      salva.mutate({ providerApiKey: tokenApi, completa: ["intermediario"] });
                      setTokenApi("");
                    }}
                  >
                    Salva
                  </button>
                </div>
                <p className="hint">Conservato cifrato: una volta salvato non è più leggibile, si può solo sostituire.</p>
              </div>

              <div className="field">
                <label htmlFor="sdi-ambiente">Ambiente</label>
                <select id="sdi-ambiente" value={s.ambiente} onChange={(e) => salva.mutate({ ambiente: e.target.value as "sandbox" | "produzione" })}>
                  <option value="sandbox">Prova (sandbox) — i documenti non sono validi</option>
                  <option value="produzione">Produzione — le fatture partono davvero</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="sdi-webhook">Segreto per le notifiche</label>
                <div className="field inline">
                  <input
                    id="sdi-webhook"
                    type="password"
                    className="flex-1 min-w-0"
                    placeholder={s.webhookSegretoPresente ? "•••••••• (salvato)" : "Almeno 16 caratteri"}
                    value={segretoWebhook}
                    onChange={(e) => setSegretoWebhook(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-navy"
                    disabled={segretoWebhook.length < 16 || salva.isPending}
                    onClick={() => {
                      salva.mutate({ webhookSecret: segretoWebhook });
                      setSegretoWebhook("");
                    }}
                  >
                    Salva
                  </button>
                </div>
                <p className="hint">
                  Va registrato presso l'intermediario insieme all'URL delle notifiche. Senza segreto, le notifiche in arrivo vengono rifiutate.
                </p>
              </div>
            </>
          )}

          <label className="field inline" style={{ alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={s.conservazioneAttiva} onChange={(e) => salva.mutate({ conservazioneAttiva: e.target.checked })} />
            <span>
              <ShieldCheck className="h-4 w-4 inline mr-1" />
              Conservazione a norma tramite l'intermediario (10 anni, art. 2220 c.c.)
            </span>
          </label>

          <label className="field inline" style={{ alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={Boolean(s.delegaFirmataAt)} onChange={(e) => salva.mutate({ delegaFirmata: e.target.checked, completa: e.target.checked ? ["delega"] : [] })} />
            <span>Ho firmato la delega presso l'intermediario</span>
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Ricevere le fatture dei fornitori</h2>
            <p className="sub">Scelta facoltativa e revocabile. Le fatture di acquisto diventano costi di cantiere con un clic.</p>
          </div>
        </div>
        <div className="act-body space-y-3">
          <label className="field inline" style={{ alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={s.cicloPassivoAttivo} onChange={(e) => salva.mutate({ cicloPassivoAttivo: e.target.checked, completa: e.target.checked ? ["ciclo_passivo"] : [] })} />
            <span>Attiva la ricezione delle fatture di acquisto</span>
          </label>
          <p className="hint">
            Finché è spenta, PrevAI non scarica nessuna fattura di acquisto. Puoi disattivarla quando vuoi: le fatture già scaricate restano dove sono.
          </p>

          {onboarding.data?.codiceDestinatarioIntermediario && (
            <div className="notice info" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <strong>Codice destinatario da registrare</strong>
                <p className="text-xs mt-1">
                  Entra in <em>Fatture e Corrispettivi</em> con SPID o CIE, apri «Registrazione dell'indirizzo telematico» e indica questo codice: da quel momento tutte le fatture dei
                  tuoi fornitori arrivano qui, qualunque codice abbiano scritto in fattura.
                </p>
                <div className="field inline mt-2">
                  <input readOnly className="flex-1 min-w-0 font-mono" value={onboarding.data.codiceDestinatarioIntermediario} aria-label="Codice destinatario" />
                  <button
                    type="button"
                    className="ic-btn"
                    aria-label="Copia il codice"
                    onClick={() => {
                      navigator.clipboard.writeText(onboarding.data!.codiceDestinatarioIntermediario!);
                      toast({ title: "Codice copiato" });
                    }}
                  >
                    <Copy />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {onboarding.data && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Come si attiva</h2>
              <p className="sub">Sei passaggi, una volta sola.</p>
            </div>
          </div>
          <div className="act-body">
            <ol className="space-y-3">
              {onboarding.data.passi.map((passo) => {
                const fatto = Boolean(onboarding.data!.completati[passo.id]);
                return (
                  <li key={passo.id} className="flex gap-2">
                    {fatto ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--green)" }} /> : <Circle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--muted-mk)" }} />}
                    <div>
                      <div className="text-sm font-medium">{passo.titolo}</div>
                      <p className="text-xs" style={{ color: "var(--muted-mk)" }}>{passo.testo}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
