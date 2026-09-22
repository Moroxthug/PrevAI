import type { ContractDocument, ContractVariables, ContractSigner, ContractEvent } from "@workspace/db";
import { paymentTermAmount } from "@workspace/db";
import { MARKET, fmtEur, fmtDateLong, fmtDateTime, fmtIsoDateLong, type Lang } from "@workspace/config";
import { taxLabel } from "../invoices/render.js";

// ── Parser markdown-lite (condiviso da renderer HTML e PDF) ─────────────────
// Supporta: paragrafi separati da riga vuota, elenchi "- ", **grassetto**,
// *corsivo*. Volutamente minimale: il testo contrattuale deve restare prevedibile.

export type Run = { text: string; bold?: boolean; italic?: boolean };
export type Block = { type: "p"; runs: Run[] } | { type: "ul"; items: Run[][] };

export function parseRuns(text: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) runs.push({ text: tok.slice(2, -2), bold: true });
    else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const chunks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
    let i = 0;
    while (i < lines.length) {
      if (/^\s*[-•]\s+/.test(lines[i])) {
        const items: Run[][] = [];
        while (i < lines.length && /^\s*[-•]\s+/.test(lines[i])) {
          items.push(parseRuns(lines[i].replace(/^\s*[-•]\s+/, "")));
          i++;
        }
        blocks.push({ type: "ul", items });
      } else {
        const para: string[] = [];
        while (i < lines.length && !/^\s*[-•]\s+/.test(lines[i])) {
          para.push(lines[i].trim());
          i++;
        }
        blocks.push({ type: "p", runs: parseRuns(para.join(" ")) });
      }
    }
  }
  return blocks;
}

// ── Formattazione ────────────────────────────────────────────────────────────

export function fmtMoney(n: number, _lang?: Lang): string {
  return fmtEur(n);
}

export function fmtDate(d: Date | string | null | undefined, _lang?: Lang, withTime = false): string {
  if (!d) return "—";
  if (typeof d === "string" && d.length === 10) return fmtIsoDateLong(d);
  return withTime ? fmtDateTime(d) : fmtDateLong(d);
}

export const T = {
  contractor: "Appaltatore",
  customer: "Committente",
  siteAddress: "Indirizzo del cantiere",
  project: "Oggetto",
  contractNo: "Contratto n.",
  quoteNo: "Sulla base del preventivo",
  date: "Data",
  description: "Descrizione",
  amount: "Importo",
  discount: "Sconto",
  subtotal: "Imponibile (IVA esclusa)",
  total: "Corrispettivo (IVA inclusa)",
  payment: "Rata",
  due: "Scadenza",
  dueOnSigning: "Alla firma",
  dueOnCompletion: "A fine lavori",
  dueMilestone: "Al raggiungimento della fase",
  dueHoldback: "Svincolo ritenuta a garanzia",
  netDays: "{n} giorni data fattura",
  bn: "P. IVA",
  licence: "N° REA / albo",
  email: "Email",
  phone: "Tel.",
  signedBy: "Firmato da",
  signedOn: "il",
  notYetSigned: "Non ancora firmato",
  auditTitle: "Certificato di firma elettronica",
  auditIntro: `Il presente certificato registra la sottoscrizione elettronica del contratto che precede. Le firme sono state raccolte tramite ${MARKET.brand} con verifica dell'indirizzo email (firma elettronica ai sensi del Regolamento eIDAS). L'integrità del documento può essere verificata confrontando le impronte SHA-256 riportate sotto con quelle dei file PDF.`,
  event: "Evento",
  when: "Data e ora (Europe/Rome)",
  who: "Parte",
  ipUa: "IP / dispositivo",
  unsignedHash: "Impronta del documento inviato",
  signedHash: "Impronta del documento firmato",
  draft: "BOZZA — NON ANCORA FIRMATO",
  page: "Pagina",
  signatureTyped: "Firma digitata",
} satisfies Record<string, string>;

export function tr(key: keyof typeof T, _lang?: Lang): string {
  return T[key];
}

export function dueLabel(trigger: string, dueDays: number, _lang?: Lang): string {
  const base =
    trigger === "on_signing" ? tr("dueOnSigning")
    : trigger === "on_completion" ? tr("dueOnCompletion")
    : trigger === "holdback_release" ? tr("dueHoldback")
    : tr("dueMilestone");
  return dueDays > 0 ? `${base}, ${tr("netDays").replace("{n}", String(dueDays))}` : base;
}

export const EVENT_LABELS: Record<string, string> = {
  created: "Contratto redatto",
  edited: "Contratto modificato",
  contractor_signed: "Firmato dall'appaltatore",
  sent: "Inviato al committente per la firma",
  viewed: "Aperto dal committente",
  otp_sent: "Codice di verifica inviato via email",
  otp_verified: "Email verificata",
  signed: "Firmato dal committente",
  completed: "Tutte le parti hanno firmato — contratto concluso",
  declined: "Rifiutato dal committente",
  voided: "Annullato dall'appaltatore",
  expired: "Link di firma scaduto",
  reminder_sent: "Promemoria inviato",
};

// ── HTML renderer (preview + public signing page + email body) ───────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function runsHtml(runs: Run[]): string {
  return runs
    .map((r) => {
      let t = esc(r.text);
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      return t;
    })
    .join("");
}

export function bodyHtml(body: string): string {
  return parseBlocks(body)
    .map((b) => (b.type === "p" ? `<p>${runsHtml(b.runs)}</p>` : `<ul>${b.items.map((i) => `<li>${runsHtml(i)}</li>`).join("")}</ul>`))
    .join("\n");
}

function partyHtml(label: string, p: ContractVariables["contractor"], lang: Lang): string {
  const lines = [
    p.address, [p.city, p.province, p.postalCode].filter(Boolean).join(", "),
    p.email ? `${tr("email", lang)}: ${p.email}` : "",
    p.phone ? `${tr("phone", lang)}: ${p.phone}` : "",
    p.businessNumber ? `${tr("bn", lang)}: ${p.businessNumber}` : "",
    p.reaNumber ? `${tr("licence", lang)}: ${p.reaNumber}` : "",
  ].filter(Boolean);
  return `<div class="party"><div class="party-label">${esc(label)}</div><div class="party-name">${esc(p.name)}</div>${lines.map((l) => `<div class="party-line">${esc(l!)}</div>`).join("")}</div>`;
}

export function partiesHtml(v: ContractVariables, lang: Lang): string {
  return `<div class="parties">${partyHtml(tr("contractor", lang), v.contractor, lang)}${partyHtml(tr("customer", lang), v.customer, lang)}</div>
<table class="kv"><tr><th>${tr("siteAddress", lang)}</th><td>${esc(v.siteAddress)}</td></tr><tr><th>${tr("project", lang)}</th><td>${esc(v.projectTitle)}</td></tr><tr><th>${tr("quoteNo", lang)}</th><td>${esc(v.quoteNumber)}</td></tr></table>`;
}

export function priceTableHtml(v: ContractVariables, lang: Lang): string {
  const rows = v.priceLines.map((l) => `<tr><td>${esc(l.label)}</td><td class="num">${fmtMoney(l.amount, lang)}</td></tr>`).join("");
  const discount = v.discount ? `<tr><td>${tr("discount", lang)} (${v.discount.percent} %)</td><td class="num">− ${fmtMoney(v.discount.amount, lang)}</td></tr>` : "";
  const taxes = v.taxLines.map((t) => `<tr><td>${esc(taxLabel(t.label, lang))} (${t.rate} %)</td><td class="num">${fmtMoney(t.amount, lang)}</td></tr>`).join("");
  return `<div class="table-wrap"><table class="grid"><thead><tr><th>${tr("description", lang)}</th><th class="num">${tr("amount", lang)}</th></tr></thead><tbody>${rows}${discount}<tr class="sub"><td>${tr("subtotal", lang)}</td><td class="num">${fmtMoney(v.subtotal, lang)}</td></tr>${taxes}<tr class="total"><td>${tr("total", lang)}</td><td class="num">${fmtMoney(v.total, lang)}</td></tr></tbody></table></div>`;
}

export function paymentTableHtml(v: ContractVariables, lang: Lang): string {
  const rows = v.paymentSchedule.terms
    .map((t, i) => `<tr><td>${i + 1}. ${esc(t.label)}</td><td>${esc(dueLabel(t.trigger, t.dueDays, lang))}</td><td class="num">${t.amountType === "percent" ? `${t.value} %` : ""}</td><td class="num">${fmtMoney(paymentTermAmount(t, v.total), lang)}</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="grid"><thead><tr><th>${tr("payment", lang)}</th><th>${tr("due", lang)}</th><th class="num">%</th><th class="num">${tr("amount", lang)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function signaturesHtml(v: ContractVariables, signers: ContractSigner[], lang: Lang): string {
  const block = (role: "contractor" | "customer") => {
    const s = signers.find((x) => x.role === role);
    const party = role === "contractor" ? v.contractor : v.customer;
    let sig = `<div class="sig-empty">${tr("notYetSigned", lang)}</div>`;
    if (s?.status === "signed") {
      sig = s.signatureType === "drawn" && s.signatureData?.startsWith("data:image")
        ? `<img class="sig-img" src="${s.signatureData}" alt="signature" />`
        : `<div class="sig-typed">${esc(s.signatureData || s.name)}</div>`;
      sig += `<div class="sig-meta">${tr("signedBy", lang)} ${esc(s.name)} · ${tr("signedOn", lang)} ${fmtDate(s.signedAt, lang, true)}</div>`;
    }
    return `<div class="sig-block"><div class="party-label">${tr(role, lang)}</div><div class="party-name">${esc(party.name)}</div>${sig}</div>`;
  };
  return `<div class="signatures">${block("contractor")}${block("customer")}</div>`;
}

export const CONTRACT_CSS = `
.contract { font-family: Georgia, "Times New Roman", serif; color:#111827; line-height:1.55; font-size:14px; }
.contract h1 { font-family: system-ui,-apple-system,sans-serif; font-size:22px; letter-spacing:-0.01em; margin:0 0 4px; }
.contract .meta { font-family: system-ui,-apple-system,sans-serif; color:#6b7280; font-size:12px; margin-bottom:24px; }
.contract h2 { font-family: system-ui,-apple-system,sans-serif; font-size:14px; text-transform:uppercase; letter-spacing:0.04em; color:#374151; margin:28px 0 8px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }
.contract p { margin:0 0 10px; }
.contract ul { margin:0 0 10px 20px; padding:0; }
.contract li { margin:0 0 4px; }
.contract .parties { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:12px; }
.contract .party { border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
.contract .party-label { font-family: system-ui,sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#6b7280; }
.contract .party-name { font-weight:700; margin:2px 0 4px; }
.contract .party-line { font-size:12.5px; color:#374151; overflow-wrap:anywhere; }
.contract table.kv { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:8px; }
.contract table.kv th { text-align:left; color:#6b7280; font-weight:600; width:30%; padding:4px 0; font-family: system-ui,sans-serif; font-size:12px; }
.contract table.kv td { padding:4px 0; }
.contract table.grid { width:100%; border-collapse:collapse; font-size:13px; margin:8px 0 12px; }
.contract table.grid th { text-align:left; font-family: system-ui,sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:#6b7280; border-bottom:1px solid #d1d5db; padding:6px 8px; }
.contract table.grid td { padding:6px 8px; border-bottom:1px solid #f3f4f6; vertical-align:top; }
.contract table.grid .num { text-align:right; white-space:nowrap; }
.contract table.grid tr.sub td { font-weight:600; border-top:1px solid #d1d5db; }
.contract table.grid tr.total td { font-weight:700; font-size:14px; background:#f9fafb; }
.contract .table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.contract .signatures { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:16px; }
@media (max-width: 480px) {
  .contract .parties { grid-template-columns:1fr; }
  .contract .signatures { grid-template-columns:1fr; gap:16px; }
  .contract table.grid th, .contract table.grid td { padding:6px 4px; font-size:12px; }
}
.contract .sig-block { border-top:1px solid #9ca3af; padding-top:8px; min-height:110px; }
.contract .sig-empty { color:#6b7280; font-style:italic; margin-top:28px; font-size:12px; }
.contract .sig-img { max-height:70px; max-width:240px; display:block; margin:6px 0; }
.contract .sig-typed { font-family: "Brush Script MT", "Segoe Script", cursive; font-size:28px; margin:8px 0; }
.contract .sig-meta { font-family: system-ui,sans-serif; font-size:11px; color:#6b7280; }
.contract .draft-banner { font-family: system-ui,sans-serif; background:#fef3c7; color:#92400e; border:1px solid #fde68a; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:600; margin-bottom:16px; text-align:center; }
`;

export function renderContractHtml(params: {
  document: ContractDocument;
  variables: ContractVariables;
  signers: ContractSigner[];
  status: string;
  createdAt: Date;
}): string {
  const { document: doc, variables: v, signers } = params;
  const lang = doc.language;
  const parts: string[] = [];
  if (params.status === "draft") parts.push(`<div class="draft-banner">${tr("draft", lang)}</div>`);
  parts.push(`<h1>${esc(doc.title)}</h1><div class="meta">${tr("contractNo", lang)} ${esc(v.contractNumber)} · ${tr("date", lang)}: ${fmtDate(params.createdAt, lang)}</div>`);
  for (const s of doc.sections) {
    parts.push(`<h2>${esc(s.heading)}</h2>`);
    if (s.key === "parties") parts.push(partiesHtml(v, lang));
    else if (s.key === "price") parts.push(bodyHtml(s.body) + priceTableHtml(v, lang));
    else if (s.key === "payment") parts.push(bodyHtml(s.body) + paymentTableHtml(v, lang));
    else if (s.key === "signatures") parts.push(bodyHtml(s.body) + signaturesHtml(v, signers, lang));
    else parts.push(bodyHtml(s.body));
  }
  return `<div class="contract">${parts.join("\n")}</div>`;
}

export function eventLabel(e: ContractEvent, _lang?: Lang): string {
  return EVENT_LABELS[e.type] ?? e.type;
}
