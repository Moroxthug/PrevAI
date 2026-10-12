// Italiano (it-IT) di Analisi (Analytics.dc.html, QuoteAI 127.9, i18n/screens/analytics.ts). I numeri vengono da /api/analytics/company e /insights
// (piano Elite). «Trimestre» al posto del «Q» canadese; le sorgenti delle richieste sono quelle di PrevAI.
export const an = {
  an: {
    back: "Indietro", more: "Altre azioni", retry: "Riprova", title: "Analisi", heading: "Come va l'impresa", sub: "{{company}} · {{period}}",
    periods: { m: "Mese", q: "Trimestre", y: "Anno", label: "Periodo" },
    label: { m: "{{month}} {{year}}", q: "{{q}}º trimestre {{year}}, da {{from}} a {{to}}", y: "{{year}} finora" },
    kpi: {
      invoiced: "Fatturato", collected: "Incassato", costs: "Costi", margin: "Margine", owed: "Da incassare", toInvoice: "Da fatturare",
      up: "In su del {{pct}}", down: "In giù del {{pct}}", upYear: "In su del {{pct}} sullo stesso periodo dell'anno scorso", downYear: "In giù del {{pct}} sullo stesso periodo dell'anno scorso", same: "Più o meno uguale",
      ofInvoiced: "{{pct}} del fatturato", costsSub: "Materiali, manodopera, subappalti", kept: "{{amount}} rimasti", lost: "{{amount}} persi", overdue: "{{amount}} scaduti", noneOverdue: "Niente di scaduto", notBilled: "Non ancora fatturato",
    },
    revenue: {
      title: "Ricavi", by: { m: "Per mese", q: "Per trimestre", y: "Per anno" }, label: { m: "Fatturato a {{month}}", q: "Fatturato nel {{q}}º trimestre", y: "Fatturato nel {{year}} finora" },
      up: "In su del {{pct}} su {{prev}}", down: "In giù del {{pct}} su {{prev}}", prevYear: "lo stesso periodo dell'anno scorso", prevQuarter: "{{q}}º trimestre", bestMonth: "Il tuo mese migliore di quest'anno.", bestQuarter: "Il tuo miglior trimestre finora.",
      aria: "Fatturato {{list}}", quarter: "T{{q}}", none: "Ancora niente di fatturato",
    },
    jobs: {
      title: "Cantieri da guardare", link: "Tutti i cantieri",
      over_budget: "Fuori budget", budget_burn: "Budget", behind_schedule: "In ritardo", overdue_invoices: "Scaduti", unbilled_completion: "Da fatturare", billing_gap: "Da fatturare",
      overPct: "{{pct}} del budget", overAmt: "{{amount}} oltre il budget", burn: "{{pct}} del budget usato", behind_one: "{{count}} giorno di ritardo", behind_other: "{{count}} giorni di ritardo", overdue: "{{amount}} scaduti", unbilled: "{{amount}} non fatturati",
    },
    win: { title: "Tasso di successo", link: "Preventivi", of: "{{won}} vinti su {{decided}} preventivi decisi", none: "Nessun preventivo deciso in questo periodo" },
    avg: { title: "Preventivo medio", upFrom: "In su da {{amount}} a {{label}}", downFrom: "In giù da {{amount}} a {{label}}", none: "Nessun preventivo inviato in questo periodo", aria: "Preventivo medio per mese, da {{from}} a {{to}}" },
    cash: { title: "Dal preventivo all'incasso", label: "Da quando invii il preventivo a quando i soldi sono in banca", days: "giorni", d: "{{n}} g", accept: "Per accettare", invoice: "Per fatturare", paid: "Per essere pagato", aria: "{{a}} per accettare, {{i}} per fatturare, {{p}} per essere pagato" },
    clients: { title: "Clienti principali", link: "Clienti", sub_one: "{{count}} fattura", sub_other: "{{count}} fatture", share: "{{pct}} di {{label}}", top: "I tuoi primi tre portano il {{pct}} del lavoro." },
    leads: {
      title: "Da dove arrivano le richieste", link: "Lead", source: "Provenienza", share: "Quota delle richieste", won: "Vinte",
      sources: { widget: "Modulo del sito", manual: "Inserita a mano", import: "Importata", meta_lead_ads: "Facebook e Instagram", google_lsa: "Google" },
    },
    locked: {
      title: "L'analisi fa parte del piano {{plan}}", body: "Ricavi, tasso di successo, margini e ore della squadra, in un posto solo. La tua impresa è sul piano {{current}}.",
      feats: { money: "Ricavi, costi e margine mese per mese", win: "Tasso di successo e preventivo medio", margin: "Margine per tipo di lavoro", crew: "Ore della squadra e provenienza delle richieste" },
      plans: "Vedi i piani su prevai.it", note: "I piani non si cambiano nell'app.", soon: "Piano",
    },
    loading: "Carico le analisi", loadFailed: { title: "Non riesco a caricare le analisi", body: "Controlla la connessione e riprova." },
    offline: { lead: "Sei senza rete.", body: "Vedi i numeri dell'ultima volta." }, noAccess: "Il tuo ruolo non può vedere i numeri dell'impresa.",
  },
};
