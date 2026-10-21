// Italiano (it-IT) del meteo sulla Home (QuoteAI 129.1, i18n/screens/weather.ts): la riga dell'intestazione, la scheda Meteo dei cantieri
// e Questa settimana. Il server manda solo chiavi (rain_after, exterior_before...), qui diventano parole. Le ore arrivano come "15"
// nel riassunto ("pioggia dalle 15") e come "14:00" nel consiglio.
export const meteo = {
  wx: {
    name: "Meteo dei cantieri", unavailable: "Meteo non disponibile", retry: "Riprova", updated: "Aggiornato alle {{time}}", loadingA11y: "Carico il meteo",
    sum: {
      rain_after: "pioggia dalle {{time}}", rain_now: "piove fino alle {{time}}", rain_all_day: "pioggia tutto il giorno", snow_after: "neve dalle {{time}}", snow_now: "nevica fino alle {{time}}", dry_all_day: "asciutto tutto il giorno", freezing: "gelo",
    },
    adv: { exterior_before: "Lavori all'esterno prima delle {{time}}", exterior_after: "I lavori all'esterno vanno meglio dopo le {{time}}", inside_only: "Oggi solo lavori al chiuso", good_exterior: "Buona giornata per i lavori all'esterno" },
    card: "Meteo dei cantieri, {{place}}, {{temp}}, {{summary}}", bar: "Ore {{hour}}, {{prob}} per cento di probabilità di pioggia",
    site: { crew_one: "{{count}} persona in cantiere", crew_other: "{{count}} persone in cantiere", slot: "Ore {{hour}}, {{temp}}, {{prob}} per cento", feelsOpen: "Apri", open: "Apri l'agenda" },
    attribution: { legal: "Fonti dei dati meteo", source: "Dati meteo: {{name}}" },
    about: { label: "Dati meteo", sub: "Da dove arrivano le previsioni" },
    week: {
      name: "Questa settimana", visits_one: "{{count}} intervento", visits_other: "{{count}} interventi", rain: "Pioggia {{days}}.", and: " e ", fits: "Il giorno migliore per l'esterno è {{day}}.", noRain: "Niente pioggia questa settimana.", plan: "Meteo da tenere d'occhio",
      row: "{{date}} · pioggia", rowVisits_one: "{{count}} intervento in agenda", rowVisits_other: "{{count}} interventi in agenda", rowNone: "Niente in agenda", open: "Apri l'agenda", dayA11y: "{{date}}, {{visits}}, pioggia probabile",
      dayDry: "{{date}}, {{visits}}",
    },
  },
};
