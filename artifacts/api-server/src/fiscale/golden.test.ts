import { describe, expect, it } from "vitest";
import { calcola, CASI_GOLDEN, motoreRevisionato, regoleDiAnno } from "@workspace/config";

// ── I 5 casi golden della revisione professionale (D6) ───────────────────────
// Due modi di fallire, a seconda di dove siamo:
//
// · **oggi**, con `attesi: null`, il test verifica che ogni caso produca un
//   risultato coerente e che il motore si dichiari non revisionato. Stampa
//   anche i valori correnti: sono quelli da portare alla riunione col
//   commercialista, accanto alle sue cifre.
// · **dopo la riunione**, compilati gli `attesi` in `golden.ts`, il test
//   diventa un vincolo: qualunque modifica alle regole che sposti un centesimo
//   fa saltare il caso, e la modifica va rivista con lui.
//
// Vedi docs/compliance/REVISIONE-COMMERCIALISTA.md.

describe("casi golden del regime forfettario", () => {
  for (const caso of CASI_GOLDEN) {
    describe(`${caso.id} — ${caso.descrizione}`, () => {
      const calcolo = calcola(caso.ingresso);

      it("produce un calcolo coerente", () => {
        expect(calcolo.imponibileCents).toBeGreaterThanOrEqual(0);
        expect(calcolo.impostaCents).toBeGreaterThanOrEqual(0);
        expect(calcolo.contributi.totaleCents).toBeGreaterThanOrEqual(0);
        // L'imposta non può superare l'imponibile: è un assurdo che vale la
        // pena bloccare, perché arriverebbe dritto in faccia all'utente.
        expect(calcolo.impostaCents).toBeLessThanOrEqual(calcolo.imponibileCents);
        expect(calcolo.totaleDovutoCents).toBe(calcolo.impostaCents + calcolo.contributi.totaleCents + calcolo.bolloCents);
      });

      if (caso.attesi === null) {
        it("resta marcato come non verificato da un commercialista", () => {
          expect(calcolo.revisionato).toBe(false);
          expect(calcolo.regoleNonRevisionate.length).toBeGreaterThan(0);
        });
      } else {
        const attesi = caso.attesi;
        it(`corrisponde ai valori confermati dal commercialista (${caso.verifica})`, () => {
          expect(calcolo.imponibileCents).toBe(attesi.imponibileCents);
          expect(calcolo.impostaCents).toBe(attesi.impostaCents);
          expect(calcolo.contributi.totaleCents).toBe(attesi.contributiTotaliCents);
          // Solo le righe Erario: dopo A-3 quella scadenza è un F24 unico che
          // contiene anche l'eccedenza contributiva (sezione INPS).
          const giugno = calcolo.scadenze.find((s) => s.id === "saldo_primo_acconto");
          const erarioGiugno = (giugno?.righe ?? []).filter((r) => r.sezione === "erario").reduce((s, r) => s + r.importoCents, 0);
          expect(erarioGiugno).toBe(attesi.saldoEPrimoAccontoCents);
          expect(calcolo.scadenze.find((s) => s.id === "secondo_acconto")?.importoCents ?? 0).toBe(attesi.secondoAccontoCents);
        });
      }
    });
  }

  it("G4 e G5 distinguono l'uscita differita da quella immediata", () => {
    const g4 = CASI_GOLDEN.find((c) => c.id === "G4")!;
    const g5 = CASI_GOLDEN.find((c) => c.id === "G5")!;
    expect(calcola(g4.ingresso).soglia.livello).toBe("superata");
    expect(calcola(g5.ingresso).soglia.livello).toBe("fuori_regime");
  });

  it("finché D6 è aperta nessun caso può essere dichiarato verificato", () => {
    // Se questo test fallisce è perché qualcuno ha segnato le regole come
    // confermate: allora servono anche gli `attesi` nei 5 casi golden.
    const revisionato = motoreRevisionato(regoleDiAnno(2026));
    if (revisionato) {
      expect(CASI_GOLDEN.every((c) => c.attesi !== null)).toBe(true);
    } else {
      expect(CASI_GOLDEN.every((c) => c.attesi === null)).toBe(true);
    }
  });
});
