{/*
  Informativa privacy ai sensi degli artt. 13-14 GDPR. Testo derivato dalla
  privacy v1 (tag v1-final) aggiornato ai sub-responsabili della piattaforma v2.
  Da far rivedere a un consulente privacy prima del cutover (A-0 prevede la DPIA);
  le integrazioni che V2-4 disattiva (contabilità, finanziamento POS, feed bancario, Google LSA canadesi)
  non sono elencate.
*/}
import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";
import { Link } from "wouter";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Privacy Policy | PrevAI"
        description="Informativa sulla privacy di PrevAI — come raccogliamo, usiamo e proteggiamo i tuoi dati personali."
        canonical="https://prevai.it/privacy/"
      />
      <div className="wrap">
        <nav aria-label="Percorso" className="crumbs">
          <Link href="/">Home</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">Privacy Policy</span>
        </nav>
      </div>

      <header className="wrap" style={{ maxWidth: 780, padding: "clamp(12px, 2vw, 24px) 0 clamp(24px, 3vw, 36px)" }}>
        <h1 style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.5rem)", fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)", lineHeight: 1.15, marginBottom: 10 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "var(--faint)" }}>Ultimo aggiornamento: 21 settembre 2026</p>
      </header>

      <div className="wrap" style={{ maxWidth: 780, paddingBottom: "clamp(48px, 6vw, 80px)" }}>
        <div className="prose blog-prose max-w-none space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Titolare del trattamento</h2>
            <p>
              Il titolare del trattamento dei dati personali è <strong>PrevAI</strong> (di seguito "Società" o "noi"),
              raggiungibile all'indirizzo email <a href="mailto:privacy@prevai.it" className="text-navy-600 hover:underline">privacy@prevai.it</a>.
              La presente informativa è resa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Dati raccolti</h2>
            <p>Raccogliamo le seguenti categorie di dati personali:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Dati di registrazione:</strong> nome, cognome e indirizzo email, forniti al momento della creazione dell'account.</li>
              <li><strong>Dati del profilo aziendale:</strong> ragione sociale, partita IVA / codice fiscale, indirizzo, telefono, email aziendale, IBAN, numero REA e logo.</li>
              <li><strong>Dati dei documenti:</strong> descrizioni dei lavori, dati dei tuoi clienti (nome, indirizzo, email, telefono, codice fiscale o partita IVA), importi e voci di preventivi, contratti, fatture e cantieri; foto e documenti che alleghi.</li>
              <li><strong>Dati di firma elettronica:</strong> nome del firmatario, indirizzo email verificato, data e ora, indirizzo IP e impronta del documento firmato.</li>
              <li><strong>Dati di pagamento:</strong> gestiti direttamente da Stripe Inc. — non accediamo mai ai dati completi della tua carta.</li>
              <li><strong>Credenziali di autenticazione:</strong> la password è conservata come hash con salt sui nostri sistemi; non viene trasmessa a fornitori di identità terzi.</li>
              <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, pagine visitate e durata della sessione (tramite log di sistema).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Finalità e basi giuridiche del trattamento</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">a) Erogazione del servizio (art. 6.1.b GDPR)</p>
                <p className="mt-1">Trattamento necessario per creare l'account, generare preventivi e documenti tramite AI, far firmare i contratti, gestire cantieri, fatture, abbonamenti e pagamenti.</p>
              </div>
              <div>
                <p className="font-medium">b) Obblighi di legge (art. 6.1.c GDPR)</p>
                <p className="mt-1">Conservazione dei documenti fiscali e contabili per gli obblighi previsti dalla normativa tributaria e civilistica.</p>
              </div>
              <div>
                <p className="font-medium">c) Legittimo interesse (art. 6.1.f GDPR)</p>
                <p className="mt-1">Analisi aggregate per migliorare il servizio, prevenzione delle frodi e sicurezza della piattaforma.</p>
              </div>
              <div>
                <p className="font-medium">d) Consenso (art. 6.1.a GDPR)</p>
                <p className="mt-1">Invio di comunicazioni promozionali e newsletter, solo dopo il tuo esplicito consenso, revocabile in qualsiasi momento.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Conservazione dei dati</h2>
            <p>Conserviamo i dati personali solo per il tempo necessario alle finalità sopra descritte:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Dati dell'account: fino alla cancellazione dell'account, poi 30 giorni aggiuntivi per motivi di sicurezza.</li>
              <li>Preventivi, contratti firmati e fatture: 10 anni dall'emissione, in linea con l'art. 2220 c.c. e con gli obblighi fiscali.</li>
              <li>Documenti contabili dell'abbonamento: 10 anni.</li>
              <li>Log tecnici: 90 giorni.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Destinatari e responsabili del trattamento</h2>
            <p>I dati possono essere comunicati ai seguenti fornitori, nominati responsabili del trattamento ai sensi dell'art. 28 GDPR:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Stripe Inc.</strong> — elaborazione dei pagamenti e accrediti (Stripe Connect).</li>
              <li><strong>Fornitori di intelligenza artificiale (Groq, Inc. o OpenAI, LLC)</strong> — generazione di preventivi, contratti e documenti. La descrizione del lavoro, le foto e i documenti che alleghi, il tuo listino e i dati del cliente necessari al documento vengono inviati al fornitore per la sola elaborazione e non sono usati per addestrare i modelli.</li>
              <li><strong>Vercel Inc. e Supabase Inc.</strong> — hosting dell'applicazione, database e archiviazione file. Il database e i file risiedono su server nell'Unione Europea (Irlanda).</li>
              <li><strong>Resend Inc.</strong> — invio di email transazionali; Gmail (Google LLC) quando colleghi la tua casella per inviare dal tuo indirizzo.</li>
              <li><strong>Meta Platforms, Inc.</strong> — messaggi WhatsApp Business che scegli di inviare ai clienti e Meta Lead Ads se colleghi un account pubblicitario.</li>
              <li><strong>Google LLC e Microsoft Corporation</strong> — sincronizzazione del calendario (Google Calendar, Outlook) quando la attivi.</li>
              <li><strong>PostHog, Inc. e Google LLC (Google Analytics)</strong> — analisi d'uso del prodotto e misurazione del traffico del sito.</li>
            </ul>
            <p className="mt-3">
              Alcuni fornitori hanno sede al di fuori dell'Unione Europea (in particolare negli Stati Uniti): il trasferimento avviene sulla base delle clausole contrattuali standard approvate dalla Commissione Europea o del Data Privacy Framework, dove applicabile.
              Non vendiamo né cediamo i dati a terzi per finalità di marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. I tuoi diritti</h2>
            <p>In qualità di interessato hai il diritto di:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Accesso</strong> — ottenere una copia dei dati personali che ti riguardano (art. 15 GDPR).</li>
              <li><strong>Rettifica</strong> — chiedere la correzione di dati inesatti o incompleti (art. 16).</li>
              <li><strong>Cancellazione</strong> — chiedere la cancellazione dei dati, salvi gli obblighi di conservazione di legge (art. 17).</li>
              <li><strong>Limitazione e opposizione</strong> — limitare il trattamento o opporti a quello basato sul legittimo interesse (artt. 18 e 21).</li>
              <li><strong>Portabilità</strong> — ricevere i dati in un formato strutturato e leggibile da dispositivo automatico (art. 20).</li>
              <li><strong>Revoca del consenso</strong> — revocare il consenso in qualsiasi momento, senza pregiudicare la liceità del trattamento precedente.</li>
            </ul>
            <p className="mt-3">
              Puoi esercitare i tuoi diritti scrivendo a <a href="mailto:privacy@prevai.it" className="text-navy-600 hover:underline">privacy@prevai.it</a>. Rispondiamo entro 30 giorni.
              Hai inoltre il diritto di proporre reclamo al{" "}
              <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-navy-600 hover:underline">Garante per la protezione dei dati personali</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookie e tecnologie di tracciamento</h2>
            <p>
              Utilizziamo solo cookie tecnici strettamente necessari al funzionamento del servizio (autenticazione, gestione della sessione).
              Non utilizziamo cookie di profilazione né cookie pubblicitari di terze parti. Gli strumenti di analisi sono configurati in modo da non identificare l'utente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Sicurezza</h2>
            <p>
              Adottiamo misure tecniche e organizzative adeguate per proteggere i dati personali da accessi non autorizzati,
              perdita o alterazione: connessioni cifrate (TLS/HTTPS), controllo degli accessi, cifratura dei token delle integrazioni,
              autenticazione a due fattori disponibile per ogni account e conservazione delle credenziali come hash sulla nostra infrastruttura.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Modifiche alla presente informativa</h2>
            <p>
              Potremmo aggiornare periodicamente questa Privacy Policy. Le modifiche sostanziali saranno comunicate
              via email o con un avviso nella piattaforma con almeno 14 giorni di preavviso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contatti</h2>
            <p>
              Per qualsiasi domanda sul trattamento dei dati: <a href="mailto:privacy@prevai.it" className="text-navy-600 hover:underline">privacy@prevai.it</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
