// Italiano (it-IT) della vista del contabile (AccountantView.dc.html, QuoteAI 127.3, i18n/screens/accountant.ts). Il contabile è un membro col ruolo
// «Contabile»; il commercialista che segue la dichiarazione dal sito ha il suo link, e non passa da qui.
export const ac = {
  ac: {
    back: "Indietro", retry: "Riprova", kicker: "Accesso del contabile", title: "Conti e scadenze",
    share: "{{you}} · condiviso da {{owner}}", shareAlone: "{{you}}", switchAria: "{{name}}, cambia impresa",
    banner: { lead: "Sola lettura.", body: "Puoi guardare, scaricare e commentare. Qui non si può cambiare niente." },
    loadFailed: { title: "Non riesco a caricare i conti", body: "Controlla la connessione e riprova." },
    locked: { title: "I conti fanno parte di PrevAI Fisco", body: "Prima nota e chiusura del mese vengono con l'add-on PrevAI Fisco. Lo attiva il titolare da prevai.it." },
    ended: { title: "Il tuo accesso è finito", body: "{{company}} ha tolto l'accesso del contabile. I file che hai scaricato restano tuoi.", other: "Scegli un'altra impresa" },
    month: "Mese", monthLabel: "Mese",
    state: { closed: "Chiuso", inProgress: "In corso" },
    sub: { closedBy: "Chiuso da {{name}}, {{date}}", closed: "Chiuso il {{date}}", open: "Non ancora chiuso" },
    of: "{{done}} su {{total}}",
    checks: {
      bank: { title: "Movimenti abbinati", left_one: "{{count}} da abbinare", left_other: "{{count}} da abbinare", done: "Ogni movimento è abbinato" },
      receipts: { title: "Documenti allegati", missing_one: "{{count}} documento mancante", missing_other: "{{count}} documenti mancanti", done: "Ogni spesa da {{amount}} in su" },
      invoices: { title: "Fatture emesse", count_one: "{{count}} documento", count_other: "{{count}} documenti", drafts_one: "{{count}} documento", drafts_other: "{{count}} documenti", withDrafts: "{{issued}} · {{drafts}} ancora in bozza" },
      empty: "Per {{month}} non c'è ancora niente da controllare.",
    },
    exports: {
      title: "File", transactions: { title: "Movimenti", sub: "CSV · banca, costi e incassi" }, invoices: { title: "Fatture emesse", sub: "CSV · fatture e pro-forma" },
      download: "Scarica", downloadAria: "Scarica {{file}}, {{month}}", downloaded: "Scaricato", failed: "Non sono riuscito a scaricare il file. Riprova.",
    },
    tax: { link: "Scadenze", deadlines: "Scadenze", who: "{{who}}", dueOn: "Entro il {{date}}", none: "L'impresa non ha ancora scadenze in calendario.", due: "Entro il {{date}}", filed: "Versata il {{date}}" },
    comments: {
      title: "Commenti", placeholder: "Scrivi un commento", send: "Invia il commento", note: "{{company}} riceve i tuoi commenti.", empty: "Ancora nessun commento. Chiedi a {{owner}} quello che vuoi su {{month}}.", readOnly: "Puoi leggere questo filo ma non scriverci.",
      failed: "Non sono riuscito a inviare il commento. Riprova.", sending: "Invio", you: "Tu",
    },
  },
};
