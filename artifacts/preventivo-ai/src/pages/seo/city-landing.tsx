// Pagina città × mestiere (/preventivi/:settore/:citta), nel design delle
// pagine pubbliche. Il contenuto viene da data/citta/: dati verificati del
// comune, profilo locale e moduli del mestiere, in ordine di rilevanza per
// quella città. Renderizzata a build time (entry-server) e idratata.
import { Link, useParams } from "wouter";
import { ArrowRight, MapPin, AlertTriangle, Calculator, ListChecks, FileText, BookOpen, Download } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { paginaCitta } from "@/data/citta/pagina";
import { caricoNeve, num, FONTI_CITTA } from "@/data/citta/fatti";
import { fileModello } from "@/data/modelli-word";
import type { Blocco, Sezione } from "@/data/citta/moduli";
import NotFound from "@/pages/not-found";

const base = "/preventivi";

function BloccoView({ b }: { b: Blocco }) {
  switch (b.tipo) {
    case "testo":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {b.paragrafi.map((t) => <p key={t} style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink)" }}>{t}</p>)}
        </div>
      );
    case "avviso":
      return (
        <div className="card" style={{ padding: "20px 22px", borderLeft: "3px solid var(--amber, #d97706)", display: "flex", gap: 14 }}>
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--amber, #d97706)", marginTop: 3 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {b.paragrafi.map((t) => <p key={t} style={{ fontSize: 15, lineHeight: 1.65, color: "var(--ink)" }}>{t}</p>)}
          </div>
        </div>
      );
    case "dati":
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {b.voci.map((v) => (
            <div key={v.etichetta} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)" }}>{v.etichetta}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)", marginTop: 4 }}>{v.valore}</div>
              {v.nota && <div style={{ fontSize: 12, color: "var(--muted-mk)", marginTop: 4 }}>{v.nota}</div>}
            </div>
          ))}
        </div>
      );
    case "calcolo":
      return (
        <div className="card" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span className="fi t"><Calculator className="h-4 w-4" /></span>
            <code style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>{b.formula}</code>
          </div>
          <p style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", marginBottom: 14 }}>{b.risultato}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {b.spiegazione.map((t) => <p key={t} style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted-mk)" }}>{t}</p>)}
          </div>
        </div>
      );
    case "tabella":
      return (
        <div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp" style={{ minWidth: 0, width: "100%" }}>
              <thead><tr>{b.colonne.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{b.righe.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} style={i > 0 ? { fontWeight: 700, color: "var(--navy)" } : undefined}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {b.nota && <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted-mk)", marginTop: 12 }}>{b.nota}</p>}
        </div>
      );
    case "lista":
      return (
        <div>
          {b.intro && <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink)", marginBottom: 12 }}>{b.intro}</p>}
          <ul style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {b.punti.map((t) => (
              <li key={t} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.6, color: "var(--ink)" }}>
                <span style={{ color: "var(--navy)", fontWeight: 800 }} aria-hidden="true">›</span>{t}
              </li>
            ))}
          </ul>
        </div>
      );
    case "voci":
      return (
        <div>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--ink)", marginBottom: 16 }}>{b.intro}</p>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {b.voci.map((v, i) => (
              <div key={v.voce} style={{ display: "flex", gap: 14, padding: "13px 18px", borderTop: i ? "1px solid var(--soft-2)" : undefined, alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--faint)", minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{v.voce}</span>
                {v.perche && <span style={{ fontSize: 13, color: "var(--muted-mk)", marginLeft: "auto", textAlign: "right" }}>{v.perche}</span>}
              </div>
            ))}
          </div>
        </div>
      );
  }
}

const ICONE: Record<string, typeof ListChecks> = { cantiere: ListChecks };

function SezioneView({ s, soft }: { s: Sezione; soft: boolean }) {
  const Icona = ICONE[s.id];
  return (
    <section className={soft ? "sec soft" : "sec"} id={s.id} style={{ paddingBlock: "clamp(36px, 4.5vw, 64px)" }}>
      <div className="wrap" style={{ maxWidth: 820 }}>
        <h2 className="h2" style={{ fontSize: "clamp(1.35rem, 2.2vw, 1.7rem)", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
          {Icona && <span className="fi g"><Icona className="h-4 w-4" /></span>}
          {s.titolo}
        </h2>
        <BloccoView b={s.blocco} />
        {s.nota && <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted-mk)", marginTop: 14 }}>{s.nota}</p>}
      </div>
    </section>
  );
}

export default function SeoCityLanding() {
  const params = useParams() as { type?: string; city?: string };
  const pg = paginaCitta(params.type ?? "", params.city ?? "");
  if (!pg) return <NotFound />;
  const { f } = pg;
  const qsk = caricoNeve(f.zonaNeve, f.altitudine);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <SeoHead title={pg.title} description={pg.description} canonical={pg.canonical} jsonLd={pg.jsonLd} ogImage={`/og/sectors/${pg.settore}.png`} />

      <div className="wrap">
        <nav aria-label="Percorso" className="crumbs">
          <Link href="/">Home</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <Link href={`${base}/${pg.settore}/`}>{pg.etichetta}</Link>
          <span className="crumb-sep" aria-hidden="true">/</span>
          <span className="crumb-current" aria-current="page">{f.nome}</span>
        </nav>
      </div>

      <section className="hero on-dark" id="hero">
        <div className="wrap" style={{ maxWidth: 900, margin: "0 auto", paddingBlock: "clamp(40px, 5.5vw, 76px)" }}>
          <p className="eyebrow on-dark" style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <MapPin className="h-3.5 w-3.5" />
            {pg.sottotitolo}
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 3.6vw, 3rem)" }}>
            Preventivo <em style={{ fontStyle: "normal", color: "#8ef07f" }}>{pg.etichetta.toLowerCase()}</em> a {f.nome}
          </h1>
          <p className="lead" style={{ marginTop: 16 }}>{pg.intro}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginTop: 26 }}>
            {[
              ["Zona climatica", `${f.zonaClimatica} · ${num(f.gradiGiorno)} GG`],
              ["Zona sismica", f.sismicaEtichetta ?? String(f.zonaSismica)],
              ["Carico neve", `${num(qsk, 2)} kN/m²`],
              ["Altitudine", `${num(f.altitudine)} m`],
            ].map(([k, v]) => (
              <div key={k} style={{ border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#c9cad6" }}>{k}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="hero-cta">
            <a href="/sign-up/" className="btn btn-white">
              Crea il preventivo gratis
              <ArrowRight className="chev h-4 w-4" />
            </a>
            <a href={`${base}/${pg.settore}/`} className="btn btn-outline-light">Tutto su {pg.etichetta.toLowerCase()}</a>
          </div>
        </div>
      </section>

      {pg.sezioni.map((s, i) => <SezioneView key={s.id} s={s} soft={i % 2 === 1} />)}

      {pg.modello && (
        <section className="sec" style={{ paddingBlock: "clamp(28px, 3vw, 44px)" }}>
          <div className="wrap" style={{ maxWidth: 820 }}>
            <div className="card" style={{ padding: "20px 22px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <span className="fi t"><FileText className="h-4 w-4" /></span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <b style={{ color: "var(--navy)" }}>{pg.modello.titolo} (.docx)</b>
                <p style={{ fontSize: 13.5, color: "var(--muted-mk)", marginTop: 2 }}>{pg.modello.descrizione}</p>
              </div>
              <a href={fileModello(pg.modello)} download className="btn btn-navy" style={{ display: "inline-flex", gap: 8 }}>
                <Download className="h-4 w-4" /> Scarica gratis
              </a>
            </div>
          </div>
        </section>
      )}

      {pg.faq.length > 0 && (
        <section className="sec soft">
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="h2" style={{ fontSize: "clamp(1.35rem, 2.2vw, 1.7rem)", marginBottom: 18 }}>Domande frequenti su {pg.etichetta.toLowerCase()} a {f.nome}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pg.faq.map((q) => (
                <div key={q.q} className="card" style={{ padding: 22 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "var(--navy)", marginBottom: 8 }}>{q.q}</h3>
                  <p style={{ fontSize: 14.5, color: "var(--muted-mk)", lineHeight: 1.65 }}>{q.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap" style={{ maxWidth: 960 }}>
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>{pg.etichetta} in altre città</h2>
              <div className="blog-links">
                {pg.vicine.map((c) => (
                  <a key={c.slug} href={`${base}/${pg.settore}/${c.slug}/`} className="blog-link-pill">{pg.etichetta} {c.nome}</a>
                ))}
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 12 }}>Altri lavori a {f.nome}</h2>
              <div className="blog-links">
                {pg.altriMestieri.map((m) => (
                  <a key={m.slug} href={`${base}/${m.slug}/${f.slug}/`} className="blog-link-pill">{m.label} a {f.nome}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {pg.articoli.length > 0 && (
        <section className="sec soft">
          <div className="wrap" style={{ maxWidth: 960 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span className="fi g"><BookOpen className="h-4 w-4" /></span>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>Approfondimenti</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {pg.articoli.map((a) => (
                <a key={a.slug} href={`/blog/${a.slug}/`} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="chip chip-teal" style={{ alignSelf: "flex-start" }}>{a.category}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--navy)", lineHeight: 1.4 }}>{a.title}</span>
                  <span style={{ fontSize: 12.5, color: "var(--faint)", marginTop: "auto" }}>{a.readingTimeMin} min di lettura</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <details className="card" style={{ padding: "16px 20px" }}>
            <summary style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)", cursor: "pointer" }}>Fonti dei dati di {f.nome}</summary>
            <ul style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {FONTI_CITTA.map((t) => <li key={t} style={{ fontSize: 13, color: "var(--muted-mk)" }}>{t}</li>)}
            </ul>
            <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 10 }}>I valori riguardano il comune nel suo complesso (altitudine della casa comunale): per un edificio specifico vanno verificati sul posto.</p>
          </details>
        </div>
      </section>

      <section className="cta on-dark">
        <div className="wrap cta-in">
          <h2>
            Il preventivo per {f.nome}, <em style={{ fontStyle: "normal", color: "#8ef07f" }}>in 30 secondi</em>
          </h2>
          <p>Descrivi il lavoro a parole: prevai scrive le voci, calcola IVA e totali e prepara il PDF da inviare al cliente.</p>
          <div className="cta-actions">
            <a href="/sign-up/" className="btn btn-white">
              Prova gratis
              <ArrowRight className="chev h-4 w-4" />
            </a>
          </div>
          <p className="cta-fine">Nessuna carta di credito richiesta.</p>
        </div>
      </section>
    </div>
  );
}
