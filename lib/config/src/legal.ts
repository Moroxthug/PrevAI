/**
 * Riferimenti normativi e testi legali ricorrenti (Codice del Consumo,
 * GDPR, Codice Civile). I contratti li compongono in contracts/templates.ts.
 */
export const LEGAL = {
  /** Diritto di recesso per contratti conclusi fuori dai locali commerciali: 14 giorni (art. 52 D.Lgs. 206/2005). */
  recessoGiorni: 14,
  recessoRiferimento: "artt. 45–67 del Codice del Consumo (D.Lgs. 206/2005)",
  /** Garanzia per difformità e vizi dell'opera nell'appalto: denuncia entro 60 giorni dalla scoperta, azione entro 2 anni (art. 1667 c.c.). */
  garanziaDenunciaGiorni: 60,
  garanziaAnni: 2,
  garanziaRiferimento: "art. 1667 c.c.",
  /** Rovina e gravi difetti di immobili: 10 anni (art. 1669 c.c.). */
  garanziaGraviDifettiAnni: 10,
  /** Interessi di mora nelle transazioni commerciali (D.Lgs. 231/2002). */
  moraRiferimento: "D.Lgs. 231/2002",
  /** Privacy. */
  privacyRiferimento: "Regolamento (UE) 2016/679 (GDPR) e D.Lgs. 196/2003",
  /** Firma elettronica. */
  firmaRiferimento: "Regolamento (UE) 910/2014 (eIDAS) e D.Lgs. 82/2005 (CAD)",
  /** Foro competente per il consumatore: residenza o domicilio del consumatore (art. 66-bis Cod. Consumo). */
  foroConsumatore: "art. 66-bis del Codice del Consumo",
  /** AI Act, art. 50: obbligo di trasparenza per chi interagisce con un'IA (dal 2/8/2026). */
  aiActDisclosure: "Stai interagendo con un assistente basato su intelligenza artificiale.",
  aiGeneratedNote: "Contenuto generato con l'ausilio di intelligenza artificiale e rivisto dall'impresa.",
} as const;

/** Nota standard a piè di preventivo. */
export const QUOTE_FOOTER_NOTE = "Preventivo valido 30 giorni";
export const QUOTE_FOOTER_NOTE_LONG = "Preventivo valido 30 giorni dalla data di emissione. Esclusi pratiche edilizie, imprevisti non visibili e lavorazioni non espressamente indicate.";
export const QUOTE_DEFAULT_TITLE = "Analisi Economica e Computo Metrico Prezzato";
export const QUOTE_NB = "N.B. OGNI LAVORAZIONE RICHIESTA E NON INCLUSA NEL PRESENTE PREVENTIVO SARÀ OGGETTO DI PREVENTIVAZIONE E PAGAMENTO SEPARATI.";
export const QUOTE_ACCEPTANCE_TEXT = "Il sottoscritto, presa visione del presente preventivo, ne accetta le condizioni sopra indicate e autorizza l'esecuzione dei lavori.";
