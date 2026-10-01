import { authClient } from "@/lib/auth-client";
import { getRestoredProfile } from "@/lib/offline/cache-state";
import { useLocation } from "wouter";
import { useEffect } from "react";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  /** Set by better-auth's twoFactor plugin once TOTP is verified (A-0 gate reads it). */
  twoFactorEnabled?: boolean;
};

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();

  // SYNC-1: il dispositivo si è aperto con le risposte salvate di chi l'ha usato per ultimo
  // (non è uscito: uscire le cancella). Mentre il controllo della sessione è in corso, e quando
  // non può rispondere (niente rete), l'app è sua e disegna subito dal dispositivo — invece di
  // uno scheletro o della scheda "non riesco a raggiungere PrevAI". Quando il controllo risponde
  // vince lui: uscito → accesso; un'altra persona → i dati salvati cadono prima (useCacheOwnerCheck).
  const offlineProfile = (isPending || error) && !session ? getRestoredProfile() : null;
  if (offlineProfile) {
    return {
      isLoaded: true,
      isError: false,
      isSignedIn: true,
      userId: offlineProfile.id,
      user: { id: offlineProfile.id, name: offlineProfile.name, email: offlineProfile.email, image: offlineProfile.image ?? null } as AuthUser,
      session,
    };
  }

  return {
    isLoaded: !isPending,
    /** The session check itself failed (API unreachable / 5xx) — not the same as "signed out". */
    isError: !!error,
    isSignedIn: !!session?.user,
    userId: session?.user?.id ?? null,
    user: (session?.user as AuthUser | null | undefined) ?? null,
    session,
  };
}

export function useRequireAuth() {
  const { isLoaded, isSignedIn, isError } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // A failed session check is not a sign-out — don't bounce to /sign-in on an outage.
    if (isLoaded && !isSignedIn && !isError) {
      navigate("/sign-in");
    }
  }, [isLoaded, isSignedIn, isError, navigate]);

  return { isLoaded, isSignedIn };
}
