import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { db, authUsersTable, businessProfilesTable, clientsTable, clientDedupKey, compensiProfessionistiTable, professionistiTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment } from "../invoices/service.js";

// ── A-6: il commercialista nel giro ──────────────────────────────────────────
// Il giro completo contro il database, con D9 aperta: la richiesta resta in
// coda, l'amministrazione verifica il professionista e l'assegna a mano, il
// cliente firma lettera e informative, il professionista accetta dopo
// l'adeguata verifica, rivede la chiusura d'anno, approva con la bozza, il
// cliente conferma, il professionista invia e carica la ricevuta, il compenso
// matura. E soprattutto i "no": dati invisibili prima dell'incarico attivo,
// a un altro professionista, dopo una revoca o con la polizza scaduta; nessun
// invio se i numeri sono cambiati dopo la conferma.

const anno = new Date().getUTCFullYear();
const annoScorso = anno - 1;
const traUnAnno = `${anno + 1}-12-31`;

function pdf(nome: string, contenuto: string): FormData {
  const f = new FormData();
  f.append("file", new Blob([`%PDF-1.4\n% ${contenuto}\n`], { type: "application/pdf" }), nome);
  return f;
}

const CANDIDATURA = {
  nome: "Laura",
  cognome: "Bianchi",
  codiceFiscale: "BNCLRA80A41F205G",
  partitaIva: "01234567897",
  sezioneAlbo: "A",
  ordine: "Milano",
  numeroAlbo: "1234",
  pec: "laura.bianchi@pec.example.it",
  studio: "Studio Bianchi",
  indirizzoStudio: "Via Verdi 3, Milano",
  provincia: "MI",
  abilitatoEntratel: true,
  rcCompagnia: "Assicurazioni Prova",
  rcNumeroPolizza: "RC-998877",
  rcMassimaleCents: 100_000_000,
  rcScadenza: traUnAnno,
};

async function dueFattori(userId: string) {
  await db.update(authUsersTable).set({ twoFactorEnabled: true }).where(eq(authUsersTable.id, userId));
}

describe("commercialista nel giro", () => {
  let cliente: TestUser & { province: string };
  let prof: TestUser;
  let altroProf: TestUser;
  let admin: TestUser;
  let profId: string;
  let incaricoId: string;
  const adminEmailPrima = process.env.ADMIN_EMAIL;

  async function incassa(importoCents: number, data: string, titolo: string) {
    const [c] = await db
      .insert(clientsTable)
      .values({ userId: cliente.userId, type: "individual", name: titolo, email: `c-${Math.random()}@example.invalid`, address: "Via Po 1", city: "Milano", province: "MI", postalCode: "20121", dedupKey: clientDedupKey({ name: titolo, email: titolo }) })
      .returning();
    const ctx = await buildInvoiceContext({ userId: cliente.userId, clientId: c!.id });
    const creata = await createInvoice({ userId: cliente.userId, ctx, type: "manual", source: "manual", actor: "contractor", lines: [{ description: titolo, quantity: 1, unitCents: importoCents, amountCents: importoCents }], dueDays: 30, title: titolo });
    const { invoice } = await sendInvoice({ invoiceId: creata.id, userId: cliente.userId, actor: "contractor" });
    await recordPayment({ invoiceId: invoice.id, userId: cliente.userId, amountCents: importoCents, method: "bank_transfer", date: new Date(`${data}T12:00:00Z`), sendReceipt: false });
  }

  async function candidaEVerifica(utente: TestUser, dati: Record<string, unknown>) {
    await dueFattori(utente.userId);
    const c = await utente.api("/api/studio/candidatura", { body: dati });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    const id = c.body.professionista.id as string;
    const v = await admin.api(`/api/admin/commercialisti/${id}/verifica`, { body: { note: "Albo controllato", rcVerificata: true, entratelVerificato: true, compensoPraticaCents: 12_000 } });
    expect(v.status, JSON.stringify(v.body)).toBe(200);
    const profilo = await utente.api("/api/studio/profilo");
    const f = await utente.api("/api/studio/convenzione/firma", { body: { impronta: profilo.body.convenzione.impronta } });
    expect(f.status, JSON.stringify(f.body)).toBe(200);
    expect(f.body.professionista.operativo).toBe(true);
    return id;
  }

  beforeAll(async () => {
    await startServer();
    cliente = await createOrg({ province: "MI", companyName: "Idraulica Pilota Srl", profile: { codiceFiscale: "01234567897", address: "Via Roma 1", city: "Milano", cap: "20121" } });
    prof = await createUser({ name: "Laura Bianchi" });
    altroProf = await createUser({ name: "Paolo Verdi" });
    admin = await createUser({ name: "Staff PrevAI" });
    process.env.ADMIN_EMAIL = admin.email;
  });

  afterAll(async () => {
    process.env.ADMIN_EMAIL = adminEmailPrima;
    // I professionisti sono referenziati da incarichi e compensi dei clienti: prima i clienti.
    await cleanupAll();
    await stopServer();
  });

  it("senza il servizio l'impresa non vede nulla, anche con Elite", async () => {
    const r = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("ACCOUNTANT_SERVICE_OFF");
  });

  it("il professionista si candida solo con la verifica in due passaggi, e con dati validi", async () => {
    const senza = await prof.api("/api/studio/candidatura", { body: CANDIDATURA });
    expect(senza.status).toBe(403);
    expect(senza.body.error).toBe("TWO_FACTOR_NEEDED");
    const profilo = await prof.api("/api/studio/profilo");
    expect(profilo.status).toBe(200);
    expect(profilo.body).toMatchObject({ twoFactorEnabled: false, professionista: null, servizio: { stato: "bozza", modello: null } });

    await dueFattori(prof.userId);
    const cfSbagliato = await prof.api("/api/studio/candidatura", { body: { ...CANDIDATURA, codiceFiscale: "XXXXXX00X00X000X" } });
    expect(cfSbagliato.status).toBe(400);
    const ok = await prof.api("/api/studio/candidatura", { body: CANDIDATURA });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.professionista).toMatchObject({ stato: "candidato", operativo: false });
    profId = ok.body.professionista.id;
  });

  it("l'impresa pilota chiede il servizio: con D9 aperta la richiesta resta in coda", async () => {
    const [p] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, cliente.userId));
    await db.update(businessProfilesTable).set({ featureFlags: { ...(p?.featureFlags ?? {}), accountant_service: true } }).where(eq(businessProfilesTable.userId, cliente.userId));
    await dueFattori(cliente.userId);

    const vista = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    expect(vista.status).toBe(200);
    expect(vista.body).toMatchObject({ servizio: { stato: "bozza", assegnazioneAutomatica: false }, incarico: null });

    const r = await cliente.api("/api/fiscale/commercialista/richiesta", { body: { anno: annoScorso } });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.incarico.stato).toBe("da_assegnare");
    incaricoId = r.body.incarico.id;
    const doppia = await cliente.api("/api/fiscale/commercialista/richiesta", { body: { anno: annoScorso } });
    expect(doppia.status).toBe(409);
  });

  it("l'amministrazione: solo lo staff, e non si assegna a chi non è operativo", async () => {
    expect((await cliente.api("/api/admin/commercialisti")).status).toBe(403);
    const elenco = await admin.api("/api/admin/commercialisti");
    expect(elenco.status).toBe(200);
    expect(elenco.body.richieste.map((r: { id: string }) => r.id)).toContain(incaricoId);
    // Lo staff vede l'impresa e l'anno, non i conti.
    expect(Object.keys(elenco.body.richieste.find((r: { id: string }) => r.id === incaricoId)).sort()).toEqual(["anno", "azienda", "id", "provincia", "richiestoAt"]);

    const aCandidato = await admin.api(`/api/admin/commercialisti/richieste/${incaricoId}/assegna`, { body: { professionistaId: profId } });
    expect(aCandidato.status).toBe(403);
    expect(aCandidato.body.error).toBe("NON_OPERATIVO");

    // Verificato ma senza compenso (D11): la convenzione non si firma.
    const v = await admin.api(`/api/admin/commercialisti/${profId}/verifica`, { body: { note: "Iscrizione controllata sull'albo online", rcVerificata: true, entratelVerificato: true } });
    expect(v.status).toBe(200);
    expect(v.body.professionista.operativo).toBe(false);
    const senzaCompenso = await prof.api("/api/studio/profilo");
    expect(senzaCompenso.body.convenzione).toBeNull();

    await admin.api(`/api/admin/commercialisti/${profId}/verifica`, { body: { note: "Compenso concordato", rcVerificata: false, entratelVerificato: false, compensoPraticaCents: 12_000 } });
    const profilo = await prof.api("/api/studio/profilo");
    expect(profilo.body.convenzione.documento.sezioni.map((s: { testo: string }) => s.testo).join(" ")).toContain("120,00 €");
    const sbagliata = await prof.api("/api/studio/convenzione/firma", { body: { impronta: "0".repeat(64) } });
    expect(sbagliata.status).toBe(409);
    const firmata = await prof.api("/api/studio/convenzione/firma", { body: { impronta: profilo.body.convenzione.impronta } });
    expect(firmata.status).toBe(200);
    expect(firmata.body.professionista.operativo).toBe(true);

    const assegnato = await admin.api(`/api/admin/commercialisti/richieste/${incaricoId}/assegna`, { body: { professionistaId: profId } });
    expect(assegnato.status, JSON.stringify(assegnato.body)).toBe(200);
    expect(assegnato.body.incarico.stato).toBe("proposto");
  });

  it("il cliente legge lettera e informative, e firma solo accettandole tutte", async () => {
    const r = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    expect(r.body.incarico.stato).toBe("proposto");
    expect(r.body.professionista).toMatchObject({ nome: "Laura Bianchi", studio: "Studio Bianchi" });
    expect(r.body.professionista.qualifica).toContain("n. 1234");
    expect(r.body.professionista).not.toHaveProperty("codiceFiscale");
    const lettera = JSON.stringify(r.body.incarico.documenti.lettera);
    expect(lettera).toContain("Idraulica Pilota Srl");
    expect(lettera).toContain("RC-998877");
    expect(JSON.stringify(r.body.incarico.documenti.informativaIa)).toContain("L. 132/2025");

    // Prima della firma il professionista non vede i dati.
    const presto = await prof.api(`/api/studio/incarichi/${incaricoId}/pacchetto`);
    expect(presto.status).toBe(403);

    const senzaInformative = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/firma`, { body: { impronta: r.body.incarico.impronta, informativaIa: true, informativaPrivacy: false } });
    expect(senzaInformative.status).toBe(400);
    const altroTesto = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/firma`, { body: { impronta: "f".repeat(64), informativaIa: true, informativaPrivacy: true } });
    expect(altroTesto.status).toBe(409);
    const firma = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/firma`, { body: { impronta: r.body.incarico.impronta, informativaIa: true, informativaPrivacy: true } });
    expect(firma.status, JSON.stringify(firma.body)).toBe(200);
    expect(firma.body.incarico.stato).toBe("firmato_cliente");
  });

  it("il professionista accetta solo dopo l'adeguata verifica; un altro professionista non vede l'incarico", async () => {
    const elenco = await prof.api("/api/studio/incarichi");
    expect(elenco.body.incarichi.find((i: { id: string }) => i.id === incaricoId)).toMatchObject({ stato: "firmato_cliente", azienda: "Idraulica Pilota Srl" });

    const senza = await prof.api(`/api/studio/incarichi/${incaricoId}/accetta`, { body: { adeguataVerifica: false } });
    expect(senza.status).toBe(400);
    const ok = await prof.api(`/api/studio/incarichi/${incaricoId}/accetta`, { body: { adeguataVerifica: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.incarico.stato).toBe("attivo");

    await candidaEVerifica(altroProf, { ...CANDIDATURA, nome: "Paolo", cognome: "Verdi", codiceFiscale: "VRDPLA75C10H501Y", numeroAlbo: "5678", pec: "paolo.verdi@pec.example.it", provincia: "RM" });
    expect((await altroProf.api(`/api/studio/incarichi/${incaricoId}`)).status).toBe(404);
    expect((await altroProf.api(`/api/studio/incarichi/${incaricoId}/pacchetto`)).status).toBe(404);
    expect((await altroProf.api(`/api/studio/incarichi/${incaricoId}/messaggi`)).status).toBe(404);
  });

  it("chat: scrivono solo cliente e professionista, e leggere segna letto", async () => {
    const vuoto = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/messaggi`, { body: { testo: "   " } });
    expect(vuoto.status).toBe(400);
    const domanda = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/messaggi`, { body: { testo: "Mi conviene la riduzione del 35% sui contributi?" } });
    expect(domanda.status).toBe(201);
    const elenco = await prof.api("/api/studio/incarichi");
    expect(elenco.body.incarichi.find((i: { id: string }) => i.id === incaricoId).messaggiNonLetti).toBe(1);
    const letti = await prof.api(`/api/studio/incarichi/${incaricoId}/messaggi`);
    expect(letti.body.messaggi).toHaveLength(1);
    const risposta = await prof.api(`/api/studio/incarichi/${incaricoId}/messaggi`, { body: { testo: "Ne parliamo: dipende anche dalla pensione che vuoi maturare." } });
    expect(risposta.status).toBe(201);
    const conversazione = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/messaggi`);
    expect(conversazione.body.messaggi.map((m: { autore: string }) => m.autore)).toEqual(["cliente", "professionista"]);
    expect(conversazione.body.messaggi[0].lettoAt).not.toBeNull();
  });

  it("consegna: si parte da un anno chiuso, e ogni apertura dei dati resta scritta per il cliente", async () => {
    const presto = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/consegna`, { body: {} });
    expect(presto.status).toBe(400);
    expect(presto.body.error).toBe("ANNO_NON_CHIUSO");

    const onboarding = await cliente.api("/api/fiscale/profilo", {
      method: "PATCH",
      body: { codiceAteco: "43.22.01", gestione: "artigiani", riduzione: "nessuna", annoInizioAttivita: 2019, requisitiStartup: false, accettaAvviso: true },
    });
    expect(onboarding.status, JSON.stringify(onboarding.body)).toBe(200);
    await incassa(3_000_000, `${annoScorso}-03-10`, "Impianto termico");
    const chiusa = await cliente.api("/api/fiscale/chiusura/chiudi", { body: { anno: annoScorso } });
    expect(chiusa.status, JSON.stringify(chiusa.body)).toBe(200);

    const consegna = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/consegna`, { body: {} });
    expect(consegna.status, JSON.stringify(consegna.body)).toBe(200);
    expect(consegna.body.pratica).toMatchObject({ stato: "da_revisionare", chiusuraImpronta: chiusa.body.chiusura.impronta });

    const pacchetto = await prof.api(`/api/studio/incarichi/${incaricoId}/pacchetto`);
    expect(pacchetto.status).toBe(200);
    expect(pacchetto.headers.get("cache-control")).toBe("no-store");
    expect(pacchetto.body.chiusura.chiusura.impronta).toBe(chiusa.body.chiusura.impronta);
    const lm22 = pacchetto.body.pacchetto.prospetto.righi.find((r: { descrizione: string }) => r.descrizione.startsWith("Ricavi"));
    expect(lm22.importoCents).toBe(3_000_000);

    const vista = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    const accessi = vista.body.eventi.filter((e: { tipo: string }) => e.tipo === "accesso");
    expect(accessi.length).toBeGreaterThanOrEqual(1);
    expect(accessi[0]).toMatchObject({ attore: "professionista", dettagli: { risorsa: "pacchetto" } });
  });

  it("revisione e bozza: se i numeri cambiano dopo l'approvazione la conferma è rifiutata", async () => {
    expect((await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/conferma`, { body: { bozzaImpronta: "a".repeat(64) } })).status).toBe(409);
    expect((await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/prendi_in_carico`, { body: {} })).status).toBe(200);
    const senzaBozza = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/approva`, { body: {} });
    expect(senzaBozza.status).toBe(400);
    const approvata = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/approva`, { form: pdf("bozza-redditi.pdf", "bozza 1") });
    expect(approvata.status, JSON.stringify(approvata.body)).toBe(200);
    expect(approvata.body.pratica.stato).toBe("approvata");
    const bozza1 = approvata.body.pratica.bozza.impronta as string;

    // Il cliente trova un incasso dimenticato, riapre e richiude: la bozza approvata non descrive più i numeri.
    await incassa(200_000, `${annoScorso}-12-20`, "Riparazione di dicembre");
    expect((await cliente.api("/api/fiscale/chiusura/riapri", { body: { anno: annoScorso } })).status).toBe(204);
    expect((await cliente.api("/api/fiscale/chiusura/chiudi", { body: { anno: annoScorso } })).status).toBe(200);
    const vista = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    expect(vista.body.pratica.differenza).toMatch(/numeri diversi/);
    const rifiutata = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/conferma`, { body: { bozzaImpronta: bozza1 } });
    expect(rifiutata.status).toBe(409);
    expect(rifiutata.body.error).toBe("NUMERI_CAMBIATI");

    // Riconsegna: la bozza vecchia sparisce, il professionista riapprova.
    const riconsegna = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/consegna`, { body: {} });
    expect(riconsegna.status, JSON.stringify(riconsegna.body)).toBe(200);
    expect(riconsegna.body.pratica.bozza).toBeNull();
    const ancora = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/approva`, { form: pdf("bozza-redditi-2.pdf", "bozza 2") });
    expect(ancora.status).toBe(200);
    const bozza2 = ancora.body.pratica.bozza.impronta as string;
    expect(bozza2).not.toBe(bozza1);

    // La bozza è scaricabile dal cliente, e dal professionista con accesso registrato.
    const file = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/file/bozza`);
    expect(file.status).toBe(200);
    expect(String(file.body)).toContain("bozza 2");

    expect((await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/conferma`, { body: { bozzaImpronta: bozza1 } })).status).toBe(409);
    const confermata = await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/conferma`, { body: { bozzaImpronta: bozza2 } });
    expect(confermata.status, JSON.stringify(confermata.body)).toBe(200);
    expect(confermata.body.pratica.stato).toBe("confermata");
  });

  it("invio col protocollo, ricevuta, compenso maturato; poi i dati non si vedono più", async () => {
    const protocolloFinto = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/segna_inviata`, { body: { protocollo: "fatto" } });
    expect(protocolloFinto.status).toBe(400);
    const inviata = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/segna_inviata`, { body: { protocollo: "26061712345678901-000001" } });
    expect(inviata.status, JSON.stringify(inviata.body)).toBe(200);
    expect(inviata.body.pratica).toMatchObject({ stato: "inviata", protocollo: "26061712345678901-000001" });

    const accolta = await prof.api(`/api/studio/incarichi/${incaricoId}/pratica/esito_accolta`, { form: pdf("ricevuta.pdf", "ricevuta accoglimento") });
    expect(accolta.status, JSON.stringify(accolta.body)).toBe(200);
    expect(accolta.body.pratica.stato).toBe("conclusa");

    const vista = await cliente.api(`/api/fiscale/commercialista?anno=${annoScorso}`);
    expect(vista.body.incarico.stato).toBe("concluso");
    expect(vista.body.pratica.ricevuta.nome).toBe("ricevuta.pdf");
    expect((await cliente.api(`/api/fiscale/commercialista/incarichi/${incaricoId}/file/ricevuta`)).status).toBe(200);

    const [compenso] = await db.select().from(compensiProfessionistiTable).where(eq(compensiProfessionistiTable.incaricoId, incaricoId));
    expect(compenso).toMatchObject({ importoCents: 12_000, stato: "maturato" });
    expect((await admin.api(`/api/admin/commercialisti/compensi/${compenso!.id}/pagato`, { body: {} })).status).toBe(400);
    expect((await admin.api(`/api/admin/commercialisti/compensi/${compenso!.id}/fatturato`, { body: { fatturaNumero: "12/2026" } })).status).toBe(200);
    expect((await admin.api(`/api/admin/commercialisti/compensi/${compenso!.id}/pagato`, { body: {} })).status).toBe(200);
    const miei = await prof.api("/api/studio/compensi");
    expect(miei.body.compensi[0]).toMatchObject({ stato: "pagato", fatturaNumero: "12/2026" });

    // Incarico concluso: niente più dati né chat.
    expect((await prof.api(`/api/studio/incarichi/${incaricoId}/pacchetto`)).status).toBe(403);
    expect((await prof.api(`/api/studio/incarichi/${incaricoId}/messaggi`, { body: { testo: "Ancora una cosa" } })).status).toBe(403);
  });

  it("revoca e polizza scaduta: l'accesso si chiude subito", async () => {
    const annoPrima = annoScorso - 1;
    const r = await cliente.api("/api/fiscale/commercialista/richiesta", { body: { anno: annoPrima } });
    expect(r.status).toBe(201);
    const id = r.body.incarico.id as string;
    expect((await admin.api(`/api/admin/commercialisti/richieste/${id}/assegna`, { body: { professionistaId: profId } })).status).toBe(200);
    const doc = await cliente.api(`/api/fiscale/commercialista?anno=${annoPrima}`);
    await cliente.api(`/api/fiscale/commercialista/incarichi/${id}/firma`, { body: { impronta: doc.body.incarico.impronta, informativaIa: true, informativaPrivacy: true } });
    expect((await prof.api(`/api/studio/incarichi/${id}/accetta`, { body: { adeguataVerifica: true } })).status).toBe(200);
    expect((await prof.api(`/api/studio/incarichi/${id}/messaggi`)).status).toBe(200);

    // Polizza scaduta ieri: il professionista si ferma, senza che nessuno intervenga.
    await db.update(professionistiTable).set({ rcScadenza: new Date(Date.now() - 86_400_000) }).where(eq(professionistiTable.id, profId));
    const fermo = await prof.api(`/api/studio/incarichi/${id}/messaggi`);
    expect(fermo.status).toBe(403);
    expect(fermo.body.error).toBe("NON_OPERATIVO");
    await db.update(professionistiTable).set({ rcScadenza: new Date(`${traUnAnno}T23:59:59Z`) }).where(eq(professionistiTable.id, profId));

    const revoca = await cliente.api(`/api/fiscale/commercialista/incarichi/${id}/revoca`, { body: { motivo: "Cambio professionista" } });
    expect(revoca.status).toBe(200);
    expect(revoca.body.incarico.stato).toBe("revocato");
    expect((await prof.api(`/api/studio/incarichi/${id}/messaggi`)).status).toBe(403);
    // Dopo una revoca si può chiedere di nuovo; il professionista può rifiutare, ma dicendo perché.
    const nuova = await cliente.api("/api/fiscale/commercialista/richiesta", { body: { anno: annoPrima } });
    expect(nuova.status).toBe(201);
    expect((await admin.api(`/api/admin/commercialisti/richieste/${nuova.body.incarico.id}/assegna`, { body: { professionistaId: profId } })).status).toBe(200);
    expect((await prof.api(`/api/studio/incarichi/${nuova.body.incarico.id}/rifiuta`, { body: { motivo: "" } })).status).toBe(400);
    const rifiutato = await prof.api(`/api/studio/incarichi/${nuova.body.incarico.id}/rifiuta`, { body: { motivo: "Conflitto di interessi" } });
    expect(rifiutato.status).toBe(200);
    expect(rifiutato.body.incarico.stato).toBe("rifiutato");
  });

  it("identità verificata non si cambia da soli; una polizza rinnovata va rivista", async () => {
    const identita = await prof.api("/api/studio/candidatura", { body: { ...CANDIDATURA, numeroAlbo: "9999" } });
    expect(identita.status).toBe(400);
    expect(identita.body.error).toBe("IDENTITA_VERIFICATA");
    const rinnovo = await prof.api("/api/studio/candidatura", { body: { ...CANDIDATURA, rcNumeroPolizza: "RC-2027-001" } });
    expect(rinnovo.status).toBe(200);
    expect(rinnovo.body.professionista.operativo).toBe(false);
    expect(rinnovo.body.professionista.motivi.join(" ")).toMatch(/non è ancora stata verificata/);
  });
});
