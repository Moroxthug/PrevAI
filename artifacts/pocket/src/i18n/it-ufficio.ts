// Italiano (it-IT) delle schermate di POCKET-4 «Soldi e ufficio» (QuoteAI 127, i18n/screens/*.ts). Una chiave per schermata.
// Il vocabolario è quello del sito: prima nota, estratto conto, SdI, F24, listino, pro-forma. Dove QuoteAI parla di
// QuickBooks, Flinks o province canadesi, qui c'è ciò che PrevAI ha davvero (estratto conto importato, SdI, scadenzario).
import { pay } from "./it-ufficio-pay";

export const ufficio = {
  ...pay,
  // Libri (Books.dc.html): nel menu è «Prima nota».
  bk: {
    title: "Prima nota", back: "Indietro", close: "Chiudi", more: "Altre azioni", retry: "Riprova",
    sub: { bank: "Fine mese · con l'estratto conto di {{account}}", none: "Fine mese" },
    loadFailed: { title: "Non riesco a caricare la prima nota", body: "Controlla la connessione e riprova." },
    locked: { title: "La prima nota fa parte di PrevAI Fisco", body: "Prima nota, estratto conto e chiusura vengono con l'add-on PrevAI Fisco. Lo attivi da prevai.it." },
    monthLabel: "Mese", tagClosed: "Chiuso", tagOpen: "Aperto",
    openWord_one: "voce aperta", openWord_other: "voci aperte", done_one: "a posto", done_other: "a posto",
    changed: { lead: "Qualcosa di nuovo da quando hai chiuso {{month}}.", body: "{{items}}: più voci aperte di quando l'hai chiuso." },
    closeBtn: { ready: "Chiudi {{month}}", closed: "{{month}} è chiuso", working: "Chiudo" },
    note: { ready: "Blocca {{month}}", openItems: "Prima sistema o segna «Non serve» ogni voce aperta", notOver: "{{month}} non è ancora finito", closed: "Chiuso il {{date}} · riapri da ⋯" },
    closeDone: "{{month}} è chiuso", closeFailed: "Non sono riuscito a chiudere il mese. Riprova.", reopenDone: "{{month}} è di nuovo aperto",
    checklist: { title: "Da controllare", count: "{{done}} su {{total}}", na: "Non serve", undo: "Annulla", naLabel: "Segna «{{item}}» come non necessario", openLabel: "Apri «{{item}}»", naSub: "Segnato come non necessario questo mese", empty: "Niente da controllare questo mese." },
    items: {
      bank_unmatched: { title: "Movimenti da abbinare", sub: "A una fattura, un incasso o un costo" },
      payments_unbanked: { title: "Incassi non in banca", sub: "Registrati, ma senza movimento sull'estratto" },
      costs_pending: { title: "Costi da rivedere", sub: "Scontrini letti ma non ancora confermati", subDone: "Ogni costo è confermato" },
      sdi_open: { title: "Fatture non arrivate allo SdI", sub: "Mai inviate, scartate o rifiutate", subDone: "Ogni fattura è arrivata allo SdI" },
      invoices_draft: { title: "Bozze non inviate", sub: "Bozze {{numbers}}", subDone: "Ogni bozza è stata inviata" },
      time_unapproved: { title: "Ore da approvare", sub_one: "{{count}} registrazione di ore", sub_other: "{{count}} registrazioni di ore", subDone: "Ogni registrazione è approvata" },
      and: "{{a}} e {{b}}",
    },
    bank: {
      title: "Movimenti dell'estratto", account: "{{name}}", filter: "Filtro dei movimenti", open: "Da abbinare", matched: "Abbinati", ignored: "Ignorati",
      match: "Abbina", matchMore: "Abbina…", cost: "Registra come costo", ignore: "Ignora", undo: "Annulla",
      status: { matched: "Abbinato", cost: "Registrato come costo", ignored: "Ignorato" },
      hint: {
        looksLike: "{{label}}", couldBe: "Potrebbe essere: {{label}}", none: "Nessuna corrispondenza", ignored: "Fuori dalla prima nota",
        kind: { incasso: "Incasso di una fattura", costo: "Costo", versamento: "Versamento F24", movimento: "Movimento di prima nota" },
      },
      emptyTitle: "Niente qui", emptyBody: "Ogni movimento di questa vista è a posto.", noneTitle: "Nessun movimento", noneBody: "L'estratto conto non ha movimenti a {{month}}.",
      feed: "Estratto conto importato il {{time}}", feedNever: "Estratto conto non ancora importato",
      notConnected: { title: "Importa l'estratto conto", body: "I movimenti compaiono qui dopo che carichi l'estratto conto (CSV o OFX) dal sito, in Fisco → Prima nota." },
    },
    picker: {
      title: "Abbina questo movimento", other: "Oppure", maybe: "Da verificare", emptyTitle: "Niente da abbinare per ora", emptyIn: "Nessun incasso o fattura aperta corrisponde a questo importo.", emptyOut: "Nessun costo corrisponde a questo importo. Registralo come costo.",
    },
    toast: { matched: "Abbinato", paid: "Incasso registrato e abbinato", cost: "Registrato come costo", movement: "Registrato in prima nota", ignored: "Ignorato", undone: "Di nuovo da abbinare", failed: "Non sono riuscito a salvare. Riprova.", taken: "È già abbinato a un altro movimento.", over: "Gli importi non coincidono." },
    menu: { reopen: "Riapri {{month}}", reopenSub: "Sbloccalo per cambiare le voci aperte" },
  },
};
