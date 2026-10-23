// POCKET-7 (riga 64): i video brevi di PrevAI, registrati dall'app (artifacts/pocket/scripts/record-videos, docs/VIDEO.md).
// Muti, 1280×776, serviti da /video/<file>.mp4 con la locandina .jpg e i sottotitoli .vtt (uno per capitolo, gli stessi
// testi dell'app). L'app ha la sua copia di durate e capitoli in artifacts/pocket/src/lib/videos.ts: un test dell'app
// controlla che coincidano. Qui ci sono solo i video registrati.

export type HelpVideo = {
  id: string;
  file: string;
  title: string;
  topic: string;
  sub: string;
  secs: number;
  /** I capitoli: dove iniziano (secondi), il titolo e la didascalia. */
  chapters: { at: number; title: string; caption: string }[];
  /** L'articolo dell'aiuto che lo mostra in cima. */
  article: string;
};

export const HELP_VIDEOS: HelpVideo[] = [
  {
    id: "quotes", file: "quotes",
    title: "Il tuo primo preventivo", topic: "Preventivi",
    sub: "Racconta il lavoro, scegli il cliente e manda un preventivo con le voci e l'IVA.",
    secs: 47,
    chapters: [
      { at: 0, title: "Tocca Nuovo preventivo", caption: "Dalla scheda Preventivi, tocca Nuovo preventivo." },
      { at: 4, title: "Descrivi il lavoro", caption: "Scrivilo o dettalo come lo diresti al cliente, poi scegli il cliente." },
      { at: 25, title: "Controlla le voci", caption: "Ogni voce ha quantità e prezzo: cambiali con un tocco." },
      { at: 37, title: "Invialo", caption: "Invia per email: il cliente lo apre e lo accetta dal telefono." },
    ],
    article: "create-a-quote",
  },
  {
    id: "overview", file: "overview",
    title: "PrevAI in 60 secondi", topic: "Panoramica",
    sub: "Oggi, preventivi, cantieri e fatture: l'app in meno di un minuto.",
    secs: 48,
    chapters: [
      { at: 0, title: "Oggi", caption: "Ogni mattina: cosa serve a te, il meteo dei cantieri, i soldi." },
      { at: 11, title: "Preventivi", caption: "Scritti dall'IA, inviati per email, accettati dal cliente." },
      { at: 20, title: "Cantieri", caption: "Dal preventivo accettato al cantiere: squadra, foto, costi." },
      { at: 38, title: "Fatture", caption: "Chi ti deve dei soldi e cosa è già arrivato." },
    ],
    article: "getting-started",
  },
  {
    id: "bonifico", file: "bonifico",
    title: "Fatti pagare con un bonifico", topic: "Fatture",
    sub: "Il cliente paga con il bonifico e lo segnala: tu controlli la banca e confermi.",
    secs: 40,
    chapters: [
      { at: 0, title: "Il cliente ha pagato", caption: "Il cliente paga con l'IBAN della fattura e lo segnala dal link." },
      { at: 6, title: "Controlla la banca", caption: "Prima di confermare, guarda che il bonifico sia arrivato." },
      { at: 15, title: "Conferma il bonifico", caption: "Confermo che è arrivato: importo e metodo sono già compilati." },
      { at: 31, title: "Pagata", caption: "La fattura è pagata e il cliente riceve la ricevuta." },
    ],
    article: "invoices-and-getting-paid",
  },
];

export const videoForArticle = (slug: string): HelpVideo | undefined => HELP_VIDEOS.find((v) => v.article === slug);

/** 72 secondi → "1:12". */
export function clock(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** I sottotitoli WebVTT di un video: una didascalia per capitolo, dall'inizio del capitolo all'inizio del successivo. */
export function toVtt(v: HelpVideo): string {
  const ts = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}.000`;
  const cues = v.chapters.map((c, i) => `${i + 1}\n${ts(c.at)} --> ${ts(v.chapters[i + 1]?.at ?? v.secs)}\n${c.caption}`);
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
