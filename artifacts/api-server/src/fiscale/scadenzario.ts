import {
  db,
  fiscalDeadlinesTable,
  fiscalPaymentsTable,
  businessProfilesTable,
  type ScadenzaSalvata,
  type StatoScadenza,
  type TipoVersamento,
} from "@workspace/db";
import { motoreRevisionato, nonRevisionate, regoleDiAnno, type RegolaId, type Scadenza } from "@workspace/config";
import { and, eq, inArray } from "drizzle-orm";
import { calcoloCorrente, ErroreFiscale } from "./service.js";
import { CODICI_TRIBUTO_BOLLO, periodiBollo, scadenzaBollo, segnaVersato as segnaBolloVersato } from "../sdi/bollo.js";

// ── A-3: lo scadenzario ──────────────────────────────────────────────────────
// Un calendario solo per tutto ciò che ha una data e un importo: imposta
// sostitutiva, contributi INPS, bollo trimestrale, invio della dichiarazione.
// Prima di A-3 le prime due stavano nel motore fiscale (A-2) e il bollo nel
// modulo fatture (A-1), e nessuna delle due schermate sapeva dell'altra.
//
// **Le scadenze non si conservano: si ricalcolano.** Un incasso di ieri cambia
// il saldo di giugno; una riga salvata a gennaio sarebbe una bugia a giugno.
// Nel database sta solo ciò che il calcolo non può sapere — versata o no, con
// quale quietanza, quali promemoria sono già partiti — e ogni lettura
// riconcilia le due cose.
//
// Regola che vale per tutto il modulo: **niente si versa da qui**. Lo
// scadenzario prepara l'F24 e registra ciò che l'impresa dichiara di aver
// pagato (AMMINISTRAZIONE-PLAN.md §5).

/** Quanto indietro nel tempo teniamo le scadenze di un anno chiuso, per lo storico. */
const GIORNI_STORICO = 400;

export type VoceScadenzario = {
  scadenza: Scadenza;
  stato: StatoScadenza;
  /** Giorni che mancano: negativo se è già passata. */
  giorniAllaScadenza: number;
  scaduta: boolean;
  versataAt: string | null;
  quietanza: { url: string; nome: string; caricataAt: string } | null;
  promemoriaInviati: Record<string, string>;
  /**
   * Quanto è stato registrato come versato su questa scadenza. Può non
   * coincidere con l'importo calcolato: l'impresa versa quello che le dice il
   * suo commercialista, non quello che diciamo noi, e la differenza va vista.
   */
  versatoCents: number;
  /** Le regole non ancora confermate da un commercialista fra quelle usate (D6). */
  regoleNonRevisionate: readonly RegolaId[];
};

export type Scadenzario = {
  anno: number;
  voci: VoceScadenzario[];
  /** La prima scadenza aperta in ordine di data: è quella che va messa in cima. */
  prossima: VoceScadenzario | null;
  totaleApertoCents: number;
  scaduteCents: number;
  revisionato: boolean;
};

function giorniDa(data: Date, adesso: Date): number {
  const giorno = 86_400_000;
  const a = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const b = Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate());
  return Math.round((a - b) / giorno);
}

function dataDi(scadenza: Scadenza): Date {
  return new Date(`${scadenza.data}T12:00:00.000Z`);
}

/**
 * Le scadenze del bollo virtuale (A-1). Non vengono dal motore fiscale perché
 * il motore conosce solo il totale dell'anno: i trimestri li sa il modulo
 * fatture, che li ricalcola dalle trasmissioni.
 */
async function scadenzeBollo(userId: string, anno: number): Promise<Scadenza[]> {
  const periodi = await periodiBollo(userId, anno);
  return periodi
    .filter((p) => p.importoCents > 0)
    .map((p) => {
      const codiceTributo = CODICI_TRIBUTO_BOLLO[p.trimestre] ?? "";
      const data = (p.scadenza ?? scadenzaBollo(anno, p.trimestre)).toISOString().slice(0, 10);
      return {
        id: `bollo_t${p.trimestre}`,
        etichetta: `Imposta di bollo ${p.trimestre}° trimestre ${anno}`,
        data,
        importoCents: p.importoCents,
        categoria: "bollo" as const,
        descrizione: `Bollo virtuale su ${p.documenti} ${p.documenti === 1 ? "fattura emessa" : "fatture emesse"} nel trimestre. Prima di versare confronta con il prospetto dell'Agenzia nel portale Fatture e Corrispettivi, che è quello che fa fede.`,
        righe: [
          {
            sezione: "erario" as const,
            codiceTributo,
            descrizione: `Imposta di bollo — ${p.trimestre}° trimestre ${anno}`,
            annoRiferimento: anno,
            importoCents: p.importoCents,
            regole: ["F8", "F19"] as readonly RegolaId[],
          },
        ],
        regole: ["F8", "F19"] as readonly RegolaId[],
      };
    });
}

/** Tutte le scadenze calcolate dell'anno, in ordine di data. */
export async function scadenzeCalcolate(userId: string, anno: number): Promise<Scadenza[]> {
  const [{ calcolo }, bollo] = await Promise.all([calcoloCorrente(userId, anno), scadenzeBollo(userId, anno)]);
  return [...calcolo.scadenze, ...bollo].sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Allinea le righe di stato alle scadenze calcolate e restituisce le due cose
 * già unite. Le righe che il motore non genera più spariscono **solo** se non
 * sono mai state toccate: una scadenza segnata come versata resta, perché è
 * storia dell'impresa e non un artefatto del calcolo di oggi.
 */
export async function riconcilia(userId: string, anno: number, adesso = new Date()): Promise<Scadenzario> {
  const scadenze = await scadenzeCalcolate(userId, anno);
  const salvate = await db.select().from(fiscalDeadlinesTable).where(and(eq(fiscalDeadlinesTable.userId, userId), eq(fiscalDeadlinesTable.anno, anno)));
  const perChiave = new Map(salvate.map((r) => [r.chiave, r]));

  // Upsert della fotografia: etichetta, data e importo di oggi. Lo stato non
  // si tocca mai da qui — lo cambia solo l'impresa.
  for (const s of scadenze) {
    const esistente = perChiave.get(s.id);
    const valori = {
      etichetta: s.etichetta,
      data: dataDi(s),
      importoCents: s.importoCents,
      categoria: s.categoria,
    };
    if (esistente) {
      const cambiata =
        esistente.etichetta !== valori.etichetta ||
        esistente.importoCents !== valori.importoCents ||
        esistente.data.getTime() !== valori.data.getTime() ||
        esistente.categoria !== valori.categoria;
      if (cambiata) {
        const [aggiornata] = await db
          .update(fiscalDeadlinesTable)
          .set(valori)
          .where(eq(fiscalDeadlinesTable.id, esistente.id))
          .returning();
        if (aggiornata) perChiave.set(s.id, aggiornata);
      }
      continue;
    }
    const [creata] = await db
      .insert(fiscalDeadlinesTable)
      .values({ userId, anno, chiave: s.id, ...valori })
      .onConflictDoNothing()
      .returning();
    if (creata) perChiave.set(s.id, creata);
  }

  // Righe orfane: il motore non le genera più (l'impresa ha cambiato gestione
  // previdenziale, il bollo di un trimestre è sceso a zero dopo uno scarto).
  const chiaviVive = new Set(scadenze.map((s) => s.id));
  const orfaneDaTogliere = salvate.filter(
    (r) => !chiaviVive.has(r.chiave) && r.stato === "aperta" && Object.keys(r.promemoriaInviati).length === 0 && r.quietanzaUrl === "",
  );
  if (orfaneDaTogliere.length > 0) {
    await db.delete(fiscalDeadlinesTable).where(
      inArray(
        fiscalDeadlinesTable.id,
        orfaneDaTogliere.map((r) => r.id),
      ),
    );
    orfaneDaTogliere.forEach((r) => perChiave.delete(r.chiave));
  }

  const versamenti = await db
    .select({ chiave: fiscalPaymentsTable.scadenzaChiave, importo: fiscalPaymentsTable.importoCents })
    .from(fiscalPaymentsTable)
    .where(and(eq(fiscalPaymentsTable.userId, userId), eq(fiscalPaymentsTable.anno, anno)));
  const versatoPerChiave = new Map<string, number>();
  for (const v of versamenti) {
    if (!v.chiave) continue;
    versatoPerChiave.set(v.chiave, (versatoPerChiave.get(v.chiave) ?? 0) + v.importo);
  }

  const parametri = regoleDiAnno(anno);
  const voci: VoceScadenzario[] = [];

  for (const s of scadenze) {
    const riga = perChiave.get(s.id);
    voci.push(voce(s, riga, versatoPerChiave.get(s.id) ?? 0, parametri, adesso));
  }

  // Le orfane sopravvissute (versate in passato) restano in fondo, ricostruite
  // dalla loro fotografia: il calcolo di oggi non le produce più.
  for (const riga of perChiave.values()) {
    if (chiaviVive.has(riga.chiave)) continue;
    if (giorniDa(riga.data, adesso) < -GIORNI_STORICO) continue;
    voci.push(voce(daFotografia(riga), riga, versatoPerChiave.get(riga.chiave) ?? 0, parametri, adesso));
  }

  voci.sort((a, b) => a.scadenza.data.localeCompare(b.scadenza.data));
  const aperte = voci.filter((v) => v.stato === "aperta" && v.scadenza.importoCents > 0);

  return {
    anno,
    voci,
    prossima: aperte.find((v) => !v.scaduta) ?? aperte[0] ?? null,
    totaleApertoCents: aperte.reduce((s, v) => s + v.scadenza.importoCents, 0),
    scaduteCents: aperte.filter((v) => v.scaduta).reduce((s, v) => s + v.scadenza.importoCents, 0),
    revisionato: motoreRevisionato(parametri),
  };
}

/** Ricostruisce una scadenza dalla sua fotografia, per le righe che il motore non genera più. */
function daFotografia(riga: ScadenzaSalvata): Scadenza {
  return {
    id: riga.chiave,
    etichetta: riga.etichetta,
    data: riga.data.toISOString().slice(0, 10),
    importoCents: riga.importoCents,
    categoria: (riga.categoria as Scadenza["categoria"]) ?? "imposta",
    descrizione: "Scadenza registrata in passato: il calcolo di oggi non la genera più, ma resta nello storico perché è stata gestita.",
    righe: [],
    regole: [],
  };
}

function voce(
  scadenza: Scadenza,
  riga: ScadenzaSalvata | undefined,
  versatoCents: number,
  parametri: ReturnType<typeof regoleDiAnno>,
  adesso: Date,
): VoceScadenzario {
  const giorni = giorniDa(dataDi(scadenza), adesso);
  const stato: StatoScadenza = riga?.stato ?? (scadenza.importoCents === 0 && scadenza.categoria !== "dichiarazione" ? "non_dovuta" : "aperta");
  return {
    scadenza,
    stato,
    giorniAllaScadenza: giorni,
    scaduta: stato === "aperta" && giorni < 0,
    versataAt: riga?.versataAt?.toISOString() ?? null,
    quietanza:
      riga && riga.quietanzaUrl
        ? { url: riga.quietanzaUrl, nome: riga.quietanzaNome, caricataAt: riga.quietanzaCaricataAt?.toISOString() ?? "" }
        : null,
    promemoriaInviati: riga?.promemoriaInviati ?? {},
    versatoCents,
    regoleNonRevisionate: nonRevisionate(parametri, scadenza.regole),
  };
}

// ── Registrazione del versamento ─────────────────────────────────────────────

/**
 * Da quale riga del modello nasce quale tipo di versamento. Serve perché il
 * motore conta i contributi versati (deducibili per cassa, F6) separatamente
 * dagli acconti d'imposta: una delega di giugno che contenesse tutto sotto
 * "imposta" farebbe sparire una deduzione vera.
 */
function tipoDiRiga(chiave: string, sezione: "erario" | "inps", codiceTributo: string | undefined, parametri: ReturnType<typeof regoleDiAnno>): TipoVersamento {
  if (sezione === "inps") return "contributi_inps";
  if (chiave.startsWith("bollo_")) return "bollo";
  if (codiceTributo === parametri.acconti.codiceTributoSaldo) return "imposta_saldo";
  if (
    codiceTributo === parametri.acconti.codiceTributoPrimoAcconto ||
    codiceTributo === parametri.acconti.codiceTributoSecondoAcconto
  ) {
    return "imposta_acconto";
  }
  return "altro";
}

export type EsitoVersamento = { scadenza: string; versamenti: number; importoCents: number };

/**
 * Segna una scadenza come versata. Registra **una riga di versamento per ogni
 * riga del modello F24**, non una sola: la delega del 30 giugno contiene
 * imposta e contributi, e il motore deve poterli contare separatamente.
 *
 * L'importo lo decide l'impresa: se ha versato una cifra diversa da quella
 * calcolata, si registra la sua, e la differenza resta visibile nello
 * scadenzario. Noi non sappiamo cosa le ha detto il suo commercialista.
 */
export async function segnaVersata(params: {
  userId: string;
  anno: number;
  chiave: string;
  data: Date;
  importoCents?: number;
  riferimento?: string;
  note?: string;
}): Promise<EsitoVersamento> {
  const scadenze = await scadenzeCalcolate(params.userId, params.anno);
  const scadenza = scadenze.find((s) => s.id === params.chiave);
  if (!scadenza) throw new ErroreFiscale("not_found", "Questa scadenza non esiste per l'anno indicato.");
  if (scadenza.righe.length === 0) {
    throw new ErroreFiscale("non_versabile", "Questa scadenza è un adempimento, non un versamento: non c'è niente da registrare.");
  }

  const parametri = regoleDiAnno(params.anno);
  const totaleCalcolato = scadenza.importoCents;
  const totaleVersato = params.importoCents != null && params.importoCents > 0 ? Math.round(params.importoCents) : totaleCalcolato;
  if (totaleVersato <= 0) throw new ErroreFiscale("importo_non_valido", "L'importo versato dev'essere maggiore di zero.");

  // Se l'impresa ha versato una cifra diversa, le righe si riproporzionano
  // sulla stessa ripartizione: è l'unica ipotesi che non inventa nulla.
  const righe = scadenza.righe.map((r, i) => {
    const quota =
      totaleCalcolato > 0 ? Math.round((r.importoCents * totaleVersato) / totaleCalcolato) : Math.round(totaleVersato / scadenza.righe.length);
    return { riga: r, indice: i, importoCents: quota };
  });
  // L'arrotondamento va tutto sull'ultima riga, così la somma torna al centesimo.
  const scarto = totaleVersato - righe.reduce((s, r) => s + r.importoCents, 0);
  if (righe.length > 0) righe[righe.length - 1]!.importoCents += scarto;

  await annullaVersamento({ userId: params.userId, anno: params.anno, chiave: params.chiave, silenzioso: true });

  await db.insert(fiscalPaymentsTable).values(
    righe
      .filter((r) => r.importoCents > 0)
      .map((r) => ({
        userId: params.userId,
        anno: params.anno,
        tipo: tipoDiRiga(params.chiave, r.riga.sezione, r.riga.codiceTributo, parametri),
        data: params.data,
        importoCents: r.importoCents,
        codiceTributo: r.riga.sezione === "erario" ? (r.riga.codiceTributo ?? "") : (r.riga.causale ?? ""),
        riferimento: params.riferimento ?? "",
        note: params.note ?? "",
        origine: "manuale" as const,
        scadenzaChiave: params.chiave,
      })),
  );

  await db
    .update(fiscalDeadlinesTable)
    .set({ stato: "versata", versataAt: params.data })
    .where(and(eq(fiscalDeadlinesTable.userId, params.userId), eq(fiscalDeadlinesTable.anno, params.anno), eq(fiscalDeadlinesTable.chiave, params.chiave)));

  // Il bollo ha il suo stato nel modulo fatture (A-1): senza questo, il
  // pannello della fattura continuerebbe a dire "da versare".
  if (params.chiave.startsWith("bollo_t")) {
    const trimestre = Number(params.chiave.slice("bollo_t".length));
    if (trimestre >= 1 && trimestre <= 4) {
      await segnaBolloVersato({ userId: params.userId, anno: params.anno, trimestre, versato: true, riferimento: params.riferimento });
    }
  }

  return { scadenza: params.chiave, versamenti: righe.filter((r) => r.importoCents > 0).length, importoCents: totaleVersato };
}

/** Riapre una scadenza: cancella i versamenti che ne erano nati e la riporta ad aperta. */
export async function annullaVersamento(params: {
  userId: string;
  anno: number;
  chiave: string;
  silenzioso?: boolean;
}): Promise<void> {
  await db
    .delete(fiscalPaymentsTable)
    .where(
      and(
        eq(fiscalPaymentsTable.userId, params.userId),
        eq(fiscalPaymentsTable.anno, params.anno),
        eq(fiscalPaymentsTable.scadenzaChiave, params.chiave),
      ),
    );
  if (params.silenzioso) return;

  await db
    .update(fiscalDeadlinesTable)
    .set({ stato: "aperta", versataAt: null })
    .where(and(eq(fiscalDeadlinesTable.userId, params.userId), eq(fiscalDeadlinesTable.anno, params.anno), eq(fiscalDeadlinesTable.chiave, params.chiave)));

  if (params.chiave.startsWith("bollo_t")) {
    const trimestre = Number(params.chiave.slice("bollo_t".length));
    if (trimestre >= 1 && trimestre <= 4) {
      await segnaBolloVersato({ userId: params.userId, anno: params.anno, trimestre, versato: false });
    }
  }
}

// ── Quietanze ────────────────────────────────────────────────────────────────

/**
 * Allega la ricevuta del versamento. Il file è già nello storage (caricato dal
 * browser con l'URL firmato di `/api/storage/uploads/request-url`): qui si
 * registra soltanto dove sta, come per le altre ricevute del prodotto.
 */
export async function allegaQuietanza(params: {
  userId: string;
  anno: number;
  chiave: string;
  url: string;
  nome: string;
}): Promise<void> {
  const righe = await db
    .update(fiscalDeadlinesTable)
    .set({ quietanzaUrl: params.url, quietanzaNome: params.nome, quietanzaCaricataAt: new Date() })
    .where(and(eq(fiscalDeadlinesTable.userId, params.userId), eq(fiscalDeadlinesTable.anno, params.anno), eq(fiscalDeadlinesTable.chiave, params.chiave)))
    .returning({ id: fiscalDeadlinesTable.id });
  if (righe.length === 0) throw new ErroreFiscale("not_found", "Scadenza non trovata: aprila nello scadenzario prima di allegare la quietanza.");
}

/** Dove sta il file della quietanza, se c'è. */
export async function quietanzaDi(userId: string, anno: number, chiave: string): Promise<{ url: string; nome: string } | null> {
  const [riga] = await db
    .select({ url: fiscalDeadlinesTable.quietanzaUrl, nome: fiscalDeadlinesTable.quietanzaNome })
    .from(fiscalDeadlinesTable)
    .where(and(eq(fiscalDeadlinesTable.userId, userId), eq(fiscalDeadlinesTable.anno, anno), eq(fiscalDeadlinesTable.chiave, chiave)));
  return riga && riga.url ? riga : null;
}

export async function rimuoviQuietanza(params: { userId: string; anno: number; chiave: string }): Promise<void> {
  await db
    .update(fiscalDeadlinesTable)
    .set({ quietanzaUrl: "", quietanzaNome: "", quietanzaCaricataAt: null })
    .where(and(eq(fiscalDeadlinesTable.userId, params.userId), eq(fiscalDeadlinesTable.anno, params.anno), eq(fiscalDeadlinesTable.chiave, params.chiave)));
}

/** Dati del contribuente per il modello F24, presi dove già stanno. */
export async function contribuenteDi(userId: string, profiloFiscale: { matricolaInps: string; sedeInps: string }) {
  const [business] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return {
    denominazione: business?.companyName ?? "",
    codiceFiscale: business?.codiceFiscale ?? "",
    partitaIva: business?.vatNumber ?? "",
    comune: business?.city ?? "",
    provincia: business?.province ?? "",
    matricolaInps: profiloFiscale.matricolaInps,
    sedeInps: profiloFiscale.sedeInps,
  };
}
