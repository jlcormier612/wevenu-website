import type { InquirySubmission } from "@/lib/inquiries/types";
import { sendRawEmail } from "@shared/email";

/**
 * Notify the team about a new inquiry (ops-only — not Relationship timeline).
 * Uses shared Resend helper; dry-runs to console when RESEND_API_KEY is unset.
 */
export async function notifyInquiry(submission: InquirySubmission): Promise<void> {
  const to = process.env.INQUIRY_NOTIFY_EMAIL?.trim();

  const fieldLines = Object.entries(submission.fields)
    .filter(([, value]) => value.trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  const text = [
    `New ${submission.label}`,
    `ID: ${submission.id}`,
    `Kind: ${submission.kind}`,
    `Received: ${submission.createdAt}`,
    "",
    fieldLines,
  ].join("\n");

  const subject = `[Hello to Cheers] ${submission.label}`;

  if (!to) {
    console.info("[inquiries] notification (INQUIRY_NOTIFY_EMAIL not set)\n", text);
    return;
  }

  const result = await sendRawEmail({ to, subject, text });
  if (!result.ok) {
    console.error("[inquiries] notify failed", result.message);
  } else if (result.delivery === "simulated") {
    console.info("[inquiries] notification dry-run\n", text);
  }
}
