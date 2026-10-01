// Italiano (it-IT): PrevAI è solo in italiano. Chiavi raggruppate per schermata, come in
// QuoteAI (en.ts/fr.ts), così ogni fase porta le stesse chiavi tradotte.
export const it = {
  sandbox: {
    title: "Componenti",
    intro: "Tutti i pezzi con cui è fatta l'app, con i loro stati. Tocca i comandi per provarli.",
    appearance: { light: "Chiaro", dark: "Scuro", auto: "Auto" },
    foundations: "Fondamenta",
    typeScale: "Scala tipografica",
    icons: "Icone",
    grounds: "Sfondi",
    digits: "Inviato 6 giorni fa · 4131,05 € · 22% · 14:30",
  },
  board: {
    buttons: {
      title: "Pulsanti",
      default: "Normale",
      pressed: "Premuto",
      disabled: "Disattivato",
      loading: "In corso",
      primary: {
        name: "Principale",
        label: "Invia preventivo",
        busy: "Invio in corso",
      },
      secondary: {
        name: "Secondario",
        label: "Anteprima",
        busy: "Caricamento",
      },
      destructive: {
        name: "Distruttivo",
        label: "Elimina bozza",
        busy: "Eliminazione",
      },
      accent: {
        name: "Accento",
        label: "Chiedi a PrevAI",
        busy: "Ci penso",
      },
      link: {
        name: "Link",
        label: "Password dimenticata?",
        busy: "Apertura",
      },
      sizes: "Misure: piccolo 36, medio 44, normale 50, grande 54",
      small: "Piccolo",
      medium: "Medio",
      defaultSize: "Normale",
      large: "Grande, tutta larghezza",
      smallGroup: "Piccoli",
      send: "Invia",
      edit: "Modifica",
      remove: "Rimuovi",
      reload: "Ricarica",
      newQuote: "Nuovo preventivo",
      fab: "Barra d'azione fluttuante",
      more: "Altre azioni",
    },
  },
  dev: {
    session: "Accesso fatto: {{company}}",
    noSession: "Nessun accesso",
  },
};

export type Dict = typeof it;
