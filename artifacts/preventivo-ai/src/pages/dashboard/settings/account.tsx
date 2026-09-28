import { LogOut, UserRound } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { leaveThisDevice } from "@/lib/push-api";
import { SdiTab } from "../settings-sdi-tab";
import { SecurityTab } from "../settings-security-tab";
import { ActionRow, SettingsGroup, SettingsSection } from "./ui";
import { DeleteAccountGroup } from "./delete-account";

// APP-1b: le tre sezioni che avvolgono pagine già esistenti senza campi da
// bozza. Sicurezza e Fatture elettroniche agiscono a ogni scelta (attivare la
// 2FA, chiudere una sessione, salvare il regime SdI) perché sono passaggi con
// verifiche lato server, non preferenze: niente barra Salva.

/** Tu → Il tuo accesso: con quale nome ed email entri, l'uscita e (APP-1c) la cancellazione dell'account. */
export function AccountSection() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user as { name?: string | null; email?: string | null } | undefined;
  const signOut = async () => {
    // APP-2: this browser stops getting this person's notifications and forgets the offline copies.
    await leaveThisDevice();
    await authClient.signOut();
    window.location.href = "/";
  };
  return (
    <SettingsSection title="Il tuo accesso" intro="L'account con cui entri in PrevAI. I dati dell'impresa che vedono i clienti sono in Impresa → Dati dell'impresa.">
      {isPending ? (
        <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <SettingsGroup>
            <div className="sprofile">
              <span className="snav-ic" aria-hidden="true"><UserRound /></span>
              <span className="sprofile-txt">
                <b>{user?.name || user?.email || "—"}</b>
                {user?.name && user?.email && <span>{user.email}</span>}
              </span>
            </div>
          </SettingsGroup>
          <SettingsGroup>
            <ActionRow label="Verifica in due passaggi e dispositivi" help="Attiva la verifica in due passaggi e chiudi le sessioni aperte sugli altri dispositivi.">
              <Link href="/dashboard/settings/security" className="btn btn-sm btn-outline-navy">Apri Sicurezza</Link>
            </ActionRow>
            <ActionRow label="Esci" help="Esci da PrevAI su questo dispositivo.">
              <button type="button" onClick={() => void signOut()} className="btn btn-sm btn-outline-navy gap-2">
                <LogOut className="h-4 w-4" aria-hidden="true" />Esci
              </button>
            </ActionRow>
          </SettingsGroup>
          <DeleteAccountGroup />
        </>
      )}
    </SettingsSection>
  );
}

/** Tu → Sicurezza: verifica in due passaggi, regola per la squadra, sessioni, registro. */
export function SecuritySection() {
  return (
    <SettingsSection title="Sicurezza" intro="Verifica in due passaggi, i dispositivi collegati e il registro di chi ha fatto cosa.">
      <SecurityTab />
    </SettingsSection>
  );
}

/** Impresa → Fatture elettroniche: il modulo SdI di PrevAI Fisco (solo con l'add-on). */
export function SdiSection() {
  return (
    <SettingsSection title="Fatture elettroniche" intro="Emissione, ricevute e conservazione delle fatture verso il Sistema di Interscambio.">
      <SdiTab />
    </SettingsSection>
  );
}
