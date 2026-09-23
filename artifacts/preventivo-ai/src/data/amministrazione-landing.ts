// A-5: testi della landing dell'add-on Amministrazione (/amministrazione/),
// condivisi fra la pagina React e lo script di prerender (JSON-LD FAQPage).
//
// Regola di scrittura (AMMINISTRAZIONE-PLAN §5): mai "commercialista
// digitale", "il tuo commercialista", "facciamo noi la dichiarazione". Sì a
// "strumento", "calcola", "prepara", "ti ricorda". E nessuna aliquota o
// coefficiente in pagina: sono regole del motore ancora da revisionare (D6),
// e una landing non è il posto dove citarle.

import { OFFERTA_AMMINISTRAZIONE, statoOfferta } from "@workspace/config";

export const LANDING_AMMINISTRAZIONE_PATH = "/amministrazione/";

export const LANDING_AMMINISTRAZIONE_SEO = {
  title: "Tasse del forfettario e fatture elettroniche per artigiani | PrevAI",
  description:
    "Quanto pagherai di tasse sul lavoro che stai preventivando, quanto mettere via ogni mese, fatture elettroniche SdI, F24 pronti e chiusura d'anno: tutto dentro PrevAI.",
};

export type FaqLanding = { domanda: string; risposta: string };

export const FAQ_LANDING_AMMINISTRAZIONE: readonly FaqLanding[] = [
  {
    domanda: "PrevAI sostituisce il commercialista?",
    risposta:
      "No. PrevAI è uno strumento: calcola imposta e contributi con la formula di ogni numero, prepara gli F24 e il prospetto per la dichiarazione, ti ricorda le scadenze. I versamenti li disponi tu e la dichiarazione dei redditi la invii tu o il tuo commercialista, al quale puoi dare un link in sola lettura a tutti i dati.",
  },
  {
    domanda: "A chi serve?",
    risposta:
      "Ad artigiani e piccole imprese dell'edilizia e degli impianti in regime forfettario, che fanno già preventivi, cantieri e fatture con PrevAI e vogliono sapere in ogni momento quanto stanno maturando di tasse e contributi.",
  },
  {
    domanda: "Come fa a sapere quanto pagherò?",
    risposta:
      "Parte dagli incassi registrati sulle fatture, non da stime: nel forfettario conta il denaro incassato nell'anno. Poi aggiunge i preventivi accettati e non ancora fatturati, per dirti in anticipo se un lavoro nuovo ti porterebbe oltre la soglia dei ricavi.",
  },
  {
    domanda: "Le fatture elettroniche passano dallo SdI?",
    risposta:
      "Sì, attraverso un intermediario accreditato: la fattura che crei in PrevAI diventa un file FatturaPA, viene controllata prima dell'invio e trasmessa allo SdI, con le ricevute e la conservazione a norma. Ricevi anche le fatture dei fornitori, che entrano nei costi del cantiere.",
  },
  {
    domanda: "Posso disdire quando voglio?",
    risposta:
      "Sì, dal portale di Stripe, senza penali. I tuoi dati restano consultabili ed esportabili; le fatture elettroniche restano conservate per il periodo previsto dalla legge.",
  },
];

/**
 * La landing entra nella sitemap e si fa indicizzare solo da "interesse" in
 * su: in bozza esiste ma è noindex, perché mostra nome e prezzi non ancora
 * decisi (D5).
 */
export function landingAmministrazioneIndicizzabile(now: Date = new Date()): boolean {
  return statoOfferta({ anno: now.getFullYear() }).effettivo !== "bozza";
}

export const NOME_OFFERTA = OFFERTA_AMMINISTRAZIONE.nome;
