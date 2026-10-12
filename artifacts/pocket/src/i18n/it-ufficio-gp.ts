// Italiano (it-IT) di Gruppo (Group.dc.html, QuoteAI 127.8, i18n/screens/group.ts): più imprese dello stesso titolare viste insieme, col lavoro fra loro tolto
// dai totali. Una sola fattura per tutte, il listino condiviso e le persone su due squadre toccano piani e fatturazione: per ora non ci sono.
export const gp = {
  gp: {
    back: "Indietro", more: "Altre azioni", retry: "Riprova", close: "Chiudi", cancel: "Annulla", title: "Gruppo",
    locked: {
      title: "Gestisci più di un'impresa", body: "I soldi di tutte le imprese che hai, in un posto solo.", tag: "Compreso nel piano {{plan}}",
      feats: { money: "Soldi di tutte le imprese insieme", between: "Il lavoro fra le tue imprese non conta due volte" },
      thisCompany: "{{province}} · questa impresa", second: "La tua seconda impresa", secondSub: "Aggiungila quando passi al piano {{plan}}",
      bannerLead: "I piani non si cambiano nell'app.", bannerBody: "Il titolare può farlo dal sito.", plans: "Vedi i piani su prevai.it", soon: "Piano",
    },
    scope: { showing: "Mostro", all: "Tutte le imprese", allSub_one: "{{count}} impresa · insieme", allSub_other: "{{count}} imprese · insieme", pick: "Impresa" },
    month: { left: "{{amount}} fra le imprese lasciati fuori", only: "Solo questa impresa" },
    kpi: {
      invoiced: "Fatturato", costs: "Costi", margin: "Margine", owed: "Da incassare",
      up: "↑ {{pct}} su {{month}}", down: "↓ {{pct}} su {{month}}", same: "Come {{month}}", costsSub: "Manodopera, materiali, subappalti", profit: "{{amount}} di utile", loss: "{{amount}} di perdita", overdue: "{{amount}} scaduti", none: "Niente di scaduto",
    },
    bars: { title: "Fatturato per mese" },
    companies: {
      title: "Imprese", count_one: "{{count}} impresa", count_other: "{{count}} imprese", sub: "{{province}} · {{jobs}}", jobs_one: "{{count}} cantiere attivo", jobs_other: "{{count}} cantieri attivi",
      margin: "{{pct}} di margine", invited: "Invito mandato", hidden: "Cifre nascoste", hiddenSub: "Lì non sei titolare né amministratore",
      add: "Aggiungi un'impresa", addSub: "Fanne entrare una tua", addNone: "Prima aggiungi l'impresa su prevai.it, poi la inviti da qui.", invitedToast: "Invito mandato a {{name}}", pickTitle: "Aggiungi un'impresa", pickSub: "Imprese tue che non sono in un gruppo",
    },
    shared: { title: "Persone", members: "Persone e ruoli", membersSub: "Chi lavora nella tua impresa" },
    leave: { button: "Esci da questo gruppo", title: "Uscire da questo gruppo?", body: "{{name}} smette di condividere i soldi con il gruppo. Non si cancella niente.", confirm: "Esci dal gruppo", left: "Sei uscito dal gruppo" },
    start: { title: "Crea un gruppo", body: "Metti vicine le imprese che hai: i soldi di tutte insieme, senza contare due volte il lavoro fra loro.", action: "Crea un gruppo", name: "Nome del gruppo", save: "Crea il gruppo" },
    invite: { lead: "{{name}} ha invitato questa impresa in «{{group}}».", join: "Entra", decline: "Rifiuta", joined: "Sei entrato nel gruppo", declined: "Invito rifiutato" },
    loadFailed: { title: "Non riesco a caricare il gruppo", body: "Controlla la connessione e riprova." },
    offline: { lead: "Sei senza rete.", body: "Vedi il gruppo dell'ultima volta." },
    noAccess: "Solo il titolare o un amministratore può cambiare il gruppo.", failed: "Non sono riuscito a salvare. Riprova.", denied: "Per vedere le cifre di un'impresa devi esserne titolare o amministratore.",
  },
};
