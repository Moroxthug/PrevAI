// PREZZI-2: il modulo del piano Su misura. Il bottone «Parliamone» di home, impostazioni e fatturazione porta qui.
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PREZZI_PIANI, VOCI_PIANI } from "@workspace/config";
import { Input } from "@/components/ui/input";
import { PATHS } from "@/data/sitemap-routes";

const VUOTO = { nome: "", impresa: "", email: "", telefono: "", persone: "", messaggio: "", sitoWeb: "" };

export function SuMisuraForm() {
  const [form, setForm] = useState(VUOTO);
  const [stato, setStato] = useState<"idle" | "sending" | "sent">("idle");
  const [errore, setErrore] = useState<string | null>(null);
  const campo = (k: keyof typeof VUOTO) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setStato("sending");
    setErrore(null);
    try {
      const r = await fetch("/api/contatti/su-misura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(j?.message ?? "Non siamo riusciti a inviare. Scrivici a info@prevai.it.");
      }
      setStato("sent");
    } catch (err) {
      setStato("idle");
      setErrore(err instanceof Error ? err.message : "Non siamo riusciti a inviare. Scrivici a info@prevai.it.");
    }
  };

  return (
    <section id="su-misura" className="sec" style={{ paddingBlock: "clamp(24px, 3vw, 40px)", scrollMarginTop: 80 }}>
      <div className="wrap" style={{ maxWidth: 700 }}>
        <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)" }}>
          <h2 className="h2" style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.8rem)", marginBottom: 8 }}>Piano {PREZZI_PIANI.monthly_elite.nome}</h2>
          <p style={{ fontSize: 15, color: "var(--muted-mk)", lineHeight: 1.6, marginBottom: 20 }}>
            Hai più squadre o più cantieri aperti? Dicci come lavori e ti proponiamo un piano fatto per la tua impresa. {VOCI_PIANI.monthly_elite[1]}, {VOCI_PIANI.monthly_elite[2].toLowerCase()}, API.
          </p>
          {stato === "sent" ? (
            <p role="status" style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, color: "var(--navy)" }}>
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Ricevuto. Ti ricontattiamo noi.
            </p>
          ) : (
            <form onSubmit={invia} style={{ display: "grid", gap: 12 }}>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm font-medium">Nome e cognome<Input required minLength={2} maxLength={120} autoComplete="name" {...campo("nome")} /></label>
                <label className="text-sm font-medium">Impresa<Input required minLength={2} maxLength={160} autoComplete="organization" {...campo("impresa")} /></label>
                <label className="text-sm font-medium">Email<Input required type="email" maxLength={200} autoComplete="email" {...campo("email")} /></label>
                <label className="text-sm font-medium">Telefono (facoltativo)<Input type="tel" maxLength={40} autoComplete="tel" {...campo("telefono")} /></label>
              </div>
              <label className="text-sm font-medium">Quante persone lavorano con te? (facoltativo)<Input maxLength={40} {...campo("persone")} /></label>
              <label className="text-sm font-medium">Cosa ti serve? (facoltativo)
                <textarea className="w-full rounded-[var(--radius-sm)] border p-3 text-sm" rows={3} maxLength={2000} {...campo("messaggio")} />
              </label>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} {...campo("sitoWeb")} />
              {errore && <p role="alert" className="text-sm" style={{ color: "var(--red)" }}>{errore}</p>}
              <div>
                <button type="submit" className="btn btn-navy" disabled={stato === "sending"}>
                  {stato === "sending" && <Loader2 className="h-4 w-4 animate-spin" />} Parliamone
                </button>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted-mk)" }}>
                Usiamo questi dati solo per risponderti. Dettagli nella <Link href={PATHS.PRIVACY}>privacy policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
