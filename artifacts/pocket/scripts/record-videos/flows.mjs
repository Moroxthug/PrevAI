// POCKET-7 (docs/VIDEO.md): the videos as scripts over the Expo web app (demo company "Edilizia Rossi", seeded by seed.mjs).
import { readFileSync } from "node:fs";
// Chapters: r.chapter(1..3) marks where chapters 2..4 start (chapter 1 starts at 0).
const BASE = "http://localhost:8104";
const go = async (r, path, ms = 7000) => { await r.page.goto(BASE + path, { waitUntil: "domcontentloaded" }); await r.wait(ms); };
const vis = (l) => l.filter({ visible: true }).first();
const seedIds = () => JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf8"));
/** Staging has no email service: the send calls answer as the real server does when it works. */
const fakeSend = async (page) => {
  await page.route("**/api/quotes/*/send-pdf-email", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }));
  await page.route("**/api/invoices/*/send", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
};
const dump = async (p) => {
  console.log("URL", p.url());
  console.log((await p.evaluate(() => document.body.innerText)).slice(0, 2500));
  console.log("LABELS", (await p.evaluate(() => [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter(Boolean))).join(" | "));
};

export const FLOWS = {
  quotes: {
    posterAt: 26,
    async setup(r) { await fakeSend(r.page); await go(r, "/quotes"); },
    async run(r) {
      const p = r.page;
      await r.wait(1500);
      await r.tap(p.getByRole("button", { name: "Nuovo preventivo" }));
      await r.wait(900);
      r.chapter(1);
      const box = p.getByPlaceholder(/Descrivi il lavoro/);
      await r.cam(vis(box));
      await r.type(box, "Bagno di 6 m²: tolgo piastrelle e sanitari, nuovo impianto idraulico, piastrelle a pavimento e parete, doccia filo pavimento e sanitari sospesi.", { delay: 26 });
      await r.wait(700);
      await r.tap(p.getByLabel(/^Luca Ferrari, Via/));
      await r.tap(p.getByLabel("Scrivi il mio preventivo"));
      r.speed(4);
      const ready = vis(p.getByText("Il tuo preventivo è pronto"));
      await ready.waitFor({ timeout: 120000 });
      await vis(p.getByText("Apri il preventivo")).waitFor({ timeout: 60000 });
      r.speed(1);
      await r.cam(ready, { dy: 80 });
      await r.wait(2200);
      await r.tap(p.getByText("Apri il preventivo"));
      await r.wait(2500);
      r.chapter(2);
      await r.cam(vis(p.getByText("Voci")), { dy: 90 });
      await r.wait(1800);
      for (let i = 0; i < 4; i++) { await r.scroll(260); await r.cam({ x: 0, y: 300 }); await r.wait(1100); }
      await r.cam(vis(p.getByText("Totale", { exact: true })), { dy: -20 });
      await r.wait(2200);
      r.chapter(3);
      const send = vis(p.getByRole("button", { name: /^Invia / }));
      await r.cam(send, { dy: -60 });
      await r.wait(1600);
      await r.tap(send);
      await r.wait(4000);
      await r.cam({ x: 0, y: 0 });
      await r.wait(2500);
      if (r.dry) await dump(p);
    },
  },
};

FLOWS.overview = {
  posterAt: 3,
  async setup(r) { await go(r, "/home", 9000); },
  async run(r) {
    const p = r.page;
    await r.wait(2500);
    await r.cam(vis(p.getByText("Serve a te")), { dy: 90 });
    await r.wait(3500);
    await r.scroll(420); await r.cam({ x: 0, y: 330 }); await r.wait(3500);
    r.chapter(1);
    await r.tap(p.getByLabel("Principale").getByLabel("Preventivi", { exact: true }), { follow: false });
    await r.cam({ x: 0, y: 0 }); await r.wait(3000);
    await r.scroll(380); await r.cam({ x: 0, y: 330 }); await r.wait(3500);
    r.chapter(2);
    await r.tap(p.getByLabel("Principale").getByLabel("Cantieri", { exact: true }), { follow: false });
    await r.cam({ x: 0, y: 0 }); await r.wait(2500);
    await r.tap(p.getByText(/facciata condominiale/));
    await r.wait(1500);
    await r.tap(p.getByText("Apri il cantiere"));
    await r.wait(2500); await r.cam({ x: 0, y: 0 }); await r.wait(2500);
    await r.scroll(420); await r.cam({ x: 0, y: 330 }); await r.wait(3000);
    r.chapter(3);
    r.speed(3);
    await go(r, "/invoices", 5000);
    r.speed(1);
    await r.cam({ x: 0, y: 0 }); await r.wait(3000);
    await r.scroll(420); await r.cam({ x: 0, y: 330 }); await r.wait(3500);
    if (r.dry) await dump(p);
  },
};

FLOWS.bonifico = {
  posterAt: 4,
  async setup(r) { await go(r, "/home", 9000); },
  async run(r) {
    const p = r.page;
    const card = vis(p.getByText(/^Bonifico di Condominio/));
    await r.wait(1500);
    await r.cam(card, { dy: 0 });
    await r.wait(4500);
    r.chapter(1);
    await r.cam(vis(p.getByText("Controlla la banca")), { dy: -40 });
    await r.wait(4500);
    await r.tap(p.getByRole("button", { name: "Conferma" }), { before: 1200 });
    await r.wait(2500);
    r.chapter(2);
    const said = vis(p.getByText(/Il cliente dice di aver mandato/));
    await r.cam(said, { dy: 20 });
    await r.wait(3500);
    await r.tap(p.getByText("Confermo che è arrivato"), { before: 1200 });
    await r.wait(2000);
    await r.cam(vis(p.getByLabel("Bonifico", { exact: true })), { dy: -60 });
    await r.wait(2500);
    await r.tap(p.getByLabel(/^Salva il pagamento/), { before: 1200 });
    await r.wait(3000);
    r.chapter(3);
    await r.cam({ x: 0, y: 0 }); await r.wait(3500);
    await r.scroll(560); await r.cam({ x: 0, y: 260 });
    await r.wait(4000);
    if (r.dry) await dump(p);
  },
};

FLOWS.jobs = {
  posterAt: 20,
  async setup(r) { await go(r, `/quote?id=${seedIds().bagno}`); },
  async run(r) {
    const p = r.page;
    await r.wait(3000);
    await r.scroll(1400); await r.cam({ x: 0, y: 450 });
    await r.wait(2000);
    r.chapter(1);
    await r.tap(p.getByText("Apri il cantiere"));
    r.speed(4);
    await vis(p.getByText(/^Fasi$/)).waitFor({ timeout: 90000 });
    await r.wait(1500);
    r.speed(1);
    await r.cam({ x: 0, y: 0 }); await r.wait(2500);
    r.chapter(2);
    await r.cam(vis(p.getByText(/^Fasi$/)), { dy: 100 });
    await r.wait(2500);
    await r.scroll(300); await r.cam({ x: 0, y: 300 }); await r.wait(2500);
    await r.scroll(500); await r.cam({ x: 0, y: 300 }); await r.wait(3000);
    r.chapter(3);
    await r.tap(p.getByText("Va bene, avvia il cantiere"), { before: 1000 });
    await r.wait(3500);
    await r.cam({ x: 0, y: 0 }); await r.wait(3000);
    await r.scroll(450); await r.cam({ x: 0, y: 300 }); await r.wait(3500);
    if (r.dry) await dump(p);
  },
};
