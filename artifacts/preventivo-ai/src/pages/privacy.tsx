import { PublicLayout } from "@/components/layout/public-layout";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Ultimo aggiornamento: 6 maggio 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Titolare del trattamento</h2>
            <p>
              Il titolare del trattamento dei dati personali è <strong>PrevAI</strong> (di seguito "Società" o "noi"),
              raggiungibile all'indirizzo email <a href="mailto:privacy@prevai.it" className="text-violet-600 hover:underline">privacy@prevai.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Dati raccolti</h2>
            <p>Raccogliamo le seguenti categorie di dati personali:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Dati di registrazione:</strong> nome, cognome, indirizzo email, forniti al momento della creazione dell'account.</li>
              <li><strong>Dati del profilo aziendale:</strong> ragione sociale, partita IVA, indirizzo, telefono, email aziendale, logo aziendale.</li>
              <li><strong>Dati dei preventivi:</strong> descrizioni dei lavori, dati dei clienti (committenti), importi, voci di computo.</li>
              <li><strong>Dati di pagamento:</strong> gestiti direttamente da Stripe Inc. — non accediamo ai dati della carta di credito.</li>
              <li><strong>Dati tecnici:</strong> indirizzo IP, tipo di browser, pagine visitate, durata delle sessioni (tramite log di sistema).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Finalità e base giuridica del trattamento</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">a) Erogazione del servizio (art. 6(1)(b) GDPR — esecuzione del contratto)</p>
                <p className="mt-1">Trattamento necessario per creare l'account, generare preventivi tramite AI, gestire abbonamenti e pagamenti.</p>
              </div>
              <div>
                <p className="font-medium">b) Obblighi legali (art. 6(1)(c) GDPR)</p>
                <p className="mt-1">Conservazione dei dati di fatturazione per gli obblighi fiscali previsti dalla normativa italiana.</p>
              </div>
              <div>
                <p className="font-medium">c) Legittimo interesse (art. 6(1)(f) GDPR)</p>
                <p className="mt-1">Analisi aggregate per migliorare il servizio, prevenzione delle frodi, sicurezza della piattaforma.</p>
              </div>
              <div>
                <p className="font-medium">d) Consenso (art. 6(1)(a) GDPR)</p>
                <p className="mt-1">Invio di comunicazioni promozionali e newsletter, previa esplicita accettazione.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Conservazione dei dati</h2>
            <p>I dati vengono conservati per il tempo strettamente necessario alle finalità indicate:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Dati dell'account: fino alla cancellazione dell'account, poi 30 giorni per finalità di sicurezza.</li>
              <li>Dati dei preventivi: 10 anni dall'emissione (obblighi fiscali italiani).</li>
              <li>Dati di fatturazione: 10 anni (D.P.R. 633/1972 e D.P.R. 600/1973).</li>
              <li>Log tecnici: 90 giorni.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Destinatari dei dati</h2>
            <p>I dati possono essere comunicati alle seguenti categorie di destinatari:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Clerk Inc.</strong> — gestione dell'autenticazione e degli account utente (USA, con garanzie adeguate ex art. 46 GDPR).</li>
              <li><strong>Stripe Inc.</strong> — elaborazione dei pagamenti (USA, con garanzie adeguate).</li>
              <li><strong>OpenAI, LLC</strong> — generazione dei preventivi tramite intelligenza artificiale (USA, con garanzie adeguate). I dati inviati sono limitati alla descrizione del lavoro.</li>
              <li><strong>Replit Inc.</strong> — infrastruttura cloud e hosting (USA, con garanzie adeguate).</li>
              <li><strong>Resend Inc.</strong> — invio email transazionali.</li>
            </ul>
            <p className="mt-3">Non vendiamo dati personali a terzi. I trasferimenti extra-UE avvengono con le garanzie previste dagli artt. 44-49 GDPR (clausole contrattuali standard o decisioni di adeguatezza).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Diritti dell'interessato</h2>
            <p>Ai sensi degli artt. 15-22 GDPR, hai diritto di:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Accesso</strong> — richiedere copia dei dati che trattiamo su di te.</li>
              <li><strong>Rettifica</strong> — correggere dati inesatti o incompleti.</li>
              <li><strong>Cancellazione ("diritto all'oblio")</strong> — richiedere la cancellazione dei dati, salvo obblighi legali di conservazione.</li>
              <li><strong>Limitazione del trattamento</strong> — in determinati casi previsti dall'art. 18 GDPR.</li>
              <li><strong>Portabilità</strong> — ricevere i tuoi dati in formato strutturato e leggibile da macchina.</li>
              <li><strong>Opposizione</strong> — opporti al trattamento basato su legittimo interesse.</li>
              <li><strong>Revoca del consenso</strong> — in qualsiasi momento, senza pregiudizio per la liceità del trattamento precedente.</li>
            </ul>
            <p className="mt-3">
              Per esercitare i tuoi diritti scrivi a <a href="mailto:privacy@prevai.it" className="text-violet-600 hover:underline">privacy@prevai.it</a>.
              Risponderemo entro 30 giorni. Hai anche il diritto di proporre reclamo all'Autorità di controllo italiana: <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Garante per la protezione dei dati personali</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookie e tecnologie di tracciamento</h2>
            <p>
              Utilizziamo esclusivamente cookie tecnici necessari al funzionamento del servizio (autenticazione, sessione).
              Non utilizziamo cookie di profilazione o di terze parti a fini pubblicitari.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Sicurezza</h2>
            <p>
              Adottiamo misure tecniche e organizzative adeguate per proteggere i dati da accesso non autorizzato,
              perdita o alterazione: connessioni cifrate (TLS/HTTPS), controllo degli accessi, autenticazione sicura tramite Clerk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Modifiche alla privacy policy</h2>
            <p>
              Ci riserviamo il diritto di aggiornare questa informativa. Le modifiche sostanziali saranno comunicate
              via email o tramite avviso in piattaforma con almeno 14 giorni di anticipo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Contatti</h2>
            <p>
              Per qualsiasi domanda relativa alla privacy: <a href="mailto:privacy@prevai.it" className="text-violet-600 hover:underline">privacy@prevai.it</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
