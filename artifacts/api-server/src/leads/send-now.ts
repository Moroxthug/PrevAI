// "Manda adesso" on a lead, shared by POST /api/leads/:id/send and the assistant
// (APP-8c, reply_lead). Uses the same GDPR-compliant (unsubscribe link) template
// as the automated sequence and advances the sequence exactly like an automated send.
import { db, leadsTable, leadEventsTable, businessProfilesTable, whatsappConnectionsTable, type Lead } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { sendLeadFollowup, FOLLOWUP_CADENCE_DAYS } from "../lib/leadMessaging.js";

export class LeadSendError extends Error {
  constructor(public code: "NOT_FOUND" | "UNSUBSCRIBED" | "NO_PROFILE" | "SEND_FAILED", message: string, public reason?: string) { super(message); }
}

export async function sendLeadNow(params: { userId: string; leadId: string; actorUserId: string | null; via?: "assistant" }): Promise<{ lead: Lead; channel: string }> {
  const { userId } = params;
  const [lead] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, params.leadId), eq(leadsTable.userId, userId)));
  if (!lead) throw new LeadSendError("NOT_FOUND", "Not found");
  if (lead.unsubscribedAt) throw new LeadSendError("UNSUBSCRIBED", "This lead has unsubscribed and cannot be messaged.");
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!profile) throw new LeadSendError("NO_PROFILE", "Business profile not found");
  const [wa] = await db.select().from(whatsappConnectionsTable).where(eq(whatsappConnectionsTable.userId, userId));
  const whatsappTemplateName = wa?.isEnabled ? (process.env.WHATSAPP_LEAD_FOLLOWUP_TEMPLATE ?? null) : null;

  const extra = { manual: true, actorUserId: params.actorUserId, ...(params.via ? { via: params.via } : {}) };
  const result = await sendLeadFollowup({ lead, profile, stage: lead.followUpStage, whatsappTemplateName });
  if (!result.ok) {
    await db.insert(leadEventsTable).values({ leadId: lead.id, userId, type: "message_failed", payload: { stage: lead.followUpStage, reason: result.reason, ...extra } });
    throw new LeadSendError("SEND_FAILED", "SEND_FAILED", result.reason);
  }

  await db.insert(leadEventsTable).values({ leadId: lead.id, userId, type: "message_sent", channel: result.channel, payload: { stage: lead.followUpStage, ...extra } });
  const nextStage = lead.followUpStage + 1;
  const nextDelayDays = FOLLOWUP_CADENCE_DAYS[nextStage];
  const [updated] = await db
    .update(leadsTable)
    .set({
      followUpStage: nextStage,
      lastContactedAt: new Date(),
      nextFollowUpAt: nextDelayDays !== undefined ? new Date(Date.now() + nextDelayDays * 86_400_000) : null,
      status: lead.status === "new" ? "contacted" : lead.status,
    })
    .where(eq(leadsTable.id, lead.id))
    .returning();
  return { lead: updated!, channel: result.channel };
}
