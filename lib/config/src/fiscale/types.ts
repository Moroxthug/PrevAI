// ── A-2: motore fiscale del regime forfettario ───────────────────────────────
// Le regole non stanno sparse nel codice: stanno in `regole/<anno>.ts`, una
// versione per anno d'imposta, perché cambiano a ogni legge di bilancio
// (AMMINISTRAZIONE-PLAN.md §3). Ogni regola porta con sé la propria fonte e,
// soprattutto, **lo stato della revisione**: finché un commercialista non l'ha
// confermata per iscritto, il numero che produce non può essere presentato
// all'utente come definitivo (docs/compliance/REVISIONE-COMMERCIALISTA.md,
// decisione D6 in docs/PIANO-AZIONE.md).
//
// Tutti gli importi sono in **centesimi di euro**, interi, come nel resto del
// prodotto: i decimali in virgola mobile sul denaro sono un bug che aspetta.

/** Identificatori delle regole, gli stessi della checklist F1–F16 mandata al commercialista. */
export const REGOLE_ID = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "F9", "F10", "F11", "F12", "F13", "F14", "F15", "F16",
  // A-3: la compilazione del modello F24. Sono fatti come gli altri — un
  // codice tributo sbagliato fa finire il denaro su un altro tributo e
  // l'imposta risulta non versata — quindi nascono anch'essi da revisionare.
  "F17", "F18", "F19",
] as const;
export type RegolaId = (typeof REGOLE_ID)[number];

/**
 * Stato della revisione professionale di una singola regola.
 * - `non_revisionata`: valore raccolto dalla ricerca, **mai** mostrato come certo;
 * - `confermata`: il commercialista l'ha confermata così com'è;
 * - `con_condizione`: confermata ma con una condizione da rispettare (in `nota`);
 * - `corretta`: il valore in codice è già quello corretto dal commercialista.
 */
export const STATI_REVISIONE = ["non_revisionata", "confermata", "con_condizione", "corretta"] as const;
export type StatoRevisione = (typeof STATI_REVISIONE)[number];

export type Revisione = {
  stato: StatoRevisione;
  /** Nome e albo del professionista che ha firmato. Vuoto finché D6 è aperta. */
  da?: string;
  /** Data della conferma, `YYYY-MM-DD`. */
  il?: string;
  /** Condizione o correzione a parole. */
  nota?: string;
};

export type Regola = {
  id: RegolaId;
  titolo: string;
  /** Norma o circolare da cui viene il numero: va stampata accanto al risultato. */
  fonte: string;
  revisione: Revisione;
};

/**
 * Aliquota contributiva e minimale della gestione previdenziale.
 * Il forfettario artigiano paga i fissi anche a reddito zero: è la voce che
 * sorprende di più chi apre partita IVA, quindi va spiegata sempre.
 */
export type ParametriInps = {
  /** Reddito minimale annuo su cui si calcolano i contributi fissi. */
  minimaleCents: number;
  /** Aliquota ordinaria, in percentuale (es. 24 = 24 %). */
  aliquotaPercent: number;
  /** Contributo maternità annuo, fisso e **non** riducibile. */
  maternitaCents: number;
  /** Oltre questo reddito l'aliquota sale di `aliquotaAggiuntivaPercent`. */
  scaglioneSuperioreCents: number;
  aliquotaAggiuntivaPercent: number;
  /** Tetto oltre il quale non si versa più (iscritti dal 1996 in poi). */
  massimaleCents: number;
  /** Rate dei fissi: giorno e mese di scadenza. */
  rateFisse: readonly { giorno: number; mese: number; annoSuccessivo?: boolean }[];
  /**
   * A-3 — causali contributo del modello F24, sezione INPS. Non sono codici
   * tributo: stanno in una sezione diversa del modello, con la matricola e il
   * codice sede al posto del codice tributo (F18).
   */
  causaleFissi: string;
  causaleEccedenza: string;
};

export type ParametriAnno = {
  anno: number;
  /** Ricavi oltre i quali si esce dal regime dall'anno successivo (F1). */
  sogliaRicaviCents: number;
  /** Ricavi oltre i quali si esce **subito**, con IVA dall'operazione (F2). */
  sogliaUscitaImmediataCents: number;
  /** Tetto alle spese per lavoro dipendente e collaboratori (F3). */
  sogliaSpeseLavoroCents: number;
  /** Tetto ai redditi da lavoro dipendente dell'anno precedente (F4). */
  sogliaRedditoDipendenteCents: number;
  /** Imposta sostitutiva ordinaria, in percentuale (F7). */
  aliquotaOrdinariaPercent: number;
  /** Aliquota start-up e durata in anni (F7). */
  aliquotaStartupPercent: number;
  anniStartup: number;
  /** Riduzioni contributive alternative fra loro (F11). */
  riduzioneForfettariPercent: number;
  riduzioneNuoviIscrittiPercent: number;
  riduzioneNuoviIscrittiMesi: number;
  inps: Record<GestionePrevidenziale, ParametriInps | null>;
  /** Acconti: percentuali, soglie e scadenze (F12). */
  acconti: {
    /** Sotto questa imposta l'acconto non è dovuto. */
    sogliaNonDovutoCents: number;
    /** Sotto questa imposta l'acconto si versa in una sola rata a novembre. */
    sogliaRataUnicaCents: number;
    primaRatePercent: number;
    secondaRatePercent: number;
    scadenzaSaldoEPrimoAcconto: { giorno: number; mese: number };
    scadenzaSecondoAcconto: { giorno: number; mese: number };
    /** A-3 — codici tributo del modello F24, sezione Erario (F17). */
    codiceTributoSaldo: string;
    codiceTributoPrimoAcconto: string;
    codiceTributoSecondoAcconto: string;
  };
  /** Dichiarazione dei redditi: termine telematico (F13). */
  scadenzaDichiarazione: { giorno: number; mese: number };
  /** Margine di sicurezza suggerito sul "quanto mettere via" (F16). */
  margineSicurezzaPercent: number;
  regole: Record<RegolaId, Regola>;
};

export const GESTIONI_PREVIDENZIALI = ["artigiani", "commercianti", "gestione_separata", "cassa_professionale", "nessuna"] as const;
export type GestionePrevidenziale = (typeof GESTIONI_PREVIDENZIALI)[number];

export const RIDUZIONI_CONTRIBUTIVE = ["nessuna", "forfettari_35", "nuovi_iscritti_50"] as const;
export type RiduzioneContributiva = (typeof RIDUZIONI_CONTRIBUTIVE)[number];

/** Ciò che l'impresa dichiara di sé una volta (onboarding fiscale) + i numeri dell'anno. */
export type IngressoCalcolo = {
  anno: number;
  /** Codice ATECO dichiarato: decide il coefficiente di redditività (F5). */
  codiceAteco: string;
  /** Coefficiente effettivo in percentuale. Normalmente viene dall'ATECO, ma resta sovrascrivibile. */
  coefficientePercent: number;
  gestione: GestionePrevidenziale;
  riduzione: RiduzioneContributiva;
  /** Anno di inizio attività: decide se l'aliquota start-up è ancora applicabile. */
  annoInizioAttivita: number | null;
  /** L'impresa ha dichiarato di avere i requisiti per il 5 % (F7). */
  requisitiStartup: boolean;
  /** Ricavi **incassati** nell'anno (criterio di cassa, F6/F1). */
  incassatiCents: number;
  /** Emesso ma non ancora incassato: non fa imposta oggi, ma serve al monitor soglia. */
  fatturatoNonIncassatoCents: number;
  /** Lavoro accettato e non ancora fatturato: la parte "pipeline" del monitor. */
  pipelineCents: number;
  /** Contributi previdenziali **versati** nell'anno, deducibili per cassa (F6). */
  contributiVersatiCents: number;
  /** Acconti d'imposta già versati per quest'anno. */
  accontiVersatiCents: number;
  /** Imposta sostitutiva dell'anno precedente: base degli acconti col metodo storico (F12). */
  impostaAnnoPrecedenteCents: number;
  /** Bollo virtuale maturato nell'anno (dal modulo A-1): entra nel "quanto mettere via". */
  bolloCents: number;
  /** Margine di sicurezza scelto dall'impresa, in percentuale. */
  margineSicurezzaPercent: number;
  /** Mese corrente (1-12) per ripartire il "da mettere via" sui mesi che restano. */
  meseCorrente: number;
};

/**
 * Un numero e il perché. Nessun importo esce dal motore senza la sua
 * spiegazione: è la mitigazione principale del rischio "errore di calcolo →
 * danno" (AMMINISTRAZIONE-PLAN.md §11) e la differenza fra uno strumento e
 * una consulenza travestita.
 */
export type Spiegazione = {
  /** Chiave stabile: l'interfaccia ci attacca il tooltip "perché questo importo". */
  id: string;
  titolo: string;
  /** La formula a parole, con i nomi delle grandezze. */
  formula: string;
  /** I valori messi nella formula, in ordine. */
  passaggi: readonly { etichetta: string; valore: string }[];
  risultatoCents: number;
  /** Regole applicate: da qui l'interfaccia sa se il numero è revisionato. */
  regole: readonly RegolaId[];
  fonte: string;
};

export type Contributi = {
  /** Reddito su cui si calcolano i contributi (= imponibile fiscale). */
  redditoCents: number;
  /** Quota fissa dovuta comunque, sul minimale. */
  fissiCents: number;
  /** Quota sulla parte di reddito oltre il minimale. */
  eccedenzaCents: number;
  maternitaCents: number;
  /** Sconto applicato dalla riduzione scelta (35 % o 50 %). */
  scontoCents: number;
  totaleCents: number;
  versatiCents: number;
  residuoCents: number;
};

export const LIVELLI_SOGLIA = ["ok", "attenzione", "vicino", "superata", "fuori_regime"] as const;
export type LivelloSoglia = (typeof LIVELLI_SOGLIA)[number];

export type MonitorSoglia = {
  livello: LivelloSoglia;
  /** Incassato + emesso non incassato: quello che conta davvero oggi. */
  maturatoCents: number;
  /** Maturato + pipeline: dove arrivi se tutto va in porto. */
  proiezioneCents: number;
  sogliaCents: number;
  sogliaUscitaImmediataCents: number;
  /** Quanto puoi ancora fatturare restando sotto gli 85.000. */
  margineCents: number;
  /** Percentuale della soglia già consumata dal maturato. */
  percentuale: number;
  /** Conseguenza a parole, senza consigli: dice cosa succede, non cosa fare. */
  conseguenza: string;
};

/**
 * Categoria della scadenza: decide l'icona, il tipo di versamento da
 * registrare e, soprattutto, la sezione del modello F24.
 */
export const CATEGORIE_SCADENZA = ["imposta", "contributi", "bollo", "dichiarazione"] as const;
export type CategoriaScadenza = (typeof CATEGORIE_SCADENZA)[number];

/** Sezioni del modello F24 usate dal forfettario. */
export const SEZIONI_F24 = ["erario", "inps"] as const;
export type SezioneF24 = (typeof SEZIONI_F24)[number];

/**
 * Una riga del modello F24. Il modello non ha una riga per scadenza ma una
 * riga per tributo: il 30 giugno si versa con **un solo** F24 che contiene il
 * saldo dell'anno scorso, il primo acconto di quest'anno e l'eccedenza
 * contributiva. Modellarle come tre scadenze separate farebbe compilare tre
 * deleghe dove ne basta una.
 */
export type RigaF24 = {
  sezione: SezioneF24;
  /** Sezione Erario: codice tributo (F17, F19). */
  codiceTributo?: string;
  /** Sezione INPS: causale contributo (F18). */
  causale?: string;
  descrizione: string;
  /** Campo "anno di riferimento": è l'anno d'imposta, non quello del versamento. */
  annoRiferimento: number;
  /** Sezione INPS, campi "da mm/aaaa" e "a mm/aaaa" del periodo di competenza. */
  periodoDa?: string;
  periodoA?: string;
  importoCents: number;
  regole: readonly RegolaId[];
};

/**
 * Una riga dello scadenzario (A-3). È **derivata**: la ricalcoliamo ogni volta
 * dai numeri dell'anno e non la conserviamo come verità. Quello che si
 * conserva nel database è solo ciò che il motore non può sapere — se è stata
 * versata, con quale quietanza, e quali promemoria sono già partiti.
 *
 * `id` è la chiave stabile che lega la riga calcolata alla riga di stato:
 * cambiarlo scollega le due cose e fa ripartire i promemoria, quindi non si
 * cambia una volta rilasciato.
 */
export type Scadenza = {
  id: string;
  etichetta: string;
  /** `YYYY-MM-DD`. */
  data: string;
  /** Somma delle righe: è l'importo del modello F24. */
  importoCents: number;
  categoria: CategoriaScadenza;
  /** A che cosa serve questo versamento, a parole. */
  descrizione: string;
  /** Le righe del modello. Vuota quando non c'è niente da versare (la dichiarazione). */
  righe: readonly RigaF24[];
  regole: readonly RegolaId[];
};

export type Calcolo = {
  anno: number;
  /** Versione delle regole usate: `2026`, ecc. Cambia il risultato, quindi si mostra. */
  annoRegole: number;
  /** false finché una sola delle regole usate non è stata revisionata (D6). */
  revisionato: boolean;
  /** Le regole non ancora confermate, per l'avviso in interfaccia. */
  regoleNonRevisionate: readonly RegolaId[];
  coefficientePercent: number;
  aliquotaPercent: number;
  /** true se sta godendo del 5 % start-up. */
  startupAttiva: boolean;
  imponibileCents: number;
  impostaCents: number;
  contributi: Contributi;
  bolloCents: number;
  /** Imposta + contributi + bollo: il costo fiscale dell'anno. */
  totaleDovutoCents: number;
  /** Quanto resta da accantonare, margine di sicurezza incluso. */
  daMettereViaCents: number;
  /** Ripartito sui mesi che restano nell'anno. */
  daMettereViaMensileCents: number;
  /** Percentuale da mettere da parte su ogni incasso futuro. */
  percentualeSuIncassi: number;
  soglia: MonitorSoglia;
  scadenze: readonly Scadenza[];
  spiegazioni: readonly Spiegazione[];
};
