// Moduli delle pagine città × mestiere. Ogni modulo trasforma i dati veri del
// comune (fatti.ts) e il profilo locale (profili.ts) in una sezione, con un
// peso = interesse del mestiere × rilevanza in quella città. La pagina mostra
// solo i moduli sopra soglia, in ordine di peso: Sondrio×tetto apre con il
// carico neve, Messina×edilizia con la zona sismica 1, Venezia×imbianchino
// con l'umidità della laguna. Nessun numero stimato: solo dati con fonte.

import {
  type FattiCitta, type ZonaClimatica,
  RISCALDAMENTO, TRASMITTANZA_MAX, SISMICA_AG, caricoNeve, formulaNeve, num,
} from "./fatti";
import type { ProfiloCitta } from "./profili";

export type Blocco =
  | { tipo: "testo"; paragrafi: string[] }
  | { tipo: "dati"; voci: { etichetta: string; valore: string; nota?: string }[] }
  | { tipo: "calcolo"; formula: string; risultato: string; spiegazione: string[] }
  | { tipo: "tabella"; colonne: string[]; righe: string[][]; nota?: string }
  | { tipo: "avviso"; paragrafi: string[] }
  | { tipo: "voci"; intro: string; voci: { voce: string; perche?: string }[] }
  | { tipo: "lista"; intro?: string; punti: string[] };

export interface Sezione {
  id: string;
  titolo: string;
  blocco: Blocco;
  peso: number;
  /** Frammento per title/intro (es. "carico neve 1,65 kN/m²"). */
  gancio?: string;
  /** Riga di commento del mestiere sotto il blocco. */
  nota?: string;
  faq?: { q: string; a: string };
}

export interface Ctx {
  f: FattiCitta;
  p: ProfiloCitta;
  settore: string;
}

// ─── Mestieri ────────────────────────────────────────────────────────────────

interface Mestiere {
  chi: string; // "gli elettricisti"
  lavoro: string; // "un impianto elettrico"
  pesi: Partial<Record<IdModulo, number>>;
  voci: string[];
}

type IdModulo =
  | "riscaldamento" | "trasmittanza" | "sismica" | "neve" | "teleriscaldamento"
  | "vincoli" | "costiera" | "umidita" | "cantiere" | "rischi" | "raffrescamento" | "verde";

export const MESTIERI: Record<string, Mestiere> = {
  imbianchino: {
    chi: "gli imbianchini", lavoro: "una tinteggiatura",
    pesi: { riscaldamento: 1, trasmittanza: 3, vincoli: 3, costiera: 3, umidita: 3, cantiere: 2, rischi: 1 },
    voci: ["Protezione di pavimenti e arredi", "Stuccatura e rasatura delle parti ammalorate", "Fissativo di fondo", "Pittura in due mani al mq", "Pulizia e smaltimento"],
  },
  pittore: {
    chi: "i pittori edili", lavoro: "una verniciatura o tinteggiatura di facciata",
    pesi: { riscaldamento: 1, trasmittanza: 3, vincoli: 4, costiera: 3, umidita: 3, cantiere: 2, rischi: 1 },
    voci: ["Ponteggio o piattaforma, con occupazione di suolo pubblico se serve", "Idrolavaggio e rimozione delle parti incoerenti", "Ripristino degli intonaci", "Fondo e pittura ai silossani o ai silicati", "Verniciatura di ringhiere e persiane"],
  },
  elettricista: {
    chi: "gli elettricisti", lavoro: "un impianto elettrico",
    pesi: { riscaldamento: 1, teleriscaldamento: 1, vincoli: 1, costiera: 2, umidita: 1, cantiere: 2, rischi: 1, raffrescamento: 3 },
    voci: ["Quadro con differenziali per circuito", "Punti luce e prese per stanza", "Linee dedicate (induzione, clima, pompa di calore)", "Impianto di terra ed equipotenziale", "Dichiarazione di Conformità (D.M. 37/2008)"],
  },
  idraulico: {
    chi: "gli idraulici", lavoro: "un intervento idraulico",
    pesi: { riscaldamento: 3, teleriscaldamento: 3, vincoli: 1, umidita: 1, cantiere: 2, rischi: 2, raffrescamento: 1 },
    voci: ["Rete di adduzione in multistrato", "Scarichi fino alla colonna", "Posa dei sanitari", "Prova di tenuta e collaudo", "Dichiarazione di Conformità (D.M. 37/2008)"],
  },
  termoidraulico: {
    chi: "i termoidraulici", lavoro: "un impianto termico",
    pesi: { riscaldamento: 4, trasmittanza: 1, teleriscaldamento: 4, cantiere: 2, rischi: 1, raffrescamento: 2 },
    voci: ["Generatore (caldaia a condensazione o pompa di calore)", "Distribuzione e collettori", "Termostati e valvole termostatiche", "Libretto d'impianto e registrazione nel catasto regionale", "Dichiarazione di Conformità (D.M. 37/2008)"],
  },
  condizionatori: {
    chi: "gli installatori di climatizzatori", lavoro: "un impianto di climatizzazione",
    pesi: { riscaldamento: 2, teleriscaldamento: 1, vincoli: 3, costiera: 3, cantiere: 2, raffrescamento: 4 },
    voci: ["Unità esterna e interne (kW/BTU, classe energetica)", "Linee frigorifere e scarico condensa", "Staffe, foro passante, collegamento elettrico", "Vuoto, carica e collaudo", "Registrazione F-gas"],
  },
  edilizia: {
    chi: "le imprese edili", lavoro: "un lavoro edile",
    pesi: { riscaldamento: 1, trasmittanza: 2, sismica: 4, neve: 1, vincoli: 3, costiera: 1, umidita: 2, cantiere: 3, rischi: 3 },
    voci: ["Allestimento di cantiere e sicurezza", "Demolizioni e smaltimenti", "Murature, intonaci e massetti", "Assistenza muraria agli impianti", "Pratiche edilizie e strutturali, se servono"],
  },
  ristrutturazione: {
    chi: "le imprese di ristrutturazione", lavoro: "una ristrutturazione",
    pesi: { riscaldamento: 2, trasmittanza: 2, sismica: 3, neve: 1, teleriscaldamento: 1, vincoli: 3, costiera: 1, umidita: 2, cantiere: 3, rischi: 2, raffrescamento: 1 },
    voci: ["Demolizioni e smaltimenti", "Impianti elettrico e idraulico", "Massetti, pavimenti e rivestimenti", "Serramenti interni ed esterni", "Tinteggiature e pulizia finale"],
  },
  muratore: {
    chi: "i muratori", lavoro: "un lavoro di muratura",
    pesi: { trasmittanza: 2, sismica: 4, neve: 1, vincoli: 3, costiera: 1, umidita: 2, cantiere: 3, rischi: 3 },
    voci: ["Demolizioni e tracce", "Murature e tramezzi", "Intonaci e rasature", "Massetti", "Carico e smaltimento delle macerie"],
  },
  geometra: {
    chi: "i geometri", lavoro: "una pratica tecnica",
    pesi: { riscaldamento: 1, trasmittanza: 3, sismica: 4, neve: 2, vincoli: 4, umidita: 1, cantiere: 1, rischi: 3 },
    voci: ["Sopralluogo e rilievo", "Pratica edilizia (CILA, SCIA o permesso)", "Pratica strutturale, se l'intervento la richiede", "Aggiornamento catastale (DOCFA)", "Direzione lavori e fine lavori"],
  },
  carpentiere: {
    chi: "i carpentieri", lavoro: "una struttura in legno o in acciaio",
    pesi: { trasmittanza: 1, sismica: 3, neve: 4, vincoli: 2, costiera: 2, umidita: 1, cantiere: 2, rischi: 2 },
    voci: ["Progetto e calcolo dei carichi", "Fornitura di legno lamellare o acciaio", "Montaggio con mezzi di sollevamento", "Ancoraggi e collegamenti", "Trattamenti protettivi"],
  },
  falegname: {
    chi: "i falegnami", lavoro: "un lavoro di falegnameria",
    pesi: { trasmittanza: 1, neve: 2, vincoli: 3, costiera: 2, umidita: 3, cantiere: 2, rischi: 1 },
    voci: ["Rilievo misure in opera", "Essenza e trattamento del legno", "Ferramenta", "Posa e regolazioni", "Finitura e protezione"],
  },
  tetto: {
    chi: "le imprese di coperture", lavoro: "un rifacimento del tetto",
    pesi: { riscaldamento: 1, trasmittanza: 4, sismica: 2, neve: 5, vincoli: 3, costiera: 2, umidita: 1, cantiere: 2, rischi: 2 },
    voci: ["Ponteggio e linea vita", "Rimozione del manto e smaltimento", "Isolamento e guaina", "Manto di copertura", "Lattonerie, grondaie e pluviali"],
  },
  serramentista: {
    chi: "i serramentisti", lavoro: "una sostituzione di serramenti",
    pesi: { riscaldamento: 2, trasmittanza: 5, vincoli: 3, costiera: 3, umidita: 1, cantiere: 2, rischi: 1 },
    voci: ["Rilievo delle misure", "Serramento con valore Uw certificato", "Smontaggio e smaltimento dei vecchi infissi", "Posa con nastri e sigillature", "Documenti per la detrazione (scheda ENEA se dovuta)"],
  },
  piastrellista: {
    chi: "i piastrellisti", lavoro: "una posa di piastrelle",
    pesi: { riscaldamento: 1, trasmittanza: 1, vincoli: 1, costiera: 1, umidita: 3, cantiere: 2, rischi: 1 },
    voci: ["Preparazione e livellamento del fondo", "Impermeabilizzazione delle zone umide", "Posa al mq per formato", "Fughe e sigillature", "Battiscopa e profili"],
  },
  pavimentista: {
    chi: "i pavimentisti", lavoro: "un pavimento",
    pesi: { riscaldamento: 2, trasmittanza: 2, vincoli: 1, umidita: 3, cantiere: 2, rischi: 1 },
    voci: ["Verifica dell'umidità del massetto", "Preparazione del fondo", "Posa di gres, parquet o resina", "Levigatura o trattamento finale", "Battiscopa e soglie"],
  },
  giardiniere: {
    chi: "i giardinieri", lavoro: "un lavoro di giardinaggio",
    pesi: { costiera: 3, cantiere: 2, rischi: 1, verde: 5 },
    voci: ["Taglio del prato e sagomatura siepi", "Potature", "Impianto di irrigazione", "Messa a dimora di piante", "Raccolta e smaltimento del verde"],
  },
};

// ─── Rilevanza in città ──────────────────────────────────────────────────────

function rilevanza(id: IdModulo, { f, p }: Ctx): number {
  switch (id) {
    case "riscaldamento": return f.gradiGiorno / 2000;
    case "trasmittanza": return 1;
    case "sismica": return ({ 1: 1.7, 2: 1.3, 3: 0.75, 4: 0.3 } as const)[f.zonaSismica];
    case "neve": return caricoNeve(f.zonaNeve, f.altitudine) / 1.2;
    case "teleriscaldamento": return p.teleriscaldamento ? 1.1 : 0;
    case "vincoli": return p.unesco ? 1.2 : p.materiale ? 0.8 : 0;
    case "costiera": return p.costiera ? 1 : 0;
    case "umidita": return p.umida ? 1.1 : 0;
    case "cantiere": return 1;
    case "rischi": return p.rischi ? 0.9 : 0;
    case "raffrescamento": return ({ A: 1.6, B: 1.5, C: 1.25, D: 1, E: 0.7, F: 0.5 } as Record<ZonaClimatica, number>)[f.zonaClimatica];
    case "verde": return 1;
  }
}

// ─── Moduli ──────────────────────────────────────────────────────────────────

const SOGLIA = 0.9;

/** Cosa si trova nei cantieri della città, letto con gli occhi del mestiere. */
const COSA_TROVI: Record<string, string> = {
  imbianchino: "Per chi tinteggia, ogni tipologia ha i suoi problemi ricorrenti: intonaci a calce da non coprire con pitture plastiche negli edifici storici, crepe da assestamento nei condomini del dopoguerra, muffa nelle case poco isolate.",
  pittore: "Per le facciate conta l'epoca: intonaci a calce e decorazioni negli edifici storici, rivestimenti e cemento armato a vista da trattare nei condomini del secondo Novecento.",
  elettricista: "Negli edifici d'epoca e del dopoguerra si trovano spesso impianti senza differenziale adeguato o senza conduttore di terra: il sopralluogo decide tra messa a norma e rifacimento.",
  idraulico: "Negli edifici più vecchi le colonne in ferro zincato o piombo sono a fine vita; nei condomini il punto critico è l'innesto sulle colonne comuni.",
  termoidraulico: "Il tipo di edificio decide l'impianto: centralizzato con contabilizzazione nei condomini, autonomo nelle case singole, con radiatori su impianti spesso a colonne montanti.",
  condizionatori: "Nei condomini contano il regolamento e la posizione delle unità esterne; nelle case singole lo spazio per l'unità esterna e il percorso delle linee.",
  edilizia: "Ogni epoca ha la sua struttura: murature portanti negli edifici storici, telai in cemento armato dal dopoguerra. Il sopralluogo deve dire su cosa si interviene.",
  ristrutturazione: "Ogni epoca ha le sue sorprese: solai in legno e murature miste negli edifici storici, impianti da rifare e massetti alti nei condomini del dopoguerra.",
  muratore: "Murature in pietra o mattoni pieni negli edifici storici, laterizio forato e cemento armato nel dopoguerra: malte e tecniche cambiano.",
  geometra: "Prima del preventivo conviene un accesso agli atti: negli edifici più vecchi lo stato legittimo va ricostruito e le difformità sono frequenti.",
  carpentiere: "Coperture in legno da consolidare negli edifici storici, tettoie e soppalchi nelle case singole, strutture in acciaio negli spazi produttivi.",
  falegname: "Negli edifici storici si restaurano portoni e scuri originali; nelle case recenti si lavora su misura per interni e serramenti.",
  tetto: "Coppi e orditure in legno negli edifici storici, solai inclinati in laterocemento nel dopoguerra: rimozione e smaltimento cambiano molto.",
  serramentista: "Nei condomini il cambio dei serramenti deve rispettare il decoro della facciata; negli edifici d'epoca spesso servono serramenti in legno su misura.",
  piastrellista: "Nei bagni degli anni '60–'80 si demoliscono rivestimenti su malta: sottofondi irregolari e impianti da rifare sono la norma.",
  pavimentista: "Nei palazzi d'epoca si trovano parquet e graniglie da recuperare; nei condomini del dopoguerra marmette e massetti da verificare prima della nuova posa.",
  giardiniere: "Giardini condominiali con manutenzione a contratto, piccoli giardini privati e terrazzi: ogni cliente chiede un preventivo diverso.",
};

function sezioneCostruito({ f, p, settore }: Ctx): Sezione {
  return {
    id: "costruito",
    titolo: `Che edifici si trovano a ${f.nome}`,
    peso: 1.6,
    blocco: { tipo: "testo", paragrafi: [p.costruito, COSA_TROVI[settore] ?? ""].filter(Boolean) },
    nota: `Quartieri di esempio: ${p.quartieri.join(", ")}.`,
  };
}

export function sezioniPerPagina(ctx: Ctx): Sezione[] {
  const m = MESTIERI[ctx.settore];
  if (!m) return [];
  const out: Sezione[] = [sezioneCostruito(ctx)];
  for (const [id, interesse] of Object.entries(m.pesi) as [IdModulo, number][]) {
    const peso = interesse * rilevanza(id, ctx);
    if (peso < SOGLIA) continue;
    const s = COSTRUTTORI[id](ctx, m);
    if (s) out.push({ ...s, peso });
  }
  return out.sort((a, b) => b.peso - a.peso);
}

type Costruttore = (ctx: Ctx, m: Mestiere) => Omit<Sezione, "peso"> | null;

const COSTRUTTORI: Record<IdModulo, Costruttore> = {
  riscaldamento: ({ f, settore }) => {
    const r = RISCALDAMENTO[f.zonaClimatica];
    const periodo = r.ore ? `dal ${r.dal} al ${r.al}, fino a ${r.ore} ore al giorno` : "senza limiti di periodo";
    const perMestiere: Record<string, string> = {
      termoidraulico: `Con ${num(f.gradiGiorno)} gradi giorno il generatore va dimensionato su una stagione lunga: in zona ${f.zonaClimatica} conviene indicare nel preventivo la potenza, il rendimento stagionale e, per una pompa di calore, la temperatura di progetto esterna usata.`,
      idraulico: `La stagione di riscaldamento (${periodo}) decide quando si può fermare l'impianto: lavori su caldaia, colonne e radiatori si programmano fuori stagione, oppure con un impianto provvisorio indicato nel preventivo.`,
      condizionatori: f.gradiGiorno > 2100
        ? `Con ${num(f.gradiGiorno)} gradi giorno una pompa di calore aria-aria può scaldare, ma va scelta con la resa dichiarata alle basse temperature: nel preventivo scrivete la potenza a −7 °C, non solo quella nominale.`
        : `Con ${num(f.gradiGiorno)} gradi giorno l'inverno è breve: una pompa di calore aria-aria copre bene anche il riscaldamento, ed è un argomento da mettere nel preventivo.`,
      serramentista: `Con ${num(f.gradiGiorno)} gradi giorno e il riscaldamento acceso ${periodo}, il risparmio di un serramento con Uw basso si vede in bolletta: è l'argomento più forte nel preventivo.`,
      pavimentista: f.gradiGiorno > 2100
        ? `In zona ${f.zonaClimatica} il riscaldamento a pavimento è diffuso: prima di posare va verificato il ciclo di accensione del massetto, e il parquet deve essere adatto e con resistenza termica bassa.`
        : `In zona ${f.zonaClimatica} il riscaldamento a pavimento è meno comune; dove c'è, il massetto va comunque portato in temperatura prima della posa.`,
      imbianchino: `Con il riscaldamento acceso ${periodo} le pareti fredde vicino a finestre e ponti termici condensano: muffa e annerimenti sono il problema più frequente da preventivare.`,
      pittore: `Le facciate lavorano con forti escursioni termiche: in zona ${f.zonaClimatica} contano cicli di gelo e disgelo e la scelta di pitture traspiranti.`,
      ristrutturazione: `In zona ${f.zonaClimatica}, con ${num(f.gradiGiorno)} gradi giorno, isolamento e impianto termico pesano sulla bolletta più di ogni finitura: conviene preventivarli insieme.`,
      tetto: `Con ${num(f.gradiGiorno)} gradi giorno il tetto è la superficie da cui si disperde più calore: isolare la copertura è l'intervento con il ritorno più rapido.`,
      edilizia: `Con ${num(f.gradiGiorno)} gradi giorno ogni intervento sull'involucro va pensato anche per l'isolamento.`,
      geometra: `La zona climatica ${f.zonaClimatica} fissa i requisiti energetici della pratica (relazione ex Legge 10/1991) e le soglie per le detrazioni.`,
      elettricista: `Nelle case che passano alla pompa di calore la potenza impegnata cresce: in zona ${f.zonaClimatica} va verificato il contatore e preventivata una linea dedicata.`,
      piastrellista: `Sui pavimenti radianti, diffusi in zona ${f.zonaClimatica}, servono colle e fughe per riscaldamento a pavimento e giunti di dilatazione.`,
    };
    return {
      id: "riscaldamento",
      titolo: `Zona climatica ${f.zonaClimatica} e stagione di riscaldamento a ${f.nome}`,
      gancio: `zona ${f.zonaClimatica}, ${num(f.gradiGiorno)} gradi giorno`,
      blocco: {
        tipo: "dati",
        voci: [
          { etichetta: "Zona climatica", valore: f.zonaClimatica, nota: "D.P.R. 412/1993" },
          { etichetta: "Gradi giorno", valore: num(f.gradiGiorno), nota: "più alto = inverno più lungo" },
          { etichetta: "Riscaldamento", valore: r.ore ? `${r.dal} – ${r.al}` : "nessun limite", nota: r.ore ? `max ${r.ore} ore al giorno (D.P.R. 74/2013)` : undefined },
          { etichetta: "Altitudine", valore: `${num(f.altitudine)} m`, nota: "casa comunale" },
        ],
      },
      faq: {
        q: `Quando si accende il riscaldamento a ${f.nome}?`,
        a: `${f.nome} è in zona climatica ${f.zonaClimatica} con ${num(f.gradiGiorno)} gradi giorno: il riscaldamento si può accendere ${periodo} (D.P.R. 74/2013), salvo ordinanze del sindaco. ${perMestiere[settore] ?? ""}`.trim(),
      },
      nota: perMestiere[settore],
    };
  },

  trasmittanza: ({ f, settore }) => {
    const t = TRASMITTANZA_MAX[f.zonaClimatica];
    const righe: string[][] = [];
    const focus: Record<string, (keyof typeof t)[]> = {
      serramentista: ["finestre"], tetto: ["coperture"], imbianchino: ["pareti"], pittore: ["pareti"],
      pavimentista: ["pavimenti"], piastrellista: ["pavimenti"], carpentiere: ["coperture"], falegname: ["finestre"],
    };
    const elementi = focus[settore] ?? (["pareti", "coperture", "pavimenti", "finestre"] as (keyof typeof t)[]);
    const nomi: Record<keyof typeof t, string> = { pareti: "Pareti verso l'esterno", coperture: "Coperture", pavimenti: "Pavimenti verso l'esterno o locali non riscaldati", finestre: "Finestre e portefinestre (Uw)" };
    for (const e of elementi) righe.push([nomi[e], `${num(t[e], 2)} W/m²K`]);
    const principale = elementi[0];
    const spiegazioni: Record<string, string> = {
      serramentista: `Per la detrazione il serramento nuovo deve avere Uw non oltre ${num(t.finestre, 2)} W/m²K in zona ${f.zonaClimatica}: il valore va scritto nel preventivo e nella dichiarazione del produttore.`,
      tetto: `Isolando la copertura a ${f.nome} si arriva alla detrazione solo con U non oltre ${num(t.coperture, 2)} W/m²K: spessore e conducibilità dell'isolante vanno indicati in voce.`,
      imbianchino: `Un cappotto a ${f.nome} dà diritto alla detrazione se la parete finita ha U non oltre ${num(t.pareti, 2)} W/m²K: chi tinteggia una facciata può proporlo nello stesso ponteggio.`,
      pittore: `Rifare la facciata è il momento giusto per il cappotto: in zona ${f.zonaClimatica} la parete deve arrivare a U non oltre ${num(t.pareti, 2)} W/m²K per la detrazione.`,
    };
    return {
      id: "trasmittanza",
      titolo: `Valori di trasmittanza richiesti a ${f.nome} per le detrazioni`,
      gancio: settore === "serramentista" ? `Uw max ${num(t.finestre, 2)} W/m²K` : undefined,
      blocco: {
        tipo: "tabella",
        colonne: ["Elemento", `Limite in zona ${f.zonaClimatica}`],
        righe,
        nota: spiegazioni[settore] ?? `Sono i limiti del D.M. 6/8/2020 (Allegato E) per la zona ${f.zonaClimatica}: un intervento che li supera non accede alle detrazioni per l'efficienza energetica.`,
      },
      faq: {
        q: `Che trasmittanza serve a ${f.nome} per la detrazione${principale === "finestre" ? " sui serramenti" : ""}?`,
        a: `${f.nome} è in zona climatica ${f.zonaClimatica}: secondo il D.M. 6/8/2020 servono ${elementi.map((e) => `${nomi[e].toLowerCase()} ≤ ${num(t[e], 2)} W/m²K`).join(", ")}.`,
      },
    };
  },

  sismica: ({ f, p, settore }) => {
    const proc = f.zonaSismica <= 2
      ? "Nelle zone 1 e 2 gli interventi strutturali richiedono di norma l'autorizzazione sismica preventiva (art. 94 D.P.R. 380/2001), con tempi da mettere nel cronoprogramma."
      : "Nelle zone 3 e 4 gli interventi strutturali richiedono di norma il deposito del progetto (art. 93 D.P.R. 380/2001); le procedure di dettaglio sono regionali.";
    const sisma = f.zonaSismica <= 3
      ? "Gli interventi di riduzione del rischio sismico possono accedere alle detrazioni previste per i lavori antisismici."
      : "La zona 4 è esclusa dal Sismabonus, che vale per le zone 1, 2 e 3.";
    const perMestiere: Record<string, string> = {
      geometra: "Per il tecnico la zona sismica cambia la pratica: va indicato nel preventivo se l'intervento è locale, di miglioramento o di adeguamento (NTC 2018, §8.4), perché cambiano calcoli, elaborati e tempi.",
      carpentiere: "Per strutture nuove o sostituzioni di solai e coperture i collegamenti alle murature vanno dimensionati per l'azione sismica: è una voce di calcolo da prevedere.",
      tetto: "Rifacendo il tetto conviene un cordolo o un collegamento leggero alle murature: in zona sismica il peso del nuovo manto e i collegamenti contano.",
      edilizia: "Aperture nei muri portanti, nuovi solai e cambi di carico sono interventi strutturali: vanno separati nel preventivo dalle opere edili ordinarie.",
      muratore: "Aprire un vano in un muro portante non è un lavoro da muratore e basta: servono calcolo, cerchiatura e pratica strutturale, da indicare a parte nel preventivo.",
      ristrutturazione: "Se la ristrutturazione tocca muri portanti o solai, la parte strutturale va separata e affidata a un tecnico: tempi e costi della pratica entrano nel preventivo.",
    };
    const paragrafi = [
      `${f.nome} è in zona sismica ${f.sismicaEtichetta ?? f.zonaSismica}: accelerazione di riferimento ${SISMICA_AG[f.zonaSismica]} (OPCM 3519/2006).${f.sismicaNota ? " " + f.sismicaNota : ""}`,
      proc,
      perMestiere[settore] ?? "",
      sisma,
    ].filter(Boolean);
    if (p.rischi && /sism|terremot/i.test(p.rischi)) paragrafi.splice(1, 0, p.rischi);
    return {
      id: "sismica",
      titolo: `Zona sismica ${f.sismicaEtichetta ?? f.zonaSismica}: cosa cambia per ${MESTIERI[settore].lavoro} a ${f.nome}`,
      gancio: `zona sismica ${f.sismicaEtichetta ?? f.zonaSismica}`,
      blocco: f.zonaSismica <= 2 ? { tipo: "avviso", paragrafi } : { tipo: "testo", paragrafi },
      faq: {
        q: `${f.nome} è in zona sismica?`,
        a: `Sì, in zona ${f.sismicaEtichetta ?? f.zonaSismica} (${SISMICA_AG[f.zonaSismica]}). ${proc} ${sisma}`,
      },
    };
  },

  neve: ({ f, settore }) => {
    const qsk = caricoNeve(f.zonaNeve, f.altitudine);
    const qs = 0.8 * qsk;
    const usi: Record<string, string> = {
      tetto: "È il carico su cui verificare travetti, assito e ancoraggi quando si rifà la copertura o si aggiunge peso (pannelli, nuovo manto).",
      carpentiere: "Per tettoie, pergole e coperture in legno è il dato di partenza del calcolo: sezioni e interassi dipendono da qui.",
      falegname: "Per pergole e tettoie in legno il carico neve decide sezioni e interassi: va scritto nel preventivo che la struttura è verificata.",
      geometra: "È il valore da riportare nella relazione di calcolo per nuove coperture, soppalchi esterni e tettoie.",
      edilizia: "Per coperture nuove o modificate il carico neve entra nella verifica strutturale.",
      muratore: "Per coperture nuove o modificate il carico neve entra nella verifica strutturale.",
      ristrutturazione: "Se la ristrutturazione tocca il tetto, il carico neve entra nella verifica della copertura.",
    };
    return {
      id: "neve",
      titolo: `Carico neve sui tetti di ${f.nome}`,
      gancio: `neve ${num(qsk, 2)} kN/m²`,
      blocco: {
        tipo: "calcolo",
        formula: `qsk = ${formulaNeve(f.zonaNeve, f.altitudine)}`,
        risultato: `${num(qsk, 2)} kN/m² al suolo · circa ${num(qs, 2)} kN/m² su una falda fino a 30°`,
        spiegazione: [
          `${f.nome} (provincia di ${f.provincia}) è nella zona di carico neve ${f.zonaNeve} delle NTC 2018, con la casa comunale a ${num(f.altitudine)} m.`,
          `Sul tetto il carico vale qs = μ · qsk · CE · Ct: con μ = 0,8 (falda fino a 30°) e coefficienti di esposizione e termico pari a 1 si ottengono circa ${num(qs, 2)} kN/m², cioè circa ${num(qs * 102, 0)} kg per metro quadro.`,
          usi[settore] ?? "",
        ].filter(Boolean),
      },
      faq: {
        q: `Qual è il carico neve a ${f.nome}?`,
        a: `Zona ${f.zonaNeve} (NTC 2018), quota ${num(f.altitudine)} m: qsk = ${num(qsk, 2)} kN/m² al suolo, circa ${num(qs, 2)} kN/m² su una falda fino a 30°. Edifici a quote diverse dalla casa comunale vanno calcolati sulla loro altitudine.`,
      },
    };
  },

  teleriscaldamento: ({ f, p, settore }) => {
    if (!p.teleriscaldamento) return null;
    const testi: Record<string, string> = {
      termoidraulico: "Negli edifici allacciati il lavoro riguarda la sottostazione di scambio, la contabilizzazione e la distribuzione interna, non la caldaia: il preventivo va impostato sulle parti di competenza dell'utente, diverse da quelle del gestore.",
      idraulico: "Molti condomini non hanno una caldaia ma uno scambiatore: prima di preventivare lavori su acqua calda e radiatori va capito dove finisce l'impianto del gestore.",
      ristrutturazione: "Se l'edificio è allacciato, il rifacimento dell'impianto interno va coordinato con la contabilizzazione del calore.",
      condizionatori: "Dove il riscaldamento arriva dal teleriscaldamento, il clima serve soprattutto per l'estate: il dimensionamento cambia.",
      elettricista: "Negli edifici allacciati al teleriscaldamento la pompa di calore non sostituisce la caldaia: il carico elettrico da prevedere è minore.",
    };
    return {
      id: "teleriscaldamento",
      titolo: `Teleriscaldamento a ${f.nome}`,
      gancio: `teleriscaldamento ${p.teleriscaldamento}`,
      blocco: { tipo: "testo", paragrafi: [`A ${f.nome} è attiva una rete di teleriscaldamento gestita da ${p.teleriscaldamento}.`, testi[settore] ?? ""].filter(Boolean) },
    };
  },

  vincoli: ({ f, p, settore }) => {
    if (!p.unesco && !p.materiale) return null;
    const perMestiere: Record<string, string> = {
      condizionatori: "Nei centri storici le unità esterne non possono di norma stare in facciata sulla via pubblica: vanno previste soluzioni su cortili, terrazzi o tetti, con l'autorizzazione dove l'edificio è vincolato.",
      serramentista: "Sugli edifici vincolati i serramenti devono riprendere disegno, materiale e colore originali: spesso legno o legno-alluminio, con autorizzazione della Soprintendenza.",
      imbianchino: "In facciata i colori nei centri storici seguono il piano del colore o le indicazioni comunali: va verificato prima di preventivare.",
      pittore: "In facciata i colori nei centri storici seguono il piano del colore o le indicazioni comunali, e sugli edifici vincolati serve l'autorizzazione: va verificato prima di preventivare.",
      tetto: "Nei centri storici il manto va rifatto con materiali coerenti (coppi o tegole di recupero) e senza alterare le pendenze; sugli edifici vincolati serve l'autorizzazione.",
      falegname: "Portoni, persiane e infissi nei centri storici vanno rifatti uguali agli originali per disegno ed essenza.",
      geometra: "Per gli immobili vincolati serve l'autorizzazione della Soprintendenza (art. 21 D.Lgs. 42/2004), e nelle aree tutelate quella paesaggistica (art. 146): sono pratiche da preventivare a parte.",
      edilizia: "Sugli edifici vincolati ogni intervento esterno passa dalla Soprintendenza (D.Lgs. 42/2004): tempi e documentazione vanno nel preventivo.",
      muratore: "Su murature storiche si lavora con malte compatibili (calce, non cemento): va scritto nel preventivo.",
      ristrutturazione: "Sugli edifici vincolati facciate, coperture e serramenti richiedono l'autorizzazione della Soprintendenza (D.Lgs. 42/2004).",
      carpentiere: "Nelle coperture storiche si preferisce consolidare l'orditura in legno esistente invece di sostituirla.",
      elettricista: "Negli edifici storici le tracce su murature e affreschi possono essere vietate: si lavora con canaline o passaggi esistenti.",
      idraulico: "Negli edifici storici scarichi e nuove colonne vanno studiati per non toccare murature e solai di pregio.",
      piastrellista: "Nei palazzi storici i pavimenti originali (cotto, graniglia, seminato) si recuperano più spesso di quanto si rifacciano.",
      pavimentista: "Nei palazzi storici i pavimenti originali (cotto, graniglia, seminato) si recuperano più spesso di quanto si rifacciano.",
    };
    const paragrafi = [
      p.unesco ? `Il tessuto urbano di ${f.nome} comprende un sito UNESCO: ${p.unesco}.` : "",
      p.materiale ? `Il materiale tipico del centro storico è ${p.materiale}: riparazioni e integrazioni vanno fatte con materiali compatibili.` : "",
      perMestiere[settore] ?? "",
    ].filter(Boolean);
    return {
      id: "vincoli",
      titolo: `Centro storico e vincoli a ${f.nome}`,
      gancio: p.unesco ? "centro storico vincolato" : undefined,
      blocco: { tipo: "avviso", paragrafi },
      faq: p.unesco ? { q: `Servono autorizzazioni per lavorare nel centro storico di ${f.nome}?`, a: `Sugli edifici vincolati sì: interventi su facciate, coperture e serramenti richiedono l'autorizzazione della Soprintendenza (D.Lgs. 42/2004). ${perMestiere[settore] ?? ""}`.trim() } : undefined,
    };
  },

  costiera: ({ f, p, settore }) => {
    if (!p.costiera) return null;
    const perMestiere: Record<string, string> = {
      serramentista: "Vicino al mare servono profili e ferramenta con trattamenti per ambiente marino (anodizzazione o verniciatura di classe adeguata, acciaio inox): va specificato in voce.",
      condizionatori: "La salsedine corrode le batterie delle unità esterne: per le installazioni esposte esistono trattamenti anticorrosione delle alette, da indicare nel preventivo.",
      imbianchino: "Su facciate e ringhiere esposte al mare servono cicli protettivi più robusti: preparazione del fondo e antiruggine fanno la differenza.",
      pittore: "Su facciate e ringhiere esposte al mare servono cicli protettivi più robusti: preparazione del fondo e antiruggine fanno la differenza.",
      tetto: "Lattonerie e fissaggi vanno scelti resistenti alla corrosione (rame, acciaio inox): è una voce che cambia il prezzo.",
      carpentiere: "Per l'acciaio in ambiente marino serve una protezione adeguata (zincatura e verniciatura), per il legno trattamenti specifici.",
      falegname: "Il legno esposto al mare richiede impregnanti e finiture per esterni da rinnovare con frequenza: va detto al cliente nel preventivo.",
      elettricista: "Per gli impianti esterni vicino al mare servono componenti con grado di protezione adeguato e materiali resistenti alla corrosione.",
      giardiniere: "Vento e salsedine selezionano le piante: nei giardini esposti al mare si scelgono specie tolleranti al sale.",
    };
    return {
      id: "costiera",
      titolo: `Lavorare vicino al mare a ${f.nome}`,
      gancio: "ambiente marino",
      blocco: { tipo: "lista", intro: `${f.nome} è una città di mare: salsedine e vento aggrediscono metalli, intonaci e impianti esterni.`, punti: [perMestiere[settore] ?? "Materiali e finiture per esterni vanno scelti per l'ambiente marino.", "Le garanzie dei produttori spesso distinguono le installazioni entro poche centinaia di metri dalla costa: va verificato prima di preventivare."] },
    };
  },

  umidita: ({ f, p, settore }) => {
    if (!p.umida) return null;
    const perMestiere: Record<string, string> = {
      imbianchino: "Prima di tinteggiare va capito se la macchia è condensa, risalita o infiltrazione: la pittura antimuffa da sola non basta, e il preventivo dovrebbe dirlo.",
      pittore: "Sulle facciate esposte all'umidità servono pitture traspiranti (silicati, silossani) e la verifica delle zoccolature.",
      piastrellista: "Su massetti e piani terra va misurata l'umidità prima della posa e prevista l'impermeabilizzazione dove serve.",
      pavimentista: "Il parquet va posato solo su massetto asciutto (misura dell'umidità residua da riportare nel preventivo): in ambienti umidi meglio essenze stabili o prefinito a più strati.",
      falegname: "Il legno lavora con l'umidità: serramenti e arredi su misura vanno trattati e posati con giochi adeguati.",
      edilizia: "Risalita capillare nei piani terra e nelle cantine è un intervento ricorrente: barriere chimiche, intonaci deumidificanti e drenaggi vanno preventivati come voce a sé.",
      muratore: "Risalita capillare nei piani terra e nelle cantine è un intervento ricorrente: barriere chimiche e intonaci deumidificanti vanno preventivati come voce a sé.",
      ristrutturazione: "Nei piani terra e nelle cantine la risalita capillare va risolta prima delle finiture: è una voce da mettere all'inizio del preventivo.",
      geometra: "Nelle zone vicine all'acqua conviene verificare la classificazione di pericolosità idraulica prima di progettare interventi ai piani terra.",
    };
    return {
      id: "umidita",
      titolo: `Umidità: il problema di molti cantieri a ${f.nome}`,
      gancio: "umidità",
      blocco: { tipo: "testo", paragrafi: [`A ${f.nome} l'umidità ambientale è legata a ${p.umida}.`, perMestiere[settore] ?? "Va verificata prima di ogni finitura."] },
    };
  },

  cantiere: ({ f, p, settore }, m) => {
    const vociLocali: { voce: string; perche?: string }[] = m.voci.map((v) => ({ voce: v }));
    if (f.slug === "venezia") vociLocali.unshift({ voce: "Trasporto acqueo di materiali e macerie", perche: "nella città storica tutto viaggia in barca" });
    if (f.slug === "genova" || f.slug === "napoli" || f.slug === "bari") vociLocali.unshift({ voce: "Trasporto dei materiali a mano o con piccoli mezzi", perche: "vicoli e caruggi non sono accessibili ai furgoni" });
    if (p.unesco && ["edilizia", "ristrutturazione", "tetto", "serramentista", "pittore", "geometra"].includes(settore)) vociLocali.push({ voce: "Pratica di autorizzazione per gli immobili vincolati", perche: "D.Lgs. 42/2004" });
    if (/ZTL|Area C|Area B/.test(p.cantiere)) vociLocali.push({ voce: "Permessi di accesso ZTL o occupazione di suolo pubblico", perche: "costi e tempi variano per zona" });
    return {
      id: "cantiere",
      titolo: `Le voci di ${m.lavoro} a ${f.nome}`,
      blocco: { tipo: "voci", intro: p.cantiere, voci: vociLocali },
    };
  },

  rischi: ({ f, p }) => {
    if (!p.rischi) return null;
    if (/sism|terremot/i.test(p.rischi) && f.zonaSismica <= 2) return null; // già nel modulo sismica
    return {
      id: "rischi",
      titolo: `Cosa insegna la storia degli edifici di ${f.nome}`,
      blocco: { tipo: "testo", paragrafi: [p.rischi] },
    };
  },

  raffrescamento: ({ f, settore }) => {
    const r = RISCALDAMENTO[f.zonaClimatica];
    const caldo = f.zonaClimatica === "B" || f.zonaClimatica === "C";
    const perMestiere: Record<string, string> = {
      condizionatori: caldo
        ? `In zona ${f.zonaClimatica} il clima lavora più d'estate che d'inverno: una pompa di calore aria-aria può essere l'unico impianto della casa, e il preventivo può proporla come tale.`
        : `In zona ${f.zonaClimatica} il clima è soprattutto estivo, ma una pompa di calore ben dimensionata riduce l'uso della caldaia nelle mezze stagioni.`,
      elettricista: caldo
        ? "Con climatizzatori in quasi ogni stanza servono linee dedicate e spesso più potenza al contatore: va verificato prima di preventivare."
        : "Per climatizzatori e pompe di calore servono linee dedicate dal quadro: è la voce che più spesso manca nei preventivi.",
      termoidraulico: caldo
        ? "Con inverni brevi una pompa di calore aria-acqua con ventilconvettori può fare riscaldamento e raffrescamento con un solo impianto."
        : "Una pompa di calore aria-acqua può affiancare la caldaia (sistema ibrido), con raffrescamento estivo tramite ventilconvettori.",
      idraulico: "Lo scarico condensa dei climatizzatori va collegato agli scarichi: è un lavoro che si coordina con l'installatore.",
      ristrutturazione: "In una ristrutturazione conviene predisporre linee frigorifere e scarichi condensa sottotraccia prima delle finiture.",
    };
    return {
      id: "raffrescamento",
      titolo: caldo ? `Estati lunghe a ${f.nome}: clima e pompa di calore` : `Clima e pompe di calore a ${f.nome}`,
      gancio: caldo ? "estati lunghe" : undefined,
      blocco: { tipo: "testo", paragrafi: [`${f.nome} è in zona climatica ${f.zonaClimatica} con ${num(f.gradiGiorno)} gradi giorno: il riscaldamento può restare acceso ${r.ore ? `al massimo ${r.ore} ore al giorno, dal ${r.dal} al ${r.al}` : "senza limiti"}.`, perMestiere[settore] ?? ""].filter(Boolean) },
      faq: settore === "condizionatori" ? { q: `Conviene una pompa di calore a ${f.nome}?`, a: perMestiere.condizionatori } : undefined,
    };
  },

  verde: ({ f, p }) => {
    const r = RISCALDAMENTO[f.zonaClimatica];
    const freddo = f.gradiGiorno > 2100;
    return {
      id: "verde",
      titolo: `Il calendario del giardino a ${f.nome}`,
      gancio: freddo ? `zona ${f.zonaClimatica}, inverni lunghi` : `zona ${f.zonaClimatica}, clima mite`,
      faq: {
        q: `Quando conviene fare i lavori in giardino a ${f.nome}?`,
        a: freddo
          ? `Con ${num(f.gradiGiorno)} gradi giorno l'inverno è lungo: potature e nuovi impianti a fine inverno, fuori dai periodi di gelo; semina o rigenerazione del prato tra fine estate e inizio autunno.`
          : `Con ${num(f.gradiGiorno)} gradi giorno l'inverno è mite: si pianta quasi tutto l'anno, ma d'estate conviene concentrarsi su irrigazione a goccia e piante resistenti alla siccità.`,
      },
      blocco: {
        tipo: "lista",
        intro: `${f.nome}: zona climatica ${f.zonaClimatica}, ${num(f.gradiGiorno)} gradi giorno, ${num(f.altitudine)} m di quota.`,
        punti: freddo
          ? [
              `L'inverno è lungo (la stagione di riscaldamento va ${r.dal ? `dal ${r.dal} al ${r.al}` : "senza limiti"}): potature di ristrutturazione e nuovi impianti si fanno a fine inverno, fuori dai periodi di gelo.`,
              "Le piante mediterranee sensibili al freddo (agrumi in piena terra, alcune palme) richiedono protezioni invernali da preventivare.",
              "Il prato si semina o si rigenera tra fine estate e inizio autunno, quando le temperature scendono.",
              p.umida ? `L'umidità legata a ${p.umida} favorisce malattie fungine: trattamenti e drenaggi sono voci frequenti.` : "L'irrigazione automatica va svuotata o protetta prima delle gelate.",
            ]
          : [
              "Le estati sono lunghe e asciutte: l'irrigazione a goccia e la pacciamatura sono le voci che fanno risparmiare acqua al cliente.",
              "Si piantano bene specie mediterranee (agrumi, olivi, lavanda, rosmarino) che reggono il caldo.",
              "Il prato tradizionale soffre d'estate: nei preventivi conviene proporre essenze resistenti alla siccità.",
              p.costiera ? "Vicino al mare vento e salsedine limitano la scelta delle piante." : "Le potature si concentrano a fine inverno, con un secondo passaggio in estate sulle siepi.",
            ],
      },
    };
  },
};
