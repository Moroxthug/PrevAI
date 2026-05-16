import { PublicLayout } from "@/components/layout/public-layout";
import { SeoHead } from "@/components/seo-head";

export default function TerminiPage() {
  return (
    <PublicLayout>
      <SeoHead
        title="Termini di Servizio | prevai"
        description="Termini e condizioni di utilizzo della piattaforma prevai per la generazione di preventivi AI."
        canonical="https://www.prevai.it/termini/"
      />
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termini di Servizio</h1>
        <p className="text-sm text-gray-500 mb-10">Ultimo aggiornamento: 6 maggio 2025</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

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
              preventivi professionali tramite intelligenza artificiale. Il Servizio include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Generazione di preventivi tramite AI a partire da una descrizione testuale dei lavori.</li>
              <li>Creazione e download di documenti PDF professionale.</li>
              <li>Gestione del profilo aziendale e archiviazione dei preventivi.</li>
              <li>Piani di abbonamento mensile e acquisti singoli.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Account utente</h2>
            <p>
              Per accedere al Servizio è necessario creare un account fornendo dati veritieri e aggiornati.
              L'utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività
              svolte tramite il proprio account. In caso di accesso non autorizzato, l'utente deve
              notificarlo immediatamente a <a href="mailto:supporto@prevai.it" className="text-violet-600 hover:underline">supporto@prevai.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Piani e pagamenti</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">4.1 Piani disponibili</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Starter (€29/mese):</strong> fino a 20 preventivi al mese, PDF con filigrana PrevAI.</li>
                  <li><strong>Pro (€79/mese):</strong> preventivi illimitati, PDF senza filigrana, branding personalizzabile.</li>
                  <li><strong>Singolo con Watermark (€29):</strong> un singolo preventivo PDF con filigrana.</li>
                  <li><strong>Singolo Pulito (€39):</strong> un singolo preventivo PDF senza filigrana.</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">4.2 Fatturazione</p>
                <p className="mt-1">
                  I piani mensili vengono rinnovati automaticamente ogni mese. I pagamenti sono processati
                  tramite Stripe Inc. e sono soggetti ai relativi termini di servizio. I prezzi sono IVA esclusa.
                </p>
              </div>
              <div>
                <p className="font-medium">4.3 Rimborsi</p>
                <p className="mt-1">
                  Ai sensi dell'art. 59(a) del Codice del Consumo (D.Lgs. 206/2005), il diritto di recesso
                  non si applica ai contenuti digitali forniti immediatamente dopo l'acquisto con esplicito consenso.
                  Per i piani mensili, puoi disdire in qualsiasi momento: il servizio rimane attivo fino alla
                  fine del periodo già pagato. Non sono previsti rimborsi pro-rata per i periodi non utilizzati.
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
              I preventivi generati tramite il Servizio sono di proprietà dell'utente che li ha creato.
              L'utente concede a PrevAI una licenza limitata, non esclusiva, per elaborare i dati inseriti
              al solo fine di erogare il Servizio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Limitazione di responsabilità</h2>
            <p>
              I preventivi generati dall'AI sono indicativi e basati su dati statistici. <strong>PrevAI non garantisce
              l'accuratezza, la completezza o l'adeguatezza dei preventivi per specifici contesti contrattuali.</strong>
              L'utente è responsabile della verifica e validazione dei contenuti prima di presentarli ai propri clienti.
              PrevAI non è responsabile per danni indiretti, perdita di dati, lucro cessante o danni derivanti
              da errori nell'output dell'AI, nei limiti consentiti dalla legge applicabile.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Sospensione e cancellazione</h2>
            <p>
              PrevAI si riserva il diritto di sospendere o terminare l'accesso al Servizio in caso di violazione
              dei presenti Termini, previo avviso via email salvo casi di grave violazione.
              L'utente può cancellare il proprio account in qualsiasi momento dalla pagina Impostazioni o
              contattando <a href="mailto:supporto@prevai.it" className="text-violet-600 hover:underline">supporto@prevai.it</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Modifiche ai termini</h2>
            <p>
              Ci riserviamo il diritto di modificare i presenti Termini con preavviso di almeno 14 giorni
              via email. L'uso continuato del Servizio dopo la data di efficacia delle modifiche costituisce
              accettazione dei nuovi Termini.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Legge applicabile e foro competente</h2>
            <p>
              I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente
              in via esclusiva il Tribunale di Milano, salvo i casi in cui l'utente sia un consumatore ai sensi
              del D.Lgs. 206/2005 (Codice del Consumo), nel qual caso si applicano le disposizioni di legge
              inderogabili a tutela dei consumatori.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contatti</h2>
            <p>
              Per qualsiasi domanda sui presenti Termini: <a href="mailto:supporto@prevai.it" className="text-violet-600 hover:underline">supporto@prevai.it</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
