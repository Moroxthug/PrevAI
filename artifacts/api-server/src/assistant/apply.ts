// Phase 5 — executes a confirmed proposal with the same logic the manual
// routes use (milestone status → automation, invoice drafts → service, …).
import {
  db,
  assistantProposalsTable,
  projectsTable,
  milestonesTable,
  projectTasksTable,
  costEntriesTable,
  businessProfilesTable,
  hasFeature,
  type AssistantProposal,
  type CostCategory,
  type MilestoneStatus,
  type PaymentMethod,
  type ProductFeature,
  type TaxBreakdown,
  type TeamMemberRole,
  assistantActionsTable,
  invoicesTable,
  type AssistantActionRow,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { raiseAutomation } from "../lib/automation.js";
import { writeAudit } from "../lib/notifications.js";
import { recomputeProgress } from "../jobs/setup.js";
import { parseIsoDate } from "../jobs/dates.js";
import { draftDepositInvoice, draftFinalInvoice, draftHoldbackReleaseInvoice, draftMilestoneInvoice, buildInvoiceContext, sendInvoice, recordPayment, voidInvoice } from "../invoices/service.js";
import { assistantV2Ready, ownsConversation, roleAllowsAction, undoDeadline } from "./permissions.js";
import { executeApp8c, undoApp8c, App8cError, APP8C_KINDS } from "./apply-app8c.js";
export { undoDeadline };

const FEATURE_FOR: Record<AssistantProposal["kind"], ProductFeature> = {
  cost_entry: "costs",
  milestone_update: "jobs",
  task: "jobs",
  invoice: "invoicing",
  send_invoice: "invoicing",
  record_payment: "invoicing",
  // APP-8c
  draft_quote: "quotes",
  send_quote: "quote_email",
  send_contract: "contracts",
  reply_lead: "quotes",
  message_client: "quotes",
  update_client: "quotes",
  job_note: "jobs",
};

export class ProposalError extends Error {
  constructor(message: string, public code: string = "PROPOSAL_FAILED", public status = 400) { super(message); }
}

export type ApplyResult = { proposal: AssistantProposal; action: AssistantActionRow | null; entityType: string; entityId: string; link: string | null };

/** APP-8b: the person acting — the company, the person and their role (service.ts Who). */
type Who = { orgId: string; actorId: string; role: TeamMemberRole };

/** A card of this person's conversation, or 404 (another person's card looks like no card at all). */
async function ownProposal(who: Who, proposalId: string): Promise<AssistantProposal> {
  const [proposal] = await db.select().from(assistantProposalsTable).where(and(eq(assistantProposalsTable.id, proposalId), eq(assistantProposalsTable.userId, who.orgId)));
  if (!proposal || !(await ownsConversation(who, proposal.conversationId))) throw new ProposalError("Proposal not found", "NOT_FOUND", 404);
  return proposal;
}

/**
 * Runs a pending card — from the Conferma button (level "ask") or straight from
 * the turn when the action is "Lo fa" (level "auto"). The plan and the person's
 * role are checked here, whatever the settings say (the second check of §4).
 */
export async function runProposal(params: { proposal: AssistantProposal; who: Who; level: "auto" | "ask"; ip?: string | null }): Promise<ApplyResult> {
  const { proposal, who } = params;
  if (proposal.status !== "pending") throw new ProposalError(`Proposal already ${proposal.status}`, "ALREADY_RESOLVED", 409);
  if (!roleAllowsAction(who.role, proposal.kind)) throw new ProposalError("Il tuo ruolo non può fare questa azione.", "FORBIDDEN", 403);
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, who.orgId));
  if (!hasFeature(profile, FEATURE_FOR[proposal.kind])) throw new ProposalError("Your plan does not include this action", "PLAN_REQUIRED", 403);

  try {
    const out = APP8C_KINDS.has(proposal.kind)
      ? await executeApp8c(proposal, who, params.ip ?? null, params.level).catch((e) => { throw e instanceof App8cError ? new ProposalError(e.message, e.code, e.status) : e; })
      : await execute(proposal, who.orgId, params.ip ?? null, params.level);
    const [updated] = await db.update(assistantProposalsTable).set({ status: "confirmed", resultEntityType: out.entityType, resultEntityId: out.entityId, resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id)).returning();
    const action = (await assistantV2Ready())
      ? (await db.insert(assistantActionsTable).values({ userId: who.orgId, proposalId: proposal.id, actorUserId: who.actorId, kind: proposal.kind, level: params.level }).returning())[0] ?? null
      : null;
    return { proposal: updated!, action, ...out };
  } catch (err) {
    const message = (err as Error).message || "Could not apply the proposal";
    await db.update(assistantProposalsTable).set({ status: "failed", error: message, resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id));
    throw err instanceof ProposalError ? err : new ProposalError(message);
  }
}

export async function confirmProposal(params: { who: Who; proposalId: string; ip?: string | null }): Promise<ApplyResult> {
  const proposal = await ownProposal(params.who, params.proposalId);
  return runProposal({ proposal, who: params.who, level: "ask", ip: params.ip });
}

export async function dismissProposal(params: { who: Who; proposalId: string }): Promise<AssistantProposal> {
  const proposal = await ownProposal(params.who, params.proposalId);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal already ${proposal.status}`, "ALREADY_RESOLVED", 409);
  const [updated] = await db.update(assistantProposalsTable).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(assistantProposalsTable.id, proposal.id)).returning();
  return updated!;
}

/** Seconds the server still accepts Annulla after the card showed it (the phone may be slow). */
const UNDO_GRACE_SECONDS = 20;

/**
 * APP-8b — Annulla on a card that ran by itself. Only for "Lo fa" actions that
 * can be taken back (a cost, a task, a draft invoice still a draft), only by the
 * same person, only for a few seconds.
 */
export async function undoProposal(params: { who: Who; proposalId: string; ip?: string | null; now?: Date }): Promise<{ proposal: AssistantProposal; action: AssistantActionRow }> {
  const { who } = params;
  const proposal = await ownProposal(who, params.proposalId);
  if (!(await assistantV2Ready())) throw new ProposalError("Annulla non è ancora disponibile.", "NOT_AVAILABLE", 503);
  const [action] = await db.select().from(assistantActionsTable).where(eq(assistantActionsTable.proposalId, proposal.id));
  const deadline = undoDeadline(action);
  if (!action || !deadline || proposal.status !== "confirmed" || !proposal.resultEntityId) throw new ProposalError("Questa azione non si può annullare.", "NOT_UNDOABLE", 409);
  if (action.actorUserId !== who.actorId) throw new ProposalError("Proposal not found", "NOT_FOUND", 404);
  const now = params.now ?? new Date();
  if (now.getTime() > deadline.getTime() + UNDO_GRACE_SECONDS * 1000) throw new ProposalError("Troppo tardi per annullare: puoi cambiarlo dalla schermata.", "UNDO_EXPIRED", 409);
  if (!roleAllowsAction(who.role, proposal.kind)) throw new ProposalError("Il tuo ruolo non può fare questa azione.", "FORBIDDEN", 403);

  const id = proposal.resultEntityId;
  switch (proposal.kind) {
    case "cost_entry":
      await db.delete(costEntriesTable).where(and(eq(costEntriesTable.id, id), eq(costEntriesTable.userId, who.orgId)));
      break;
    case "task": {
      const project = await ownedProject(who.orgId, String((proposal.payload as Record<string, unknown>).projectId));
      await db.delete(projectTasksTable).where(and(eq(projectTasksTable.id, id), eq(projectTasksTable.projectId, project.id)));
      break;
    }
    case "invoice": {
      const [inv] = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.userId, who.orgId)));
      if (!inv || inv.status !== "draft") throw new ProposalError("La fattura non è più una bozza: annullala dalla sua pagina.", "NOT_UNDOABLE", 409);
      await voidInvoice({ invoiceId: id, userId: who.orgId, reason: "Bozza annullata dall'assistente" });
      break;
    }
    default:
      if (!APP8C_KINDS.has(proposal.kind)) throw new ProposalError("Questa azione non si può annullare.", "NOT_UNDOABLE", 409);
      await undoApp8c(proposal, who).catch((e) => { throw e instanceof App8cError ? new ProposalError(e.message, e.code, e.status) : e; });
  }
  const [updated] = await db.update(assistantProposalsTable).set({ status: "undone" }).where(eq(assistantProposalsTable.id, proposal.id)).returning();
  const [undone] = await db.update(assistantActionsTable).set({ undoneAt: now }).where(eq(assistantActionsTable.id, action.id)).returning();
  await writeAudit({ userId: who.orgId, actorType: "user", actorId: who.actorId, entityType: proposal.resultEntityType ?? proposal.kind, entityId: id, action: "undone_via_assistant", diff: { proposalId: proposal.id }, ip: params.ip ?? null });
  return { proposal: updated!, action: undone! };
}

async function ownedProject(userId: string, id: string) {
  const [p] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));
  if (!p) throw new ProposalError("Job not found", "NOT_FOUND", 404);
  return p;
}

async function execute(proposal: AssistantProposal, userId: string, ip: string | null, level: "auto" | "ask"): Promise<{ entityType: string; entityId: string; link: string | null }> {
  const p = proposal.payload as Record<string, unknown>;
  switch (proposal.kind) {
    case "cost_entry": {
      const project = await ownedProject(userId, String(p.projectId));
      const [entry] = await db
        .insert(costEntriesTable)
        .values({
          userId,
          projectId: project.id,
          milestoneId: (p.milestoneId as string | null) ?? null,
          category: p.category as CostCategory,
          vendor: String(p.vendor ?? ""),
          description: String(p.description ?? ""),
          date: parseIsoDate(p.date as string | null) ?? new Date(),
          subtotalCents: Number(p.subtotalCents ?? 0),
          taxCents: Number(p.taxCents ?? 0),
          taxBreakdown: (p.taxBreakdown as TaxBreakdown) ?? {},
          totalCents: Number(p.totalCents ?? 0),
          status: "confirmed",
          source: "manual",
          createdBy: "ai",
          confirmedAt: new Date(),
        })
        .returning();
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "cost_entry", entityId: entry!.id, action: "created_via_assistant", diff: { level }, ip });
      return { entityType: "cost_entry", entityId: entry!.id, link: `/dashboard/jobs/${project.id}?tab=costs` };
    }
    case "milestone_update": {
      const project = await ownedProject(userId, String(p.projectId));
      const [m] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, String(p.milestoneId)), eq(milestonesTable.projectId, project.id)));
      if (!m) throw new ProposalError("Milestone not found", "NOT_FOUND", 404);
      const updates: Partial<typeof milestonesTable.$inferInsert> = {};
      if (p.title) updates.title = String(p.title);
      if (p.plannedStart) updates.plannedStart = parseIsoDate(String(p.plannedStart));
      if (p.plannedEnd) updates.plannedEnd = parseIsoDate(String(p.plannedEnd));
      const status = (p.status as MilestoneStatus | null) ?? null;
      if (status) {
        updates.status = status;
        if (status === "in_progress" && !m.actualStart) updates.actualStart = new Date();
        if (status === "completed") { updates.actualEnd = m.actualEnd ?? new Date(); if (!m.actualStart) updates.actualStart = new Date(); }
        if (status === "planned") { updates.actualStart = null; updates.actualEnd = null; }
      }
      await db.update(milestonesTable).set(updates).where(eq(milestonesTable.id, m.id));
      await recomputeProgress(project.id);
      if (status === "completed" && m.status !== "completed") {
        await raiseAutomation({ event: "milestone.completed", userId, entityType: "milestone", entityId: m.id, payload: { projectId: project.id } });
      }
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "milestone", entityId: m.id, action: "updated_via_assistant", diff: { ...(updates as Record<string, unknown>), level }, ip });
      return { entityType: "milestone", entityId: m.id, link: `/dashboard/jobs/${project.id}?tab=schedule` };
    }
    case "task": {
      const project = await ownedProject(userId, String(p.projectId));
      const [t] = await db.insert(projectTasksTable).values({ projectId: project.id, title: String(p.title), milestoneId: (p.milestoneId as string | null) ?? null, dueDate: parseIsoDate((p.dueDate as string | null) ?? null), status: "todo" }).returning();
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "task", entityId: t!.id, action: "created_via_assistant", diff: { level }, ip });
      return { entityType: "task", entityId: t!.id, link: `/dashboard/jobs/${project.id}?tab=schedule` };
    }
    case "invoice": {
      const project = await ownedProject(userId, String(p.projectId));
      const kind = String(p.kind);
      const ctx = await buildInvoiceContext({ userId, projectId: project.id });
      let out: { invoice: { id: string }; created: boolean } | null;
      if (kind === "deposit") {
        if (!ctx.contract) throw new ProposalError("This job has no signed contract");
        out = await draftDepositInvoice({ contract: ctx.contract, projectId: project.id, source: "manual", actor: "contractor" });
      } else if (kind === "term") {
        const [ms] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, String(p.milestoneId)), eq(milestonesTable.projectId, project.id)));
        if (!ms) throw new ProposalError("Milestone not found", "NOT_FOUND", 404);
        out = await draftMilestoneInvoice({ milestone: ms, source: "manual", actor: "contractor" });
      } else if (kind === "final") out = await draftFinalInvoice({ project, source: "manual", actor: "contractor" });
      else out = await draftHoldbackReleaseInvoice({ project, source: "manual", actor: "contractor" });
      if (!out) throw new ProposalError("Nothing left to invoice for that item", "NOTHING_TO_INVOICE");
      await writeAudit({ userId, actorType: "ai", actorId: proposal.id, entityType: "invoice", entityId: out.invoice.id, action: "drafted_via_assistant", diff: { level }, ip });
      return { entityType: "invoice", entityId: out.invoice.id, link: `/dashboard/invoices/${out.invoice.id}` };
    }
    case "send_invoice": {
      const { invoice } = await sendInvoice({ invoiceId: String(p.invoiceId), userId, actor: "contractor", message: p.message ? String(p.message) : undefined, ip });
      return { entityType: "invoice", entityId: invoice.id, link: `/dashboard/invoices/${invoice.id}` };
    }
    case "record_payment": {
      const { invoice } = await recordPayment({ invoiceId: String(p.invoiceId), userId, amountCents: Number(p.amountCents), method: (p.method as PaymentMethod) ?? "bank_transfer", date: parseIsoDate((p.date as string | null) ?? null) ?? new Date(), reference: p.reference ? String(p.reference) : undefined, ip });
      return { entityType: "invoice", entityId: invoice.id, link: `/dashboard/invoices/${invoice.id}` };
    }
    default:
      throw new ProposalError(`Unsupported proposal kind ${proposal.kind}`);
  }
}
