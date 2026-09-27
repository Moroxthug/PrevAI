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
  postiFondatoriRimasti,
  prezzoFondatoriCents,
  PREZZI_PIANI,
  lookupKeyPiano,
  lookupKeysPianiAttese,
  pianoDaLookupKey,
  prezzoPianoCents,
} from "@workspace/config";
import { PLANS, pianoDaPrezzo, prezzoPianoStripe, ErrorePrezzo } from "../routes/payments";
import { addonAttivo, hasFeature, statoAddonDaStripe } from "@workspace/db";
import { eAbbonamentoAddon } from "./amministrazione";

const TUTTO_CHIUSO = { decisioni: { D5: true, D8: true }, motoreRevisionato: true } as const;

describe("statoOfferta — lo stato effettivo non supera i prerequisiti", () => {
  it("oggi (D5 chiusa, D6 e D8 aperte) si chiede 'vendita' ma si arriva a 'interesse', senza livello gratuito", () => {
    const s = statoOfferta({ anno: 2026 });
    expect(s.richiesto).toBe("vendita");
    expect(s.effettivo).toBe("interesse");
    expect(s.gratuitoAttivo).toBe(false);
    expect(s.mancanti.map((m) => m.id)).toEqual(["D6", "D8"]);
  });

  it("chiedere 'vendita' con D5 aperta resta in bozza", () => {
    expect(statoOfferta({ anno: 2026, statoRichiesto: "vendita", decisioni: { D5: false } }).effettivo).toBe("bozza");
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
  it("la variante predefinita è quella decisa con D5: 14,90 €/mese, 149 €/anno, IVA inclusa", () => {
    const v = variantePredefinita();
    expect(v.id).toBe("a");
    expect(formatPrezzoOfferta(v.mensileCents)).toBe("14,90 €");
    expect(formatPrezzoOfferta(v.annualeCents)).toBe("149 €");
    expect(OFFERTA_AMMINISTRAZIONE.ivaInclusa).toBe(true);
    expect(OFFERTA_AMMINISTRAZIONE.nome).toBe("PrevAI Fisco");
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
    expect(OFFERTA_AMMINISTRAZIONE.bundleEliteMensileCents).toBe(490);
  });

  it("le lookup key da creare su Stripe sono uniche: variante × periodo, bundle, fondatori × periodo", () => {
    const chiavi = lookupKeysAttese().map((k) => k.chiave);
    expect(new Set(chiavi).size).toBe(chiavi.length);
    expect(chiavi).toHaveLength(OFFERTA_AMMINISTRAZIONE.varianti.length * 2 + 1 + 2);
    expect(chiavi).toContain("amministrazione_fondatori_annuale");
  });

  it("posti fondatori: si esauriscono col conteggio e chiudono alla data", () => {
    const prima = new Date("2027-01-10T12:00:00Z");
    expect(postiFondatoriRimasti(0, prima)).toBe(100);
    expect(postiFondatoriRimasti(63, prima)).toBe(37);
    expect(postiFondatoriRimasti(140, prima)).toBe(0);
    expect(postiFondatoriRimasti(0, new Date("2027-04-01T12:00:00Z"))).toBe(0);
    expect(prezzoFondatoriCents("mensile")).toBe(990);
    expect(prezzoFondatoriCents("annuale")).toBe(9900);
    // Il fondatori deve costare meno del listino in ogni variante, se no non ha senso.
    for (const v of OFFERTA_AMMINISTRAZIONE.varianti) {
      expect(prezzoFondatoriCents("mensile")).toBeLessThan(v.mensileCents);
      expect(prezzoFondatoriCents("annuale")).toBeLessThan(v.annualeCents);
    }
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

describe("prezzi dei piani (D5, 2026-09-23)", () => {
  it("IVA inclusa, Elite a 79 €, annuale = dieci mensilità", () => {
    expect(PREZZI_PIANI.monthly_starter.mensileCents).toBe(1900);
    expect(PREZZI_PIANI.monthly_pro.mensileCents).toBe(4900);
    expect(PREZZI_PIANI.monthly_elite.mensileCents).toBe(7900);
    for (const p of Object.values(PREZZI_PIANI)) expect(p.annualeCents).toBe(p.mensileCents * 10);
    expect(prezzoPianoCents("monthly_elite", "annuale")).toBe(79000);
  });

  it("lookup key dei piani: andata e ritorno", () => {
    expect(lookupKeyPiano("monthly_pro", "annuale")).toBe("piano_pro_annuale");
    for (const k of lookupKeysPianiAttese()) expect(pianoDaLookupKey(k.chiave)).not.toBeNull();
    expect(lookupKeysPianiAttese()).toHaveLength(6);
    expect(pianoDaLookupKey("amministrazione_a_mensile")).toBeNull();
    expect(pianoDaLookupKey("piano_platinum_mensile")).toBeNull();
  });

  it("gli abbonati storici restano riconosciuti (Elite a 59 € compreso), i nuovi per lookup key", () => {
    expect(pianoDaPrezzo({ id: "price_1TUdJjCaDBaDETvnCo3JKGJ7" })).toBe("monthly_elite");
    expect(pianoDaPrezzo({ id: "price_1TUdJjCaDBaDETvnCGbjTgIq" })).toBe("monthly_starter");
    expect(pianoDaPrezzo({ id: "price_nuovo", lookup_key: "piano_elite_annuale" })).toBe("monthly_elite");
    expect(pianoDaPrezzo({ id: "price_nuovo", lookup_key: "amministrazione_a_mensile" })).toBeNull();
    expect(pianoDaPrezzo(null)).toBeNull();
  });
});

describe("prezzoPianoStripe — si addebita solo il prezzo mostrato", () => {
  type FakePrice = { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null; active: boolean };
  const fakeStripe = (perChiave: Record<string, FakePrice>, storici: Record<string, FakePrice> = {}) =>
    ({
      prices: {
        list: async ({ lookup_keys }: { lookup_keys: string[] }) => ({ data: perChiave[lookup_keys[0]!] ? [perChiave[lookup_keys[0]!]] : [] }),
        retrieve: async (id: string) => {
          if (!storici[id]) throw new Error("no such price");
          return storici[id];
        },
      },
    }) as never;
  const piano = (id: string) => PLANS.find((p) => p.id === id)!;
  const prezzo = (id: string, cents: number, interval = "month"): FakePrice => ({ id, unit_amount: cents, currency: "eur", recurring: { interval }, active: true });

  it("usa il Price con la lookup key quando coincide", async () => {
    const stripe = fakeStripe({ piano_elite_annuale: prezzo("price_elite_y", 79000, "year") });
    expect(await prezzoPianoStripe(stripe, piano("monthly_elite"), "annuale")).toBe("price_elite_y");
  });

  it("rifiuta un Price con la lookup key giusta ma un importo diverso", async () => {
    const stripe = fakeStripe({ piano_pro_mensile: prezzo("price_pro_sbagliato", 5900) });
    await expect(prezzoPianoStripe(stripe, piano("monthly_pro"), "mensile")).rejects.toMatchObject({ codice: "PLAN_PRICE_MISMATCH" });
  });

  it("senza lookup key ripiega sul Price storico solo se ha lo stesso importo", async () => {
    const pro = piano("monthly_pro");
    expect(await prezzoPianoStripe(fakeStripe({}, { [pro.stripePriceId]: prezzo(pro.stripePriceId, 4900) }), pro, "mensile")).toBe(pro.stripePriceId);
    // Elite: lo storico è a 59 €, la pagina dice 79 € → niente checkout.
    const elite = piano("monthly_elite");
    await expect(prezzoPianoStripe(fakeStripe({}, { [elite.stripePriceId]: prezzo(elite.stripePriceId, 5900) }), elite, "mensile")).rejects.toBeInstanceOf(ErrorePrezzo);
    // L'annuale non ha storico.
    await expect(prezzoPianoStripe(fakeStripe({}, { [pro.stripePriceId]: prezzo(pro.stripePriceId, 4900) }), pro, "annuale")).rejects.toMatchObject({ codice: "PLAN_PRICE_MISSING" });
  });

  it("i preventivi singoli restano sui Price di sempre", async () => {
    const singolo = piano("oneshot_clean");
    expect(await prezzoPianoStripe(fakeStripe({}), singolo, "mensile")).toBe(singolo.stripePriceId);
  });
});
