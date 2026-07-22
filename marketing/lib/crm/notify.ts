import { enrollmentSummaryLines } from "@/lib/crm/service";
import type { VenueEnrollmentRecord } from "@/lib/crm/types";
import { sendRawEmail } from "@shared/email";

/**
 * Notify the team about a new Hello to Cheers subscription enrollment.
 * Ops-only (not timeline'd). Product welcome emails go through @shared/email
 * via createVenueEnrollment → sendEnrollmentProductEmails.
 */
export async function notifySubscriptionEnrollment(
  record: VenueEnrollmentRecord,
): Promise<void> {
  const to = process.env.INQUIRY_NOTIFY_EMAIL?.trim();
  const text = enrollmentSummaryLines(record).join("\n");
  const subject = "New Hello to Cheers Subscription";

  if (!to) {
    console.info(`[crm] ${subject} (INQUIRY_NOTIFY_EMAIL not set)\n`, text);
    return;
  }

  const result = await sendRawEmail({ to, subject, text });
  if (!result.ok) {
    console.error("[crm] subscription notify failed", result.message);
  } else if (result.delivery === "simulated") {
    console.info(`[crm] ${subject} dry-run\n`, text);
  }
}
