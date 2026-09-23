import { useEffect } from "react";

/**
 * La shell dell'app ha già un `<meta name="robots" content="index, follow">`:
 * aggiungerne un secondo (come fa `SeoHead noIndex`) lascerebbe due istruzioni
 * in conflitto. Si cambia quello che c'è e lo si rimette com'era all'uscita,
 * così la pagina successiva torna indicizzabile. Nato in A-4 per la pagina
 * del commercialista, condiviso in A-5 con la landing dell'add-on in bozza.
 */
export function useNoIndex(attivo = true): void {
  useEffect(() => {
    if (!attivo) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const creato = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const precedente = meta.content;
    meta.content = "noindex, nofollow";
    return () => {
      if (creato) meta!.remove();
      else meta!.content = precedente;
    };
  }, [attivo]);
}
