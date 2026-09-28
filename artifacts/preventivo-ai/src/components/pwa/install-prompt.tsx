import { useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { promptInstall, usePwa } from "@/lib/pwa";

const SNOOZE_KEY = "prevai:install-snoozed";
const SNOOZE_DAYS = 30;

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

/**
 * APP-2: "Metti PrevAI nella schermata Home". Chrome/Android get the real
 * install dialog, Safari on iPhone the two steps (it has no install API).
 * Hidden once installed and for 30 days after "Non ora". The Oggi page shows
 * it only from the second quote (docs/APP-PLAN.md: not at first sign-in);
 * Settings → Notifiche sul telefono always (`always`).
 */
export function InstallPrompt({ className, always = false }: { className?: string; always?: boolean }) {
  const pwa = usePwa();
  const [hidden, setHidden] = useState(() => !always && snoozed());
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (hidden || pwa.standalone || !pwa.supported) return null;
  if (!pwa.canPrompt && !pwa.ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };

  const install = async () => {
    if (pwa.canPrompt) {
      if (await promptInstall()) setHidden(true);
      return;
    }
    setShowIosSteps(true);
  };

  return (
    <div className={cn("notice info install-prompt", className)} role="region" aria-label="Metti PrevAI nella schermata Home">
      <Smartphone aria-hidden="true" />
      <span className="grow">
        Metti PrevAI nella schermata Home
        <small>Si apre come un'app, a tutto schermo, e può avvisarti quando un cliente apre o accetta un preventivo.</small>
        {showIosSteps && (
          <ol className="install-steps">
            <li>Tocca <Share aria-label="Condividi" className="inline h-3.5 w-3.5 align-[-2px]" /> in basso in Safari</li>
            <li>Scegli «Aggiungi alla schermata Home»</li>
          </ol>
        )}
      </span>
      <span className="actions">
        {!showIosSteps && (
          <button type="button" className="btn btn-sm btn-navy" onClick={() => void install()}>
            {pwa.canPrompt ? "Installa" : "Come si fa"}
          </button>
        )}
        {!always && (
          <button type="button" className="btn btn-sm secondary" onClick={dismiss} aria-label="Non ora">
            <X className="h-4 w-4" aria-hidden="true" /> Non ora
          </button>
        )}
      </span>
    </div>
  );
}
