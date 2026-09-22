// ── F5: coefficiente di redditività per codice ATECO ─────────────────────────
// Il forfettario non deduce i costi: deduce una percentuale forfettaria decisa
// dal codice ATECO (allegato 2 della L. 145/2018). Per gli artigiani edili —
// il grosso degli utenti PrevAI — il gruppo è 41-43 e il coefficiente è **86 %**,
// il più alto della tabella: significa che l'86 % di ogni euro incassato è
// considerato reddito, e solo il 14 % è "costi".
//
// La classificazione ATECO 2025 ha rinumerato parecchi codici: la mappatura
// gruppo → coefficiente è rimasta, ma i singoli codici a sei cifre vanno
// riverificati (domanda F5 al commercialista). Per questo il lookup lavora sul
// **gruppo** (le prime due o tre cifre) e non su una lista di codici esatti:
// un codice nuovo dentro un gruppo noto continua a dare la risposta giusta.

export type GruppoAteco = {
  /** Prefissi del codice, in cifre, dal più specifico al più generico. */
  prefissi: readonly string[];
  coefficientePercent: number;
  descrizione: string;
};

/**
 * Ordine significativo: vince il prefisso più lungo che combacia, così
 * `47.81` (ambulante alimentare, 40 %) batte `47` (commercio, 40 %) e
 * `46.1` (intermediari, 62 %) batte `46` (ingrosso, 40 %).
 */
export const GRUPPI_ATECO: readonly GruppoAteco[] = [
  { prefissi: ["41", "42", "43", "68"], coefficientePercent: 86, descrizione: "Costruzioni e attività immobiliari" },
  { prefissi: ["10", "11"], coefficientePercent: 40, descrizione: "Industrie alimentari e delle bevande" },
  { prefissi: ["461"], coefficientePercent: 62, descrizione: "Intermediari del commercio" },
  { prefissi: ["4781"], coefficientePercent: 40, descrizione: "Commercio ambulante di prodotti alimentari e bevande" },
  { prefissi: ["4782", "4789"], coefficientePercent: 54, descrizione: "Commercio ambulante di altri prodotti" },
  { prefissi: ["45", "46", "47"], coefficientePercent: 40, descrizione: "Commercio all'ingrosso e al dettaglio" },
  { prefissi: ["55", "56"], coefficientePercent: 40, descrizione: "Alloggio e ristorazione" },
  { prefissi: ["64", "65", "66", "69", "70", "71", "72", "73", "74", "75", "85", "86", "87", "88"], coefficientePercent: 78, descrizione: "Attività professionali, scientifiche, tecniche, sanitarie, di istruzione, servizi finanziari e assicurativi" },
];

/** Coefficiente residuale per tutto ciò che non rientra nei gruppi sopra. */
export const COEFFICIENTE_RESIDUALE = 67;
export const DESCRIZIONE_RESIDUALE = "Altre attività economiche";

/**
 * Mestieri che PrevAI vede davvero, con il codice ATECO più frequente: serve
 * a far scegliere l'artigiano per mestiere invece che per numero. La conferma
 * codice per codice è la domanda F5.
 */
export const MESTIERI_ATECO: readonly { codice: string; mestiere: string }[] = [
  { codice: "43.21.01", mestiere: "Elettricista (impianti elettrici)" },
  { codice: "43.22.01", mestiere: "Idraulico (impianti idraulici e sanitari)" },
  { codice: "43.22.02", mestiere: "Installatore di impianti di riscaldamento e condizionamento" },
  { codice: "43.29.09", mestiere: "Altri lavori di installazione (isolamento, impianti vari)" },
  { codice: "43.31.00", mestiere: "Intonacatore" },
  { codice: "43.32.01", mestiere: "Serramentista (posa in opera di infissi)" },
  { codice: "43.33.00", mestiere: "Piastrellista e pavimentista" },
  { codice: "43.34.00", mestiere: "Imbianchino e verniciatore" },
  { codice: "43.39.01", mestiere: "Stuccatore e decoratore" },
  { codice: "43.91.00", mestiere: "Lattoniere e copritetto" },
  { codice: "43.99.01", mestiere: "Muratore (opere murarie e di finitura)" },
  { codice: "43.12.00", mestiere: "Movimento terra e preparazione del cantiere" },
  { codice: "41.20.00", mestiere: "Impresa edile (costruzione di edifici)" },
  { codice: "81.30.00", mestiere: "Giardiniere (cura del verde)" },
  { codice: "95.22.01", mestiere: "Riparazione di elettrodomestici" },
];

/** Toglie punti, spazi e lettere: il confronto avviene sulle sole cifre. */
export function normalizzaAteco(codice: string): string {
  return (codice ?? "").replace(/\D/g, "");
}

export function gruppoAtecoDi(codice: string): GruppoAteco | null {
  const cifre = normalizzaAteco(codice);
  if (!cifre) return null;
  let migliore: { gruppo: GruppoAteco; lunghezza: number } | null = null;
  for (const gruppo of GRUPPI_ATECO) {
    for (const prefisso of gruppo.prefissi) {
      if (cifre.startsWith(prefisso) && (!migliore || prefisso.length > migliore.lunghezza)) {
        migliore = { gruppo, lunghezza: prefisso.length };
      }
    }
  }
  return migliore?.gruppo ?? null;
}

export function coefficienteDiAteco(codice: string): { coefficientePercent: number; descrizione: string; riconosciuto: boolean } {
  const gruppo = gruppoAtecoDi(codice);
  if (!gruppo) return { coefficientePercent: COEFFICIENTE_RESIDUALE, descrizione: DESCRIZIONE_RESIDUALE, riconosciuto: false };
  return { coefficientePercent: gruppo.coefficientePercent, descrizione: gruppo.descrizione, riconosciuto: true };
}

/** Formato tipico `43.22.01`: accettiamo anche senza punti, ma almeno quattro cifre. */
export function atecoPlausibile(codice: string): boolean {
  const cifre = normalizzaAteco(codice);
  return cifre.length >= 4 && cifre.length <= 8;
}
