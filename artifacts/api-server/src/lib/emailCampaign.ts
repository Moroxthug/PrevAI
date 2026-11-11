// EMAIL-1: template for marketing campaigns to PrevAI's own users.
//
// A campaign is data (blocks), not HTML: whoever writes it — the owner, the
// admin page later, or Claude — fills a CampaignContent and gets an email
// that matches every other PrevAI email, dark mode included.
//
// Legal (Italy): campaigns to registered users rely on the "soft spam"
// exception (art. 130 c.4 D.Lgs. 196/2003) — similar services, opt-out offered
// in every message. So `unsubscribeUrl` is REQUIRED here, and the sender
// should also set the List-Unsubscribe headers (see campaignHeaders()).

import { MARKET } from "@workspace/config";
import { layout, p, h2, button, callout, checklist, featureGrid, image, quote, divider, esc, type Tone } from "./emailLayout.js";

export type CampaignBlock =
  | { type: "text"; text: string } // plain text, blank line = new paragraph, **bold** allowed
  | { type: "heading"; text: string }
  | { type: "image"; src: string; alt: string; href?: string }
  | { type: "checklist"; items: string[] }
  | { type: "features"; items: Array<{ title: string; text: string }> }
  | { type: "callout"; text: string; tone?: Tone }
  | { type: "quote"; text: string; author?: string }
  | { type: "button"; label: string; href: string; variant?: "primary" | "dark" | "ghost" }
  | { type: "divider" };

export type CampaignContent = {
  /** Subject line (not rendered in the body). */
  subject: string;
  /** Inbox preview text — the second thing people read. */
  preheader: string;
  eyebrow?: { text: string; tone?: Tone };
  heading: string;
  lead?: string;
  blocks: CampaignBlock[];
  /** Main call to action, rendered after the blocks. */
  cta?: { label: string; href: string };
  /** Personalisation: "Ciao {nome}," is added at the top when given. */
  firstName?: string | null;
};

/** **bold** and line breaks, everything else escaped. */
function inline(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

/** Adds UTM parameters to links that point at our own site. */
export function withUtm(href: string, campaign: string): string {
  try {
    const u = new URL(href);
    if (!u.hostname.endsWith(MARKET.domain)) return href;
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "email");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "campaign");
    if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    return href;
  }
}

function renderBlock(b: CampaignBlock, utm: (h: string) => string): string {
  switch (b.type) {
    case "text":
      return b.text
        .replace(/\r/g, "")
        .trim()
        .split(/\n{2,}/)
        .map((para) => p(inline(para)))
        .join("");
    case "heading":
      return h2(b.text);
    case "image":
      return image(b.src, b.alt, { href: b.href ? utm(b.href) : undefined });
    case "checklist":
      return checklist(b.items.map(inline));
    case "features":
      return featureGrid(b.items.map((it) => ({ title: it.title, html: inline(it.text) })));
    case "callout":
      return callout(inline(b.text), b.tone);
    case "quote":
      return quote(b.text, b.author);
    case "button":
      return button(utm(b.href), b.label, { variant: b.variant });
    case "divider":
      return divider();
  }
}

export function buildCampaignEmail(content: CampaignContent, opts: { unsubscribeUrl: string; campaignId: string }): string {
  const utm = (h: string) => withUtm(h, opts.campaignId);
  const hello = content.firstName ? p(`Ciao ${esc(content.firstName)},`) : "";
  return layout({
    title: content.subject,
    preheader: content.preheader,
    eyebrow: content.eyebrow,
    heading: content.heading,
    bodyHtml: hello + (content.lead ? p(esc(content.lead)) : "") + content.blocks.map((b) => renderBlock(b, utm)).join("") + (content.cta ? button(utm(content.cta.href), content.cta.label) : ""),
    footerHtml: `Ricevi questa email perché hai un account ${MARKET.brand}. Ti scriviamo solo per novità sul servizio che usi.`,
    unsubscribeUrl: opts.unsubscribeUrl,
  });
}

/** RFC 8058 one-click unsubscribe headers (Gmail/Yahoo bulk-sender rules). */
export function campaignHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${MARKET.supportEmail}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ── Starter campaigns (copy the owner can reuse/edit) ───────────────────────

export const CAMPAIGN_EXAMPLES: Record<string, CampaignContent> = {
  /** For people who registered but haven't made a quote yet. */
  attivazione: {
    subject: "Il tuo primo preventivo in 60 secondi",
    preheader: "Scrivi il lavoro come lo diresti al cliente: al resto pensa PrevAI.",
    eyebrow: { text: "Primi passi", tone: "brand" },
    heading: "Il tuo primo preventivo ti aspetta",
    lead: "Ti sei registrato su PrevAI ma non hai ancora creato un preventivo. Bastano un minuto e una frase.",
    blocks: [
      { type: "text", text: "Scrivi il lavoro come lo diresti al telefono, ad esempio:" },
      { type: "quote", text: "Rifacimento bagno 6 mq: demolizione piastrelle, nuovo impianto idraulico, posa gres 60x60, sanitari sospesi e box doccia." },
      { type: "text", text: "PrevAI lo trasforma in un **preventivo completo**: capitoli, voci, quantità e prezzi. Lo rivedi, lo correggi e lo mandi." },
      {
        type: "features",
        items: [
          { title: "PDF con il tuo logo", text: "Intestazione, P.IVA e condizioni: pronto da firmare." },
          { title: "Accettazione online", text: "Il cliente accetta con un clic, tu ricevi l'avviso." },
          { title: "Solleciti automatici", text: "Se il cliente non risponde, ci pensa PrevAI." },
          { title: "Anche dal telefono", text: "Detta il lavoro a voce direttamente dal cantiere." },
        ],
      },
    ],
    cta: { label: "Crea il primo preventivo", href: `${MARKET.siteUrl}/dashboard` },
  },
  /** Product news. */
  novita: {
    subject: "Novità di novembre su PrevAI",
    preheader: "Contratti firmati online, area clienti e solleciti automatici.",
    eyebrow: { text: "Novità", tone: "info" },
    heading: "Cosa c'è di nuovo questo mese",
    blocks: [
      { type: "heading", text: "Contratti con firma online" },
      { type: "text", text: "Dal preventivo accettato al contratto firmato in due clic, con codice di verifica e certificato di firma." },
      { type: "heading", text: "Area clienti" },
      { type: "text", text: "Preventivi, fatture, foto del cantiere e messaggi: il tuo cliente trova tutto in un posto." },
      { type: "callout", text: "**Suggerimento:** attiva i solleciti automatici in Impostazioni → Automazioni.", tone: "brand" },
    ],
    cta: { label: "Scopri le novità", href: `${MARKET.siteUrl}/dashboard` },
  },
};
