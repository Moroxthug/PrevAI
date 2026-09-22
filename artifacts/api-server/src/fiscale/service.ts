import {
  db,
  taxProfilesTable,
  fiscalPaymentsTable,
  businessProfilesTable,
  FISCO_ONBOARDING_STEPS,
  type FiscoOnboardingStep,
  type ProfiloFiscale,
  type TipoVersamento,
} from "@workspace/db";
// Il motore sta in @workspace/config e si importa da lì, non attraverso
// @workspace/db: è codice puro e non deve trascinarsi dietro il pool Postgres
// quando lo usa il frontend o un test.
import {
  atecoPlausibile,
  calcola,
  coefficienteDiAteco,
  motoreRevisionato,
  regoleDiAnno,
  simula,
  type Calcolo,
  type IngressoCalcolo,
  type Simulazione,
} from "@workspace/config";
import { and, desc, eq } from "drizzle-orm";
import { datiAnno, type DatiAnno } from "./dati.js";

// ── A-2: il servizio ─────────────────────────────────────────────────────────
// Mette insieme tre pezzi che restano separati apposta: il profilo dichiarato
// (tabella), i numeri dell'anno (`dati.ts`) e il motore puro
// (`@workspace/config/fiscale`). Qui non si calcola nulla a mano: se un numero
// serve, lo chiede al motore, perché il motore è la cosa che il commercialista
// revisionerà.

/**
 * Versione del testo dell'avviso "strumento, non consulenza". Cambiarla
 * ri-chiede la presa d'atto a tutti: si alza **solo** se il testo cambia in
 * sostanza, non per una virgola.
 */
export const VERSIONE_AVVISO = "2026-09-1";

export const AVVISO_NON_CONSULENZA =
  "PrevAI Amministrazione è uno strumento di calcolo: applica le regole del regime forfettario ai tuoi numeri e ti mostra come arriva a ogni importo. Non è consulenza fiscale e non sostituisce un commercialista. Le scelte con effetti duraturi — la riduzione contributiva, l'uscita dal regime, l'opzione per l'IVA — vanno discusse con un professionista. I versamenti li disponi tu.";

export class ErroreFiscale extends Error {
  constructor(
    readonly codice: string,
    message: string,
  ) {
    super(message);
  }
}

export async function profiloOCrea(userId: string): Promise<ProfiloFiscale> {
  const [esistente] = await db.select().from(taxProfilesTable).where(eq(taxProfilesTable.userId, userId));
  if (esistente) return esistente;
  const [creato] = await db.insert(taxProfilesTable).values({ userId }).onConflictDoNothing().returning();
  if (creato) return creato;
  const [riletto] = await db.select().from(taxProfilesTable).where(eq(taxProfilesTable.userId, userId));
  return riletto!;
}

export type AggiornamentoProfilo = Partial<{
  regime: "forfettario" | "altro";
  codiceAteco: string;
  coefficientePercent: number;
  gestione: ProfiloFiscale["gestione"];
  riduzione: ProfiloFiscale["riduzione"];
  annoInizioAttivita: number | null;
  requisitiStartup: boolean;
  ricaviAnnoPrecedenteCents: number;
  speseLavoroCents: number;
  redditoDipendenteCents: number;
  impostaAnnoPrecedenteCents: number;
  margineSicurezzaPercent: number;
  accettaAvviso: boolean;
  passoCompletato: FiscoOnboardingStep;
}>;

export async function aggiornaProfilo(userId: string, patch: AggiornamentoProfilo): Promise<ProfiloFiscale> {
  const attuale = await profiloOCrea(userId);

  if (patch.codiceAteco !== undefined && patch.codiceAteco !== "" && !atecoPlausibile(patch.codiceAteco)) {
    throw new ErroreFiscale("ateco_non_valido", "Il codice ATECO non sembra valido: servono almeno quattro cifre, per esempio 43.22.01.");
  }
  if (patch.coefficientePercent !== undefined && (patch.coefficientePercent < 0 || patch.coefficientePercent > 100)) {
    throw new ErroreFiscale("coefficiente_non_valido", "Il coefficiente di redditività è una percentuale fra 0 e 100.");
  }
  if (patch.margineSicurezzaPercent !== undefined && (patch.margineSicurezzaPercent < 0 || patch.margineSicurezzaPercent > 100)) {
    throw new ErroreFiscale("margine_non_valido", "Il margine di sicurezza è una percentuale fra 0 e 100.");
  }
  const annoCorrente = new Date().getUTCFullYear();
  if (patch.annoInizioAttivita != null && (patch.annoInizioAttivita < 1950 || patch.annoInizioAttivita > annoCorrente + 1)) {
    throw new ErroreFiscale("anno_non_valido", "L'anno di inizio attività non è plausibile.");
  }

  const onboarding = { ...attuale.onboarding };
  if (patch.passoCompletato) onboarding[patch.passoCompletato] = { doneAt: new Date().toISOString() };

  const valori: Partial<typeof taxProfilesTable.$inferInsert> = {
    ...(patch.regime !== undefined ? { regime: patch.regime } : {}),
    ...(patch.codiceAteco !== undefined ? { codiceAteco: patch.codiceAteco.trim() } : {}),
    ...(patch.coefficientePercent !== undefined ? { coefficientePercent: Math.round(patch.coefficientePercent) } : {}),
    ...(patch.gestione !== undefined ? { gestione: patch.gestione } : {}),
    ...(patch.riduzione !== undefined ? { riduzione: patch.riduzione } : {}),
    ...(patch.annoInizioAttivita !== undefined ? { annoInizioAttivita: patch.annoInizioAttivita } : {}),
    ...(patch.requisitiStartup !== undefined ? { requisitiStartup: patch.requisitiStartup } : {}),
    ...(patch.ricaviAnnoPrecedenteCents !== undefined ? { ricaviAnnoPrecedenteCents: Math.max(0, Math.round(patch.ricaviAnnoPrecedenteCents)) } : {}),
    ...(patch.speseLavoroCents !== undefined ? { speseLavoroCents: Math.max(0, Math.round(patch.speseLavoroCents)) } : {}),
    ...(patch.redditoDipendenteCents !== undefined ? { redditoDipendenteCents: Math.max(0, Math.round(patch.redditoDipendenteCents)) } : {}),
    ...(patch.impostaAnnoPrecedenteCents !== undefined ? { impostaAnnoPrecedenteCents: Math.max(0, Math.round(patch.impostaAnnoPrecedenteCents)) } : {}),
    ...(patch.margineSicurezzaPercent !== undefined ? { margineSicurezzaPercent: Math.round(patch.margineSicurezzaPercent) } : {}),
    ...(patch.accettaAvviso ? { avvisoAccettatoAt: new Date(), avvisoVersione: VERSIONE_AVVISO } : {}),
    onboarding,
  };

  const [aggiornato] = await db.update(taxProfilesTable).set(valori).where(eq(taxProfilesTable.userId, userId)).returning();
  return await completaSeFinito(aggiornato!);
}

/** I passi che mancano all'onboarding, dedotti dai dati veri e non da un flag. */
export function passiMancanti(profilo: ProfiloFiscale): FiscoOnboardingStep[] {
  const mancanti: FiscoOnboardingStep[] = [];
  if (!profilo.regime) mancanti.push("regime");
  if (!profilo.codiceAteco) mancanti.push("ateco");
  if (profilo.gestione === "nessuna") mancanti.push("previdenza");
  if (profilo.annoInizioAttivita == null) mancanti.push("storico");
  if (!profilo.avvisoAccettatoAt || profilo.avvisoVersione !== VERSIONE_AVVISO) mancanti.push("avviso");
  return mancanti;
}

async function completaSeFinito(profilo: ProfiloFiscale): Promise<ProfiloFiscale> {
  const finito = passiMancanti(profilo).length === 0;
  if (finito === Boolean(profilo.completatoAt)) return profilo;
  const [aggiornato] = await db
    .update(taxProfilesTable)
    .set({ completatoAt: finito ? new Date() : null })
    .where(eq(taxProfilesTable.userId, profilo.userId))
    .returning();
  return aggiornato ?? profilo;
}

/** Ingresso del motore per un anno, con la possibilità di forzare qualche numero (simulatore). */
export async function ingressoDi(
  userId: string,
  anno: number,
  override: Partial<IngressoCalcolo> = {},
): Promise<{ ingresso: IngressoCalcolo; profilo: ProfiloFiscale; dati: DatiAnno }> {
  const profilo = await profiloOCrea(userId);
  const dati = await datiAnno(userId, anno);
  const coefficiente =
    profilo.coefficientePercent > 0 ? profilo.coefficientePercent : coefficienteDiAteco(profilo.codiceAteco).coefficientePercent;

  const ingresso: IngressoCalcolo = {
    anno,
    codiceAteco: profilo.codiceAteco,
    coefficientePercent: coefficiente,
    gestione: profilo.gestione,
    riduzione: profilo.riduzione,
    annoInizioAttivita: profilo.annoInizioAttivita,
    requisitiStartup: profilo.requisitiStartup,
    incassatiCents: dati.incassatiCents,
    fatturatoNonIncassatoCents: dati.fatturatoNonIncassatoCents,
    pipelineCents: dati.pipelineCents,
    contributiVersatiCents: dati.contributiVersatiCents,
    accontiVersatiCents: dati.accontiVersatiCents,
    impostaAnnoPrecedenteCents: profilo.impostaAnnoPrecedenteCents,
    bolloCents: dati.bolloCents,
    margineSicurezzaPercent: profilo.margineSicurezzaPercent,
    meseCorrente: anno === new Date().getUTCFullYear() ? new Date().getUTCMonth() + 1 : 12,
    ...override,
  };
  return { ingresso, profilo, dati };
}

export type CalcoloCompleto = {
  calcolo: Calcolo;
  dati: DatiAnno;
  profilo: ProfiloFiscale;
  /** Passi che mancano: finché ce n'è uno, il calcolo è parziale e va detto. */
  passiMancanti: FiscoOnboardingStep[];
  /** Controlli di permanenza nel regime sull'anno precedente (F3/F4). */
  requisiti: { id: string; etichetta: string; rispettato: boolean; dettaglio: string }[];
};

export async function calcoloCorrente(userId: string, anno: number): Promise<CalcoloCompleto> {
  const { ingresso, profilo, dati } = await ingressoDi(userId, anno);
  const calcolo = calcola(ingresso);
  const p = regoleDiAnno(anno);

  const requisiti = [
    {
      id: "F3",
      etichetta: "Spese per lavoro dipendente e collaboratori entro 20.000 € lordi",
      rispettato: profilo.speseLavoroCents <= p.sogliaSpeseLavoroCents,
      dettaglio: `Hai dichiarato ${(profilo.speseLavoroCents / 100).toFixed(2)} € per l'anno precedente.`,
    },
    {
      id: "F4",
      etichetta: "Redditi da lavoro dipendente dell'anno precedente entro 35.000 €",
      rispettato: profilo.redditoDipendenteCents <= p.sogliaRedditoDipendenteCents,
      dettaglio: `Hai dichiarato ${(profilo.redditoDipendenteCents / 100).toFixed(2)} € per l'anno precedente.`,
    },
    {
      id: "F1",
      etichetta: "Ricavi dell'anno precedente entro 85.000 €",
      rispettato: profilo.ricaviAnnoPrecedenteCents <= p.sogliaRicaviCents,
      dettaglio: `Hai dichiarato ${(profilo.ricaviAnnoPrecedenteCents / 100).toFixed(2)} € per l'anno precedente.`,
    },
  ];

  return { calcolo, dati, profilo, passiMancanti: passiMancanti(profilo), requisiti };
}

export async function simulazione(userId: string, anno: number, importoCents: number): Promise<Simulazione> {
  const { ingresso } = await ingressoDi(userId, anno);
  return simula(ingresso, importoCents);
}

// ── Versamenti ───────────────────────────────────────────────────────────────

export async function versamentiDi(userId: string, anno: number) {
  return db
    .select()
    .from(fiscalPaymentsTable)
    .where(and(eq(fiscalPaymentsTable.userId, userId), eq(fiscalPaymentsTable.anno, anno)))
    .orderBy(desc(fiscalPaymentsTable.data));
}

export async function registraVersamento(params: {
  userId: string;
  anno: number;
  tipo: TipoVersamento;
  data: Date;
  importoCents: number;
  codiceTributo?: string;
  riferimento?: string;
  note?: string;
}) {
  if (params.importoCents <= 0) throw new ErroreFiscale("importo_non_valido", "L'importo del versamento dev'essere maggiore di zero.");
  const [riga] = await db
    .insert(fiscalPaymentsTable)
    .values({
      userId: params.userId,
      anno: params.anno,
      tipo: params.tipo,
      data: params.data,
      importoCents: Math.round(params.importoCents),
      codiceTributo: params.codiceTributo ?? "",
      riferimento: params.riferimento ?? "",
      note: params.note ?? "",
      origine: "manuale",
    })
    .returning();
  return riga!;
}

export async function eliminaVersamento(userId: string, id: string): Promise<void> {
  const eliminati = await db
    .delete(fiscalPaymentsTable)
    .where(and(eq(fiscalPaymentsTable.id, id), eq(fiscalPaymentsTable.userId, userId)))
    .returning({ id: fiscalPaymentsTable.id });
  if (eliminati.length === 0) throw new ErroreFiscale("not_found", "Versamento non trovato.");
}

// ── Serializzazione per le API ───────────────────────────────────────────────

export function serializzaProfilo(profilo: ProfiloFiscale) {
  const coefficiente = coefficienteDiAteco(profilo.codiceAteco);
  return {
    regime: profilo.regime,
    codiceAteco: profilo.codiceAteco,
    coefficientePercent: profilo.coefficientePercent,
    coefficienteEffettivo: profilo.coefficientePercent > 0 ? profilo.coefficientePercent : coefficiente.coefficientePercent,
    coefficienteDescrizione: coefficiente.descrizione,
    coefficienteRiconosciuto: coefficiente.riconosciuto,
    gestione: profilo.gestione,
    riduzione: profilo.riduzione,
    annoInizioAttivita: profilo.annoInizioAttivita,
    requisitiStartup: profilo.requisitiStartup,
    ricaviAnnoPrecedenteCents: profilo.ricaviAnnoPrecedenteCents,
    speseLavoroCents: profilo.speseLavoroCents,
    redditoDipendenteCents: profilo.redditoDipendenteCents,
    impostaAnnoPrecedenteCents: profilo.impostaAnnoPrecedenteCents,
    margineSicurezzaPercent: profilo.margineSicurezzaPercent,
    onboarding: profilo.onboarding,
    completatoAt: profilo.completatoAt,
    avvisoAccettato: Boolean(profilo.avvisoAccettatoAt) && profilo.avvisoVersione === VERSIONE_AVVISO,
    passiMancanti: passiMancanti(profilo),
    passi: FISCO_ONBOARDING_STEPS,
  };
}

/**
 * Stato della revisione professionale del motore, così com'è oggi. L'interfaccia
 * lo mostra sempre, non solo quando è negativo: un numero fiscale senza il suo
 * grado di affidabilità è peggio di nessun numero.
 */
export function statoRevisione(anno: number) {
  const p = regoleDiAnno(anno);
  return {
    annoRegole: p.anno,
    revisionato: motoreRevisionato(p),
    regole: Object.values(p.regole).map((r) => ({
      id: r.id,
      titolo: r.titolo,
      fonte: r.fonte,
      stato: r.revisione.stato,
      da: r.revisione.da ?? null,
      il: r.revisione.il ?? null,
      nota: r.revisione.nota ?? null,
    })),
  };
}

/** La 2FA è un requisito del modulo Amministrazione (A-0): senza, non si entra. */
export async function requisitiDiSicurezza(userId: string): Promise<{ twoFactorRequired: boolean }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return { twoFactorRequired: Boolean(profile?.twoFactorRequired) };
}
