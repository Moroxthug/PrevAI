import { Link, useLocation } from "wouter";
import { ArrowRight, Receipt, Shield, Zap } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { RevealHeading } from "@/components/reveal-heading";
import { StatsBar } from "@/components/stats-bar";
import { TestimonialsSection } from "@/components/testimonials-section";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { BLOG_INDEX } from "@/data/blog-index";
import { sectorLabel } from "@/data/seo-slugs";

function ScrollSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFade();
  return (
    <section
      id={id}
      ref={ref as React.RefObject<HTMLElement>}
      className={`fade-in-section ${className}`}
    >
      {children}
    </section>
  );
}

/** The 18 real trade verticals, in the order they appear on their SEO pages. */
const TRADE_SLUGS = [
  "imbianchino", "elettricista", "idraulico", "edilizia", "ristrutturazione",
  "carpentiere", "falegname", "termoidraulico", "freelance",
  "geometra", "muratore", "giardiniere", "piastrellista", "serramentista",
  "tetto", "condizionatori", "pittore", "pavimentista",
];

export default function Home() {
  const { isSignedIn } = useAuth();
  const { lang } = useLanguage();
  const [, navigate] = useLocation();

  const tradeLabel = (slug: string) => sectorLabel(slug, lang);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Il JSON-LD WebSite + SoftwareApplication per "/" è già nel guscio
          prerenderizzato da scripts/prerender-seo.ts — non duplicarlo qui via
          Helmet, o i crawler vedono due schemi WebSite. */}
      <SeoHead
        title={"prevai – Preventivi Online per Artigiani e Aziende | AI in 30s"}
        description={
          "Dimentica Excel e i documenti scritti a mano. Descrivi il lavoro a parole tue e prevai genera un preventivo professionale con IVA, voci di costo e totali in 30 secondi — poi gestisce lead, cantieri, contratti e fatture fino all'incasso."
        }
        canonical={"https://prevai.it/"}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>
              La piattaforma AI per artigiani e imprese italiane
            </p>
            <h1>
                <RevealHeading
                  lines={[
                    [{ text: "Crea" }, { text: "preventivi" }],
                    [{ text: "professionali" }, { text: "in" }, { text: "30" }, { text: "secondi" }],
                    [{ text: "con" }, { text: "l'AI." }],
                  ]}
                />
            </h1>
            <p className="lead">
              Descrivi il lavoro a parole tue — prevai genera un preventivo con prezzi, logo, voci, quantità e IVA calcolata. Poi segue tutto il resto del percorso: lead, cantieri, contratti, fatture, incasso.
            </p>
            <div className="hero-cta">
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
                Inizia gratis
              </button>
              <Link href="/#deep-dive" className="btn btn-outline-light">
                Vedi i piani
              </Link>
            </div>
            <p className="hero-note">
              Prova gratuita di 7 giorni · Nessuna carta di credito · Anche su WhatsApp
            </p>
          </div>
          <div>
            <div className="doc-mock">
              <div className="dm-bar"><b>Preventivo_Mario_Rossi.pdf</b><span className="chip chip-grey">PDF</span></div>
              <div className="dm-body">
                <div className="dm-co">
                  <span><b>Rossi Tinteggiature</b>P. IVA 01234567890</span>
                  <span style={{ textAlign: "right" }}><b>Preventivo N. 42/2026</b>Milano (MI)</span>
                </div>
                <div className="dm-row"><span>A. Tinteggiatura pareti</span><span className="v">€ 1.200,00</span></div>
                <div className="dm-row"><span>B. Rasatura e preparazione</span><span className="v">€ 250,00</span></div>
                <div className="dm-tot">
                  <div className="dm-row"><span>Imponibile</span><span className="v">€ 1.450,00</span></div>
                  <div className="dm-row"><span>IVA (10 %)</span><span className="v">€ 145,00</span></div>
                  <div className="dm-grand"><span>Totale</span><b>€ 1.595,00</b></div>
                </div>
              </div>
              <div className="dm-chips">
                <span className="chip chip-green">IVA calcolata</span>
                <span className="chip chip-teal">Generato in 30 sec</span>
                <span className="chip chip-grey">Firma elettronica inclusa</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODOTTI ───────────────────────────────────────── */}
      <ScrollSection className="sec" id="products">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">I nostri prodotti</span>
              <h2 className="h2">Una piattaforma, dal lead all'incasso.</h2>
            </div>
            <p className="lead">
              Non un semplice generatore di preventivi. Ogni passaggio che un lavoro attraversa davvero — lead, preventivo, cantiere, contratto, fattura, pagamento — vive in un unico posto, pensato per gli artigiani italiani.
            </p>
          </div>
          <div className="tiles">
            <Link href="#story-quotes" className="tile t-green">
              <h3>Preventivi AI</h3>
              <p>
                Descrivi il lavoro in italiano — o manda un vocale o una foto su WhatsApp — e ottieni in circa 30 secondi un preventivo con prezzi, logo, voci, quantità e IVA. Basato sul tuo listino, firmato online dal cliente.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-purple">
              <h3>CRM e lead</h3>
              <p>
                I contatti in arrivo finiscono in una pipeline kanban prima di diventare preventivi. Valutali, fai follow-up e portali alla firma senza un foglio Excel.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-teal">
              <h3>Cantieri</h3>
              <p>
                Un preventivo accettato diventa un cantiere: attività con scadenze, squadra assegnata, fornitori e budget a confronto con i costi reali — collegato al preventivo originale.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-yellow">
              <h3>Fatturazione e pagamenti</h3>
              <p>
                Le fatture nascono dai preventivi accettati o dai cantieri, con una pagina pubblica per il cliente. I solleciti partono da soli finché non incassi.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-green">
              <h3>Contratti e documenti</h3>
              <p>
                I contratti d'appalto nascono dai preventivi accettati e dai cantieri. Ogni file, preventivo, cliente e fattura resta cercabile in un unico archivio — cestino incluso.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#products" className="tile t-purple">
              <h3>Squadra, analisi e assistente</h3>
              <p>
                Account multiutente con ruoli e inviti, dashboard su fatturato, tasso di chiusura e tempi di risposta, un assistente AI dentro la dashboard e l'importazione di listini e clienti esistenti.
              </p>
              <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
          </div>
          <div className="also">
            <span className="lbl">Incluso anche</span>
            {(
              ["Preventivi da WhatsApp", "Firma elettronica", "Listino prezzi", "IVA 22/10/4 %", "Bonus e incentivi", "Ore degli operai", "Inviti alla squadra", "Import da Excel e PDF", "Documenti e archivio", "Assistente AI"]
            ).map((item) => (
              <span key={item} className="chip chip-grey">{item}</span>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── STORIE ─────────────────────────────────────────── */}
      <ScrollSection className="sec soft">
        <div className="wrap">
          <div className="split" id="story-quotes">
            <div className="split-media">
              <img src="https://picsum.photos/seed/prevai-contractor-onsite/980/686" alt={"Un artigiano che rivede un preventivo in cantiere"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">Preventivi AI</span>
              <h2>Da una frase a un preventivo firmato.</h2>
              <p>
                Il motore legge la tua descrizione, sceglie le voci di costo, stima le quantità e applica l'aliquota IVA giusta. Tu controlli, il cliente firma online e la richiesta di acconto parte lo stesso giorno.
              </p>
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="cta-link">
                Scopri i preventivi AI <ArrowRight className="chev h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="split rev" id="story-jobs">
            <div className="split-media">
              <img src="https://picsum.photos/seed/prevai-team-jobsite/980/686" alt={"Una squadra al lavoro in cantiere"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">Cantieri</span>
              <h2>Un preventivo accettato diventa un cantiere.</h2>
              <p>
                Apri il cantiere direttamente dal preventivo firmato — cliente, importo e voci già collegati. Segui le attività, assegna la squadra, registra i fornitori e guarda il budget rispetto ai costi reali man mano che arrivano.
              </p>
              <Link href="/dashboard/jobs" className="cta-link">
                Scopri i cantieri <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="split" id="story-invoicing">
            <div className="split-media">
              <img src="https://picsum.photos/seed/prevai-cafe-owner/980/686" alt={"Un titolare d'impresa che controlla una fattura"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">Fatturazione e pagamenti</span>
              <h2>Fatture che si sollecitano da sole.</h2>
              <p>
                Generate dal preventivo accettato o dal cantiere, inviate con una pagina pubblica per il cliente, sollecitate con garbo a scadenza e riconciliate quando vengono pagate. I contratti nascono dalla stessa fonte.
              </p>
              <Link href="/dashboard/invoices" className="cta-link">
                Scopri la fatturazione <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── WHATSAPP ───────────────────────────────────────── */}
      <ScrollSection className="sec" id="whatsapp">
        <div className="wrap">
          <div className="split">
            <div>
              <span className="chip chip-new">Novità</span>
              <span className="eyebrow grey" style={{ marginLeft: 10 }}>Direttamente dal telefono</span>
              <h2 className="h2" style={{ margin: "16px 0 14px" }}>Tutto il flusso del preventivo, su WhatsApp.</h2>
              <p className="lead">
                Vocale, testo o foto — l'assistente prepara il preventivo, tu lo correggi o lo approvi in chat e il PDF torna nella conversazione. Salvato in automatico nel tuo account. Nessuna app da aprire.
              </p>
              <Link href="/whatsapp/" className="cta-link" style={{ marginTop: 22 }}>
                Scopri la funzione completa <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
            <div className="split-media">
              <img src="https://picsum.photos/seed/prevai-whatsapp-phone/980/686" alt={"Un artigiano che manda un vocale dal telefono"} loading="lazy" />
            </div>
          </div>
          <div className="steps3">
            <div className="step">
              <span className="n">1</span>
              <b>Manda un vocale, un testo o una foto</b>
              <p>Direttamente su WhatsApp. Descrivi il lavoro come lo spiegheresti a un cliente.</p>
            </div>
            <div className="step">
              <span className="n">2</span>
              <b>L'AI genera l'anteprima</b>
              <p>Capitoli, prezzi e IVA in 60 secondi. Correggila o approvala subito.</p>
            </div>
            <div className="step">
              <span className="n">3</span>
              <b>Ricevi il PDF in chat</b>
              <p>Invialo al cliente con un tocco. Il preventivo è salvato anche su prevai.it.</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CONFRONTO ──────────────────────────────────────── */}
      <ScrollSection className="sec soft" id="comparison">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Confronto</span>
              <h2 className="h2">Un confronto onesto</h2>
            </div>
            <p className="lead">
              Gli artigiani comprano su una domanda sola: mi fa risparmiare i 30 minuti di burocrazia? Ecco come prevai si confronta con le alternative che già conosci.
            </p>
          </div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Funzionalità</th>
                  <th className="q">prevai</th>
                  <th>Gestionali tradizionali</th>
                  <th>Excel e Word</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { f: "Preventivo da una descrizione in italiano", q: "~30 secondi", j: "Non previsto", e: "A mano, 30–60 min" },
                  { f: "IVA 22/10/4 % per tipo di lavoro", q: "Automatica", j: "Configurazione manuale", e: "Formule a mano" },
                  { f: "Preventivi da WhatsApp", q: "Incluso", j: "Non previsto", e: "Impossibile" },
                  { f: "Bonus e incentivi fiscali", q: "Suggeriti in automatico", j: "Non previsti", e: "Da cercare a parte" },
                  { f: "Lead → preventivo → cantiere → fattura → incasso", q: "Una sola piattaforma", j: "Moduli e piani a parte", e: "File separati" },
                  { f: "Tempo per il primo preventivo", q: "30 secondi", j: "Ore di configurazione", e: "Ore per documento" },
                ]).map((row) => (
                  <tr key={row.f}>
                    <td>{row.f}</td>
                    <td className="q">{row.q}</td>
                    <td>{row.j}</td>
                    <td>{row.e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cmp-cta">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">
              Prova prevai gratis
            </button>
          </div>
        </div>
      </ScrollSection>

      {/* ── IMPATTO (numeri reali, contati dal vivo) ─────────── */}
      <StatsBar />

      {/* ── NOVITÀ (articoli reali del blog) ──────────────────── */}
      <ScrollSection className="sec" id="newsroom">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Novità</span>
              <h2 className="h2">Le ultime da prevai</h2>
            </div>
            <Link href="/blog/" className="cta-link">Vedi tutte le novità <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="news-grid">
            {[...BLOG_INDEX].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3).map((article, i) => (
              <Link key={article.slug} href={`/blog/${article.slug}/`} className="card news-card">
                <div className="news-media">
                  <img src={`https://picsum.photos/seed/prevai-blog-${i}/840/525`} alt="" loading="lazy" />
                </div>
                <div className="news-body">
                  <p className="news-meta">
                    {article.category} · {new Date(article.publishedAt).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <h3>{article.title}</h3>
                  <span className="cta-link">Leggi <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── RECENSIONI (testimonianze reali e verificate) ─────── */}
      <TestimonialsSection />

      {/* ── GUIDE ──────────────────────────────────────────── */}
      <ScrollSection className="sec" id="guides">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Guide</span>
              <h2 className="h2">Basta fogli di calcolo. Dimentica Excel e Word.</h2>
            </div>
            <p className="lead">
              I modelli Excel si rompono. I documenti Word non calcolano. Con prevai descrivi il lavoro a parole tue e in 30 secondi hai un documento professionale pronto da inviare.
            </p>
          </div>
          <div className="news-grid">
            {([
              { slug: "modello-excel", chip: "chip-green", badge: "vs Excel", title: "Alternativa al preventivo in Excel", desc: "Niente formule. Niente errori. Solo risultati.", seed: "prevai-guide-excel" },
              { slug: "modello-word", chip: "chip-teal", badge: "vs Word", title: "Alternativa al modello Word", desc: "PDF professionale con un clic, senza impaginare a mano.", seed: "prevai-guide-word" },
              { slug: "come-fare-preventivo", chip: "chip-purple", badge: "Guida", title: "Come fare un preventivo", desc: "Una guida pratica per artigiani e piccole imprese italiane.", seed: "prevai-guide-howto" },
            ]).map((g) => (
              <Link key={g.slug} href={`/preventivi/${g.slug}/`} className="card news-card">
                <div className="news-media">
                  <img src={`https://picsum.photos/seed/${g.seed}/840/525`} alt="" loading="lazy" />
                </div>
                <div className="news-body">
                  <p><span className={`chip ${g.chip}`}>{g.badge}</span></p>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <span className="cta-link">Scopri di più <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── MESTIERI E CITTÀ ───────────────────────────────── */}
      <ScrollSection className="sec soft" id="trades">
        <div className="wrap">
          <div className="sec-head" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", alignItems: "center" }}>
            <span className="eyebrow grey">Copertura</span>
            <h2 className="h2">Preventivi per ogni mestiere e città</h2>
            <p className="lead" style={{ marginInline: "auto" }}>
              Diciotto mestieri con il loro vocabolario, incrociati con le principali città lombarde per le pagine locali — ognuna con l'aliquota IVA giusta applicata in automatico.
            </p>
          </div>
        </div>
        <div className="marquee">
          <div className="mq-track">
            {[...TRADE_SLUGS, ...TRADE_SLUGS].map((slug, i) => (
              <Link key={`${slug}-${i}`} href={`/preventivi/${slug}/`} className="wm">{tradeLabel(slug)}</Link>
            ))}
          </div>
        </div>
        <div className="wrap">
          <div className="cov-note">
            <span className="chip chip-green">18 mestieri</span>
            <span className="chip chip-teal">30 città</span>
            <span className="chip chip-grey">Bonus e incentivi</span>
            <span className="chip chip-grey">IVA 22/10/4 %</span>
          </div>
        </div>
      </ScrollSection>

      {/* ── APPROFONDIMENTO ────────────────────────────────── */}
      <ScrollSection className="sec" id="deep-dive">
        <div className="wrap">
          <div className="split" style={{ paddingTop: 0 }}>
            <div>
              <span className="eyebrow grey">Approfondimento</span>
              <h2 className="h2" style={{ margin: "14px 0 16px" }}>Cos'è prevai e a chi serve</h2>
              <p className="lead">
                prevai è un software italiano che usa l'intelligenza artificiale per trasformare una descrizione in linguaggio naturale in un preventivo completo e professionale. È pensato per artigiani, imprese edili, tecnici e piccole imprese che ogni settimana inviano preventivi ai clienti e non vogliono più perdere serate su Excel.
              </p>
            </div>
            <div className="dd-feats">
              <div className="dd-feat">
                <span className="fi g"><Receipt className="h-5 w-5" /></span>
                <div>
                  <b>IVA italiana integrata</b>
                  <p>Calcolo automatico al 22 %, 10 % o 4 % in base al lavoro.</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi t"><Shield className="h-5 w-5" /></span>
                <div>
                  <b>Dati al sicuro in Europa</b>
                  <p>Server nell'UE, pagamenti gestiti da Stripe, sessioni protette da cookie cifrati.</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi p"><Zap className="h-5 w-5" /></span>
                <div>
                  <b>AI addestrata sui mestieri</b>
                  <p>Vocabolario tecnico dell'edilizia e dell'impiantistica italiana.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="dd-grid">
            <div className="card dd-card">
              <h3>Come funziona davvero</h3>
              <p>
                Apri prevai dal telefono direttamente in cantiere, o da casa la sera. Descrivi il lavoro come lo spiegheresti a un collega: "Tinteggiatura appartamento 90 mq, due mani di pittura lavabile bianca, rasatura parete bagno". In trenta secondi hai un documento con capitoli, voci, quantità stimate, prezzi unitari, imponibile, IVA e totale. Lo controlli, lo correggi se serve e lo invii al cliente in PDF, via email o WhatsApp.
              </p>
            </div>
            <div className="card dd-card">
              <h3>Perché funziona meglio di Excel o dei gestionali tradizionali</h3>
              <p>
                I gestionali tradizionali sono fatti per l'ufficio: richiedono installazione, una configurazione iniziale di listini e codici e ore di formazione. Excel è gratis ma ti costringe a ripartire da un foglio bianco ogni volta. prevai elimina entrambi i problemi: nessuna configurazione, nessuna formula, e un documento che esce già impaginato con il tuo logo e i tuoi dati.
              </p>
            </div>
            <div className="card dd-card">
              <h3>Sicurezza e conformità fiscale italiana</h3>
              <p>
                Tutti i dati sono conservati su infrastruttura sicura e cifrata nell'Unione Europea, le sessioni sono protette da cookie cifrati e i pagamenti passano da Stripe. L'IVA segue le regole italiane: 22 % ordinaria, 10 % per manutenzione e ristrutturazione di abitazioni, 4 % per la prima casa, con le diciture di legge per reverse charge e regime forfettario. I tuoi preventivi restano tuoi: li scarichi quando vuoi.
              </p>
            </div>
            <div className="card dd-card" id="plans">
              <h3>Quanto costa iniziare</h3>
              <p>
                La registrazione è gratuita e il primo preventivo si genera senza inserire la carta di credito. Da lì puoi scegliere: paghi un preventivo singolo quando serve, oppure attivi un abbonamento mensile (Starter con 20 preventivi al mese, Pro con preventivi illimitati, Elite con squadra, cantieri e integrazioni). Disdici quando vuoi dalle impostazioni, senza penali.
              </p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ────────────────────────────────────────────── */}
      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <img src="https://picsum.photos/seed/prevai-team-celebration/1800/900" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark">Inizia ora</span>
          <h2>Pronto a trasformare la tua attività?</h2>
          <p>
            Unisciti a centinaia di artigiani e imprese italiane che risparmiano ore ogni settimana.
          </p>
          <div className="cta-actions">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
              Crea il tuo account gratuito
            </button>
            <Link href="/#plans" className="btn btn-outline-light">
              Vedi i piani
            </Link>
          </div>
          <p className="cta-fine">
            Prova gratuita di 7 giorni · Nessuna carta di credito · Preventivi singoli disponibili
          </p>
        </div>
      </ScrollSection>
    </div>
  );
}
