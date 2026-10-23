// Fictional demo company on STAGING for the POCKET-7 videos (never real customers). Idempotent: drops the demo owner's rows first.
// node seed.mjs → prints the session token to rec/token.txt
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
// playwright-core and pg come from the API server's install (this app has its own flat npm install without them).
const require = createRequire(new URL("../../../api-server/package.json", import.meta.url));
const pg = require("pg");
const DB = "postgresql://postgres@127.0.0.1:5433/prevai_staging?sslmode=disable";
const API = "http://127.0.0.1:5080";
const OWNER = "demo_video_owner";
const c = new pg.Client({ connectionString: DB });
await c.connect();

// Clean up an earlier run: every table with user_id, then the user (cascades sessions).
const { rows: tabs } = await c.query("select table_name from information_schema.columns where table_schema='public' and column_name='user_id' and table_name not in ('auth_user','auth_session','auth_account')");
for (let pass = 0; pass < 4; pass++) for (const t of tabs) { try { await c.query(`delete from "${t.table_name}" where user_id=$1`, [OWNER]); } catch { /* FK order: retry next pass */ } }
await c.query("delete from auth_session where user_id=$1", [OWNER]);
await c.query("delete from auth_user where id=$1", [OWNER]);

await c.query("insert into auth_user (id, name, email, email_verified) values ($1,'Marco Rossi','demo-video@e2e.local',true)", [OWNER]);
const token = randomBytes(32).toString("base64url");
await c.query("insert into auth_session (id, token, user_id, expires_at) values ($1,$2,$3, now() + interval '30 days')", [randomUUID(), token, OWNER]);
await c.query(`insert into business_profiles (user_id, company_name, legal_name, vat_number, codice_fiscale, rea_number, address, city, cap, province, phone, email, iban, subscription_plan, subscription_status, automation_settings)
  values ($1,'Edilizia Rossi','Edilizia Rossi Srl','IT01234567890','01234567890','MI-1234567','Via Melzo 14','Milano','20129','MI','02 1234 5678','info@edilizia-rossi.example','IT60X0542811101000000123456','monthly_elite','active',
  '{"notifyOnQuoteAccepted":true,"autoDraftContract":false,"autoSendInvoices":false,"invoiceAutoSendAfterHours":0,"invoiceReminders":true}')`, [OWNER]);

const call = async (path, body, method = "POST") => {
  const r = await fetch(API + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", origin: "https://localhost" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} ${r.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

const clients = {};
for (const cl of [
  { key: "ferrari", name: "Luca Ferrari", email: "luca.ferrari@example.invalid", phone: "333 123 4567", address: "Via Padova 88", city: "Milano", province: "MI", postalCode: "20132" },
  { key: "bianchi", name: "Giulia Bianchi", email: "giulia.bianchi@example.invalid", phone: "347 765 4321", address: "Corso Lodi 21", city: "Milano", province: "MI", postalCode: "20135" },
  { key: "verdi", name: "Condominio Via Verdi 12", email: "amministrazione@example.invalid", phone: "02 9876 5432", address: "Via Verdi 12", city: "Monza", province: "MB", postalCode: "20900", type: "business" },
  { key: "colombo", name: "Sara Colombo", email: "sara.colombo@example.invalid", phone: "340 111 2233", address: "Via Novara 5", city: "Milano", province: "MI", postalCode: "20147" },
]) {
  const { key, ...body } = cl;
  const out = await call("/api/clients", body);
  clients[key] = { id: out.id ?? out.client?.id, ...body };
}

const schedule = { currency: "EUR", derived: false, holdback: { enabled: false, percent: 10 }, terms: [
  { id: "t1", type: "deposit", label: "Acconto", trigger: "on_signing", amountType: "percent", value: 30, dueDays: 0 },
  { id: "t2", type: "milestone", label: "Avanzamento lavori", trigger: "milestone", amountType: "percent", value: 40, dueDays: 15 },
  { id: "t3", type: "completion", label: "Saldo finale", trigger: "on_completion", amountType: "percent", value: 30, dueDays: 15 },
] };
const voce = (descrizione, quantita, um, prezzoUnitario) => ({ descrizione, quantita, um, prezzoUnitario, totale: Math.round(quantita * prezzoUnitario * 100) / 100 });
const capitolo = (lettera, titolo, voci) => ({ lettera, titolo, voci, subtotale: Math.round(voci.reduce((s, v) => s + v.totale, 0) * 100) / 100 });
async function quote(cl, descr, capitoli, status, daysAgo, iva = 10) {
  const sub = Math.round(capitoli.reduce((s, x) => s + x.subtotale, 0) * 100) / 100;
  const ivaV = Math.round(sub * iva) / 100;
  const client = clients[cl];
  const { rows } = await c.query(`insert into quotes (user_id, client_id, province, client_data, descrizione_generale, capitoli, condizioni_pagamento, payment_schedule, subtotale, iva_percentuale, iva_valore, totale, status, source, created_at, updated_at, sent_at, accepted_at, accepted_by_name)
    values ($1,$2,'MI',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'ai', now() - ($13 || ' days')::interval, now() - ($13 || ' days')::interval, $14, $15, $16) returning id`,
    [OWNER, client.id, JSON.stringify({ nome: client.name, indirizzo: client.address, city: client.city, province: client.province, postalCode: client.postalCode, email: client.email, phone: client.phone }), descr, JSON.stringify(capitoli),
      ["30% acconto alla firma", "40% ad avanzamento lavori", "30% a fine lavori"], JSON.stringify(schedule), String(sub), String(iva), String(ivaV), String(Math.round((sub + ivaV) * 100) / 100), status, String(daysAgo),
      status === "draft" ? null : new Date(Date.now() - daysAgo * 86400000 + 3600000), status === "accepted" ? new Date(Date.now() - (daysAgo - 1) * 86400000) : null, status === "accepted" ? client.name : null]);
  return rows[0].id;
}

const bagno = await quote("ferrari", "Rifacimento completo del bagno", [
  capitolo("A", "Demolizioni e smaltimento", [voce("Rimozione sanitari, piastrelle e massetto", 1, "a corpo", 950), voce("Smaltimento macerie in discarica autorizzata", 1, "a corpo", 380)]),
  capitolo("B", "Impianti", [voce("Rifacimento impianto idraulico del bagno", 1, "a corpo", 1850), voce("Punti luce e prese a norma", 6, "cad", 85)]),
  capitolo("C", "Rivestimenti e sanitari", [voce("Posa piastrelle a pavimento e parete", 28, "m²", 48), voce("Fornitura e posa sanitari sospesi e piatto doccia", 1, "a corpo", 2150)]),
], "accepted", 6);
const facciata = await quote("verdi", "Rifacimento della facciata condominiale", [
  capitolo("A", "Ponteggio", [voce("Montaggio e noleggio ponteggio per 60 giorni", 420, "m²", 12.5)]),
  capitolo("B", "Facciata", [voce("Ripristino intonaco ammalorato", 180, "m²", 32), voce("Tinteggiatura ai silossani, due mani", 420, "m²", 14)]),
], "accepted", 20);
await quote("bianchi", "Tinteggiatura appartamento di 85 m²", [
  capitolo("A", "Preparazione", [voce("Protezione pavimenti e mobili", 1, "a corpo", 180), voce("Stuccatura e carteggiatura", 85, "m²", 4.5)]),
  capitolo("B", "Tinteggiatura", [voce("Pittura lavabile, due mani, pareti e soffitti", 260, "m²", 9)]),
], "unlocked", 2);
await quote("colombo", "Sostituzione pavimento soggiorno", [
  capitolo("A", "Pavimento", [voce("Rimozione vecchio parquet", 32, "m²", 14), voce("Posa gres effetto legno", 32, "m²", 42)]),
], "draft", 1);

// The condominium job, with an invoice waiting for its bank transfer (the bagno quote stays accepted with no job: the jobs video starts it).
const job = await call("/api/jobs", { name: "Facciata Via Verdi 12", quoteId: facciata });
const jobId = job.job.id;
const inv = await call("/api/invoices", { projectId: jobId, title: "Acconto 30% facciata", lines: [{ description: "Acconto 30% sul rifacimento della facciata", quantity: 1, unitCents: 3_294_00 }], dueDays: 15 });
// Sent five days ago; yesterday the client said, from the invoice link, that the bank transfer went out (what the bonifico video confirms).
await c.query("update invoices set status='pending_confirmation', sent_at=now() - interval '5 days', bank_transfer_self_reported_at=now() - interval '18 hours' where id=$1", [inv.invoice.id]);
writeFileSync(new URL("./token.txt", import.meta.url), token);
console.log(JSON.stringify({ clients: Object.fromEntries(Object.entries(clients).map(([k, v]) => [k, v.id])), bagno, facciata, jobId, invoice: inv.invoice?.id, invoiceStatus: inv.invoice?.status }));
await c.end();
