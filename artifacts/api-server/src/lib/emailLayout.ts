// EMAIL-1: one layout for every email PrevAI sends.
//
// Rules this file follows, because mail clients are hostile:
//  • Tables + inline styles only for structure. The <style> block only adds
//    progressive extras (dark mode, mobile padding) — the email must look right
//    with it stripped (Gmail on some accounts, Outlook desktop).
//  • Dark mode. Three families of clients:
//      1. Apple Mail / iOS Mail / Outlook.com / Outlook app: honour
//         `prefers-color-scheme` + [data-ogsc]/[data-ogsb] → we ship a real dark palette.
//      2. Gmail app (iOS/Android): forcibly inverts colours, never images and
//         never `background-image` → anything that must stay a fixed colour
//         (brand header, company-logo chip) is either an image or carries a
//         `background-image: linear-gradient(c,c)` twin of its background colour.
//      3. Clients with no dark mode: plain light design.
//    The PrevAI logo is therefore a pre-rendered image with its own navy
//    background (public/email/header.png): no client can recolour it.
//  • No gradients for meaning (Outlook drops them): solid colours with a
//    gradient only as decoration.

import { MARKET } from "@workspace/config";
import { getBaseUrl } from "./baseUrl.js";
import { emailLogoSrc } from "./logo.js";

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Palette (dashboard: navy #101031, purple #6c2bd9, teal #0a7580) ──────────
export const C = {
  page: "#f3f3f0",
  card: "#ffffff",
  line: "#e6e6ea",
  navy: "#101031",
  ink: "#393a3d",
  muted: "#71717a",
  purple: "#6c2bd9",
  purpleT: "#eeecfc",
  teal: "#0a7580",
  tealT: "#e3f5f4",
} as const;

export type Tone = "brand" | "success" | "warning" | "danger" | "info";
const TONES: Record<Tone, { fg: string; bg: string; dot: string }> = {
  brand: { fg: "#5a21bd", bg: "#eeecfc", dot: "#6c2bd9" },
  success: { fg: "#05603a", bg: "#e3f6ec", dot: "#12b76a" },
  warning: { fg: "#93370d", bg: "#fef0d7", dot: "#f79009" },
  danger: { fg: "#a01f16", bg: "#fdecea", dot: "#f04438" },
  info: { fg: "#0a6f78", bg: "#e3f5f4", dot: "#0a7580" },
};

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function asset(name: string): string {
  return `${getBaseUrl()}/email/${name}`;
}

/** A solid background that the Gmail app will not invert. */
function fixedBg(color: string): string {
  return `background-color:${color};background-image:linear-gradient(${color},${color});`;
}

// ── Building blocks ─────────────────────────────────────────────────────────

export function p(html: string, opts: { muted?: boolean; small?: boolean; center?: boolean } = {}): string {
  const size = opts.small ? "13px" : "15px";
  const color = opts.muted ? C.muted : C.ink;
  return `<p class="${opts.muted ? "e-muted" : "e-ink"}" style="margin:0 0 16px;font-size:${size};line-height:1.65;color:${color};${opts.center ? "text-align:center;" : ""}">${html}</p>`;
}

export function h2(text: string): string {
  return `<h2 class="e-title" style="margin:28px 0 10px;font-size:16px;line-height:1.35;font-weight:700;color:${C.navy};">${esc(text)}</h2>`;
}

/** Bulletproof button (works in Outlook desktop, survives dark-mode inversion). */
export function button(href: string, label: string, opts: { variant?: "primary" | "dark" | "ghost"; align?: "center" | "left" } = {}): string {
  const v = opts.variant ?? "primary";
  const bg = v === "primary" ? C.purple : v === "dark" ? C.navy : C.card;
  const fg = v === "ghost" ? C.navy : "#ffffff";
  const border = v === "ghost" ? `border:1px solid ${C.line};` : `border:1px solid ${bg};`;
  const align = opts.align ?? "center";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="margin:26px ${align === "center" ? "auto" : "0"} 26px;">
<tr><td align="center" bgcolor="${bg}" class="${v === "ghost" ? "e-ghost" : ""}" style="border-radius:10px;${v === "ghost" ? "" : fixedBg(bg)}">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${fg};text-decoration:none;border-radius:10px;${border}">${esc(label)}</a>
</td></tr></table>`;
}

/** Label / value rows. Last row can be emphasised (totals). */
export function infoTable(rows: Array<[string, string]>, opts: { emphasizeLast?: boolean } = {}): string {
  const body = rows
    .map(([label, valueHtml], i) => {
      const last = i === rows.length - 1;
      const strong = last && opts.emphasizeLast;
      const border = last ? "" : `border-bottom:1px solid ${C.line};`;
      return `<tr>
<td class="e-muted e-line" style="padding:12px 0;${border}font-size:13.5px;color:${C.muted};">${esc(label)}</td>
<td align="right" class="${strong ? "e-accent" : "e-title"} e-line" style="padding:12px 0;${border}font-size:${strong ? "17px" : "14px"};font-weight:${strong ? "700" : "600"};color:${strong ? C.purple : C.navy};text-align:right;">${valueHtml}</td>
</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-panel" style="margin:22px 0;background:#fafafa;border:1px solid ${C.line};border-radius:12px;">
<tr><td style="padding:6px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr></table>`;
}

/** Tinted callout box. */
export function callout(html: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
<tr><td class="e-callout-${tone}" style="padding:16px 18px;background:${t.bg};border-radius:12px;border-left:3px solid ${t.dot};font-size:14px;line-height:1.6;color:${t.fg};">${html}</td></tr></table>`;
}

/** Quoted personal message (e.g. the note a company adds to a quote). */
export function quote(text: string, author?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
<tr><td class="e-quote" style="padding:4px 0 4px 16px;border-left:3px solid #c9bdf5;font-size:15px;line-height:1.65;color:${C.ink};font-style:italic;white-space:pre-wrap;">${esc(text)}${author ? `<br/><span class="e-muted" style="font-style:normal;font-size:13px;color:${C.muted};">— ${esc(author)}</span>` : ""}</td></tr></table>`;
}

/** Large one-time code. */
export function code(value: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;">
<tr><td class="e-code" style="padding:16px 28px;${fixedBg(C.purpleT)}border:1px solid #d9d1fa;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${C.navy};">${esc(value)}</td></tr></table>`;
}

/** Numbered steps. `items` are HTML. */
export function steps(items: string[]): string {
  const rows = items
    .map(
      (html, i) => `<tr>
<td width="40" valign="top" style="padding:0 0 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="28" height="28" bgcolor="${C.purpleT}" class="e-step" style="width:28px;height:28px;border-radius:14px;background:${C.purpleT};font-size:13px;font-weight:700;color:${C.purple};">${i + 1}</td></tr></table></td>
<td valign="top" class="e-ink" style="padding:4px 0 16px;font-size:14.5px;line-height:1.6;color:${C.ink};">${html}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;">${rows}</table>`;
}

/** Check-mark list (features, benefits). `items` are HTML. */
export function checklist(items: string[]): string {
  const rows = items
    .map(
      (html) => `<tr><td width="26" valign="top" style="padding:2px 0 10px;font-size:15px;line-height:1.5;color:${C.teal};font-weight:700;">✓</td><td class="e-ink" style="padding:2px 0 10px;font-size:14.5px;line-height:1.55;color:${C.ink};">${html}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">${rows}</table>`;
}

/** Hairline separator. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="e-line" style="padding:8px 0 24px;border-bottom:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr></table><div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>`;
}

/** Full-width image (campaigns). Width in px at 1x; supply a 2x source. */
export function image(src: string, alt: string, opts: { href?: string; radius?: number } = {}): string {
  const img = `<img src="${esc(src)}" alt="${esc(alt)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:${opts.radius ?? 12}px;" />`;
  return `<div style="margin:22px 0;">${opts.href ? `<a href="${esc(opts.href)}" target="_blank">${img}</a>` : img}</div>`;
}

/** Two cards side by side (stacks on phones). Each item: { title, html }. */
export function featureGrid(items: Array<{ title: string; html: string }>): string {
  const cells = items.map(
    (it) => `<td class="e-col" width="50%" valign="top" style="padding:6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="e-panel" style="padding:16px;background:#fafafa;border:1px solid ${C.line};border-radius:12px;">
<div class="e-title" style="font-size:14.5px;font-weight:700;color:${C.navy};margin:0 0 6px;">${esc(it.title)}</div>
<div class="e-muted" style="font-size:13.5px;line-height:1.55;color:${C.muted};">${it.html}</div></td></tr></table></td>`,
  );
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? `<td class="e-col" width="50%"></td>`}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px -6px;width:calc(100% + 12px);">${rows.join("")}</table>`;
}

/** Plain text → escaped paragraphs (blank line = new paragraph). */
export function textParagraphs(text: string): string {
  return text
    .replace(/\r/g, "")
    .trim()
    .split(/\n{2,}/)
    .map((para) => p(esc(para).replace(/\n/g, "<br>")))
    .join("");
}

/** Sender identification for emails a company sends to its customers (GDPR / D.Lgs. 70/2003). */
export function companyIdentification(profile: { companyName?: string | null; address?: string | null; phone?: string | null; email?: string | null }): string {
  const contact = [profile.phone, profile.email].filter((x): x is string => !!x).map(esc).join(" · ");
  return [`Inviato da <strong>${esc(profile.companyName || "questa impresa")}</strong>`, profile.address ? esc(profile.address) : "", contact].filter(Boolean).join("<br/>");
}

// ── The layout ──────────────────────────────────────────────────────────────

export type LayoutBrand =
  /** PrevAI → its own users. */
  | { kind: "prevai" }
  /** A company → its customers, sent through PrevAI. */
  | { kind: "company"; name: string; logoUrl?: string | null };

export type LayoutParams = {
  /** <title> and fallback for the preheader. */
  title: string;
  /** Inbox preview line (hidden in the body). */
  preheader?: string;
  brand?: LayoutBrand;
  /** Small pill above the title. */
  eyebrow?: { text: string; tone?: Tone };
  /** Big title at the top of the card (optional: body can start straight away). */
  heading?: string;
  /** Lead paragraph under the title (plain text). */
  lead?: string;
  /** Card body HTML (built with the helpers above). */
  bodyHtml: string;
  /** Fine print under the card (HTML). */
  footerHtml?: string;
  /** Unsubscribe link — shown in the footer when present (marketing / follow-ups). */
  unsubscribeUrl?: string | null;
  /** Hide the PrevAI links row in the footer (customer emails sent for a company). */
  hidePrevaiLinks?: boolean;
};

const DARK_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .e-page, body { background:#0c0c1d !important; }
  .e-card { background:#17172e !important; border-color:#2a2a48 !important; }
  .e-title, .e-title a { color:#f2f2f7 !important; }
  .e-ink { color:#d3d3de !important; }
  .e-muted { color:#9a9ab0 !important; }
  .e-line { border-color:#2a2a48 !important; }
  .e-panel { background:#1e1e3a !important; border-color:#2f2f52 !important; }
  .e-accent { color:#b69cff !important; }
  .e-quote { color:#d3d3de !important; border-color:#5b47b0 !important; }
  .e-ghost { border-color:#3a3a5c !important; }
  .e-ghost a { color:#f2f2f7 !important; border-color:#3a3a5c !important; }
  .e-callout-brand { background:#26204a !important; color:#d9ccff !important; }
  .e-callout-success { background:#123326 !important; color:#a6f0c8 !important; }
  .e-callout-warning { background:#3a2a10 !important; color:#ffd59a !important; }
  .e-callout-danger { background:#3d1a18 !important; color:#ffb4ab !important; }
  .e-callout-info { background:#0f3034 !important; color:#9fe6ea !important; }
  .e-foot, .e-foot a { color:#8c8ca6 !important; }
  .e-chipwrap { background:#17172e !important; }
  .e-step { background:#2c2456 !important; color:#c9b8ff !important; }
  .e-pill-brand { background:#2c2456 !important; color:#d2c4ff !important; }
  .e-pill-success { background:#123326 !important; color:#8fe3b5 !important; }
  .e-pill-warning { background:#3a2a10 !important; color:#ffcf8a !important; }
  .e-pill-danger { background:#3d1a18 !important; color:#ffaba3 !important; }
  .e-pill-info { background:#0f3034 !important; color:#8edde2 !important; }
  .e-body a:not([style*="display:inline-block"]) { color:#b69cff !important; }
}
[data-ogsc] .e-title { color:#f2f2f7 !important; }
[data-ogsc] .e-ink { color:#d3d3de !important; }
[data-ogsc] .e-muted { color:#9a9ab0 !important; }
[data-ogsb] .e-page { background:#0c0c1d !important; }
[data-ogsb] .e-card { background:#17172e !important; }
[data-ogsb] .e-panel { background:#1e1e3a !important; }
@media only screen and (max-width:620px) {
  .e-wrap { padding:12px 8px !important; }
  .e-body { padding:28px 22px 24px !important; }
  .e-h1 { font-size:22px !important; }
  .e-col { display:block !important; width:100% !important; }
}
a { color:${C.purple}; }
`;

function headerHtml(brand: LayoutBrand): string {
  if (brand.kind === "prevai") {
    return `<tr><td bgcolor="${C.navy}" style="${fixedBg(C.navy)}border-radius:16px 16px 0 0;font-size:0;line-height:0;">
<a href="${esc(MARKET.siteUrl)}" target="_blank"><img src="${asset("header.png")}" width="600" alt="${esc(MARKET.brand)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:16px 16px 0 0;color:#ffffff;font-family:${FONT};font-size:22px;font-weight:700;line-height:112px;text-align:center;background:${C.navy};" /></a>
</td></tr>`;
  }
  // Company: its logo on a white chip that dark mode cannot invert (any logo
  // reads on white — transparent PNGs with dark text would vanish on dark).
  const logo = emailLogoSrc(brand.logoUrl);
  const inner = logo
    ? `<img src="${logo}" alt="${esc(brand.name)}" height="44" style="display:block;height:44px;width:auto;max-width:220px;border:0;" />`
    : `<span style="font-family:${FONT};font-size:19px;font-weight:700;color:${C.navy};letter-spacing:-0.2px;">${esc(brand.name)}</span>`;
  return `<tr><td align="center" bgcolor="#ffffff" class="e-chipwrap" style="padding:28px 24px 8px;background:#ffffff;border-radius:16px 16px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#ffffff" style="${fixedBg("#ffffff")}padding:10px 16px;border-radius:12px;">${inner}</td></tr></table>
</td></tr>`;
}

export function layout(params: LayoutParams): string {
  const brand = params.brand ?? { kind: "prevai" };
  const pre = params.preheader ?? params.lead ?? "";
  const year = new Date().getFullYear();
  const site = MARKET.siteUrl;

  const eyebrow = params.eyebrow
    ? (() => {
        const t = TONES[params.eyebrow.tone ?? "brand"];
        return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td class="e-pill-${params.eyebrow.tone ?? "brand"}" style="padding:5px 11px;border-radius:999px;background:${t.bg};font-size:12px;font-weight:600;letter-spacing:0.2px;color:${t.fg};"><span style="color:${t.dot};">●</span>&nbsp; ${esc(params.eyebrow.text)}</td></tr></table>`;
      })()
    : "";
  const heading = params.heading
    ? `<h1 class="e-title e-h1" style="margin:0 0 12px;font-size:25px;line-height:1.25;font-weight:700;letter-spacing:-0.3px;color:${C.navy};">${esc(params.heading)}</h1>`
    : "";
  const lead = params.lead ? `<p class="e-ink" style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${C.ink};">${esc(params.lead)}</p>` : "";

  const prevaiLinks = params.hidePrevaiLinks
    ? ""
    : `<p style="margin:0 0 10px;"><a href="${site}/dashboard" style="color:${C.muted};text-decoration:none;font-weight:600;">Dashboard</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${site}/blog" style="color:${C.muted};text-decoration:none;font-weight:600;">Guide</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="mailto:${MARKET.supportEmail}" style="color:${C.muted};text-decoration:none;font-weight:600;">Supporto</a></p>`;
  const unsubscribe = params.unsubscribeUrl
    ? `<p style="margin:10px 0 0;">Non vuoi più ricevere queste email? <a href="${esc(params.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Annulla l'iscrizione</a></p>`
    : "";
  const poweredBy =
    brand.kind === "company"
      ? `<p style="margin:12px 0 0;"><a href="${site}" style="text-decoration:none;color:${C.muted};"><img src="${asset("badge.png")}" width="16" height="16" alt="" style="vertical-align:-3px;border:0;border-radius:4px;" />&nbsp; Inviato con ${MARKET.brand}</a></p>`
      : `<p style="margin:12px 0 0;">&copy; ${year} ${MARKET.brand} · Preventivi edili con l'AI · <a href="${site}" style="color:${C.muted};text-decoration:none;">${MARKET.domain}</a></p>`;

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<meta name="x-apple-disable-message-reformatting" />
<title>${esc(params.title)}</title>
<style>${DARK_CSS}</style>
</head>
<body class="e-page" style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${esc(pre)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-page" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" class="e-wrap" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT};">
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:16px;">
${headerHtml(brand)}
<tr><td class="e-body" style="padding:36px 40px 32px;font-family:${FONT};">
${eyebrow}${heading}${lead}${params.bodyHtml}
</td></tr>
</table>
</td></tr>
<tr><td align="center" class="e-foot" style="padding:22px 24px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};text-align:center;">
${params.footerHtml ? `<p style="margin:0 0 12px;">${params.footerHtml}</p>` : ""}${prevaiLinks}${poweredBy}${unsubscribe}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
