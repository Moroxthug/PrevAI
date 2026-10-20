// Message templates: the standard wording of the eight messages clients get (follow-ups, reminders, the review request, "on my way"), with {slots} for the
// client's name, the quote link and so on. The pure parts: splitting a text into words and slots, filling it with a sample client, adding and removing a slot.
// Source: MessageTemplates.dc.html, in Italian (PrevAI speaks Italian only, and sends these to clients by email).
export type Lang = "it";
export type VarKey = "first" | "link" | "job" | "amount" | "due" | "inv" | "me" | "co" | "eta" | "review" | "sign";
export type Category = "follow" | "remind" | "review" | "way";
export type Who = "dana" | "hart" | "okoye";
export type Template = { id: string; cat: Category; who: Who; /** 0 email, 1 text, 2 WhatsApp. */ defCh: 0 | 1 | 2; vars: VarKey[]; subj: Record<Lang, string>; it: string; icon: string; tone: string };

export const VAR_LABELS: Record<VarKey, Record<Lang, string>> = {
  first: { it: "nome del cliente" }, link: { it: "link del preventivo" }, job: { it: "nome del lavoro" },
  amount: { it: "importo" }, due: { it: "scadenza" }, inv: { it: "link della fattura" }, me: { it: "il tuo nome" },
  co: { it: "impresa" }, eta: { it: "ora di arrivo" }, review: { it: "link della recensione" }, sign: { it: "link per firmare" },
};

type Sample = Record<VarKey, string>;
export const SAMPLES: Record<Who, { name: string; it: Omit<Sample, "me" | "co"> }> = {
  dana: { name: "Dana Bianchi", it: { first: "Dana", link: "prevai.it/p/7KD2", job: "camere e soffitto del bagno", amount: "4.131,05 €", due: "29 ott", inv: "prevai.it/f/7KD2", eta: "10:40", review: "g.page/edilrossi", sign: "prevai.it/c/7KD2" } },
  hart: { name: "Lena Rossi", it: { first: "Lena", link: "prevai.it/p/H48G", job: "taverna", amount: "2.340,00 €", due: "20 set", inv: "prevai.it/f/0412", eta: "7:50", review: "g.page/edilrossi", sign: "prevai.it/c/H48G" } },
  okoye: { name: "Grazia Conti", it: { first: "Grazia", link: "", job: "pavimento del corridoio", amount: "", due: "", inv: "", eta: "8:30", review: "g.page/edilrossi", sign: "" } },
};

export const TEMPLATES: Template[] = [
  { id: "f1", cat: "follow", who: "dana", defCh: 0, vars: ["first", "job", "link", "me", "co"], icon: "chat", tone: "violet",
    subj: { it: "Il tuo preventivo da {co}" },
    it: "Buongiorno {first}, volevo assicurarmi che le sia arrivato il preventivo per {job}: {link} Se vuole lo vediamo insieme al telefono. {me}, {co}" },
  { id: "f2", cat: "follow", who: "dana", defCh: 0, vars: ["first", "job", "link", "me"], icon: "chat", tone: "violet",
    subj: { it: "Domande su {job}?" },
    it: "Buongiorno {first}, il preventivo per {job} è ancora valido: {link} Se i tempi o i lavori vanno cambiati, mi risponda e lo sistemo. {me}" },
  { id: "f3", cat: "follow", who: "dana", defCh: 0, vars: ["first", "job", "link", "me", "co"], icon: "chat", tone: "violet",
    subj: { it: "Il tuo preventivo scade presto" },
    it: "Buongiorno {first}, un'ultima nota sul preventivo per {job}. Scade presto e l'agenda dei prossimi mesi si sta riempiendo. {link} {me}, {co}" },
  { id: "r1", cat: "remind", who: "hart", defCh: 0, vars: ["first", "amount", "job", "due", "inv", "co"], icon: "bell", tone: "amber",
    subj: { it: "Fattura per {job}, scaduta il {due}" },
    it: "Buongiorno {first}, le ricordo che {amount} per {job} erano da pagare entro il {due}. Può pagare con bonifico o carta qui: {inv} Grazie, {co}" },
  { id: "r2", cat: "remind", who: "hart", defCh: 0, vars: ["first", "job", "amount", "due", "inv", "co"], icon: "bell", tone: "rose",
    subj: { it: "La fattura è ancora da pagare" },
    it: "Buongiorno {first}, la fattura per {job} ({amount}) era in scadenza il {due}. Può pagare qui: {inv} Se ha già pagato, grazie. {co}" },
  { id: "r3", cat: "remind", who: "hart", defCh: 0, vars: ["first", "job", "sign", "me"], icon: "pen", tone: "indigo",
    subj: { it: "Il contratto è pronto da firmare" },
    it: "Buongiorno {first}, il contratto per {job} è pronto da firmare: {sign} Ci vuole circa un minuto. {me}" },
  { id: "rv", cat: "review", who: "okoye", defCh: 0, vars: ["first", "job", "review", "me", "co"], icon: "star", tone: "gold",
    subj: { it: "Com'è andata?" },
    it: "Buongiorno {first}, grazie per averci scelto per {job}. Se è contenta del lavoro, una breve recensione aiuta molto una piccola impresa come la nostra: {review} {me}, {co}" },
  { id: "ow", cat: "way", who: "okoye", defCh: 0, vars: ["first", "me", "co", "eta"], icon: "truck", tone: "teal",
    subj: { it: "{co} sta arrivando" },
    it: "Buongiorno {first}, {me} di {co} sta arrivando. Arriviamo verso le {eta}." },
];

export const CATEGORIES: ("all" | Category)[] = ["all", "follow", "remind", "review", "way"];
export const inCategory = (t: Template, c: "all" | Category): boolean => c === "all" || t.cat === c;

export type Part = { text: string } | { slot: string; n: number };

/** A text split into words and {slots}; `n` counts the slots in order, so one can be removed. */
export function parts(s: string): Part[] {
  const out: Part[] = [];
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  let last = 0;
  let n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ slot: m[1]!, n: n++ });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** The text with a sample client's words in the slots, on one line (an empty value leaves its slot empty). */
export function fill(s: string, sample: Partial<Record<string, string>>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => sample[k] ?? "").replace(/\s+/g, " ").trim();
}

/** Takes the n-th slot out, with the space before it. */
export function removeSlot(s: string, n: number): string {
  let c = 0;
  return s.replace(/\s?\{(\w+)\}/g, (all) => (c++ === n ? "" : all));
}

export const addSlot = (s: string, key: string): string => `${s.replace(/\s+$/, "")} {${key}}`;
export const wordCount = (s: string): number => (s ? s.split(" ").filter(Boolean).length : 0);
/** Texts the carrier counts: 160 characters each. */
export const segmentsOf = (s: string): number => Math.max(1, Math.ceil(s.length / 160));

/** The stored key of a template's text in a language, and of its "send automatically" switch. */
export const textKey = (id: string, lang: Lang): string => `${id}_${lang}`;
export const autoKey = (id: string): string => `auto_${id}`;

/** Is it different from our standard wording in either language (as saved)? */
export function isEdited(t: Template, saved: Record<string, unknown>): boolean {
  return (["it"] as const).some((l) => typeof saved[textKey(t.id, l)] === "string" && saved[textKey(t.id, l)] !== t[l]);
}
