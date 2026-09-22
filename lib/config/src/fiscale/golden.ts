import type { IngressoCalcolo } from "./types";

// ── I cinque casi golden (docs/compliance/REVISIONE-COMMERCIALISTA.md) ───────
// Sono gli stessi profili mandati al commercialista. Ogni caso ha due colonne:
// `attesi`, cioè i valori che ci darà il professionista, e ciò che il motore
// produce oggi (calcolato dai test, non scritto qui).
//
// Finché `attesi` è `null` il test golden **non** confronta: registra il
// risultato corrente come istantanea e verifica soltanto che non cambi da
// solo. Quando arrivano i valori firmati si compila `attesi` e da quel momento
// il test è un vincolo vero: se qualcuno tocca le regole, il test salta.
//
// Questo è il meccanismo che chiude D6 sul lato codice. Il lato umano è la
// colonna Esito della checklist F1–F16 in `regole/2026.ts`.

export type ValoriAttesi = {
  imponibileCents: number;
  impostaCents: number;
  contributiTotaliCents: number;
  /**
   * Saldo + primo acconto alla scadenza di giugno dell'anno successivo.
   * È la parte **Erario** della delega: dopo A-3 quella scadenza porta nello
   * stesso F24 anche l'eccedenza contributiva, che qui non si conta perché
   * la colonna dei contributi è già `contributiTotaliCents`.
   */
  saldoEPrimoAccontoCents: number;
  secondoAccontoCents: number;
};

export type CasoGolden = {
  id: "G1" | "G2" | "G3" | "G4" | "G5";
  descrizione: string;
  /** Cosa verifica questo caso: serve a chi legge il fallimento del test. */
  verifica: string;
  ingresso: IngressoCalcolo;
  attesi: ValoriAttesi | null;
};

const BASE = {
  anno: 2026,
  fatturatoNonIncassatoCents: 0,
  pipelineCents: 0,
  accontiVersatiCents: 0,
  impostaAnnoPrecedenteCents: 0,
  bolloCents: 0,
  margineSicurezzaPercent: 10,
  meseCorrente: 1,
} as const;

export const CASI_GOLDEN: readonly CasoGolden[] = [
  {
    id: "G1",
    descrizione: "Idraulico, ATECO 43.22, aliquota 15 %, terzo anno di attività, 42.000 € incassati",
    verifica: "Caso base: coefficiente 86 %, contributi fissi interi, nessuna riduzione.",
    ingresso: {
      ...BASE,
      codiceAteco: "43.22.01",
      coefficientePercent: 86,
      gestione: "artigiani",
      riduzione: "nessuna",
      annoInizioAttivita: 2024,
      requisitiStartup: false,
      incassatiCents: 4_200_000,
      contributiVersatiCents: 452_136,
    },
    attesi: null,
  },
  {
    id: "G2",
    descrizione: "Elettricista, ATECO 43.21, aliquota 5 % start-up al primo anno, riduzione contributiva 50 %, 28.000 € incassati",
    verifica: "Aliquota start-up e riduzione per i nuovi iscritti applicate insieme.",
    ingresso: {
      ...BASE,
      codiceAteco: "43.21.01",
      coefficientePercent: 86,
      gestione: "artigiani",
      riduzione: "nuovi_iscritti_50",
      annoInizioAttivita: 2026,
      requisitiStartup: true,
      incassatiCents: 2_800_000,
      contributiVersatiCents: 226_068,
    },
    attesi: null,
  },
  {
    id: "G3",
    descrizione: "Imbianchino, ATECO 43.34, aliquota 15 %, riduzione contributiva 35 %, 61.000 € incassati",
    verifica: "Reddito oltre il minimale: compare la quota di eccedenza, ridotta del 35 %.",
    ingresso: {
      ...BASE,
      codiceAteco: "43.34.00",
      coefficientePercent: 86,
      gestione: "artigiani",
      riduzione: "forfettari_35",
      annoInizioAttivita: 2019,
      requisitiStartup: false,
      incassatiCents: 6_100_000,
      contributiVersatiCents: 293_888,
    },
    attesi: null,
  },
  {
    id: "G4",
    descrizione: "Muratore, ATECO 43.99, aliquota 15 %, 91.000 € incassati (soglia 85.000 superata a settembre)",
    verifica: "F1/F2: sopra 85.000 ma sotto 100.000, uscita dall'anno successivo.",
    ingresso: {
      ...BASE,
      codiceAteco: "43.99.01",
      coefficientePercent: 86,
      gestione: "artigiani",
      riduzione: "nessuna",
      annoInizioAttivita: 2015,
      requisitiStartup: false,
      incassatiCents: 9_100_000,
      contributiVersatiCents: 452_136,
      meseCorrente: 9,
    },
    attesi: null,
  },
  {
    id: "G5",
    descrizione: "Serramentista, ATECO 43.32, aliquota 15 %, 104.000 € incassati a novembre",
    verifica: "F2: oltre 100.000 l'uscita è immediata e l'IVA si applica dall'operazione che sfora.",
    ingresso: {
      ...BASE,
      codiceAteco: "43.32.01",
      coefficientePercent: 86,
      gestione: "artigiani",
      riduzione: "nessuna",
      annoInizioAttivita: 2012,
      requisitiStartup: false,
      incassatiCents: 10_400_000,
      contributiVersatiCents: 452_136,
      meseCorrente: 11,
    },
    attesi: null,
  },
];
