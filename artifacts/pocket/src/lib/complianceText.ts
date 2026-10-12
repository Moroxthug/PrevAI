// Le parole di una scadenza o di un promemoria (titolo, riga sotto, parola dello stato), condivise da Scadenze e dalla vista del commercialista.
import { useTranslation } from "react-i18next";
import { dayDate, wordOf, type Item } from "./compliance";
import { money, shortDate, type Locale } from "./format";

export function useComplianceText() {
  const { t } = useTranslation();
  const locale: Locale = "it-IT";
  const c = (k: string, o?: Record<string, unknown>): string => t(`cp.${k}`, o);
  const d = (day: string): string => shortDate(dayDate(day), locale);
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

  /** L'etichetta dello scadenzario, o il titolo scritto dall'impresa. */
  const title = (i: Item): string => i.title;

  /** La riga sotto il titolo: a chi va e quanto, o cos'è il promemoria. */
  const sub = (i: Item): string => {
    if (i.source === "reminder") {
      const own = [i.authority, i.detail].filter(Boolean).join(" · ");
      return own || c(`subs.repeats.${i.recurrence ?? "none"}`);
    }
    if (i.look === "filed") {
      const date = i.filedOn ? d(i.filedOn) : "";
      if (i.filedToday) return c("subs.today");
      return i.kind === "dichiarazione" ? c("subs.filed", { date }) : c("subs.paid", { date });
    }
    const who = i.authority;
    return i.amountCents > 0 ? c("subs.owe", { who, amount: money(i.amountCents / 100, locale) }) : who;
  };

  /** La parola della pillola di stato. */
  const word = (i: Item): string => {
    const w = wordOf(i);
    switch (w.kind) {
      case "late": return c("words.late", { count: w.days });
      case "due": return c(w.verb === "renews" ? "words.renews" : "words.due", { date: d(i.due) });
      default: return c(`words.${w.kind}`);
    }
  };

  /** «20 ott · tra 21 giorni» per la scadenza scelta sulla striscia. */
  const when = (i: Item): string => (i.daysLeft === 0 ? c("calendar.today", { date: d(i.due) }) : i.daysLeft > 0 ? c("calendar.in", { date: d(i.due), count: i.daysLeft }) : c("calendar.ago", { date: d(i.due), count: -i.daysLeft }));

  return { c, d, locale, title, sub, word, when, cap };
}
