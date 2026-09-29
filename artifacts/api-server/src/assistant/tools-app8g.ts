// APP-8g (docs/PIANO-AZIONE.md riga 38, docs/ASSISTENTE-PLAN.md) — "Chiama Rossi".
//
// One card, propose_call: the assistant finds the right number among the
// company's clients, leads, suppliers (the rubrica fornitori in Squadra) and
// workers, and the card opens the phone's dialer (`tel:`) once the person
// confirms — on a computer it shows the number and a QR to scan. The assistant
// never places a call: bridged calls, recordings and an AI speaking to customers
// are out of this plan (D19). Opening the phone always asks first (max "ask").
//
// Names are matched word by word ("Marco di Edilceramiche" → marco + edilceramiche
// anywhere in the supplier's name, referente/notes or category); more than one
// person with different numbers → the model is told to ask which one.
import { z } from "zod";
import { telefonoPerChiamata } from "@workspace/config";
import type { OpenAI } from "@workspace/integrations-openai-ai-server";
import { db, clientsTable, leadsTable, suppliersTable, collaboratorsTable, projectsTable, type ProposalKind, type TeamMemberRole } from "@workspace/db";
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { roleCan } from "../middlewares/requirePermission.js";

export type App8gContext = { userId: string; projectId: string | null; role: TeamMemberRole };

const CONTACT_TYPES = ["client", "lead", "supplier", "worker"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

export const APP8G_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "propose_call",
      description: "Propose opening the phone to call someone: a client, a lead, a supplier (the company's supplier book) or a worker. Pass the name exactly as the user said it ('Rossi', 'Marco di Edilceramiche', 'l'idraulico'); it finds the number itself. You never place the call: the user confirms and their phone opens with the number. If several people match, the result lists them: ask which one, then call again with type and id.",
      parameters: {
        type: "object",
        properties: {
          who: { type: "string", description: "Name, company or trade as the user said it" },
          type: { type: "string", enum: [...CONTACT_TYPES], description: "Only when known (from a previous result)" },
          id: { type: "string", description: "The contact's id from a previous propose_call or find result" },
          job_id: { type: "string", description: "The job the call is about, if any (omit to use the current job)" },
        },
        required: ["who"],
        additionalProperties: false,
      },
    },
  },
];

export const APP8G_PROPOSAL_TOOLS: Record<string, ProposalKind> = { propose_call: "call" };

// ── Matching (pure, tested in tools-app8g.test.ts) ───────────────────────────

const STOP = new Set(["di", "del", "dello", "della", "dei", "degli", "delle", "da", "dal", "dalla", "il", "lo", "la", "l", "i", "gli", "le", "un", "uno", "una", "e", "a", "al", "alla", "per", "con", "signor", "signore", "signora", "sig", "sigra", "geom", "geometra", "ing", "arch", "dott", "dottor", "chiama", "chiamami", "chiamare", "telefona", "telefono", "numero", "ditta", "impresa"]);

/** Lowercase, no accents, only letters and digits. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The words of "Marco di Edilceramiche" that identify someone: ["marco", "edilceramiche"]. */
export function nameTokens(who: string): string[] {
  return [...new Set(fold(who).split(" ").filter((w) => w.length >= 2 && !STOP.has(w)))];
}

export type CallCandidate = { type: ContactType; id: string; name: string; detail: string | null; phone: string | null; haystack: string; clientId?: string | null; /** A supplier's referente ("Marco Neri"), when the notes start with one. */ person?: string | null };

/** "Marco Neri · P. IVA 0123…" → "Marco Neri": the first piece of a supplier's notes when it looks like a name. */
export function referente(notes: string | null | undefined): string | null {
  const first = (notes ?? "").split(/[·,;|\n]| - | – /)[0]?.trim() ?? "";
  return first && first.length <= 40 && !/\d|@|p\.?\s*iva/i.test(first) && /^[\p{L}' .]+$/u.test(first) ? first : null;
}

/** How many of the words appear in what we know about the contact (name, referente, trade…). */
export function matchScore(tokens: readonly string[], haystack: string): number {
  const words = fold(haystack).split(" ");
  // A word matches a whole word or the start of one ("edil" ~ "edilceramiche"); 3+ letters may also match inside ("ceramiche").
  return tokens.filter((t) => words.some((w) => w === t || w.startsWith(t) || (t.length >= 4 && w.includes(t)))).length;
}

export type CallPick =
  | { kind: "one"; candidate: CallCandidate }
  | { kind: "choose"; candidates: CallCandidate[] }
  | { kind: "none" };

/**
 * Who "Marco di Edilceramiche" is. Every word must match; several people with
 * the same number are one (the client and the lead of the same person). A single
 * partial match is not enough: the model asks.
 */
export function pickCallee(tokens: readonly string[], candidates: readonly CallCandidate[]): CallPick {
  if (!tokens.length) return { kind: "none" };
  const scored = candidates.map((c) => ({ c, s: matchScore(tokens, c.haystack) })).filter((x) => x.s > 0);
  const full = scored.filter((x) => x.s === tokens.length).map((x) => x.c);
  if (full.length) {
    const numbers = new Set(full.map((c) => telefonoPerChiamata(c.phone)?.dial ?? `none:${c.type}:${c.id}`));
    if (numbers.size === 1) return { kind: "one", candidate: full.find((c) => telefonoPerChiamata(c.phone)) ?? full[0]! };
    return { kind: "choose", candidates: onePerNumber(full).slice(0, 6) };
  }
  const best = Math.max(0, ...scored.map((x) => x.s));
  const partial = scored.filter((x) => x.s === best).map((x) => x.c);
  return partial.length ? { kind: "choose", candidates: onePerNumber(partial).slice(0, 6) } : { kind: "none" };
}

/** The same person as client and as lead (same number) is listed once — the first found, the client. */
function onePerNumber(list: readonly CallCandidate[]): CallCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = telefonoPerChiamata(c.phone)?.dial ?? `none:${c.type}:${c.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TYPE_IT: Record<ContactType, string> = { client: "cliente", lead: "richiesta", supplier: "fornitore", worker: "squadra" };

// ── Loading the candidates ───────────────────────────────────────────────────

/** A LIKE pattern for one word (% and _ said by the user are not wildcards). */
const like = (w: string) => `%${w.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** The areas a role must see for each kind of contact. */
function allowedTypes(role: TeamMemberRole): ContactType[] {
  return CONTACT_TYPES.filter((t) => roleCan(role, t === "client" ? "quotes" : t === "lead" ? "leads" : t === "worker" ? "team" : "jobs", "view"));
}

async function loadCandidates(ctx: App8gContext, tokens: string[], types: ContactType[], byId?: string): Promise<CallCandidate[]> {
  const anyWord = (cols: unknown[]): SQL => or(...tokens.flatMap((w) => cols.map((c) => sql`${c} ilike ${like(w)}`)))!;
  const out: Promise<CallCandidate[]>[] = [];
  const idOk = byId && z.string().uuid().safeParse(byId).success ? byId : null;
  if (byId && !idOk) return [];
  if (types.includes("client")) {
    out.push(db.select({ id: clientsTable.id, name: clientsTable.name, phone: clientsTable.phone, city: clientsTable.city, address: clientsTable.address }).from(clientsTable)
      .where(and(eq(clientsTable.userId, ctx.userId), idOk ? eq(clientsTable.id, idOk) : anyWord([clientsTable.name, clientsTable.address, clientsTable.city]))).limit(30)
      .then((rows) => rows.map((r) => ({ type: "client" as const, id: r.id, name: r.name, detail: r.city || null, phone: r.phone, haystack: [r.name, r.address, r.city, "cliente"].filter(Boolean).join(" "), clientId: r.id }))));
  }
  if (types.includes("lead")) {
    out.push(db.select({ id: leadsTable.id, name: leadsTable.name, phone: leadsTable.phone, unsub: leadsTable.unsubscribedAt }).from(leadsTable)
      .where(and(eq(leadsTable.userId, ctx.userId), idOk ? eq(leadsTable.id, idOk) : anyWord([leadsTable.name]))).orderBy(desc(leadsTable.createdAt)).limit(30)
      .then((rows) => rows.map((r) => ({ type: "lead" as const, id: r.id, name: r.name, detail: "richiesta", phone: r.phone, haystack: `${r.name} richiesta` }))));
  }
  if (types.includes("supplier")) {
    out.push(db.select({ id: suppliersTable.id, name: suppliersTable.name, category: suppliersTable.category, info: suppliersTable.contactInfo, phone: suppliersTable.phone }).from(suppliersTable)
      .where(and(eq(suppliersTable.userId, ctx.userId), idOk ? eq(suppliersTable.id, idOk) : anyWord([suppliersTable.name, suppliersTable.category, suppliersTable.contactInfo]))).limit(30)
      .then((rows) => rows.map((r) => ({ type: "supplier" as const, id: r.id, name: r.name, detail: r.category || null, phone: r.phone, haystack: [r.name, r.category, r.info, "fornitore"].filter(Boolean).join(" "), person: referente(r.info) }))));
  }
  if (types.includes("worker")) {
    out.push(db.select({ id: collaboratorsTable.id, name: collaboratorsTable.name, role: collaboratorsTable.role, phone: collaboratorsTable.phone }).from(collaboratorsTable)
      .where(and(eq(collaboratorsTable.userId, ctx.userId), eq(collaboratorsTable.active, true), idOk ? eq(collaboratorsTable.id, idOk) : anyWord([collaboratorsTable.name, collaboratorsTable.role]))).limit(30)
      .then((rows) => rows.map((r) => ({ type: "worker" as const, id: r.id, name: r.name, detail: r.role || null, phone: r.phone, haystack: [r.name, r.role, "squadra operaio"].filter(Boolean).join(" ") }))));
  }
  return (await Promise.all(out)).flat();
}

/** The job a note after the call goes on: the one asked for, the current one, or the client's only open job. */
async function jobForCall(ctx: App8gContext, jobId: string | undefined, callee: CallCandidate): Promise<{ id: string; name: string } | null> {
  const own = async (id: string) => (await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, ctx.userId))))[0] ?? null;
  const id = jobId || ctx.projectId;
  if (id && z.string().uuid().safeParse(id).success) return own(id);
  if (callee.type !== "client") return null;
  const open = await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable)
    .where(and(eq(projectsTable.userId, ctx.userId), eq(projectsTable.clientId, callee.id), inArray(projectsTable.status, ["planning", "active", "suspended"]))).limit(2);
  return open.length === 1 ? open[0]! : null;
}

// ── The card ─────────────────────────────────────────────────────────────────

const Args = z.object({ who: z.string().trim().min(1).max(200), type: z.enum(CONTACT_TYPES).optional(), id: z.string().max(64).optional(), job_id: z.string().max(64).optional() });

type Validated = { kind: ProposalKind; projectId: string | null; summary: string; payload: Record<string, unknown> };
type Result = { ok: true; proposal: Validated } | { ok: false; error: string };

export async function validateApp8gProposal(name: string, rawArgs: unknown, ctx: App8gContext): Promise<Result> {
  if (name !== "propose_call") return { ok: false, error: `Unknown tool ${name}` };
  const a = Args.parse(rawArgs);
  const allowed = allowedTypes(ctx.role);
  const types = a.type ? allowed.filter((t) => t === a.type) : allowed;
  if (!types.length) return { ok: false, error: "This person's role can't see that kind of contact." };
  const tokens = nameTokens(a.who);

  let pick: CallPick;
  if (a.id) {
    const found = await loadCandidates(ctx, tokens, types, a.id);
    pick = found.length ? { kind: "one", candidate: found[0]! } : { kind: "none" };
  } else {
    if (!tokens.length) return { ok: false, error: "Say who to call (a name, a company or a trade)." };
    pick = pickCallee(tokens, await loadCandidates(ctx, tokens, types));
  }

  if (pick.kind === "none") {
    return { ok: false, error: `Nobody called "${a.who}" among the company's ${types.map((t) => TYPE_IT[t]).join(", ")}. Tell the user; a supplier's number can be added in Squadra → Fornitori, a client's from the Clienti page.` };
  }
  if (pick.kind === "choose") {
    const list = pick.candidates.map((c) => ({ type: c.type, id: c.id, name: c.name, what: [TYPE_IT[c.type], c.detail].filter(Boolean).join(", "), has_phone: Boolean(telefonoPerChiamata(c.phone)) }));
    return { ok: false, error: `More than one contact matches, or only in part: ask the user which one (say the names and what they are, never the ids), then call propose_call again with type and id. Candidates: ${JSON.stringify(list)}` };
  }

  const c = pick.candidate;
  const tel = telefonoPerChiamata(c.phone);
  if (!tel) {
    const where = c.type === "supplier" ? "Squadra → Fornitori" : c.type === "worker" ? "Squadra → Operai" : c.type === "lead" ? "Richieste" : "Clienti";
    return { ok: false, error: `${c.name} (${TYPE_IT[c.type]}) has no valid phone number saved. The user can add it in ${where}${c.type === "client" ? " (or you can propose_update_client)" : ""}.` };
  }
  const job = await jobForCall(ctx, a.job_id, c);
  const what = [TYPE_IT[c.type], c.detail && c.detail !== TYPE_IT[c.type] ? c.detail : null].filter(Boolean).join(", ");
  return {
    ok: true,
    proposal: {
      kind: "call",
      projectId: job?.id ?? null,
      // A supplier with a referente: "Chiama Marco Neri di Edilceramiche Srl".
      summary: `Chiama ${c.person ? `${c.person} di ${c.name}` : c.name} (${what}) al ${tel.display}`,
      payload: { contactType: c.type, contactId: c.id, name: c.person ?? c.name, company: c.person ? c.name : null, detail: c.detail, phone: tel.dial, phoneDisplay: tel.display, projectId: job?.id ?? null, projectName: job?.name ?? null },
    },
  };
}
