import {
  enrollmentSummaryLines,
  type EnrollmentNotifyContext,
} from "./enrollment-summary";
import type { VenueEnrollmentRecord } from "./types";
import { sendOpsInternalEmail } from "@shared/email";

/**
 * Notify the team about a new Hello to Cheers subscription enrollment.
 * Ops-only (not timeline'd). Product welcome emails go through @shared/email
 * via createVenueEnrollment → sendEnrollmentProductEmails.
 *
 * Called only on first enrollment insert (webhook retries reuse existing).
 * Resend Idempotency-Key further protects against duplicate delivers.
 */
export async function notifySubscriptionEnrollment(
  record: VenueEnrollmentRecord,
  context: EnrollmentNotifyContext = {},
): Promise<void> {
  const subject = `New Hello to Cheers Subscription — ${record.venueName}`;
  const text = enrollmentSummaryLines(record, context).join("\n");
  const sessionKey = record.stripeCheckoutSessionId?.trim() || record.id;
  const result = await sendOpsInternalEmail({
    subject,
    text,
    idempotencyKey: `htc-ops-subscription:${sessionKey}`,
    tags: [
      { name: "category", value: "ops_subscription" },
      { name: "enrollment", value: record.id.slice(0, 64) },
    ],
  });
  if (!result.ok) {
    console.error("[crm] subscription notify failed", result.message);
  }
}
