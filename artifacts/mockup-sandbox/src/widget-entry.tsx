import React from "react";
import { createRoot } from "react-dom/client";
import { PrevAiQuoteBar, type PrevAiQuoteBarConfig } from "./components/mockups/prevai-redesign/WidgetFunnelDemo";

// Interfaccia per l'inizializzatore globale
interface PrevAiWidgetGlobal {
  init: (options: PrevAiQuoteBarConfig & { target: string }) => void;
}

const PrevAiWidget: PrevAiWidgetGlobal = {
  init: (options) => {
    const { target, ...config } = options;
    const container = document.querySelector(target);
    if (!container) {
      console.error(`PrevAI Widget: Impossibile trovare il contenitore target "${target}"`);
      return;
    }

    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <PrevAiQuoteBar {...config} />
      </React.StrictMode>
    );
  }
};

// Espone l'oggetto globale
(window as any).PrevAiWidget = PrevAiWidget;

// Automounting intelligente: controlla se lo script è stato caricato con data-api-key
function autoMount() {
  if (typeof document === "undefined") return;
  const script = (document.currentScript as HTMLScriptElement) || document.querySelector('script[data-api-key]');
  if (!script) return;

  const apiKey = script.getAttribute("data-api-key");
  if (!apiKey) return;

  const target = script.getAttribute("data-target") || "#prevai-widget";
  const apiBaseUrl = script.getAttribute("data-api-base-url") || undefined;

  const tryInit = () => {
    const container = document.querySelector(target);
    if (container) {
      PrevAiWidget.init({ target, apiKey, ...(apiBaseUrl ? { apiBaseUrl } : {}) });
    } else {
      console.warn(`PrevAI Widget: automount target "${target}" non trovato, assicurati che il tag <div id="${target.replace('#', '')}"></div> esista nel DOM.`);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInit);
  } else {
    tryInit();
  }
}

autoMount();

export default PrevAiWidget;
