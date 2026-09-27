// @workspace/config — configurazione di mercato di PrevAI (Italia).
// Nessuna dipendenza: importabile dal frontend, dall'API server e da lib/db.
// Tutto ciò che in QuoteAI era "canadese" (CAD, en-CA/fr-CA, GST/HST,
// province) vive qui in versione italiana. V2-2 (PREVAI-V2-PLAN.md §4).
export * from "./market";
export * from "./iva";
export * from "./province";
export * from "./format";
export * from "./legal";
export * from "./fatturapa";
export * from "./fiscale/index";
export * from "./offerta";
export * from "./piani";
export * from "./commercialista";
