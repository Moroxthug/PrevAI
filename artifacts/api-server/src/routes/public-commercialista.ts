import { Router } from "express";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { apriCondivisione, chiusuraDi, guida, pacchettoAnno, serializzaChiusura } from "../primanota/chiusura.js";
import { primaNota, primaNotaCsv } from "../primanota/service.js";
import { buildPacchettoPdf } from "../primanota/pdf.js";

// ── A-4: il link del commercialista (/commercialista/:token) ─────────────────
// Sola lettura, per un anno, finché non scade o il titolare non lo revoca.
// Ogni apertura finisce nel registro degli accessi, che il titolare vede.
//
// Il token è hashato prima della ricerca (come per fatture e preventivi
// pubblici), la risposta a un token sbagliato è sempre la stessa 404, e le
// intestazioni tengono il pacchetto fuori da cache condivise e motori di
// ricerca: sono i conti di un'impresa.

const router = Router();
const viewLimiter = ipRateLimiter({ windowMs: 60_000, max: 30, message: "Troppe richieste" });

function riservato(res: import("express").Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function meta(req: import("express").Request) {
  return { ip: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

router.get("/commercialista/:token", viewLimiter, async (req, res) => {
  riservato(res);
  const share = await apriCondivisione(req.params.token as string, "pacchetto", meta(req));
  if (!share) {
    res.status(404).json({ error: "not_found", message: "Link non valido, scaduto o revocato." });
    return;
  }
  const [pacchetto, nota, chiusura] = await Promise.all([pacchettoAnno(share.userId, share.anno), primaNota(share.userId, share.anno), chiusuraDi(share.userId, share.anno)]);
  res.json({
    destinatario: share.destinatario,
    scadeAt: share.scadeAt.toISOString(),
    pacchetto,
    voci: nota.voci,
    chiusura: serializzaChiusura(chiusura),
    guida: guida(share.anno),
  });
});

router.get("/commercialista/:token/prima-nota.csv", viewLimiter, async (req, res) => {
  riservato(res);
  const share = await apriCondivisione(req.params.token as string, "prima-nota.csv", meta(req));
  if (!share) {
    res.status(404).json({ error: "not_found", message: "Link non valido, scaduto o revocato." });
    return;
  }
  const { voci } = await primaNota(share.userId, share.anno);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="prima-nota-${share.anno}.csv"`);
  res.send(primaNotaCsv(voci));
});

router.get("/commercialista/:token/pacchetto.pdf", viewLimiter, async (req, res) => {
  riservato(res);
  const share = await apriCondivisione(req.params.token as string, "pacchetto.pdf", meta(req));
  if (!share) {
    res.status(404).json({ error: "not_found", message: "Link non valido, scaduto o revocato." });
    return;
  }
  const { buffer, filename } = await buildPacchettoPdf(await pacchettoAnno(share.userId, share.anno), await chiusuraDi(share.userId, share.anno));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

export default router;
