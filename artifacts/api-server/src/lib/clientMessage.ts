// APP-8c — a personal email from the company to one of its clients, written by
// the assistant and confirmed by a person (message_client). One-to-one and
// transactional, so no unsubscribe link; it goes out like every other customer
// email (the connected Gmail if there is one, else Resend with Reply-To).
import type { BusinessProfile } from "@workspace/db";
import { escapeHtml } from "./email.js";
import { sendCustomerEmail } from "./connectedEmailSend.js";
import { layout, companyIdentification } from "./emailLayout.js";

/** Plain text → paragraphs (blank lines) and line breaks, every character escaped. */
export function textToHtml(body: string): string {
  return body
    .replace(/\r/g, "")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p class="e-ink" style="font-size:15px;color:#393a3d;line-height:1.65;margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function buildClientMessageHtml(params: { subject: string; body: string; profile: Pick<BusinessProfile, "companyName" | "address" | "phone" | "email" | "logoUrl"> }): string {
  const pr = params.profile;
  // One-to-one and personal: no heading, no unsubscribe — it should read like a letter.
  return layout({
    title: params.subject,
    preheader: params.body.slice(0, 140),
    brand: { kind: "company", name: pr.companyName || "", logoUrl: pr.logoUrl },
    bodyHtml: textToHtml(params.body),
    footerHtml: companyIdentification(pr).replace(/^Inviato da /, ""),
    hidePrevaiLinks: true,
  });
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
