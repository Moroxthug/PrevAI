// APP-2 (docs/PIANO-AZIONE.md riga 17, docs/APP-PLAN.md) — le notifiche che
// arrivano anche sul telefono (Web Push), oltre alla campanella.
//
// Poche e scelte: le cose per cui vale la pena interrompere qualcuno in
// cantiere. Ogni tipo ha un interruttore per persona in Impostazioni →
// Notifiche sul telefono (acceso di partenza) e un'area di permessi: chi non
// può vedere l'area non riceve la notifica, anche se l'ha accesa (la posizione
// fiscale del titolare non arriva al telefono del capocantiere).
// Shared by the API (who gets what) and the web app (the switches). No dependencies.

export const PUSH_KINDS = ["quote_viewed", "quote_accepted", "lead_new", "client_message", "field_blocker", "scadenza_fiscale"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** The permission area (api-server requirePermission) a person needs, at least "view", to receive the kind. */
export type PushArea = "quotes" | "leads" | "jobs" | "fiscale";

export const PUSH_KIND_DEFS: Record<PushKind, { label: string; help: string; area: PushArea }> = {
  quote_viewed: {
    label: "Il cliente apre il preventivo",
    help: "La prima volta che apre il link: il momento giusto per chiamarlo.",
    area: "quotes",
  },
  quote_accepted: {
    label: "Preventivo accettato",
    help: "Il cliente ha detto sì dal link.",
    area: "quotes",
  },
  lead_new: {
    label: "Nuova richiesta dal sito",
    help: "Qualcuno ha chiesto un preventivo dal widget sul tuo sito.",
    area: "leads",
  },
  client_message: {
    label: "Messaggio da un cliente",
    help: "Un cliente ti ha scritto dalla sua area clienti.",
    area: "jobs",
  },
  // SQUADRA-1 (riga 52): un operaio che non può andare avanti.
  field_blocker: {
    label: "Un operaio è bloccato in cantiere",
    help: "Ha premuto \"Sono bloccato\" dal suo link: va sentito subito.",
    area: "jobs",
  },
  scadenza_fiscale: {
    label: "Scadenza fiscale vicina",
    help: "Una settimana prima, se usi PrevAI Fisco. Solo a chi vede la parte fiscale.",
    area: "fiscale",
  },
};

/** Fiscal reminders reach the phone only from this many days before the due date (the bell gets every threshold). */
export const PUSH_FISCAL_DAYS = 7;

/** A notification type that is also a push, or null when it stays in the bell only. */
export function pushKindOf(type: string): PushKind | null {
  return (PUSH_KINDS as readonly string[]).includes(type) ? (type as PushKind) : null;
}

/** The kinds a person has switched off, cleaned of anything unknown (an old client, a removed kind). */
export function normalizePushMuted(input: unknown): PushKind[] {
  if (!Array.isArray(input)) return [];
  return PUSH_KINDS.filter((k) => input.includes(k));
}
