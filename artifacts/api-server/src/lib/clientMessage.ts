// APP-8c — a personal email from the company to one of its clients, written by
// the assistant and confirmed by a person (message_client). One-to-one and
// transactional, so no unsubscribe link; it goes out like every other customer
// email (the connected Gmail if there is one, else Resend with Reply-To).
import type { BusinessProfile } from "@workspace/db";
import { escapeHtml } from "./email.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";

/** Plain text → paragraphs (blank lines) and line breaks, every character escaped. */
export function textToHtml(body: string): string {
  return body
    .replace(/\r/g, "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;color:#111827;line-height:1.6;margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function buildClientMessageHtml(params: { subject: string; body: string; profile: Pick<BusinessProfile, "companyName" | "address" | "phone" | "email" | "logoUrl"> }): string {
  const p = params.profile;
  const logo = p.logoUrl ? `<img src="${escapeHtml(p.logoUrl)}" alt="" style="max-height:40px;margin-bottom:16px;" />` : "";
  const contact = [p.phone, p.email].filter(Boolean).map((x) => escapeHtml(String(x))).join(" · ");
  return `<!DOCTYPE html>
<html lang="it"><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    ${logo}
    ${textToHtml(params.body)}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.6;">
      <div><strong>${escapeHtml(p.companyName || "")}</strong></div>
      ${p.address ? `<div>${escapeHtml(p.address)}</div>` : ""}
      ${contact ? `<div>${contact}</div>` : ""}
    </div>
  </div>
</body></html>`;
}

export async function sendClientMessage(params: { userId: string; toEmail: string; subject: string; body: string; profile: BusinessProfile }): Promise<void> {
  await sendCustomerEmail({
    userId: params.userId,
    toEmail: params.toEmail,
    fromDisplayName: params.profile.companyName || "PrevAI",
    replyTo: params.profile.email ?? null,
    subject: params.subject,
    html: buildClientMessageHtml({ subject: params.subject, body: params.body, profile: params.profile }),
  });
}
