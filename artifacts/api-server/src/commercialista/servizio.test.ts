import { describe, expect, it } from "vitest";
import {
  SERVIZIO_COMMERCIALISTA,
  azioniPossibili,
  documentoInTesto,
  informativaIa,
  informativaPrivacyProfessionista,
  letteraIncarico,
  operativita,
  scegliProfessionista,
  statoServizio,
  testoConvenzione,
  transizionePratica,
  validaProtocolloTelematico,
  type DatiProfessionista,
} from "@workspace/config";
import { hasFeature } from "@workspace/db";

// ── A-6: le regole pure del servizio col commercialista ──────────────────────

const ORA = new Date("2026-09-23T10:00:00Z");
const TRA_UN_ANNO = new Date("2027-09-23T00:00:00Z");

const PROFESSIONISTA: DatiProfessionista = {
  nome: "Laura",
  cognome: "Bianchi",
  codiceFiscale: "BNCLRA80A41F205G",
  partitaIva: "01234567897",
  sezioneAlbo: "A",
  ordine: "Milano",
  numeroAlbo: "1234",
  pec: "laura.bianchi@pec.it",
  studio: "Studio Bianchi",
  indirizzoStudio: "Via Verdi 3, Milano",
  rcCompagnia: "Assicurazioni Prova",
  rcNumeroPolizza: "RC-998877",
  rcMassimaleCents: 100_000_000,
  rcScadenza: TRA_UN_ANNO,
  altriStrumentiIa: "",
};

const IN_REGOLA = {
  stato: "verificato" as const,
  abilitatoEntratel: true,
  rcVerificataAt: ORA,
  rcScadenza: TRA_UN_ANNO,
  convenzioneFirmataAt: ORA,
  convenzioneCessataAt: null,
};

describe("statoServizio — il servizio non si mostra finché D9, D11 e un professionista non ci sono", () => {
  it("oggi (D9 e D11 aperte, nessun professionista) resta in bozza e non assegna da solo", () => {
    const s = statoServizio({ anno: 2026, professionistiOperativi: 0 });
    expect(SERVIZIO_COMMERCIALISTA.decisioni.D9).toBeNull();
    expect(s.effettivo).toBe("bozza");
    expect(s.modello).toBeNull();
    expect(s.assegnazioneAutomatica).toBe(false);
    expect(s.mancanti.map((m) => m.id)).toEqual(["D9", "D11", "professionisti", "D6", "D8"]);
  });

  it("con un professionista operativo ma D9 aperta si lavora a mano: niente assegnazione automatica", () => {
    const s = statoServizio({ anno: 2026, professionistiOperativi: 3 });
    expect(s.effettivo).toBe("bozza");
    expect(s.assegnazioneAutomatica).toBe(false);
  });

  it("D9 e D11 chiuse con un professionista: si mostra (interesse) ma non si vende finché D6 e D8 sono aperte", () => {
    const s = statoServizio({ anno: 2026, professionistiOperativi: 1, decisioni: { D9: "rete", D11: true } });
    expect(s.effettivo).toBe("interesse");
    expect(s.assegnazioneAutomatica).toBe(true);
  });

  it("tutto chiuso: vendita", () => {
    const s = statoServizio({ anno: 2026, professionistiOperativi: 1, decisioni: { D9: "studio_unico", D11: true, D8: true }, motoreRevisionato: true });
    expect(s.effettivo).toBe("vendita");
    expect(s.mancanti).toEqual([]);
  });

  it("senza professionisti non si mostra nemmeno con tutte le decisioni prese", () => {
    const s = statoServizio({ anno: 2026, professionistiOperativi: 0, decisioni: { D9: "rete", D11: true, D8: true }, motoreRevisionato: true });
    expect(s.effettivo).toBe("bozza");
    expect(s.assegnazioneAutomatica).toBe(false);
  });
});

describe("operativita — un professionista lavora solo se tutto è in regola adesso", () => {
  it("in regola", () => {
    expect(operativita(IN_REGOLA, ORA)).toEqual({ operativo: true, motivi: [] });
  });

  it("la polizza scaduta ieri lo ferma oggi, senza che nessuno debba accorgersene", () => {
    const r = operativita({ ...IN_REGOLA, rcScadenza: new Date("2026-09-22T23:59:59Z") }, ORA);
    expect(r.operativo).toBe(false);
    expect(r.motivi.join(" ")).toMatch(/scaduta/);
  });

  it("candidato, senza Entratel, senza convenzione: tre motivi distinti", () => {
    const r = operativita({ ...IN_REGOLA, stato: "candidato", abilitatoEntratel: false, convenzioneFirmataAt: null }, ORA);
    expect(r.operativo).toBe(false);
    expect(r.motivi).toHaveLength(3);
  });

  it("una convenzione cessata vale come nessuna convenzione", () => {
    expect(operativita({ ...IN_REGOLA, convenzioneCessataAt: ORA }, ORA).operativo).toBe(false);
  });

  it("polizza dichiarata ma non ancora vista da PrevAI: fermo", () => {
    expect(operativita({ ...IN_REGOLA, rcVerificataAt: null }, ORA).operativo).toBe(false);
  });
});

describe("scegliProfessionista — D9 decide a chi va un cliente", () => {
  const candidati = [
    { id: "mi", operativo: true, carico: 10, capienza: 40, provincia: "MI" },
    { id: "rm", operativo: true, carico: 2, capienza: 40, provincia: "RM" },
    { id: "pieno", operativo: true, carico: 5, capienza: 5, provincia: "BG" },
    { id: "fermo", operativo: false, carico: 0, capienza: 40, provincia: "BS" },
  ];

  it("con D9 aperta nessuno: la richiesta resta in coda", () => {
    expect(scegliProfessionista(candidati, null, "MI")).toBeNull();
  });

  it("studio unico: il meno carico, dovunque sia", () => {
    expect(scegliProfessionista(candidati, "studio_unico", "MI")?.id).toBe("rm");
  });

  it("rete: prima la stessa regione del cliente, poi il carico; mai chi è pieno o fermo", () => {
    expect(scegliProfessionista(candidati, "rete", "BG")?.id).toBe("mi"); // Lombardia: MI batte RM anche se più carico
    expect(scegliProfessionista(candidati, "rete", "NA")?.id).toBe("rm");
    expect(scegliProfessionista(candidati.slice(2), "rete", "BG")).toBeNull();
  });
});

describe("transizionePratica — chi fa cosa, e quando", () => {
  it("il giro completo", () => {
    let stato = null as ReturnType<typeof transizionePratica> extends { a: infer A } ? A | null : never;
    const passi = [
      ["consegna", "cliente"],
      ["prendi_in_carico", "professionista"],
      ["approva", "professionista"],
      ["conferma", "cliente"],
      ["segna_inviata", "professionista"],
      ["esito_accolta", "professionista"],
    ] as const;
    for (const [azione, attore] of passi) {
      const t = transizionePratica(stato, azione, attore);
      expect(t.ok, `${azione} da ${stato}`).toBe(true);
      if (t.ok) stato = t.a;
    }
    expect(stato).toBe("conclusa");
  });

  it("il professionista non conferma al posto del cliente, e il cliente non approva", () => {
    expect(transizionePratica("approvata", "conferma", "professionista").ok).toBe(false);
    expect(transizionePratica("in_revisione", "approva", "cliente").ok).toBe(false);
  });

  it("non si invia senza conferma del cliente", () => {
    expect(transizionePratica("approvata", "segna_inviata", "professionista").ok).toBe(false);
    expect(azioniPossibili("approvata", "professionista")).not.toContain("segna_inviata");
    expect(azioniPossibili("approvata", "cliente")).toEqual(["consegna", "conferma"]);
  });

  it("uno scarto riporta alla revisione; una confermata si può ancora fermare con una richiesta di modifiche", () => {
    expect(transizionePratica("inviata", "esito_scartata", "professionista")).toEqual({ ok: true, a: "in_revisione" });
    expect(transizionePratica("confermata", "richiedi_modifiche", "professionista")).toEqual({ ok: true, a: "modifiche_richieste" });
    expect(transizionePratica("confermata", "consegna", "cliente").ok).toBe(false);
  });
});

describe("i testi — ciò che si firma", () => {
  const cliente = { ragioneSociale: "Idraulica Rossi", codiceFiscale: "RSSMRA80A01F205X", partitaIva: "01234567897", indirizzo: "Via Po 1, Milano", titolare: "Mario Rossi" };

  it("la lettera d'incarico nomina l'iscrizione, la polizza, l'antiriciclaggio e il compenso", () => {
    const testo = documentoInTesto(letteraIncarico(PROFESSIONISTA, cliente, { anno: 2025, compensoClienteTesto: "Compreso nel canone.", dataProposta: ORA }));
    expect(testo).toContain("Redditi Persone Fisiche 2026");
    expect(testo).toContain("n. 1234");
    expect(testo).toContain("RC-998877");
    expect(testo).toContain("D.Lgs. 231/2007");
    expect(testo).toContain("art. 5 DPR 137/2012");
    expect(testo).toContain("Compreso nel canone.");
    expect(testo).toContain("conferma");
  });

  it("l'informativa IA cita la L. 132/2025, dice che il calcolo non è IA e riporta gli altri strumenti dichiarati", () => {
    const base = documentoInTesto(informativaIa(PROFESSIONISTA));
    expect(base).toContain("L. 132/2025");
    expect(base).toContain("motore a regole");
    expect(base).toContain("non usare altri strumenti");
    const altri = documentoInTesto(informativaIa({ ...PROFESSIONISTA, altriStrumentiIa: "un assistente di scrittura" }));
    expect(altri).toContain("un assistente di scrittura");
  });

  it("il professionista è titolare autonomo, PrevAI responsabile", () => {
    const testo = documentoInTesto(informativaPrivacyProfessionista(PROFESSIONISTA));
    expect(testo).toContain("titolare autonomo");
    expect(testo).toContain("art. 28");
  });

  it("la convenzione riporta il compenso fissato e cambia testo se cambia il compenso", () => {
    const a = documentoInTesto(testoConvenzione(PROFESSIONISTA, 12_000, null));
    const b = documentoInTesto(testoConvenzione(PROFESSIONISTA, 13_000, null));
    expect(a).toContain("120,00 €");
    expect(a).not.toEqual(b);
  });
});

describe("dettagli", () => {
  it("protocollo telematico: un codice, non una frase", () => {
    expect(validaProtocolloTelematico("26061712345678901-000001")).toBe(true);
    expect(validaProtocolloTelematico("inviata ieri")).toBe(false);
    expect(validaProtocolloTelematico("")).toBe(false);
  });

  it("il servizio non è in nessun piano, ma chi lo ha ottiene tutto il modulo Fisco", () => {
    const elite = { subscriptionPlan: "monthly_elite", subscriptionStatus: "active" };
    expect(hasFeature(elite, "accountant_service")).toBe(false);
    const pilota = { ...elite, featureFlags: { accountant_service: true } };
    expect(hasFeature(pilota, "accountant_service")).toBe(true);
    expect(hasFeature(pilota, "admin_suite")).toBe(true);
    expect(hasFeature(pilota, "fiscal_engine")).toBe(true);
    // Un flag esplicito a false vince sempre.
    expect(hasFeature({ ...pilota, featureFlags: { accountant_service: true, admin_suite: false } }, "admin_suite")).toBe(false);
  });
});
