import type { Attribution, Condition, DayForecast, Forecast, HourForecast, PrecipType, WeatherProvider } from "./types.js";
import { isoOnTheHour } from "./time.js";
import { localDate } from "./summary.js";

// MET Norway (Istituto meteorologico norvegese), Locationforecast 2.0: copre tutta l'Europa, gratuito anche per uso commerciale con licenza CC BY 4.0 (va citata la
// fonte, che torna come attribuzione), senza chiave. È la fonte che parte quando non ci sono le credenziali di Apple WeatherKit: in PrevAI prende il posto di
// Environment Canada. Le regole d'uso (https://api.met.no/doc/TermsOfService) chiedono un User-Agent che dica chi siamo, coordinate con al massimo 4 decimali e
// di non chiedere più del necessario: la cache di 30 minuti per luogo (provider.ts) basta.
//
// Fuori dalla Scandinavia MET Norway non dà la probabilità di pioggia, solo il simbolo e i millimetri previsti: la probabilità qui è STIMATA da quei due
// (vedi `chanceOf`), abbastanza per dire "pioggia dalle 15" o "asciutto", non per un numero da meteorologo.

const API = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const USER_AGENT = "PrevAI/1.0 (+https://prevai.it; info@prevai.it)";
export const METNO_ATTRIBUTION: Attribution = { name: "MET Norway", legalUrl: "https://api.met.no/doc/License" };

type Next = { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
type Step = { time: string; data: { instant: { details: { air_temperature?: number } }; next_1_hours?: Next; next_6_hours?: Next; next_12_hours?: Next } };
export type Reply = { properties?: { timeseries?: Step[] } };

/** I simboli di MET Norway ("lightrainshowers_day", "partlycloudy_night"...) → le nove condizioni che disegniamo. */
export function conditionOfSymbol(symbol: string | undefined): Condition {
  const s = (symbol ?? "").replace(/_(day|night|polartwilight)$/, "");
  if (!s) return "cloudy";
  if (s.includes("thunder")) return "thunder";
  if (s.includes("sleet")) return "sleet";
  if (s.includes("snow")) return "snow";
  if (s.includes("showers")) return "showers";
  if (s.includes("rain")) return "rain";
  if (s === "fog") return "fog";
  if (s === "clearsky") return "clear";
  if (s === "fair" || s === "partlycloudy") return "partly_cloudy";
  return "cloudy";
}

function precipOfSymbol(symbol: string | undefined): PrecipType {
  const c = conditionOfSymbol(symbol);
  return c === "rain" || c === "showers" || c === "thunder" ? "rain" : c === "snow" ? "snow" : c === "sleet" ? "sleet" : "none";
}

/**
 * La probabilità stimata di un periodo: dal simbolo (piove o no) e dai millimetri all'ora. Un simbolo di pioggia con 0,2 mm/h o più vale 70 % e oltre, con meno
 * 55 % (sopra la soglia del 50 % che l'app chiama pioggia), con 0 mm 35 %; un simbolo asciutto con qualche goccia 20 %.
 */
export function chanceOf(type: PrecipType, amountMm: number | undefined, hours: number): number {
  const perHour = Math.max(0, amountMm ?? 0) / Math.max(1, hours);
  if (type === "none") return perHour > 0 ? 20 : 0;
  if (perHour >= 1) return 90;
  if (perHour >= 0.5) return 80;
  if (perHour >= 0.2) return 70;
  if (perHour > 0) return 55;
  return 35;
}

export function forecastFrom(r: Reply, tz: string): Forecast {
  const steps = r.properties?.timeseries ?? [];
  const hourly: HourForecast[] = steps.filter((s) => s.data.next_1_hours).slice(0, 48).map((s) => {
    const sym = s.data.next_1_hours?.summary?.symbol_code;
    const type = precipOfSymbol(sym);
    return { hour: isoOnTheHour(new Date(s.time), tz), tempC: Math.round(s.data.instant.details.air_temperature ?? 0), precipProb: chanceOf(type, s.data.next_1_hours?.details?.precipitation_amount, 1), precipType: type };
  });
  // Each day: the wettest period that starts in it (hourly steps first, then the six-hour ones further out).
  const byDate = new Map<string, DayForecast>();
  for (const s of steps) {
    const next = s.data.next_1_hours ?? s.data.next_6_hours;
    if (!next) continue;
    const type = precipOfSymbol(next.summary?.symbol_code);
    const prob = chanceOf(type, next.details?.precipitation_amount, s.data.next_1_hours ? 1 : 6);
    const date = localDate(new Date(s.time), tz);
    const prev = byDate.get(date);
    if (!prev || prob > prev.precipProb) byDate.set(date, { date, precipProb: prob, precipType: type });
  }
  const first = steps[0];
  const nowSym = first?.data.next_1_hours?.summary?.symbol_code ?? first?.data.next_6_hours?.summary?.symbol_code;
  return {
    now: { tempC: Math.round(first?.data.instant.details.air_temperature ?? hourly[0]?.tempC ?? 0), condition: conditionOfSymbol(nowSym) },
    hourly,
    daily7: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7),
  };
}

export class MetNoProvider implements WeatherProvider {
  readonly name = "metno" as const;
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async forecast(lat: number, lng: number, tz: string): Promise<Forecast> {
    const r = await this.fetcher(`${API}?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, { headers: { accept: "application/json", "user-agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`MET Norway ${r.status}`);
    return forecastFrom((await r.json()) as Reply, tz);
  }
}
