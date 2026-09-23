{/*
  Testo ripreso da PrevAI v1 (termini.tsx, tag v1-final) nel layout QuoteAI.
  Piani e prezzi in 4.1 vengono da @workspace/config (piani.ts, offerta.ts): A-5, D5 del 2026-09-23.
*/}
import { PublicLayout } from "@/components/layout/public-layout";
import { OFFERTA_AMMINISTRAZIONE, PREVENTIVI_SINGOLI, PREZZI_PIANI, formatPrezzo } from "@workspace/config";
import { prezzoPianoTesto } from "@/lib/prezzi";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";

export default function TermsPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Termini di servizio | PrevAI"
        description="Termini e condizioni per l'utilizzo della piattaforma PrevAI per la generazione di preventivi con intelligenza artificiale."
        canonical="https://prevai.it/termini/"
      />
      <div className="wrap">
        <nav aria-label="Percorso" className="crumbs">
          <Link href="/">Home</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">Termini di servizio</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, padding: "clamp(12px, 2vw, 24px) 0 clamp(24px, 3vw, 36px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 10 }}>
          Termini di servizio
        </h1>
        <p style={{ fontSize: 13, color: "var(--faint)" }}>Ultimo aggiornamento: 23 settembre 2026</p>
      </header>

      <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="prose blog-prose max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Accettazione dei termini</h2>
            <p>
              Utilizzando la piattaforma <strong>PrevAI</strong> (di seguito "Servizio"), disponibile all'indirizzo <strong>prevai.it</strong>,
              l'utente accetta integralmente i presenti Termini di Servizio. Se non accetti questi termini,
              non puoi utilizzare il Servizio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Descrizione del servizio</h2>
            <p>
              PrevAI è una piattaforma SaaS che consente a professionisti, artigiani e imprese di generare
              preventivi professionali tramite intelligenza artificiale e di gestire il lavoro che ne segue. Il Servizio include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Generazione di preventivi tramite AI a partire da una descrizione testuale, vocale o fotografica dei lavori.</li>
              <li>Creazione e download di documenti PDF professionali; accettazione online da parte del cliente.</li>
              <li>Contratti d'appalto con firma elettronica, gestione dei cantieri, fatture pro-forma e promemoria.</li>
              <li>Gestione del profilo aziendale, archiviazione dei documenti e account per la squadra.</li>
              <li>Piani di abbonamento mensile e acquisti singoli.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Account utente</h2>
            <p>
              Per accedere al Servizio è necessario creare un account fornendo dati veritieri e aggiornati.
              L'utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività
              svolte tramite il proprio account. In caso di accesso non autorizzato, l'utente deve
              notificarlo immediatamente a{" "}
              <a href="mailto:supporto@prevai.it" className="text-navy-600 hover:underline">supporto@prevai.it</a>.
              Il titolare di un'organizzazione può rendere obbligatoria l'autenticazione a due fattori per tutti gli utenti
              della sua squadra; per le funzioni che trattano dati fiscali e bancari (modulo PrevAI Fisco) essa è sempre obbligatoria.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Piani e pagamenti</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">4.1 Piani disponibili</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Starter ({prezzoPianoTesto("monthly_starter")} o {prezzoPianoTesto("monthly_starter", "annuale")}):</strong> {PREZZI_PIANI.monthly_starter.preventiviMese} preventivi al mese, PDF con filigrana PrevAI.</li>
                  <li><strong>Pro ({prezzoPianoTesto("monthly_pro")} o {prezzoPianoTesto("monthly_pro", "annuale")}):</strong> {PREZZI_PIANI.monthly_pro.preventiviMese} preventivi al mese, PDF senza filigrana, branding personalizzabile, contratti, cantieri e fatturazione, {PREZZI_PIANI.monthly_pro.utenti} utenti.</li>
                  <li><strong>Elite ({prezzoPianoTesto("monthly_elite")} o {prezzoPianoTesto("monthly_elite", "annuale")}):</strong> preventivi illimitati e tutto il Pro, più squadra, ore degli operai, analisi, assistente AI e integrazioni avanzate, {PREZZI_PIANI.monthly_elite.utenti} utenti.</li>
                  <li><strong>Singolo con filigrana ({formatPrezzo(PREVENTIVI_SINGOLI.oneshot_watermark.cents)}):</strong> un singolo preventivo PDF con filigrana.</li>
                  <li><strong>Singolo pulito ({formatPrezzo(PREVENTIVI_SINGOLI.oneshot_clean.cents)}):</strong> un singolo preventivo PDF senza filigrana.</li>
                  <li>
                    <strong>Add-on {OFFERTA_AMMINISTRAZIONE.nome}:</strong> fatture elettroniche, calcolo fiscale del regime forfettario, scadenzario, F24 precompilati,
                    prima nota e chiusura d'anno, acquistabile con qualunque piano al prezzo indicato nella pagina dell'add-on al momento dell'acquisto. Il
                    prezzo fondatori ({formatPrezzo(OFFERTA_AMMINISTRAZIONE.fondatori.mensileCents)} al mese o {formatPrezzo(OFFERTA_AMMINISTRAZIONE.fondatori.annualeCents)} all'anno), riservato alle prime{" "}
                    {OFFERTA_AMMINISTRAZIONE.fondatori.posti} imprese che si abbonano entro il {new Date(OFFERTA_AMMINISTRAZIONE.fondatori.finoAl).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}, resta invariato finché
                    l'abbonamento non viene disdetto.
                  </li>
                </ul>
                <p className="mt-1 text-xs text-gray-500">I prezzi aggiornati e le funzionalità di ciascun piano sono indicati nella pagina Piano e fatturazione al momento dell'acquisto.</p>
              </div>
              <div>
                <p className="font-medium">4.2 Fatturazione</p>
                <p className="mt-1">
                  Gli abbonamenti mensili si rinnovano automaticamente ogni mese, quelli annuali ogni anno. I pagamenti sono processati
                  tramite Stripe Inc. e sono soggetti ai relativi termini di servizio. I prezzi sono espressi in euro
                  e si intendono IVA inclusa.
                </p>
              </div>
              <div>
                <p className="font-medium">4.3 Rimborsi e disdetta</p>
                <p className="mt-1">
                  Ai sensi dell'art. 59, lett. o), del Codice del Consumo (D.Lgs. 206/2005), il diritto di recesso
                  non si applica ai contenuti digitali forniti immediatamente dopo l'acquisto con l'esplicito consenso
                  dell'utente. Per i piani mensili, puoi disdire in qualsiasi momento: il servizio rimane attivo fino alla
                  fine del periodo già pagato. Non sono previsti rimborsi pro-rata per i periodi non utilizzati.
                  Nulla in questa sezione limita i diritti inderogabili riconosciuti ai consumatori dalla legge.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Uso accettabile</h2>
            <p>È vietato utilizzare il Servizio per:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Generare documenti falsi, fraudolenti o fuorvianti.</li>
              <li>Violare diritti di terzi, normative applicabili o la presente policy.</li>
              <li>Tentare di accedere a dati di altri utenti o compromettere la sicurezza della piattaforma.</li>
              <li>Uso automatizzato massivo (scraping, bot) senza autorizzazione scritta.</li>
              <li>Rivendere o sublicenziare l'accesso al Servizio a terzi.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Proprietà intellettuale</h2>
            <p>
              PrevAI e i relativi loghi, marchi, interfacce e codice sorgente sono di proprietà esclusiva della Società.
              I preventivi, i contratti e le fatture generati tramite il Servizio sono di proprietà dell'utente che li ha creati.
              L'utente concede a PrevAI una licenza limitata, non esclusiva, per elaborare i dati inseriti
              al solo fine di erogare il Servizio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Limitazione di responsabilità</h2>
            <p>
              I preventivi generati dall'AI sono indicativi e basati su dati statistici. <strong>PrevAI non garantisce
              l'accuratezza, la completezza o l'adeguatezza dei preventivi, dei contratti o degli altri documenti per specifici contesti contrattuali o fiscali.</strong>{" "}
              L'utente è responsabile della verifica e validazione dei contenuti prima di presentarli ai propri clienti,
              inclusa l'aliquota IVA applicata. Nei limiti consentiti dalla legge applicabile, PrevAI non è responsabile per danni indiretti,
              perdita di dati, lucro cessante o danni derivanti da errori nell'output dell'AI.
            </p>
            <p className="mt-3">
              <strong>Trasparenza sull'intelligenza artificiale (art. 50 Regolamento (UE) 2024/1689).</strong>{" "}
              Gli assistenti di PrevAI (assistente in app, bot di supporto, bot WhatsApp) dichiarano al primo contatto di essere sistemi
              di intelligenza artificiale. I preventivi generati dall'AI e i documenti redatti con la sua assistenza riportano
              tale indicazione nei metadati del PDF e, per i preventivi, in calce al documento; l'utente non deve rimuoverla.
              Nessuna decisione con effetti giuridici verso l'utente o i suoi clienti è presa in modo automatico: ogni invio,
              firma o pagamento richiede una conferma umana.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Sospensione e cancellazione</h2>
            <p>
              PrevAI si riserva il diritto di sospendere o terminare l'accesso al Servizio in caso di violazione
              dei presenti Termini, previo avviso via email salvo casi di grave violazione.
              L'utente può cancellare il proprio account in qualsiasi momento dalla pagina Impostazioni o
              contattando{" "}
              <a href="mailto:supporto@prevai.it" className="text-navy-600 hover:underline">supporto@prevai.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Trattamento dei dati per conto dell'utente (accordo ex art. 28 GDPR)</h2>
            <p>
              I preventivi, i contratti, le fatture e le anagrafiche che l'utente gestisce con il Servizio contengono
              dati personali dei <strong>suoi</strong> clienti (nome, indirizzo, codice fiscale, contatti, importi).
              Per questi dati l'utente è <strong>titolare del trattamento</strong> e PrevAI è <strong>responsabile del trattamento</strong>
              ai sensi dell'art. 28 del Regolamento (UE) 2016/679. Il presente articolo costituisce l'accordo sul trattamento
              dei dati tra le parti e prevale, per quanto riguarda tali dati, sulle altre clausole dei Termini.
            </p>
            <div className="space-y-3 mt-3">
              <div>
                <p className="font-medium">9.1 Oggetto, durata, natura e finalità</p>
                <p>
                  PrevAI tratta i dati esclusivamente per fornire il Servizio descritto all'art. 2 (generazione e archiviazione di
                  documenti, invio ai clienti dell'utente, promemoria, firma elettronica, gestione dei cantieri e della fatturazione)
                  per tutta la durata dell'account e per il periodo di conservazione indicato nella{" "}
                  <Link href="/privacy/" className="text-navy-600 hover:underline">Privacy Policy</Link>.
                  Categorie di interessati: clienti e potenziali clienti dell'utente, loro referenti, firmatari dei contratti, collaboratori dell'utente.
                  Categorie di dati: identificativi e di contatto, indirizzi dei lavori, codici fiscali e partite IVA, dati economici dei documenti, firme e relativi metadati.
                  Nessuna categoria particolare di dati (art. 9) è richiesta dal Servizio: l'utente si impegna a non inserirla nei campi liberi.
                </p>
              </div>
              <div>
                <p className="font-medium">9.2 Istruzioni e obblighi di PrevAI</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>tratta i dati solo su istruzione documentata dell'utente, che coincide con l'uso delle funzioni del Servizio, e non per finalità proprie (nessun uso per marketing né per l'addestramento di modelli di intelligenza artificiale);</li>
                  <li>garantisce che le persone autorizzate al trattamento siano vincolate alla riservatezza;</li>
                  <li>adotta le misure di sicurezza dell'art. 32 GDPR descritte nella Privacy Policy (cifratura in transito e a riposo dei campi sensibili, controllo degli accessi per ruolo, autenticazione a due fattori, registro delle attività di sicurezza, backup cifrati);</li>
                  <li>assiste l'utente nel rispondere alle richieste degli interessati (artt. 15–22) tramite le funzioni di esportazione e cancellazione del Servizio e, ove non bastino, su richiesta a privacy@prevai.it;</li>
                  <li>assiste l'utente negli adempimenti degli artt. 32–36 (sicurezza, violazioni, valutazione d'impatto) e gli notifica senza ingiustificato ritardo, e comunque entro 48 ore dalla scoperta, ogni violazione dei dati personali che riguardi i suoi dati;</li>
                  <li>mette a disposizione le informazioni necessarie a dimostrare il rispetto degli obblighi dell'art. 28 e consente verifiche, anche tramite la documentazione di sicurezza fornita su richiesta;</li>
                  <li>alla cessazione del Servizio cancella i dati entro i termini della Privacy Policy, salvo che la legge ne imponga la conservazione (in particolare le fatture per 10 anni), dopo aver consentito all'utente di esportarli.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">9.3 Sub-responsabili</p>
                <p>
                  L'utente autorizza in via generale il ricorso ai sub-responsabili elencati nella sezione "Destinatari" della Privacy Policy
                  (hosting e database nell'Unione Europea, invio email, pagamenti, fornitori di intelligenza artificiale, messaggistica).
                  PrevAI impone loro per contratto gli stessi obblighi qui assunti e resta responsabile del loro operato.
                  Le modifiche all'elenco sono comunicate con almeno 14 giorni di preavviso; l'utente può opporsi per motivi legittimi
                  e, in mancanza di soluzione, recedere dal Servizio senza penali.
                  I trasferimenti extra-UE avvengono sulla base delle clausole contrattuali standard o del Data Privacy Framework.
                </p>
              </div>
              <div>
                <p className="font-medium">9.4 Obblighi dell'utente</p>
                <p>
                  L'utente garantisce di avere una base giuridica per i dati che inserisce, di fornire ai propri clienti l'informativa
                  dovuta (che può richiamare PrevAI come responsabile), di non inserire nei documenti dati eccedenti rispetto allo scopo
                  (in particolare nelle descrizioni delle fatture) e di impartire istruzioni compatibili con la legge.
                  L'utente è responsabile dei documenti generati con l'assistenza dell'intelligenza artificiale una volta che li verifica e li invia.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Modifiche ai termini</h2>
            <p>
              Ci riserviamo il diritto di modificare i presenti Termini con preavviso di almeno 14 giorni
              via email. L'uso continuato del Servizio dopo la data di efficacia delle modifiche costituisce
              accettazione dei nuovi Termini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Legge applicabile e foro competente</h2>
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente
              in via esclusiva il Tribunale di Milano, salvo i casi in cui l'utente sia un consumatore ai sensi
              del D.Lgs. 206/2005 (Codice del Consumo), nel qual caso è competente il foro di residenza o domicilio
              del consumatore e si applicano le disposizioni di legge inderogabili a sua tutela.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Contatti</h2>
            <p>
              Per qualsiasi domanda sui presenti Termini: <a href="mailto:supporto@prevai.it" className="text-navy-600 hover:underline">supporto@prevai.it</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
