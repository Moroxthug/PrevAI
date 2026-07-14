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

export default PrevAiWidget;
