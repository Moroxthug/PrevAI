// A-5: client dell'add-on Amministrazione (paywall, test di prezzo, checkout).
// Stesso schema degli altri client scritti a mano (fiscale-api.ts, sdi-api.ts).
//
// Lo stato dell'offerta (bozza / interesse / vendita) si può calcolare anche
// qui, da `@workspace/config`, senza chiamare il server: il menu lo usa per
// decidere se mostrare la voce prima che la risposta arrivi. Il server resta
// l'autorità su ciò che l'impresa ha acquistato.

import { statoOfferta, type StatoOfferta, type VoceOfferta, type IntervalloAddon } from "@workspace/config";

export type RiepilogoAddonDto = {
  offerta: {
    nome: string;
    stato: StatoOfferta;
    gratuitoAttivo: boolean;
    ivaInclusa: boolean;
    etichettaIva: string;
    mancanti: string[];
    voci: VoceOfferta[];
  };
  prezzo: {
    variante: string;
    mensileCents: number;
    annualeCents: number;
    conElite: boolean;
    mensileEffettivoCents: number;
  };
  abbonamento: {
    attivo: boolean;
    stato: "attivo" | "prova" | "insoluto" | "beta" | "cessato" | null;
    intervallo: IntervalloAddon | null;
    finePeriodo: string | null;
    disdettaAFinePeriodo: boolean;
    betaFino: string | null;
  };
  funzioni: { fattureSdi: boolean; calcoloFiscale: boolean; suite: boolean };
  interesseRegistrato: boolean;
  fondatori: StatoFondatoriDto;
};

/** Prezzo fondatori: `rimasti` è il conteggio vero degli abbonamenti già fatti a quel prezzo. */
export type StatoFondatoriDto = { posti: number; rimasti: number; finoAl: string; mensileCents: number; annualeCents: number; aperti: boolean };

export type RigaTestPrezzoDto = {
  variante: string;
  mensileCents: number;
  annualeCents: number;
  imprese: Record<"vista" | "interesse" | "checkout" | "attivato" | "cessato" | "beta", number>;
  conversionePercent: number | null;
};

export class ErroreApiAddon extends Error {
  constructor(
    message: string,
    readonly codice: string,
  ) {
    super(message);
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new ErroreApiAddon(body.message || body.error || `Richiesta fallita (${res.status})`, body.error ?? "ERRORE");
  return body;
}

/** Chiave sessionStorage del `?v=` con cui l'utente è arrivato dalla landing. */
const CHIAVE_CAMPAGNA = "prevai_offerta_variante";

export function ricordaCampagna(v: string | null): void {
  if (!v) return;
  try {
    sessionStorage.setItem(CHIAVE_CAMPAGNA, v.slice(0, 8));
  } catch {
    /* storage non disponibile: la variante resterà quella dell'hash */
  }
}

export function campagnaRicordata(): string | null {
  try {
    return sessionStorage.getItem(CHIAVE_CAMPAGNA);
  } catch {
    return null;
  }
}

export const addonsApi = {
  riepilogo: () => req<RiepilogoAddonDto>("/api/addons/amministrazione"),
  evento: (tipo: "vista" | "interesse") =>
    req<{ registrato: boolean; variante: string }>("/api/addons/amministrazione/eventi", { method: "POST", body: JSON.stringify({ tipo, campagna: campagnaRicordata() }) }),
  checkout: (intervallo: IntervalloAddon) => req<{ url: string }>("/api/addons/amministrazione/checkout", { method: "POST", body: JSON.stringify({ intervallo }) }),
  /** Pubblica, senza account: per la landing. */
  offertaPubblica: () => req<{ stato: StatoOfferta; fondatori: StatoFondatoriDto }>("/api/public/offerta-fisco"),
  testPrezzo: () => req<{ stato: { effettivo: StatoOfferta; richiesto: StatoOfferta }; righe: RigaTestPrezzoDto[] }>("/api/admin/addons/test-prezzo"),
};

/** Stato dell'offerta calcolato nel browser, per il menu e i paywall. */
export function statoOffertaLocale(): StatoOfferta {
  return statoOfferta({ anno: new Date().getFullYear() }).effettivo;
}

/** Codici delle API che vogliono dire "questa parte si sblocca con l'add-on". */
export const CODICI_PAYWALL = ["FISCAL_MODULE_OFF", "ADMIN_SUITE_OFF", "SDI_MODULE_OFF"] as const;
