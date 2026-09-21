{/*
  Testo ripreso da PrevAI v1 (termini.tsx, tag v1-final) nel layout QuoteAI.
  Piani e prezzi in 4.1 vanno allineati ai price ID Stripe EUR in V2-4 (D3/D5).
*/}
import { PublicLayout } from "@/components/layout/public-layout";
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
        <p style={{ fontSize: 13, color: "var(--faint)" }}>Ultimo aggiornamento: 21 settembre 2026</p>
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
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Piani e pagamenti</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium">4.1 Piani disponibili</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Starter (€29/mese):</strong> fino a 20 preventivi al mese, PDF con filigrana PrevAI.</li>
                  <li><strong>Pro (€79/mese):</strong> preventivi illimitati, PDF senza filigrana, branding personalizzabile, contratti, cantieri e fatturazione.</li>
                  <li><strong>Elite:</strong> tutto il Pro più squadra, ore degli operai, analisi, assistente AI e integrazioni avanzate.</li>
                  <li><strong>Singolo con filigrana (€29):</strong> un singolo preventivo PDF con filigrana.</li>
                  <li><strong>Singolo pulito (€39):</strong> un singolo preventivo PDF senza filigrana.</li>
                </ul>
                <p className="mt-1 text-xs text-gray-500">I prezzi aggiornati e le funzionalità di ciascun piano sono indicati nella pagina Piano e fatturazione al momento dell'acquisto.</p>
              </div>
              <div>
                <p className="font-medium">4.2 Fatturazione</p>
                <p className="mt-1">
                  I piani mensili vengono rinnovati automaticamente ogni mese. I pagamenti sono processati
                  tramite Stripe Inc. e sono soggetti ai relativi termini di servizio. I prezzi sono espressi in euro
                  e si intendono IVA esclusa; l'IVA viene aggiunta al momento del pagamento.
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
              del D.Lgs. 206/2005 (Codice del Consumo), nel qual caso è competente il foro di residenza o domicilio
              del consumatore e si applicano le disposizioni di legge inderogabili a sua tutela.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contatti</h2>
            <p>
              Per qualsiasi domanda sui presenti Termini: <a href="mailto:supporto@prevai.it" className="text-navy-600 hover:underline">supporto@prevai.it</a>
            </p>
          </section>

        </div>
      </div>
    </PublicLayout>
  );
}
