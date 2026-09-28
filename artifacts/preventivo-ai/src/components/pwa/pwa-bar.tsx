import { useEffect } from "react";
import { applyUpdate, registerServiceWorker, usePwa } from "@/lib/pwa";

/**
 * APP-2: the two things the app says about itself, in the dashboard's own
 * notice style — no signal (what you see is the last copy saved on this
 * device) and a new version ready (one tap reloads). Also makes sure the
 * service worker is registered when someone reaches the dashboard without a
 * page load (signed in from the home page).
 */
export function PwaBar() {
  const pwa = usePwa();
  useEffect(() => registerServiceWorker(), []);
  if (!pwa.online) {
    return (
      <div className="notice warn pwa-bar" role="status">
        <span className="grow">
          Sei offline.
          <small>Vedi l'ultima copia salvata su questo dispositivo; le modifiche partono quando torna la rete.</small>
        </span>
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
  return null;
}
