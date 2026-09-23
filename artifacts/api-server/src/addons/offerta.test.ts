import { describe, expect, it } from "vitest";
import {
  OFFERTA_AMMINISTRAZIONE,
  contenutiFiscaliPubblicabili,
  formatPrezzoOfferta,
  lookupKeyStripe,
  lookupKeysAttese,
  prezzoCents,
  statoOfferta,
  varianteDaId,
  varianteDiUtente,
  variantePredefinita,
} from "@workspace/config";
import { addonAttivo, hasFeature, statoAddonDaStripe } from "@workspace/db";
import { eAbbonamentoAddon } from "./amministrazione";

const TUTTO_CHIUSO = { decisioni: { D5: true, D8: true }, motoreRevisionato: true } as const;

describe("statoOfferta — lo stato effettivo non supera i prerequisiti", () => {
  it("oggi (D5, D6, D8 aperte) l'offerta è in bozza e il livello gratuito è spento", () => {
    const s = statoOfferta({ anno: 2026 });
    expect(s.richiesto).toBe("bozza");
    expect(s.effettivo).toBe("bozza");
    expect(s.gratuitoAttivo).toBe(false);
    expect(s.mancanti.map((m) => m.id)).toEqual(["D5", "D6", "D8"]);
  });

  it("chiedere 'vendita' con D5 aperta resta in bozza", () => {
    expect(statoOfferta({ anno: 2026, statoRichiesto: "vendita" }).effettivo).toBe("bozza");
  });

  it("con D5 chiusa ma D6 aperta si arriva solo a 'interesse', senza livello gratuito", () => {
    const s = statoOfferta({ anno: 2026, statoRichiesto: "vendita", decisioni: { D5: true, D8: true }, motoreRevisionato: false });
    expect(s.effettivo).toBe("interesse");
    expect(s.gratuitoAttivo).toBe(false);
    expect(s.mancanti.map((m) => m.id)).toEqual(["D6"]);
  });

  it("con D8 aperta non si vende", () => {
    expect(statoOfferta({ anno: 2026, statoRichiesto: "vendita", decisioni: { D5: true, D8: false }, motoreRevisionato: true }).effettivo).toBe("interesse");
  });

  it("con tutto chiuso si arriva allo stato richiesto, e non oltre", () => {
    expect(statoOfferta({ anno: 2026, statoRichiesto: "vendita", ...TUTTO_CHIUSO }).effettivo).toBe("vendita");
    expect(statoOfferta({ anno: 2026, statoRichiesto: "interesse", ...TUTTO_CHIUSO }).effettivo).toBe("interesse");
    expect(statoOfferta({ anno: 2026, statoRichiesto: "bozza", ...TUTTO_CHIUSO }).effettivo).toBe("bozza");
  });

  it("il livello gratuito vuole offerta pubblica e motore revisionato", () => {
    expect(statoOfferta({ anno: 2026, statoRichiesto: "interesse", ...TUTTO_CHIUSO }).gratuitoAttivo).toBe(true);
    expect(statoOfferta({ anno: 2026, statoRichiesto: "bozza", ...TUTTO_CHIUSO }).gratuitoAttivo).toBe(false);
  });

  it("D6 si deduce dalle regole del motore: oggi nessuna è revisionata", () => {
    const d6 = statoOfferta({ anno: 2026 }).prerequisiti.find((p) => p.id === "D6");
    expect(d6?.chiuso).toBe(false);
    expect(contenutiFiscaliPubblicabili(2026)).toBe(false);
  });
});

describe("varianti e prezzi", () => {
  it("la variante predefinita è quella del piano: 12 €/mese, 120 €/anno", () => {
    const v = variantePredefinita();
    expect(v.id).toBe("a");
    expect(formatPrezzoOfferta(v.mensileCents)).toBe("12 €");
    expect(formatPrezzoOfferta(v.annualeCents)).toBe("120 €");
  });

  it("l'annuale vale dieci mensilità in ogni variante", () => {
    for (const v of OFFERTA_AMMINISTRAZIONE.varianti) expect(v.annualeCents).toBe(v.mensileCents * 10);
  });

  it("la variante di un utente è stabile e sempre una di quelle configurate", () => {
    const ids = OFFERTA_AMMINISTRAZIONE.varianti.map((v) => v.id);
    for (const u of ["u1", "u2", "utente-lungo-123", "x"]) {
      expect(varianteDiUtente(u).id).toBe(varianteDiUtente(u).id);
      expect(ids).toContain(varianteDiUtente(u).id);
    }
    // Su molti utenti escono tutte le varianti: l'hash non ne privilegia una.
    const viste = new Set(Array.from({ length: 200 }, (_, i) => varianteDiUtente(`user-${i}`).id));
    expect(viste.size).toBe(ids.length);
  });

  it("?v= della campagna: accettato solo se è una variante vera", () => {
    expect(varianteDaId("B")?.id).toBe("b");
    expect(varianteDaId(" c ")?.id).toBe("c");
    expect(varianteDaId("z")).toBeNull();
    expect(varianteDaId("")).toBeNull();
  });

  it("con Elite il mensile è quello del bundle, l'annuale no", () => {
    const v = variantePredefinita();
    expect(prezzoCents(v, "mensile", true)).toBe(OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents);
    expect(prezzoCents(v, "annuale", true)).toBe(v.annualeCents);
    expect(lookupKeyStripe(v, "mensile", true)).toBe("amministrazione_bundle_elite_mensile");
    expect(lookupKeyStripe(v, "annuale", true)).toBe("amministrazione_a_annuale");
  });

  it("le lookup key da creare su Stripe sono uniche, una per variante e periodo più il bundle", () => {
    const chiavi = lookupKeysAttese().map((k) => k.chiave);
    expect(new Set(chiavi).size).toBe(chiavi.length);
    expect(chiavi).toHaveLength(OFFERTA_AMMINISTRAZIONE.varianti.length * 2 + 1);
  });
});

describe("hasFeature con l'add-on", () => {
  const profilo = (addons: object, featureFlags: Record<string, boolean> = {}) => ({ subscriptionPlan: "monthly_pro", subscriptionStatus: "active", featureFlags, addons });

  it("senza add-on il modulo è spento, anche su Pro ed Elite", () => {
    for (const f of ["sdi_invoicing", "fiscal_engine", "admin_suite"] as const) expect(hasFeature(profilo({}), f)).toBe(false);
  });

  it("l'add-on attivo accende tutto il modulo", () => {
    const p = profilo({ amministrazione: { stato: "attivo" } });
    for (const f of ["sdi_invoicing", "fiscal_engine", "admin_suite"] as const) expect(hasFeature(p, f)).toBe(true);
    expect(hasFeature(p, "team_time")).toBe(false);
  });

  it("insoluto tiene l'accesso, cessato no", () => {
    expect(hasFeature(profilo({ amministrazione: { stato: "insoluto" } }), "admin_suite")).toBe(true);
    expect(hasFeature(profilo({ amministrazione: { stato: "cessato" } }), "admin_suite")).toBe(false);
  });

  it("la beta scade alla sua data", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(addonAttivo({ stato: "beta", betaFino: "2026-12-31T22:59:59Z" }, now)).toBe(true);
    expect(addonAttivo({ stato: "beta", betaFino: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(addonAttivo({ stato: "beta" }, now)).toBe(false);
  });

  it("un flag a false spegne anche un add-on pagato (kill switch)", () => {
    expect(hasFeature(profilo({ amministrazione: { stato: "attivo" } }, { fiscal_engine: false }), "fiscal_engine")).toBe(false);
  });

  it("il livello gratuito oggi è spento: fiscal_engine senza add-on resta false", () => {
    expect(hasFeature({ subscriptionPlan: null, subscriptionStatus: null }, "fiscal_engine")).toBe(false);
  });
});

describe("abbonamenti Stripe dell'add-on", () => {
  it("riconosce l'add-on dai metadati o dalla lookup key, e non scambia il piano per l'add-on", () => {
    expect(eAbbonamentoAddon({ metadata: { addon: "amministrazione" } })).toBe(true);
    expect(eAbbonamentoAddon({ items: { data: [{ price: { lookup_key: "amministrazione_b_annuale" } }] } })).toBe(true);
    expect(eAbbonamentoAddon({ items: { data: [{ price: { id: "price_1TUdJjCaDBaDETvnfBv37ryF", lookup_key: null } }] } })).toBe(false);
    expect(eAbbonamentoAddon({ metadata: { planType: "monthly_pro" } })).toBe(false);
    expect(eAbbonamentoAddon(null)).toBe(false);
  });

  it("traduce gli stati di Stripe", () => {
    expect(statoAddonDaStripe("active")).toBe("attivo");
    expect(statoAddonDaStripe("trialing")).toBe("prova");
    expect(statoAddonDaStripe("past_due")).toBe("insoluto");
    for (const s of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", undefined]) expect(statoAddonDaStripe(s)).toBe("cessato");
  });
});
