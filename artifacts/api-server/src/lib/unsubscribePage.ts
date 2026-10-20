import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * POCKET-5 (riga 62, QuoteAI 125.10, 128.9 e 128.10): la pagina dove arriva un cliente da un link di disiscrizione, dalla schermata «fatto»
 * del disegno Unsubscribe (docs/pocket-design/Unsubscribe.dc.html): l'impresa in alto, la spunta, «Basta … per email», l'etichetta
 * «Disiscritto», la nota che le fatture arrivano comunque, e «Ci hai ripensato? Riiscriviti» (un POST, così un antivirus della posta che
 * apre il link non può annullarla). La disiscrizione avviene sul GET, subito (GDPR art. 21, art. 130 Codice Privacy).
 * Prima di POCKET-5 queste pagine erano in inglese. Chiaro e notte seguono il telefono.
 */

export type UnsubscribeKind = "reminders" | "followups" | "marketing";

const T = {
  changed: "Ci hai ripensato?",
  resub: "Riiscriviti",
  again: "Ti sei iscritto di nuovo.",
  from: "Da",
  unsubscribed: "Disiscritto",
  stillTitle: "Le fatture arrivano comunque.",
  still: "Anche le ricevute e i documenti da firmare, finché abbiamo lavori in corso con te.",
  sentWith: "Inviato con PrevAI",
  invalid: "Questo link di disiscrizione non è più valido.",
  missing: "Manca il link di disiscrizione.",
  error: "Qualcosa è andato storto. Riprova più tardi.",
  title: { reminders: "Basta solleciti per email", followups: "Basta messaggi di follow-up per email", marketing: "Basta richieste di recensione e foto per email" } as Record<UnsubscribeKind, string>,
  sub: { reminders: "Non riceverai più solleciti per questo preventivo.", followups: "Non riceverai più messaggi di follow-up da noi.", marketing: "Non riceverai più richieste di recensione né foto condivise da noi." } as Record<UnsubscribeKind, string>,
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function companyNameForUser(userId: string): Promise<string> {
  try {
    const [p] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    return p?.companyName?.trim() ?? "";
  } catch {
    return "";
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] ?? "" : "")).toUpperCase();
}

const CSS = `
:root{color-scheme:light dark;--ground:#f2f2f8;--card:#ffffff;--sunk:#e8e7f2;--ink:#141416;--inv:#141416;--on-inv:#ffffff;--t2:#3c3c43;--muted:#66666e;--faint:#8a8a90;--line:#e8e7f1;--ring:rgba(20,20,22,.05);--ok:#1f7a45;--ok-soft:#e8f3ee;--fade:linear-gradient(0deg,#ece6f8 0,#f0edf9 220px,#f3f5f8 560px)}
@media (prefers-color-scheme:dark){:root{--ground:#0c0c0e;--card:#18181b;--sunk:#26262b;--ink:#f3f2ef;--inv:#f3f2ef;--on-inv:#141416;--t2:#d0cfd5;--muted:#a09fa7;--faint:#7c7b83;--line:rgba(255,255,255,.07);--ring:rgba(255,255,255,.07);--ok:#62d498;--ok-soft:rgba(52,195,117,.16);--fade:none}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--fade),var(--ground);background-attachment:fixed;color:var(--ink);font-family:-apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.4;letter-spacing:-0.01em;-webkit-font-smoothing:antialiased}
main{max-width:520px;margin:0 auto;padding-bottom:40px}
header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.mark{width:40px;height:40px;border-radius:12px;background:var(--inv);color:var(--on-inv);display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:600;letter-spacing:-0.02em;flex-shrink:0}
.t{display:flex;flex-direction:column;gap:1px;min-width:0}.t span{font-size:12.5px;color:var(--muted)}.t b{font-size:15px;font-weight:600;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card{margin:40px 16px 0;padding:28px 20px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;background:var(--card);border-radius:22px;box-shadow:0 0 0 1px var(--ring)}
.disc{width:64px;height:64px;border-radius:50%;background:var(--ok-soft);display:flex;align-items:center;justify-content:center;color:var(--ok)}
h1{margin:16px 0 0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.035em;text-wrap:balance}
.sub{margin:8px 0 0;font-size:13.5px;color:var(--muted);line-height:1.5;max-width:290px}
.st{display:inline-flex;align-items:center;gap:5px;height:24px;margin-top:14px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;background:var(--sunk);color:var(--muted)}
.note{width:100%;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);text-align:left;font-size:13.5px;color:var(--t2);line-height:1.45}.note b{font-weight:600}
.msg{margin:40px 16px 0;padding:20px;background:var(--card);border-radius:22px;box-shadow:0 0 0 1px var(--ring);text-align:center;font-size:14.5px;color:var(--t2)}
.again{width:100%;margin-top:16px;padding-top:16px;border-top:1px solid var(--line);font-size:13.5px;color:var(--muted)}.again button{margin-top:10px;height:44px;padding:0 18px;border:0;border-radius:13px;background:var(--sunk);color:var(--ink);font:inherit;font-size:14.5px;font-weight:500;cursor:pointer}
.foot{margin:24px 16px 0;text-align:center;font-size:12.5px;color:var(--faint)}
`;

function shell(company: string, body: string): string {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>${escapeHtml(company ? `${T.unsubscribed} · ${company}` : T.unsubscribed)}</title><style>${CSS}</style></head><body><main>${
    company ? `<header><span class="mark" aria-hidden="true">${escapeHtml(initials(company))}</span><span class="t"><span>${escapeHtml(T.from)}</span><b>${escapeHtml(company)}</b></span></header>` : ""
  }${body}<p class="foot">${escapeHtml(T.sentWith)}</p></main></body></html>`;
}

const CHECK = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

/** La pagina «sei disiscritto», con «Riiscriviti» quando la rotta lo permette. */
export function unsubscribeDonePage(opts: { kind: UnsubscribeKind; company?: string; resubscribe?: { action: string } }): string {
  const off = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m6 18 12-12"/></svg>`;
  return shell(opts.company ?? "", `<div class="card" role="status"><span class="disc">${CHECK}</span><h1>${escapeHtml(T.title[opts.kind])}</h1><p class="sub">${escapeHtml(T.sub[opts.kind])}</p><span class="st">${off}${escapeHtml(T.unsubscribed)}</span><div class="note"><b>${escapeHtml(T.stillTitle)}</b> ${escapeHtml(T.still)}</div>${opts.resubscribe ? `<form class="again" method="post" action="${escapeHtml(opts.resubscribe.action)}">${escapeHtml(T.changed)}<br><button type="submit">${escapeHtml(T.resub)}</button></form>` : ""}</div>`);
}

/** La pagina dopo «Riiscriviti». */
export function resubscribedPage(opts: { company?: string }): string {
  return shell(opts.company ?? "", `<div class="card" role="status"><span class="disc">${CHECK}</span><h1>${escapeHtml(T.again)}</h1></div>`);
}

/** Un rifiuto semplice (link mancante o vecchio, o un errore) nella stessa pagina. */
export function unsubscribeMessagePage(which: "invalid" | "missing" | "error"): string {
  return shell("", `<p class="msg" role="alert">${escapeHtml(T[which])}</p>`);
}
