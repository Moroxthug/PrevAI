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
      {/* WebSite + SoftwareApplication JSON-LD for "/" is already baked into
          the prerendered shell by scripts/prerender-seo.ts — don't duplicate
          it here via Helmet, or crawlers see two WebSite schemas. */}
      <SeoHead
        title={
          "quoteai – Instant Quotes for Canadian Contractors | AI in 30s"
        }
        description={
          "quoteai turns a plain-language job description into a priced, branded, tax-calculated quote in 30 seconds — then runs leads, job sites, contracts and invoices until you're paid. Built for Canadian trades."
        }
        canonical={"https://prevai.it/"}
        lang="it-IT"
        frCanonical="https://prevai.it/fr/"
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>
              The AI-driven expert platform for Canadian trades
            </p>
            <h1>
                <RevealHeading
                  lines={[
                    [{ text: "Create" }, { text: "professional" }],
                    [{ text: "quotes" }, { text: "in" }, { text: "30" }, { text: "seconds" }],
                    [{ text: "with" }, { text: "AI." }],
                  ]}
                />
            </h1>
            <p className="lead">
              Describe the job in your own words — quoteai generates a priced, branded quote with line items, quantities and GST/HST by province. Then it runs the rest of the path: leads, job sites, contracts, invoices, paid.
            </p>
            <div className="hero-cta">
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
                Start for free
              </button>
              <Link href="/#deep-dive" className="btn btn-outline-light">
                See plans
              </Link>
            </div>
            <p className="hero-note">
              7-day free trial · No credit card required · Bilingual FR / EN
            </p>
          </div>
          <div>
            <div className="doc-mock">
              <div className="dm-bar"><b>Quote_John_Smith.pdf</b><span className="chip chip-grey">PDF</span></div>
              <div className="dm-body">
                <div className="dm-co">
                  <span><b>Smith Painting Co.</b>GST/HST: 123456789 RT0001</span>
                  <span style={{ textAlign: "right" }}><b>Quote N. 2024-042</b>Toronto, ON</span>
                </div>
                <div className="dm-row"><span>A. Wall painting</span><span className="v">$1,200.00</span></div>
                <div className="dm-row"><span>B. Skim coating & prep</span><span className="v">$250.00</span></div>
                <div className="dm-tot">
                  <div className="dm-row"><span>Subtotal</span><span className="v">$1,450.00</span></div>
                  <div className="dm-row"><span>HST (13%)</span><span className="v">$319.00</span></div>
                  <div className="dm-grand"><span>Total</span><b>$1,769.00</b></div>
                </div>
              </div>
              <div className="dm-chips">
                <span className="chip chip-green">Tax calculated</span>
                <span className="chip chip-teal">Generated in 30 sec</span>
                <span className="chip chip-grey">E-signature built in</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ───────────────────────────────────────── */}
      <ScrollSection className="sec" id="products">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Our products</span>
              <h2 className="h2">One platform, from lead to paid.</h2>
            </div>
            <p className="lead">
              Not a one-trick quote generator. Every step a job actually flows through — lead, quote, job site, contract, invoice, payment — lives in one place, built for Canadian trades.
            </p>
          </div>
          <div className="tiles">
            <Link href="#story-quotes" className="tile t-green">
              <h3>AI Quotes</h3>
              <p>
                Describe the job in plain language — or send a WhatsApp voice note or photo — and get a priced, branded quote with line items, quantities and GST/HST by province in about 30 seconds. Backed by your price catalog, signed with e-signature.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-purple">
              <h3>CRM & Leads</h3>
              <p>
                Incoming leads land in a kanban pipeline before they become quotes. Score them, follow up, and move them to signed without a spreadsheet in sight.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-teal">
              <h3>Job Sites</h3>
              <p>
                An accepted quote becomes a job: tasks with deadlines, team assignment, supplier tracking and budget vs actual — linked to the original quote.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-yellow">
              <h3>Invoicing & Payments</h3>
              <p>
                Invoices generate from accepted quotes or jobs, with a public invoice view for clients. Reminders go out on schedule until it's paid.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-green">
              <h3>Contracts & Documents</h3>
              <p>
                Contracts generate from accepted quotes and jobs. Every file, quote, client and invoice stays searchable in one archive — soft-delete included.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#products" className="tile t-purple">
              <h3>Team, Analytics & Assistant</h3>
              <p>
                Multi-user accounts with roles and invites, dashboards for revenue, win rate and turnaround, an AI assistant inside your dashboard, and imports for your existing price lists and client data.
              </p>
              <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
          </div>
          <div className="also">
            <span className="lbl">Also included</span>
            {(
              ["WhatsApp quoting", "E-signature", "Price catalog", "GST/HST by province", "Bilingual FR / EN", "Worker time tracking", "Team invites", "Spreadsheet & PDF imports", "Documents & archive", "AI Assistant"]
            ).map((item) => (
              <span key={item} className="chip chip-grey">{item}</span>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── STORIES ────────────────────────────────────────── */}
      <ScrollSection className="sec soft">
        <div className="wrap">
          <div className="split" id="story-quotes">
            <div className="split-media">
              <img src="https://picsum.photos/seed/quoteai-contractor-onsite/980/686" alt={"A contractor reviewing a quote on site"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">AI Quotes</span>
              <h2>From a plain sentence to a signed quote.</h2>
              <p>
                The engine reads your description, picks the cost items, estimates quantities and applies your province's tax. You review, the client e-signs, and the deposit request goes out the same day.
              </p>
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="cta-link">
                Explore AI Quotes <ArrowRight className="chev h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="split rev" id="story-jobs">
            <div className="split-media">
              <img src="https://picsum.photos/seed/quoteai-team-jobsite/980/686" alt={"A crew working on a job site"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">Job Sites</span>
              <h2>An accepted quote becomes a job site.</h2>
              <p>
                Open the job straight from the signed quote — client, amount and line items already linked. Track tasks, assign your team, log suppliers and watch budget vs actual as costs land.
              </p>
              <Link href="/dashboard/jobs" className="cta-link">
                Explore job sites <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="split" id="story-invoicing">
            <div className="split-media">
              <img src="https://picsum.photos/seed/quoteai-cafe-owner/980/686" alt={"A business owner reviewing an invoice"} loading="lazy" />
            </div>
            <div className="split-body">
              <span className="eyebrow">Invoicing & Payments</span>
              <h2>Invoices that chase themselves.</h2>
              <p>
                Generated from the accepted quote or job, sent with a public client view, reminded politely on schedule, and reconciled when paid. Contracts come from the same source of truth.
              </p>
              <Link href="/dashboard/invoices" className="cta-link">
                Explore invoicing <ArrowRight className="chev h-4 w-4" />
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
              <span className="chip chip-new">New</span>
              <span className="eyebrow grey" style={{ marginLeft: 10 }}>Straight from your phone</span>
              <h2 className="h2" style={{ margin: "16px 0 14px" }}>The whole quote flow, on WhatsApp.</h2>
              <p className="lead">
                Voice note, text or photo — the assistant drafts the quote, you correct or approve it in chat, and the PDF lands back in the conversation. Saved to your account automatically. No app to open.
              </p>
              <Link href="/whatsapp/" className="cta-link" style={{ marginTop: 22 }}>
                See the full feature <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
            <div className="split-media">
              <img src="https://picsum.photos/seed/quoteai-whatsapp-phone/980/686" alt={"A tradesperson sending a voice note from a phone"} loading="lazy" />
            </div>
          </div>
          <div className="steps3">
            <div className="step">
              <span className="n">1</span>
              <b>Send a voice note, text, or photo</b>
              <p>Right on WhatsApp. Describe the job just like you'd talk to a client.</p>
            </div>
            <div className="step">
              <span className="n">2</span>
              <b>The AI generates a preview</b>
              <p>Sections, prices, and tax in 60 seconds. Correct or approve it right away.</p>
            </div>
            <div className="step">
              <span className="n">3</span>
              <b>Get the PDF in chat</b>
              <p>Send it to your client with a tap. The quote is also saved on prevai.it.</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── COMPARISON ─────────────────────────────────────── */}
      <ScrollSection className="sec soft" id="comparison">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Comparison</span>
              <h2 className="h2">Honest side-by-side</h2>
            </div>
            <p className="lead">
              Trades buy on one question: does it save me the 30 minutes of paperwork? Here is how quoteai compares to the alternatives you already know.
            </p>
          </div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className="q">quoteai</th>
                  <th>Jobber / Housecall Pro</th>
                  <th>Excel & Word</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { f: "Quote from a plain-language description", q: "~30 seconds", j: "Not offered", e: "Manual, 30–60 min" },
                  { f: "Canadian GST/HST by province", q: "Automatic", j: "Manual tax setup", e: "Manual formulas" },
                  { f: "Quoting over WhatsApp", q: "Built in", j: "Not offered", e: "Not possible" },
                  { f: "Bilingual FR / EN", q: "Yes", j: "Limited", e: "Manual" },
                  { f: "Lead → quote → job → invoice → paid", q: "One platform", j: "Modules & plan gates", e: "Separate files" },
                  { f: "Time to first quote", q: "30 seconds", j: "Hours of onboarding", e: "Hours per document" },
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
              Try quoteai for free
            </button>
          </div>
        </div>
      </ScrollSection>

      {/* ── IMPACT (real, live-counted numbers) ───────────────── */}
      <StatsBar />

      {/* ── NEWSROOM (real blog posts) ─────────────────────── */}
      <ScrollSection className="sec" id="newsroom">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Newsroom</span>
              <h2 className="h2">The latest from quoteai</h2>
            </div>
            <Link href="/blog/" className="cta-link">View all news <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="news-grid">
            {[...BLOG_INDEX].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3).map((article, i) => (
              <Link key={article.slug} href={`/blog/${article.slug}/`} className="card news-card">
                <div className="news-media">
                  <img src={`https://picsum.photos/seed/quoteai-blog-${i}/840/525`} alt="" loading="lazy" />
                </div>
                <div className="news-body">
                  <p className="news-meta">
                    {article.category} · {new Date(article.publishedAt).toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <h3>{article.title}</h3>
                  <span className="cta-link">Read more <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── REVIEWS (real, verified testimonials) ─────────────── */}
      <TestimonialsSection />

      {/* ── GUIDES ─────────────────────────────────────────── */}
      <ScrollSection className="sec" id="guides">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">Guides</span>
              <h2 className="h2">No more spreadsheets. Forget Excel and Word.</h2>
            </div>
            <p className="lead">
              Excel templates break. Word documents don't calculate. With quoteai you describe the job in your own words and in 30 seconds you have a professional document ready to send.
            </p>
          </div>
          <div className="news-grid">
            {([
              { slug: "modello-excel", chip: "chip-green", badge: "vs Excel", title: "Alternative to an Excel quote", desc: "No formulas. No errors. Just results.", seed: "quoteai-guide-excel" },
              { slug: "modello-word", chip: "chip-teal", badge: "vs Word", title: "Alternative to a Word template", desc: "Professional PDF in one click, no manual formatting.", seed: "quoteai-guide-word" },
              { slug: "come-fare-preventivo", chip: "chip-purple", badge: "Guide", title: "How to write a quote", desc: "A practical guide for Canadian contractors and small businesses.", seed: "quoteai-guide-howto" },
            ]).map((g) => (
              <Link key={g.slug} href={`/preventivi/${g.slug}/`} className="card news-card">
                <div className="news-media">
                  <img src={`https://picsum.photos/seed/${g.seed}/840/525`} alt="" loading="lazy" />
                </div>
                <div className="news-body">
                  <p><span className={`chip ${g.chip}`}>{g.badge}</span></p>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <span className="cta-link">Learn more <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── TRADES & CITIES ────────────────────────────────── */}
      <ScrollSection className="sec soft" id="trades">
        <div className="wrap">
          <div className="sec-head" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", alignItems: "center" }}>
            <span className="eyebrow grey">Coverage</span>
            <h2 className="h2">Quotes for every trade and city</h2>
            <p className="lead" style={{ marginInline: "auto" }}>
              Eighteen trade verticals with their own vocabulary, crossed with 15+ Canadian cities for local pages — each applying your province's tax rules automatically.
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
            <span className="chip chip-green">18 trade verticals</span>
            <span className="chip chip-teal">15+ Canadian cities</span>
            <span className="chip chip-grey">Bilingual FR / EN</span>
            <span className="chip chip-grey">GST/HST by province</span>
          </div>
        </div>
      </ScrollSection>

      {/* ── DEEP DIVE ──────────────────────────────────────── */}
      <ScrollSection className="sec" id="deep-dive">
        <div className="wrap">
          <div className="split" style={{ paddingTop: 0 }}>
            <div>
              <span className="eyebrow grey">Deep dive</span>
              <h2 className="h2" style={{ margin: "14px 0 16px" }}>What is quoteai and who it's for</h2>
              <p className="lead">
                quoteai is a Canadian software that uses artificial intelligence to turn a plain-language description into a complete, professional quote. It's built for contractors, skilled tradespeople, and small businesses that send client quotes every week — painters, electricians, plumbers, masons, metalworkers, carpenters, renovation companies, and every trade in construction and mechanical/electrical work. The goal is simple: cut the time it takes to put together a quote from 30-60 minutes down to 30 seconds, without giving up the quality of the final document.
              </p>
            </div>
            <div className="dd-feats">
              <div className="dd-feat">
                <span className="fi g"><Receipt className="h-5 w-5" /></span>
                <div>
                  <b>Built-in Canadian tax</b>
                  <p>Automatic GST/HST calculation by province.</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi t"><Shield className="h-5 w-5" /></span>
                <div>
                  <b>Securely stored data</b>
                  <p>Stripe handles payments, sessions are protected with encrypted cookies.</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi p"><Zap className="h-5 w-5" /></span>
                <div>
                  <b>AI trained for the trades</b>
                  <p>Technical vocabulary for construction and mechanical trades.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="dd-grid">
            <div className="card dd-card">
              <h3>How it actually works</h3>
              <p>
                Open quoteai on your phone right on the job site, or from home in the evening. Describe the job the way you'd explain it to a coworker: \"Paint an 800 sq ft apartment, two coats of white washable paint, skim-coat the bathroom wall.\" In thirty seconds the AI engine builds a quote organized into sections, with cost items, units of measure, market-rate unit prices, and automatic tax calculation. You can edit every line item, swap in your own price list, and add or remove sections.
              </p>
            </div>
            <div className="card dd-card">
              <h3>Why it works better than Excel or traditional software</h3>
              <p>
                Traditional quoting software is built for the office: it requires installation, an upfront setup of price lists and codes, and hours of training. Excel is free but forces you to start from a blank sheet every single time. quoteai removes both problems: there's nothing to install, nothing to configure up front, and every quote is structured from the start. On average, our users report saving 4-6 hours a week.
              </p>
            </div>
            <div className="card dd-card">
              <h3>Security and Canadian tax compliance</h3>
              <p>
                All data is stored on secure, encrypted infrastructure, sessions are protected with encrypted cookies, and payments are processed through Stripe. Tax handling follows Canadian rules: GST/HST is calculated automatically based on your province. Your business details are saved once and applied to every quote automatically.
              </p>
            </div>
            <div className="card dd-card" id="plans">
              <h3>What it costs to get started</h3>
              <p>
                Signing up is free, and your first quote is generated without entering a credit card. From there you can choose: pay for a single quote ($5 to $13) when you need one, or start a monthly subscription (Starter $19 with 10 quotes, Pro $49 with 60 quotes, Elite $59 unlimited). You can change or cancel your plan at any time from your account.
              </p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ────────────────────────────────────────────── */}
      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <img src="https://picsum.photos/seed/quoteai-team-celebration/1800/900" alt="" aria-hidden="true" loading="lazy" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark">Get started</span>
          <h2>Ready to transform your business?</h2>
          <p>
            Join hundreds of Canadian contractors and tradespeople who save hours every week.
          </p>
          <div className="cta-actions">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
              Create your free account
            </button>
            <Link href="/#plans" className="btn btn-outline-light">
              See plans
            </Link>
          </div>
          <p className="cta-fine">
            7-day free trial · No credit card required · Single quotes from $5
          </p>
        </div>
      </ScrollSection>
    </div>
  );
}
