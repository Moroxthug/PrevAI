import type { PendingQuoteData } from "./generateQuoteFromText.js";
import { logger } from "./logger.js";
import { ObjectStorageService } from "./objectStorage.js";

const objectStorage = new ObjectStorageService();

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

async function fetchLogoDataUri(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    let response: Response | null = null;
    if (logoUrl.startsWith("/api/storage/public-objects/")) {
      const subPath = logoUrl.replace(/^\/api\/storage\/public-objects\//, "");
      const file = await objectStorage.searchPublicObject(subPath).catch(() => null);
      if (!file) return null;
      response = await objectStorage.downloadObject(file, { isPublic: true, cacheTtlSec: 3600 }).catch(() => null);
    } else if (logoUrl.startsWith("/objects/")) {
      const subPath = logoUrl.replace(/^\/objects\//, "");
      response = await objectStorage.downloadPrivateObject(subPath).catch(() => null);
    }
    if (!response?.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    const ct = response.headers.get("content-type") ?? "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildQuoteHtml(data: PendingQuoteData, logoDataUri: string | null): string {
  const snap = data.companySnapshot;
  const companyName = snap?.companyName ?? "";
  const companyDetails = [snap?.vatNumber ? `P.IVA ${snap.vatNumber}` : "", snap?.address ?? "", snap?.phone ? `Tel: ${snap.phone}` : "", snap?.email ?? ""]
    .filter(Boolean)
    .join(" · ");

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" style="height:48px;max-width:100px;object-fit:contain;margin-bottom:4px;display:block" alt="logo">`
    : "";

  const dateStr = new Date().toLocaleDateString("it-IT");

  const clientName = data.clientData.nome || "—";
  const clientAddr = data.clientData.indirizzo
    ? `<div class="client-addr">${escHtml(data.clientData.indirizzo)}</div>`
    : "";

  const summaryRows = data.capitoli.map(cap => `
    <tr>
      <td class="td">${escHtml(cap.lettera)}. ${escHtml(cap.titolo)}</td>
      <td class="td td-r td-b">€ ${formatEur(cap.subtotale)}</td>
      <td class="td" style="color:#666;font-style:italic">${escHtml(cap.osservazione ?? "")}</td>
    </tr>`).join("");

  const chaptersDetail = data.capitoli.map(cap => {
    const voceRows = cap.voci.map((v, i) => {
      const bg = i % 2 !== 0 ? "background:#f8f9fb;" : "";
      return `<tr>
        <td class="td td-c" style="${bg}">${i + 1}</td>
        <td class="td" style="${bg}">${escHtml(v.descrizione)}</td>
        <td class="td td-c" style="${bg}">${escHtml(v.um)}</td>
        <td class="td td-c" style="${bg}">${v.quantita}</td>
        <td class="td td-r" style="${bg}">${formatEur(v.prezzoUnitario)}</td>
        <td class="td td-r td-b" style="${bg}">${formatEur(v.totale)}</td>
      </tr>`;
    }).join("");

    return `
      <div class="chap-h">${escHtml(cap.lettera)}. ${escHtml(cap.titolo)}</div>
      <table>
        <thead><tr>
          <th class="th" style="width:22px">#</th>
          <th class="th">Descrizione</th>
          <th class="th th-c" style="width:36px">U.M.</th>
          <th class="th th-c" style="width:36px">Q.tà</th>
          <th class="th th-r" style="width:68px">P.u. (€)</th>
          <th class="th th-r" style="width:68px">Totale (€)</th>
        </tr></thead>
        <tbody>
          ${voceRows}
          <tr class="subtotal-row">
            <td colspan="5" class="td">Subtotale capitolo ${escHtml(cap.lettera)}</td>
            <td class="td td-r">€ ${formatEur(cap.subtotale)}</td>
          </tr>
        </tbody>
      </table>`;
  }).join("");

  const subtotale = Number(data.subtotale);
  const ivaPerc = Number(data.ivaPercentuale);
  const ivaValore = Number(data.ivaValore);
  const totale = Number(data.totale);

  let totalsRows = `
    <tr><td class="tot-r">TOTALE IMPONIBILE</td><td class="tot-v">€ ${formatEur(subtotale)}</td></tr>`;
  if (data.sconto && data.sconto.percentuale > 0) {
    totalsRows += `
    <tr><td class="tot-r">SCONTO (${data.sconto.percentuale}%)</td><td class="tot-v">-€ ${formatEur(subtotale - data.sconto.importoScontato)}</td></tr>
    <tr><td class="tot-r">IMPONIBILE SCONTATO</td><td class="tot-v">€ ${formatEur(data.sconto.importoScontato)}</td></tr>`;
  }
  totalsRows += `
    <tr><td class="tot-r">IVA (${ivaPerc.toFixed(0)}%)</td><td class="tot-v">€ ${formatEur(ivaValore)}</td></tr>
    <tr class="tot-final"><td style="padding:7px 10px;font-size:11px;font-weight:bold">TOTALE + IVA</td><td style="padding:7px 10px;font-size:11px;font-weight:bold;text-align:right">€ ${formatEur(totale)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:Helvetica,Arial,sans-serif; font-size:10px; color:#1a1a2e; background:white; width:794px; padding:36px 40px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:12px; border-bottom:2px solid #1a1a2e; margin-bottom:14px; }
.company-name { font-size:14px; font-weight:bold; color:#1a1a2e; margin-top:4px; }
.company-sub { font-size:8px; color:#555; margin-top:3px; line-height:1.6; }
.quote-ref { text-align:right; padding-top:4px; }
.quote-ref-num { font-size:11px; font-weight:bold; }
.quote-ref-date { font-size:8px; color:#555; margin-top:2px; }
.title1 { text-align:center; font-size:13px; font-weight:bold; text-transform:uppercase; color:#1a1a2e; margin-bottom:3px; }
.title2 { text-align:center; font-size:9px; color:#555; font-style:italic; margin-bottom:14px; }
.client-box { background:#f4f6f9; border:0.5px solid #c5cce0; border-radius:3px; padding:8px 12px; margin-bottom:14px; }
.client-label { font-size:7px; font-weight:bold; color:#888; text-transform:uppercase; letter-spacing:0.5px; }
.client-name { font-size:11px; font-weight:bold; color:#1a1a2e; margin-top:2px; }
.client-addr { font-size:8.5px; color:#555; margin-top:2px; }
.section-h { font-size:8px; font-weight:bold; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
table { width:100%; border-collapse:collapse; margin-bottom:14px; }
.th { background:#1a1a2e; color:white; font-size:8px; font-weight:bold; padding:5px 8px; text-align:left; }
.th-c { text-align:center; }
.th-r { text-align:right; }
.td { font-size:9px; padding:4px 8px; border-bottom:0.5px solid #ddd; color:#1a1a1a; }
.td-c { text-align:center; }
.td-r { text-align:right; }
.td-b { font-weight:bold; }
.subtotal-row td { background:#edf0f5; font-weight:bold; font-size:8.5px; color:#1a1a2e; }
.chap-h { font-size:10.5px; font-weight:bold; color:#1a1a2e; margin:12px 0 5px; }
.totals-wrap { display:flex; justify-content:flex-end; margin-bottom:14px; }
.totals-inner { width:340px; }
.totals-inner table { margin-bottom:0; }
.tot-r { font-size:8.5px; font-weight:bold; color:#333; padding:5px 10px; border-bottom:0.5px solid #dde1ec; }
.tot-v { font-size:9px; font-weight:bold; padding:5px 10px; text-align:right; border-bottom:0.5px solid #dde1ec; }
.tot-final { background:#1a1a2e; color:white; }
.tot-final td { color:white; }
.footer { margin-top:20px; padding-top:8px; border-top:1px solid #eee; display:flex; justify-content:space-between; font-size:7.5px; color:#aaa; }
</style>
</head>
<body>
<div class="header">
  <div>
    ${logoHtml}
    <div class="company-name">${escHtml(companyName)}</div>
    <div class="company-sub">${escHtml(companyDetails)}</div>
  </div>
  <div class="quote-ref">
    <div class="quote-ref-num">${escHtml(data.numeroPreventivoData)}</div>
    <div class="quote-ref-date">Data: ${dateStr}</div>
  </div>
</div>

<div class="title1">${escHtml(data.titoloPreventivoRiga1)}</div>
${data.titoloPreventivoRiga2 ? `<div class="title2">${escHtml(data.titoloPreventivoRiga2)}</div>` : '<div style="margin-bottom:14px"></div>'}

<div class="client-box">
  <div class="client-label">Spett.le Committente</div>
  <div class="client-name">${escHtml(clientName)}</div>
  ${clientAddr}
</div>

<div class="section-h">Quadro Sintetico</div>
<table>
  <thead><tr>
    <th class="th" style="width:50%">Capitolo</th>
    <th class="th th-r" style="width:25%">Importo netto</th>
    <th class="th" style="width:25%">Osservazione</th>
  </tr></thead>
  <tbody>${summaryRows}</tbody>
</table>

<div class="section-h">Computo Metrico Dettagliato</div>
${chaptersDetail}

<div class="totals-wrap">
  <div class="totals-inner">
    <table><tbody>${totalsRows}</tbody></table>
  </div>
</div>

<div class="footer">
  <span>${escHtml(companyName)}</span>
  <span>Documento generato con Prevai</span>
</div>
</body>
</html>`;
}

/**
 * Generates a PNG screenshot of the quote preview.
 * Returns null if Puppeteer is unavailable or fails — caller should degrade gracefully.
 */
export async function generateQuotePreviewImage(data: PendingQuoteData): Promise<Buffer | null> {
  const logoUrl = data.companySnapshot?.logoUrl ?? null;
  const logoDataUri = await fetchLogoDataUri(logoUrl).catch(() => null);
  const html = buildQuoteHtml(data, logoDataUri);

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--single-process",
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1122, deviceScaleFactor: 1.5 });
      await page.setContent(html, { waitUntil: "load", timeout: 30000 });
      const screenshot = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: 794, height: 1122 },
      });
      return Buffer.from(screenshot);
    } finally {
      await browser.close();
    }
  } catch (err) {
    logger.warn({ err }, "Puppeteer screenshot failed — falling back to text-only preview");
    return null;
  }
}
