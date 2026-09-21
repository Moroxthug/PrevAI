// Phase 70 (PrevAI) / V2-2: contenuti del centro assistenza — i dieci flussi
// che una nuova impresa attraversa, nell'ordine in cui accadono
// (JOB-LIFECYCLE-PLAN §3). Resi da src/pages/help/*, prerenderizzati da
// scripts/prerender-seo.ts, elencati da generate-sitemap.ts e dalla mappa del sito.
//
// Ogni affermazione qui deve essere vera per il prodotto: i numeri (cadenza
// promemoria 2/5/10 giorni, solleciti 3/7/14, link operai 6 mesi, posti per
// piano) sono le stesse costanti del server. Quando una cambia, cambiarla
// anche qui — e aggiornare `updatedAt` così il lastmod della sitemap si muove.
//
// Riferimenti canadesi (GST/HST, e-Transfer, CASL, QuickBooks/Wave, LSA) sono
// stati sostituiti con gli equivalenti italiani; le integrazioni che V2-4
// disattiva non sono citate.
import type { Lang } from "@workspace/config";
export type HelpLang = Lang;
export type L = { [K in HelpLang]: string };

export type HelpBlock =
  | { type: "p"; text: L }
  | { type: "h"; text: L }
  | { type: "steps"; items: L[] }
  | { type: "bullets"; items: L[] }
  | { type: "note"; text: L };

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  title: L;
  summary: L;
  /** Data ISO dell'ultima modifica ai contenuti — il lastmod della sitemap. */
  updatedAt: string;
  readingTimeMin: number;
  blocks: HelpBlock[];
}

export type HelpCategory = "start" | "quotes" | "contracts" | "jobs" | "money" | "team" | "growth";

export const HELP_CATEGORIES: Record<HelpCategory, L> = {
  start: { it: "Primi passi" },
  quotes: { it: "Preventivi" },
  contracts: { it: "Contratti e firma elettronica" },
  jobs: { it: "Cantieri" },
  money: { it: "Fatture e pagamenti" },
  team: { it: "Squadra" },
  growth: { it: "Lead e integrazioni" },
};

const p = (it: string): HelpBlock => ({ type: "p", text: { it } });
const h = (it: string): HelpBlock => ({ type: "h", text: { it } });
const note = (it: string): HelpBlock => ({ type: "note", text: { it } });
const steps = (items: string[]): HelpBlock => ({ type: "steps", items: items.map((it) => ({ it })) });
const bullets = (items: string[]): HelpBlock => ({ type: "bullets", items: items.map((it) => ({ it })) });

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    category: "start",
    title: { it: "Imposta la tua azienda in 10 minuti" },
    summary: {
      it: "Crea l'account, compila il profilo aziendale che compare su ogni preventivo, contratto e fattura, e scegli un piano.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      p("Tutto ciò che PrevAI produce — preventivi, contratti, fatture, email ai clienti — nasce dal tuo profilo aziendale. Dieci minuti qui ti risparmiano di riscrivere gli stessi dati su ogni documento."),
      h("1. Crea l'account"),
      steps([
        "Vai su Registrati, inserisci nome, email e una password.",
        "La procedura guidata chiede ragione sociale, mestiere e provincia. Scegli la provincia in cui lavori di più: compare sui documenti e serve alle landing locali.",
        "Arrivi sulla dashboard con il piano gratuito. Non viene addebitato nulla finché non passi a un piano a pagamento.",
      ]),
      h("2. Completa il profilo aziendale"),
      p("Apri Impostazioni → Profilo aziendale. I campi che contano di più:"),
      bullets([
        "Ragione sociale, indirizzo e telefono — stampati su ogni documento e obbligatori in fattura.",
        "Partita IVA e codice fiscale — devono comparire su ogni fattura (art. 21 DPR 633/72); il codice destinatario SDI o la PEC servono quando la fattura elettronica verrà emessa.",
        "Numero REA o iscrizione all'albo — inserito nel contratto dove serve.",
        "IBAN — mostrato sulle fatture così i clienti sanno dove fare il bonifico. È il modo in cui la maggior parte dei clienti paga gli artigiani.",
        "Logo — compare sui PDF e sulle pagine cliente di preventivo, firma e fattura.",
        "Condizioni di pagamento e acconto predefiniti — il piano di pagamento proposto su ogni nuovo preventivo (modificabile preventivo per preventivo).",
      ]),
      h("3. Scegli un piano"),
      p("Impostazioni → Piano e fatturazione. Starter copre i preventivi, il loro invio via email e le notifiche di accettazione. Pro aggiunge listino prezzi, contratti e firma elettronica, cantieri, costi, fatturazione e account per la squadra (2 posti inclusi). Elite aggiunge timbratura ore degli operai, analisi, assistente AI e le integrazioni avanzate."),
      note("L'utilizzo (preventivi generati, foto analizzate, messaggi WhatsApp) si azzera il 1° di ogni mese ed è visibile in Impostazioni → Utilizzo. Superare la soglia non ti blocca mai: serve solo a dirti quando conviene passare di piano."),
    ],
  },
  {
    slug: "create-a-quote",
    category: "quotes",
    title: { it: "Crea un preventivo da una descrizione, un vocale o delle foto" },
    summary: {
      it: "Descrivi il lavoro in italiano e ottieni un preventivo voce per voce, con IVA, in circa 30 secondi. Poi modificalo, proponi le opzioni Base/Consigliato/Premium e scegli un modello PDF.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Descrivi il lavoro"),
      steps([
        "Clicca Nuovo preventivo nella barra laterale.",
        "Scrivi quello che diresti a un collega: \"Tinteggiatura trilocale a Monza, due mani, soffitti inclusi, piccola rasatura nel corridoio\". Più misure, materiali e vincoli dai, migliori sono le voci.",
        "Preferisci parlare? Premi il microfono e detta. La trascrizione compare nel riquadro e puoi correggerla prima di generare.",
        "Allega foto del cantiere o documenti (PDF, Excel, Word) con la graffetta. L'AI li legge per ricavare quantità e portata del lavoro. Starter consente 1 foto per preventivo, Pro 3, Elite 5.",
        "Clicca Genera. Il preventivo si apre con capitoli, voci, quantità, prezzi unitari, subtotali e l'IVA (22 %, oppure 10 % per manutenzione e ristrutturazione).",
      ]),
      h("Modifica il risultato"),
      p("Clicca su qualsiasi campo per modificarlo: descrizioni, quantità, prezzi, dati del cliente, condizioni di pagamento. Aggiungi o togli voci e capitoli. Totali e IVA si ricalcolano mentre scrivi. Le voci che prezzi spesso vanno nel Listino (da Pro in su): l'AI le usa come riferimento e ottieni prezzi coerenti da un preventivo all'altro."),
      h("Base / Consigliato / Premium"),
      p("Nel pannello Base / Consigliato / Premium del preventivo aggiungi fino a tre opzioni di prezzo, ognuna con descrizione e totale. Il cliente ne sceglie una nella pagina di accettazione e l'opzione scelta diventa il valore del contratto."),
      h("Scegli un modello PDF"),
      p("Sono disponibili tre impaginazioni: Standard (voce per voce con blocco firma), Professionale (capitolato numerato con subtotali per capitolo) ed Elegante (elenco numerato con intestazione OFFERTA). L'anteprima si aggiorna in tempo reale e il PDF inviato via email è identico."),
      note("L'AI è un punto di partenza, non un'autorità sui prezzi. Controlla le quantità con il tuo computo prima di inviare: il prezzo a cui ti impegni è responsabilità tua."),
    ],
  },
  {
    slug: "send-a-quote-and-get-it-accepted",
    category: "quotes",
    title: { it: "Invia un preventivo e fallo accettare online" },
    summary: {
      it: "Invia il preventivo via email o condividi il link. Il cliente lo esamina e lo accetta su una pagina sicura; i promemoria automatici lo sollecitano dopo 2, 5 e 10 giorni finché non risponde.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      h("Due modi per inviare"),
      bullets([
        "Invia via email — inserisci l'indirizzo del cliente; il PDF è allegato e l'email contiene un pulsante verso il preventivo online. Se hai collegato Gmail (Impostazioni → Integrazioni), parte dalla tua casella e le risposte arrivano lì.",
        "Copia link — incollalo su WhatsApp, in un SMS o nella tua email. Il link apre la stessa pagina.",
      ]),
      h("Cosa vede il cliente"),
      p("Una pagina con il tuo logo, il preventivo completo, il piano di pagamento e — se le hai aggiunte — le opzioni Base / Consigliato / Premium. Per accettare digita il suo nome e conferma. PrevAI registra nome, ora e indirizzo IP dell'accettazione, segna il preventivo come Accettato e ti avvisa via email e nella campanella delle notifiche. Se il cliente ha scelto un'opzione, la vedi sul preventivo."),
      h("Promemoria automatici"),
      p("Quando invii un preventivo via email parte una sequenza di promemoria: un gentile sollecito dopo 2 giorni, un altro dopo 5, l'ultimo dopo 10. La sequenza si ferma da sola nel momento in cui il preventivo viene accettato o rifiutato, o se il cliente clicca il link di disiscrizione presente in ogni promemoria. Non devi ricordarti di sollecitare."),
      h("Dopo l'accettazione"),
      p("Su Pro ed Elite un preventivo accettato genera in automatico la bozza di contratto d'appalto (vedi l'articolo sui contratti). Su Starter l'accettazione è il tuo via libera firmato: puoi comunque scaricare il PDF e iniziare i lavori."),
      note("I preventivi inviati vengono bloccati, così il cliente vede sempre la versione che ha accettato. Per cambiare un prezzo dopo l'invio, duplica il preventivo e invia quello nuovo."),
    ],
  },
  {
    slug: "contracts-and-e-signature",
    category: "contracts",
    title: { it: "Contratti e firma elettronica" },
    summary: {
      it: "Un preventivo accettato diventa un contratto d'appalto costruito sul modello italiano. Il cliente firma online con un codice di verifica via email; entrambi ricevete il PDF firmato con il certificato di firma.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 6,
    blocks: [
      h("Come viene costruito il contratto"),
      p("Il contratto riprende dal preventivo accettato le parti, l'oggetto dei lavori, il corrispettivo e il piano di pagamento, e li inserisce in un contratto d'appalto in 16 articoli (artt. 1655 ss. c.c.): varianti, titoli abilitativi e sicurezza, garanzia, ritenuta a garanzia, diritto di recesso del consumatore, risoluzione, foro. L'AI redige le sezioni \"Oggetto dei lavori\" e \"Tempi di esecuzione\"; tutto il resto è testo fisso che si adatta alle variabili (ritenuta sì/no, contratto concluso fuori sede)."),
      p("Puoi anche caricare un tuo modello con {{variabili}} come {{clientName}} o {{total}} se hai già un testo approvato dal tuo legale."),
      h("Rivedi e invia"),
      steps([
        "Apri Contratti. La bozza compare nel momento in cui un preventivo viene accettato (oppure clicca Nuovo contratto da un preventivo accettato).",
        "Leggi ogni sezione. Modifica oggetto, date, piano o qualsiasi clausola. Attiva o disattiva la ritenuta a garanzia e impostane la percentuale: il testo della clausola si adatta.",
        "Clicca Invia per la firma. Il cliente riceve un'email con un link di firma personale. Se il preventivo non aveva un'email, ti viene chiesta e viene salvata sulla scheda cliente.",
        "I solleciti partono in automatico dopo 3, 7 e 14 giorni finché il contratto non è firmato.",
      ]),
      h("Come firma il cliente"),
      steps([
        "Apre il link e legge il contratto per intero.",
        "Richiede un codice a 6 cifre, inviato all'indirizzo a cui hai mandato il contratto: è così che PrevAI verifica chi sta firmando.",
        "Digita nome e cognome, spunta la dichiarazione di consenso e firma. Può anche rifiutare indicando un motivo, che vedi subito.",
        "Tu controfirmi dalla pagina del contratto. Quando ci sono entrambe le firme, il PDF finale e il certificato di firma (nomi, email, orari, indirizzi IP, impronte SHA-256 del documento inviato e di quello firmato) vengono generati, archiviati e inviati via email a entrambe le parti.",
      ]),
      h("Cosa succede dopo"),
      p("Un contratto firmato imposta in automatico il cantiere (fasi, cronoprogramma, budget dei costi) e prepara la fattura dell'acconto. Ricevi una sola notifica — \"Rivedi l'impostazione del cantiere\" — e confermi tutto con un clic. I contratti firmati non vengono mai eliminati: archiviare un cantiere li conserva, perché sono documenti da tenere per dieci anni (art. 2220 c.c.)."),
      note("Il modello si basa su Codice Civile, Codice del Consumo e Regolamento eIDAS, ma non è consulenza legale e PrevAI non è uno studio legale. Fai leggere il modello al tuo legale una volta prima di affidartici, e di nuovo quando la tua attività cambia."),
    ],
  },
  {
    slug: "jobs-milestones-and-change-orders",
    category: "jobs",
    title: { it: "Cantieri: impostazione, fasi e varianti" },
    summary: {
      it: "Ogni contratto firmato diventa un cantiere con fasi, cronoprogramma e budget proposti dall'AI. Confermalo con un clic, segui l'avanzamento e gestisci gli extra con varianti che il cliente firma.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("La revisione dell'impostazione"),
      p("Non compili mai un modulo per creare un cantiere. Quando un contratto viene firmato, PrevAI legge l'oggetto dei lavori e propone le fasi (per una cucina: demolizione, impianti al grezzo, mobili, finiture), un cronoprogramma con data di fine e un budget dei costi diviso tra manodopera, materiali, subappaltatori e attrezzature. La pagina Rivedi l'impostazione del cantiere mostra tutto insieme: cambia quello che vuoi e clicca Avvia il cantiere."),
      h("Durante i lavori"),
      bullets([
        "La pagina del cantiere mostra la timeline, il budget rispetto ai costi reali, le ore registrate, i documenti e ogni fattura del cantiere.",
        "Segna una fase come completata quando il lavoro è finito. Se il piano di pagamento lega una rata a quella fase, la fattura di SAL viene generata (con la ritenuta a garanzia dedotta se attiva) e inviata, oppure lasciata in bozza: lo scegli in Impostazioni → Profilo aziendale → Automazioni.",
        "Collega Google Calendar o Outlook (Impostazioni → Integrazioni) e le fasi compaiono nel tuo calendario; spostare una data in PrevAI sposta l'evento.",
        "Imposta la posizione del cantiere nella scheda Squadra così le timbrature degli operai vengono confrontate con essa.",
      ]),
      h("Varianti in corso d'opera"),
      steps([
        "Nella pagina del cantiere clicca Variante e descrivi l'extra (o lo storno). Aggiungi le voci come su un preventivo.",
        "Inviala. Il cliente la firma online esattamente come il contratto.",
        "Una volta firmata, il corrispettivo, il piano di pagamento e il budget si aggiornano da soli e la variante viene allegata al fascicolo del contratto.",
      ]),
      h("Chiusura"),
      p("Segna il cantiere come completato per generare la fattura di saldo. Se c'è una ritenuta a garanzia, PrevAI programma la fattura di svincolo al termine del periodo pattuito (di norma 60 giorni dalla fine lavori) e ti avvisa quando è il momento. I cantieri completati passano nell'Archivio, dove ogni documento resta consultabile."),
    ],
  },
  {
    slug: "invoices-and-getting-paid",
    category: "money",
    title: { it: "Fatture, bonifici e pagamenti con carta" },
    summary: {
      it: "Le fatture di acconto, SAL e saldo nascono dal piano di pagamento del contratto. I clienti pagano con bonifico o con carta; i solleciti partono 3, 7 e 14 giorni dopo la scadenza.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Da dove nascono le fatture"),
      p("Il piano di pagamento impostato sul preventivo (per esempio 30 % di acconto, 40 % dopo gli impianti al grezzo, 30 % a fine lavori) viene copiato nel contratto, e ogni riga diventa una fattura al momento giusto: l'acconto alla firma del contratto, i SAL al completamento della fase, il saldo quando il cantiere è segnato come completato. Puoi anche creare una fattura manuale da zero."),
      p("Ogni fattura ha un numero progressivo che non viene mai riutilizzato, la tua partita IVA, i dati del cliente, l'IVA esposta separatamente e la scadenza. Annullare una fattura ne conserva il numero nella sequenza e ti permette di emetterne una corretta. Finché non è collegato il Sistema di Interscambio, i documenti valgono come pro-forma: la fattura elettronica va emessa dal tuo software di fatturazione o dal commercialista."),
      h("Invia e incassa"),
      p("In Impostazioni → Profilo aziendale → Automazioni scegli se le fatture vengono inviate in automatico (dopo un ritardo che imposti tu) o lasciate in bozza perché sia tu a inviarle. Il cliente riceve un'email con il PDF e un link alla pagina della fattura, che mostra il residuo e come pagare:"),
      bullets([
        "Bonifico all'IBAN del tuo profilo, con il numero del documento in causale. Il cliente clicca \"Ho inviato il bonifico\" e tu ricevi una notifica per confermare quando i soldi arrivano.",
        "Pagamento con carta, se hai collegato Stripe (Impostazioni → Integrazioni → Stripe Connect). I soldi vanno direttamente sul tuo conto; PrevAI non li trattiene mai. La fattura viene segnata come pagata in automatico.",
        "Assegno, con il tuo indirizzo.",
      ]),
      h("Registrare pagamenti e solleciti"),
      p("Clicca Registra pagamento sulla fattura per annotare importo, data, modalità e riferimento, e se vuoi inviare una ricevuta via email. I pagamenti parziali vanno bene: il residuo si aggiorna. Mentre una fattura è scaduta, i solleciti partono in automatico 3, 7 e 14 giorni dopo la scadenza (disattivabili in Automazioni). La sezione crediti della dashboard mostra chi deve cosa e da quanto."),
      h("Ritenuta a garanzia"),
      p("Quando il contratto prevede una ritenuta a garanzia, ogni fattura di SAL mostra l'importo trattenuto e la fattura di svincolo viene creata per te al termine del periodo pattuito. Il promemoria ti dice quando puoi fatturarla."),
      note("Gli importi in contanti sono ammessi fino a 5.000 euro (art. 49 D.Lgs. 231/2007); oltre serve un mezzo tracciabile. Per i lavori con detrazione fiscale il cliente deve pagare con bonifico parlante."),
    ],
  },
  {
    slug: "costs-receipts-and-time",
    category: "jobs",
    title: { it: "Costi, scontrini e ore di lavoro" },
    summary: {
      it: "Fotografa uno scontrino e l'AI lo registra sul cantiere. Gli operai timbrano entrata e uscita da un link personale — niente app, niente login — e il margine del cantiere si aggiorna in tempo reale.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 4,
    blocks: [
      h("Scontrini e costi"),
      steps([
        "Nella pagina del cantiere apri Costi e clicca Aggiungi ricevuta. Scatta una foto o carica il PDF del fornitore.",
        "L'AI legge fornitore, data, voci, IVA e totale, e propone una categoria (materiali, attrezzature, subappaltatore, altro). Controlla, correggi se serve, salva.",
        "Inserisci a mano i costi senza ricevuta: la fattura di un subappaltatore, lo smaltimento in discarica, un noleggio.",
      ]),
      p("Ogni costo viene imputato alla riga di budget della revisione iniziale, così la pagina del cantiere mostra budget e consuntivo per categoria e il margine previsto."),
      h("Ore degli operai (Elite)"),
      steps([
        "Apri Squadra e aggiungi un operaio con il suo costo orario. Clicca Link per le ore: gli viene inviato via email un link personale, oppure copialo e mandaglielo via SMS o WhatsApp.",
        "L'operaio apre il link dal telefono, sceglie il cantiere e tocca Timbra entrata. Nessun account, nessuna app da installare. Il link vale 6 mesi; generane uno nuovo per sostituirlo o revocalo dalla riga dell'operaio.",
        "Se il cantiere ha una posizione, la timbratura registra a che distanza dal cantiere si trovava l'operaio, così individui le timbrature fatte da casa. Tra entrata e uscita non viene tracciato nulla.",
        "Le ore compaiono sul cantiere come costo di manodopera alla tariffa dell'operaio. Puoi aggiungere o correggere le registrazioni tu stesso.",
      ]),
      h("Export per il consulente del lavoro"),
      p("Squadra → Esporta ti dà un CSV con le ore per operaio e per periodo da girare a chi elabora le buste paga. PrevAI non elabora le paghe."),
    ],
  },
  {
    slug: "team-accounts-and-roles",
    category: "team",
    title: { it: "Invita la squadra e assegna i ruoli" },
    summary: {
      it: "Dai a impiegati, capicantiere o al commercialista un accesso personale con un ruolo che limita cosa possono vedere e fare. Pro include 2 posti, Elite 5.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 3,
    blocks: [
      h("Due tipi di persone"),
      bullets([
        "I membri della squadra accedono a PrevAI con la propria email e password e vedono le parti dell'account che il loro ruolo consente. Occupano un posto.",
        "Gli operai timbrano solo le ore da un link personale (vedi l'articolo su costi e ore). Non accedono mai e non occupano un posto.",
      ]),
      h("Ruoli"),
      bullets([
        "Amministratore — accesso completo tranne la fatturazione del piano.",
        "Ufficio — preventivi, clienti, contratti, cantieri e fatturazione.",
        "Capocantiere — cantieri e registrazioni ore; sola lettura sul resto.",
        "Lettore — sola lettura ovunque. Ideale per un commercialista o un socio.",
      ]),
      p("Solo il titolare vede Piano e fatturazione e può cambiare i dati legali dell'azienda."),
      h("Invitare qualcuno"),
      steps([
        "Vai su Squadra → Membri e clicca Invita membro. Inserisci l'email e scegli un ruolo.",
        "La persona riceve un'email con un link per creare il proprio accesso. Se l'email non arriva, copia il link di invito dalla riga del membro e inviaglielo tu.",
        "Cambia un ruolo in qualsiasi momento. Sospendi qualcuno per bloccarne l'accesso senza perdere lo storico; Rimuovilo quando se ne va.",
      ]),
      note("Pro include 2 posti ed Elite 5 (il titolare ne occupa uno). Quando i posti sono tutti usati, il pulsante di invito te lo dice; aggiungi posti da Piano e fatturazione."),
    ],
  },
  {
    slug: "leads-and-follow-ups",
    category: "growth",
    title: { it: "Lead, follow-up e richieste di recensione" },
    summary: {
      it: "Ogni richiesta di preventivo finisce nella pipeline Lead — dal widget del sito, da WhatsApp o da Meta Lead Ads. Segui il contatto finché è vinto o perso, nel rispetto del GDPR.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      h("Da dove arrivano i lead"),
      bullets([
        "Widget del sito — Impostazioni → Integrazione sito ti dà uno snippet per il tuo sito; i visitatori descrivono il lavoro e diventano un lead con una bozza di preventivo.",
        "WhatsApp — collega il tuo numero WhatsApp Business (Impostazioni → Bot WhatsApp) e i clienti possono mandare un messaggio, un vocale o una foto; il bot risponde con un preventivo e crea il lead.",
        "Meta Lead Ads — collegali in Impostazioni → Integrazioni e i nuovi lead vengono importati in automatico, con la fonte registrata.",
        "A mano — Nuovo lead nella pagina Lead, o dopo una telefonata.",
      ]),
      h("Gestire la pipeline"),
      p("I lead passano per Nuovo → Contattato → Preventivato → Vinto o Perso. Ogni lead mostra la data del prossimo follow-up; la scheda Follow-up in scadenza della dashboard elenca quelli di oggi. Invia ora manda subito il prossimo messaggio. Quando invii un preventivo da un lead, subentra la sequenza di promemoria del preventivo (giorni 2, 5, 10) e il lead viene segnato come Preventivato."),
      h("Restare nel GDPR"),
      p("Puoi scrivere a chi ti ha chiesto un preventivo (interesse legittimo / esecuzione di misure precontrattuali) e ai clienti esistenti per servizi analoghi (art. 130 c. 4 Codice Privacy). PrevAI registra come è stato ottenuto il consenso su ogni lead, inserisce ragione sociale, indirizzo e link di disiscrizione in ogni messaggio automatico, e ferma tutte le sequenze nell'istante in cui qualcuno si disiscrive. Un lead disiscritto non riceve più nulla finché non chiede di nuovo."),
      h("Richieste di recensione"),
      p("Impostazioni → Profilo aziendale → Recensioni: incolla il link alla tua scheda Google e lascia attivo l'interruttore. Tre giorni dopo che un cantiere è segnato come completato, il cliente riceve un messaggio che chiede una recensione — una volta per cantiere, mai a chi si è disiscritto, e solo se il link è impostato."),
    ],
  },
  {
    slug: "integrations-and-imports",
    category: "growth",
    title: { it: "Integrazioni e importazione dei vecchi preventivi" },
    summary: {
      it: "Invia dalla tua Gmail, sincronizza le fasi con Google Calendar o Outlook, incassa con carta tramite Stripe e importa anni di preventivi passati da un foglio di calcolo o da vecchi PDF.",
    },
    updatedAt: "2026-09-21",
    readingTimeMin: 5,
    blocks: [
      p("Tutte le integrazioni sono in Impostazioni → Integrazioni. Ognuna si collega con un pulsante Collega che ti porta dal fornitore ad approvare l'accesso; PrevAI conserva il token risultante cifrato e non vede mai la tua password. Scollega quando vuoi dalla stessa pagina."),
      h("Email dalla tua casella"),
      p("Collega Gmail e preventivi, contratti e fatture partono dal tuo indirizzo invece che da no-reply@prevai.it: le risposte arrivano nella tua casella e il messaggio resta nella cartella Inviati. Se un invio fallisce (per esempio dopo che hai cambiato la password Google) la pagina Integrazioni ti dice di ricollegare. L'invio da Outlook è in programma; finché non arriva, PrevAI invia per tuo conto con il tuo indirizzo come risposta."),
      h("Calendari"),
      p("Collega Google Calendar o Outlook e ogni fase del cantiere diventa un evento. Sposta la data in PrevAI e l'evento si sposta; completa la fase e l'evento viene segnato come fatto."),
      h("Contabilità"),
      p("L'export delle fatture verso il tuo software di fatturazione elettronica e il commercialista arriverà con il modulo Amministrazione; nel frattempo scarichi i PDF e il CSV dei pagamenti dalla pagina Fatture."),
      h("Pagamenti con carta tramite Stripe"),
      p("Collega Stripe e sulle pagine fattura dei tuoi clienti compare il pulsante Paga con carta. Gli accrediti arrivano sul tuo conto secondo i tempi di Stripe; PrevAI non trattiene mai i soldi. Si applica la commissione Stripe sulla carta; il bonifico resta gratuito."),
      h("Importa il tuo storico"),
      steps([
        "Apri Importazioni. Scegli Foglio di calcolo (un export CSV o Excel del tuo vecchio strumento, un preventivo per riga — scarica il modello per vedere le colonne) oppure Vecchi PDF (fino a 20 alla volta; l'AI legge ciascuno).",
        "Ogni riga o PDF arriva nella Coda di revisione con cliente, data, totale e stato trovati, e indica se corrisponde a un cliente esistente.",
        "Conferma quelli corretti (o Conferma tutti in questo lotto) e rifiuta il resto. Nulla diventa un preventivo o un cliente vero finché non lo confermi.",
      ]),
      h("API pubblica e Zapier"),
      p("Impostazioni → Integrazioni → Chiavi API crea una chiave per l'API REST di PrevAI (preventivi, clienti, lead, fatture, più webhook per gli eventi che ti interessano). Usala direttamente o tramite Zapier e Make per collegare strumenti che non integriamo in modo nativo."),
    ],
  },
];

export function findHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
