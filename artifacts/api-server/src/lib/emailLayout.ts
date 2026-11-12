// EMAIL-1: one layout for every email PrevAI sends.
//
// Rules this file follows, because mail clients are hostile:
//  • Tables + inline styles only for structure. The <style> block only adds
//    progressive extras (dark mode, phone sizes) — the email must look right
//    with it stripped (Gmail on some accounts, Outlook desktop).
//  • Dark mode. Three families of clients:
//      1. Apple Mail / iOS Mail / Outlook.com / Outlook app: honour
//         `prefers-color-scheme` + [data-ogsc]/[data-ogsb] → we ship a real dark palette.
//      2. Gmail app (iOS/Android): forcibly inverts colours, never images and
//         never `background-image` → anything that must stay a fixed colour
//         (brand header, company-logo chip, buttons) is either an image or carries a
//         `background-image: linear-gradient(c,c)` twin of its background colour.
//      3. Clients with no dark mode: plain light design.
//    The PrevAI logo is therefore a pre-rendered image with its own navy
//    background (public/email/header.png): no client can recolour it.
//
// Look (EMAIL-3): editorial, left-aligned, one column. No status pills, no
// coloured side bars, no boxed "feature cards": big type, generous spacing,
// panels only where there are numbers to read.

import { MARKET } from "@workspace/config";
import { getBaseUrl } from "./baseUrl.js";
import { emailLogoSrc } from "./logo.js";

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── Palette (dashboard: navy #101031, purple #6c2bd9, teal #0a7580) ──────────
export const C = {
  page: "#f1f2f5",
  card: "#ffffff",
  panel: "#f7f7fa",
  line: "#e7e8ee",
  navy: "#101031",
  ink: "#2f3140",
  muted: "#6b6d7b",
  purple: "#6c2bd9",
  purpleT: "#f1edfd",
  teal: "#0a7580",
  tealT: "#e3f5f4",
} as const;

export type Tone = "brand" | "success" | "warning" | "danger" | "info";
const TONES: Record<Tone, { fg: string; bg: string }> = {
  brand: { fg: "#4b1aa6", bg: "#f1edfd" },
  success: { fg: "#05603a", bg: "#e8f6ee" },
  warning: { fg: "#8a3a0c", bg: "#fdf1dc" },
  danger: { fg: "#9b1c14", bg: "#fdeceb" },
  info: { fg: "#08626a", bg: "#e4f4f3" },
};

const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TABLE = `role="presentation" cellpadding="0" cellspacing="0" border="0"`;

function asset(name: string): string {
  return `${getBaseUrl()}/email/${name}`;
}

/** A solid background that the Gmail app will not invert. */
function fixedBg(color: string): string {
  return `background-color:${color};background-image:linear-gradient(${color},${color});`;
}

export function unescapeHtml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

// ── Building blocks ─────────────────────────────────────────────────────────

export function p(html: string, opts: { muted?: boolean; small?: boolean; center?: boolean; lead?: boolean } = {}): string {
  if (opts.lead) return `<p class="e-ink" style="margin:0 0 22px;font-size:17.5px;line-height:1.6;color:${C.ink};">${html}</p>`;
  const size = opts.small ? "13.5px" : "16px";
  const color = opts.muted ? C.muted : C.ink;
  return `<p class="${opts.muted ? "e-muted" : "e-ink"}" style="margin:0 0 18px;font-size:${size};line-height:1.65;color:${color};">${html}</p>`;
}

export function h2(text: string): string {
  return `<h2 class="e-title" style="margin:36px 0 12px;font-size:19px;line-height:1.3;font-weight:700;letter-spacing:-0.2px;color:${C.navy};">${esc(text)}</h2>`;
}

/** Bulletproof button (works in Outlook desktop, survives dark-mode inversion). Full width on phones. */
export function button(href: string, label: string, opts: { variant?: "primary" | "dark" | "ghost"; align?: "center" | "left" } = {}): string {
  const v = opts.variant ?? "primary";
  const bg = v === "primary" ? C.purple : v === "dark" ? C.navy : C.card;
  const fg = v === "ghost" ? C.navy : "#ffffff";
  const border = v === "ghost" ? `border:1.5px solid ${C.line};` : `border:1.5px solid ${bg};`;
  return `<table ${TABLE} class="e-btn" style="margin:30px 0 30px;">
<tr><td align="center" bgcolor="${v === "ghost" ? "" : bg}" class="${v === "ghost" ? "e-ghost" : ""}" style="border-radius:10px;${v === "ghost" ? "" : fixedBg(bg)}">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:16px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:${fg};text-decoration:none;border-radius:10px;${border}">${esc(label)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>`;
}

function panel(inner: string, margin = "26px 0"): string {
  return `<table ${TABLE} width="100%" class="e-panel" bgcolor="${C.panel}" style="margin:${margin};background:${C.panel};border-radius:14px;"><tr><td style="padding:8px 22px;">${inner}</td></tr></table>`;
}

/** Rows of label (HTML) / value (HTML). The last row can be the total. */
export function infoRowsHtml(rows: Array<[string, string]>, opts: { emphasizeLast?: boolean; title?: string; note?: string } = {}): string {
  const body = rows
    .map(([labelHtml, valueHtml], i) => {
      const strong = i === rows.length - 1 && opts.emphasizeLast;
      const border = i === 0 && !opts.title ? "" : `border-top:1px solid ${C.line};`;
      return `<tr>
<td class="${strong ? "e-title" : "e-muted"} e-line" style="padding:${strong ? "16px" : "13px"} 12px ${strong ? "16px" : "13px"} 0;${border}vertical-align:baseline;font-size:${strong ? "15px" : "14.5px"};font-weight:${strong ? "700" : "400"};color:${strong ? C.navy : C.muted};">${labelHtml}</td>
<td align="right" class="${strong ? "e-accent" : "e-title"} e-line" style="padding:${strong ? "16px" : "13px"} 0;${border}vertical-align:baseline;font-size:${strong ? "20px" : "14.5px"};font-weight:${strong ? "800" : "600"};letter-spacing:${strong ? "-0.3px" : "0"};color:${strong ? C.purple : C.navy};text-align:right;white-space:nowrap;">${valueHtml}</td>
</tr>`;
    })
    .join("");
  const head = opts.title
    ? `<tr><td colspan="2" style="padding:14px 0 12px;"><div class="e-title" style="font-size:15px;font-weight:700;color:${C.navy};">${esc(opts.title)}</div>${opts.note ? `<div class="e-muted" style="margin-top:3px;font-size:12.5px;color:${C.muted};">${esc(opts.note)}</div>` : ""}</td></tr>`
    : "";
  return panel(`<table ${TABLE} width="100%">${head}${body}</table>`);
}

/** Label / value rows (labels are plain text). Last row can be emphasised (totals). */
export function infoTable(rows: Array<[string, string]>, opts: { emphasizeLast?: boolean; title?: string; note?: string } = {}): string {
  return infoRowsHtml(
    rows.map(([l, v]) => [esc(l), v]),
    opts,
  );
}

/** Tinted note. First <strong> line reads as its title. */
export function callout(html: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `<table ${TABLE} width="100%" style="margin:26px 0;">
<tr><td class="e-callout-${tone}" bgcolor="${t.bg}" style="padding:18px 22px;background:${t.bg};border-radius:14px;font-size:14.5px;line-height:1.6;color:${t.fg};">${html}</td></tr></table>`;
}

/** Quoted words (HTML) — a customer's note, an example of what to write. */
export function quoteHtml(html: string, author?: string): string {
  return panel(
    `<div style="padding:12px 0 14px;"><div class="e-accent" style="font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:28px;height:22px;color:${C.purple};">&ldquo;</div><div class="e-title" style="font-size:16px;line-height:1.6;color:${C.navy};white-space:pre-wrap;">${html}</div>${author ? `<div class="e-muted" style="margin-top:10px;font-size:13px;color:${C.muted};">${esc(author)}</div>` : ""}</div>`,
  );
}

export function quote(text: string, author?: string): string {
  return quoteHtml(esc(text), author);
}

/** Large one-time code. */
export function code(value: string): string {
  return `<table ${TABLE} style="margin:28px 0;">
<tr><td class="e-code" style="padding:18px 26px;${fixedBg(C.purpleT)}border-radius:14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${C.navy};">${esc(value)}</td></tr></table>`;
}

/** Numbered steps. `items` are HTML. */
export function steps(items: string[]): string {
  const rows = items
    .map(
      (html, i) => `<tr>
<td width="44" valign="top" class="e-line" style="padding:16px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><div class="e-accent" style="font-size:15px;font-weight:800;color:${C.purple};">0${i + 1}</div></td>
<td valign="top" class="e-ink e-line" style="padding:16px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-size:15px;line-height:1.55;color:${C.ink};">${html}</td>
</tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:8px 0 6px;">${rows}</table>`;
}

/** Check-mark list (features, benefits). `items` are HTML. */
export function checklist(items: string[]): string {
  const rows = items
    .map(
      (html) => `<tr><td width="30" valign="top" style="padding:3px 0 12px;"><div class="e-check" style="width:20px;height:20px;border-radius:10px;${fixedBg(C.purpleT)}text-align:center;font-size:12px;line-height:20px;font-weight:700;color:${C.purple};">&#10003;</div></td><td class="e-ink" style="padding:2px 0 12px;font-size:15px;line-height:1.55;color:${C.ink};">${html}</td></tr>`,
    )
    .join("");
  return `<table ${TABLE} width="100%" style="margin:18px 0;">${rows}</table>`;
}

/** Hairline separator. */
export function divider(): string {
  return `<table ${TABLE} width="100%" style="margin:30px 0;"><tr><td class="e-line" style="border-top:1px solid ${C.line};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
}

/** Full-width image (campaigns). Width in px at 1x; supply a 2x source. */
export function image(src: string, alt: string, opts: { href?: string; radius?: number } = {}): string {
  const img = `<img src="${esc(src)}" alt="${esc(alt)}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border:0;border-radius:${opts.radius ?? 14}px;" />`;
  return `<div style="margin:26px 0;">${opts.href ? `<a href="${esc(opts.href)}" target="_blank">${img}</a>` : img}</div>`;
}

/** Two columns of short points (stacks on phones). Each item: { title, html }. */
export function featureGrid(items: Array<{ title: string; html: string }>): string {
  const cell = (it: { title: string; html: string } | undefined, side: "l" | "r") =>
    it
      ? `<td class="e-col" width="50%" valign="top" style="padding:${side === "l" ? "0 14px 26px 0" : "0 0 26px 14px"};">
<table ${TABLE}><tr><td class="e-bar" height="3" width="28" style="${fixedBg(C.purple)}height:3px;width:28px;font-size:0;line-height:0;border-radius:2px;">&nbsp;</td></tr></table>
<div class="e-title" style="margin:14px 0 6px;font-size:15.5px;font-weight:700;color:${C.navy};">${esc(it.title)}</div>
<div class="e-muted" style="font-size:14.5px;line-height:1.55;color:${C.muted};">${it.html}</div></td>`
      : `<td class="e-col" width="50%"></td>`;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(`<tr>${cell(items[i], "l")}${cell(items[i + 1], "r")}</tr>`);
  return `<table ${TABLE} width="100%" style="margin:28px 0 4px;">${rows.join("")}</table>`;
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
  .e-page, body { background:#0b0b17 !important; }
  .e-card { background:#15152a !important; }
  .e-title, .e-title a { color:#f4f4f8 !important; }
  .e-ink { color:#d0d1dc !important; }
  .e-muted { color:#9798ad !important; }
  .e-line { border-color:#2a2a46 !important; }
  .e-panel { background:#1d1d36 !important; }
  .e-accent { color:#b69cff !important; }
  .e-ghost { border-color:#3a3a5c !important; }
  .e-ghost a { color:#f4f4f8 !important; border-color:#3a3a5c !important; }
  .e-callout-brand { background:#241f45 !important; color:#d9ccff !important; }
  .e-callout-success { background:#11301f !important; color:#a6f0c8 !important; }
  .e-callout-warning { background:#35270f !important; color:#ffd59a !important; }
  .e-callout-danger { background:#3a1917 !important; color:#ffb4ab !important; }
  .e-callout-info { background:#0f2d31 !important; color:#9fe6ea !important; }
  .e-check, .e-code { background:#2a2350 !important; color:#c9b8ff !important; }
  .e-bar { background:#9b7bff !important; }
  .e-foot, .e-foot a { color:#8a8ba3 !important; }
  .e-chipwrap { background:#15152a !important; }
  .e-body a:not([style*="display:inline-block"]) { color:#b69cff !important; }
}
[data-ogsc] .e-title { color:#f4f4f8 !important; }
[data-ogsc] .e-ink { color:#d0d1dc !important; }
[data-ogsc] .e-muted { color:#9798ad !important; }
[data-ogsc] .e-accent { color:#b69cff !important; }
[data-ogsb] .e-page { background:#0b0b17 !important; }
[data-ogsb] .e-card { background:#15152a !important; }
[data-ogsb] .e-panel { background:#1d1d36 !important; }
@media only screen and (max-width:620px) {
  .e-wrap { padding:0 !important; }
  .e-card, .e-head, .e-head img { border-radius:0 !important; }
  .e-body { padding:34px 30px 30px !important; }
  .e-foot { padding:24px 30px 32px !important; }
  .e-chipwrap { padding:24px 18px 0 !important; }
  .e-h1 { font-size:27px !important; }
  .e-col { display:block !important; width:100% !important; padding:0 0 24px 0 !important; }
  .e-btn { width:100% !important; }
  .e-btn a { display:block !important; }
}
a { color:${C.purple}; }
`;

function headerHtml(brand: LayoutBrand): string {
  if (brand.kind === "prevai") {
    return `<tr><td class="e-head" bgcolor="${C.navy}" style="${fixedBg(C.navy)}border-radius:18px 18px 0 0;font-size:0;line-height:0;">
<a href="${esc(MARKET.siteUrl)}" target="_blank"><img src="${asset("header-v2.png")}" width="600" alt="${esc(MARKET.brand)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:18px 18px 0 0;color:#ffffff;font-family:${FONT};font-size:20px;font-weight:700;line-height:72px;text-indent:48px;background:${C.navy};" /></a>
</td></tr>`;
  }
  // Company: its logo on a white chip that dark mode cannot invert (any logo
  // reads on white — transparent PNGs with dark text would vanish on dark).
  const logo = emailLogoSrc(brand.logoUrl);
  const inner = logo
    ? `<img src="${logo}" alt="${esc(brand.name)}" height="44" style="display:block;height:44px;width:auto;max-width:220px;border:0;" />`
    : `<span style="font-family:${FONT};font-size:19px;font-weight:700;color:${C.navy};letter-spacing:-0.2px;">${esc(brand.name)}</span>`;
  return `<tr><td class="e-chipwrap e-head" bgcolor="#ffffff" style="padding:30px 36px 0;background:#ffffff;border-radius:18px 18px 0 0;">
<table ${TABLE}><tr><td bgcolor="#ffffff" style="${fixedBg("#ffffff")}padding:8px 12px;border-radius:10px;">${inner}</td></tr></table>
</td></tr>`;
}

export function layout(params: LayoutParams): string {
  const brand = params.brand ?? { kind: "prevai" };
  const pre = params.preheader ?? params.lead ?? "";
  const year = new Date().getFullYear();
  const site = MARKET.siteUrl;

  const heading = params.heading
    ? `<h1 class="e-title e-h1" style="margin:0 0 16px;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-0.6px;color:${C.navy};">${esc(params.heading)}</h1>`
    : "";
  const lead = params.lead ? `<p class="e-ink" style="margin:0 0 22px;font-size:17.5px;line-height:1.6;color:${C.ink};">${esc(params.lead)}</p>` : "";

  const link = (href: string, label: string) => `<a href="${href}" style="color:${C.muted};text-decoration:none;font-weight:600;">${label}</a>`;
  const prevaiLinks = params.hidePrevaiLinks
    ? ""
    : `<p style="margin:0 0 14px;">${link(`${site}/dashboard`, "Dashboard")}&nbsp;&nbsp;&nbsp;${link(`${site}/blog`, "Guide")}&nbsp;&nbsp;&nbsp;${link(`mailto:${MARKET.supportEmail}`, "Supporto")}</p>`;
  const unsubscribe = params.unsubscribeUrl
    ? `<p style="margin:12px 0 0;"><a href="${esc(params.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">Annulla l'iscrizione</a></p>`
    : "";
  const signature =
    brand.kind === "company"
      ? `<p style="margin:14px 0 0;"><a href="${site}" style="text-decoration:none;color:${C.muted};"><img src="${asset("badge.png")}" width="16" height="16" alt="" style="vertical-align:-3px;border:0;border-radius:4px;" />&nbsp; Inviato con ${MARKET.brand}</a></p>`
      : `<p style="margin:14px 0 0;">&copy; ${year} ${MARKET.brand} &nbsp;·&nbsp; <a href="${site}" style="color:${C.muted};text-decoration:none;">${MARKET.domain}</a></p>`;

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
<table ${TABLE} width="100%" class="e-page" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" class="e-wrap" style="padding:40px 16px;">
<table ${TABLE} width="600" style="width:100%;max-width:600px;font-family:${FONT};">
<tr><td>
<table ${TABLE} width="100%" class="e-card" bgcolor="${C.card}" style="background:${C.card};border-radius:18px;">
${headerHtml(brand)}
<tr><td class="e-body" style="padding:${brand.kind === "company" ? "28px" : "44px"} 48px 40px;font-family:${FONT};text-align:left;">
${heading}${lead}${params.bodyHtml}
</td></tr>
</table>
</td></tr>
<tr><td class="e-foot" style="padding:28px 48px 8px;font-family:${FONT};font-size:12.5px;line-height:1.65;color:${C.muted};text-align:left;">
${prevaiLinks}${params.footerHtml ? `<p style="margin:0;">${params.footerHtml}</p>` : ""}${signature}${unsubscribe}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

