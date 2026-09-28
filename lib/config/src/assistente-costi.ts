// APP-8h (docs/ASSISTENTE-PLAN.md) — quanto costa l'assistente a un'impresa.
//
// I consumi si registrano in usage_events in centesimi di dollaro (i fornitori
// fatturano in dollari): token di ogni turno (related_entity_type
// "assistant_turn") e secondi di voce del fornitore ("ai_speech"). Qui si
// passano in euro e si dividono per i posti, per la pagina dello staff e per
// l'avviso quando un'impresa costa più del previsto.

/** Cambio approssimato dollaro → euro per i conti dello staff (non per fatturare). Da rileggere ogni tanto. */
export const USD_TO_EUR_APPROX = 0.86;

/**
 * Sopra questi centesimi di euro al mese per posto lo staff riceve un avviso.
 * Proposta: 5 € — circa il 6 % di Elite (79 €/mese). Con gpt-oss su Groq un
 * turno costa una frazione di centesimo, quindi ci si arriva solo con un uso
 * fuori scala o con la voce del fornitore accesa (D17).
 */
export const ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT = 500;

export type AssistantUsageNumbers = {
  turns: number;
  tokens: number;
  tokenCostUsdCents: number;
  voiceSeconds: number;
  voiceCostUsdCents: number;
  seats: number;
};

export type AssistantCostSummary = AssistantUsageNumbers & {
  voiceMinutes: number;
  costEurCents: number;
  perSeatEurCents: number;
  perTurnEurCents: number;
  overAlert: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function assistantCostSummary(u: AssistantUsageNumbers, alertPerSeat = ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT): AssistantCostSummary {
  const seats = Math.max(1, u.seats);
  const costEurCents = (u.tokenCostUsdCents + u.voiceCostUsdCents) * USD_TO_EUR_APPROX;
  const perSeatEurCents = costEurCents / seats;
  return {
    ...u,
    seats,
    voiceMinutes: Math.round(u.voiceSeconds / 6) / 10,
    costEurCents: round2(costEurCents),
    perSeatEurCents: round2(perSeatEurCents),
    perTurnEurCents: u.turns ? round2(u.tokenCostUsdCents * USD_TO_EUR_APPROX / u.turns) : 0,
    overAlert: perSeatEurCents > alertPerSeat,
  };
}

/**
 * L'avviso parte una volta sola: il giorno in cui il costo per posto del mese
 * supera la soglia (ieri sotto, oggi sopra). Il primo del mese si riparte da zero.
 */
export function crossedCostAlert(beforePerSeatEurCents: number, nowPerSeatEurCents: number, alertPerSeat = ASSISTANT_COST_ALERT_EUR_CENTS_PER_SEAT): boolean {
  return beforePerSeatEurCents <= alertPerSeat && nowPerSeatEurCents > alertPerSeat;
}

/** Primo giorno del mese (UTC) della data. */
export function monthStartUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
