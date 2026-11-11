/**
 * Ops email when a White Glove customer first submits intake.
 * Idempotent: only for first transition into a post-submit status; Resend key per enrollment.
 */

import { sendOpsInternalEmail } from "@shared/email";
import {
  BRING_BUSINESS_OPTIONS,
  type BringBusinessChoice,
  type OnboardingIntakeInput,
} from "@/lib/onboarding/types";

const POST_SUBMIT = new Set([
  "waiting",
  "in_progress",
  "setup_complete_access_pending",
  "complete",
]);

export function isFirstWhiteGloveIntakeSubmit(
  previousStatus: string | null | undefined,
): boolean {
  return !POST_SUBMIT.has(previousStatus ?? "");
}

function bringBusinessLabel(choice: BringBusinessChoice | null | undefined): string {
  if (!choice) return "—";
  const opt = BRING_BUSINESS_OPTIONS.find((o) => o.key === choice);
  return opt?.title ?? choice;
}

function productAppBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.PRODUCT_APP_URL?.trim() ||
    "https://app.sandbox.hellotocheers.com"
  ).replace(/\/$/, "");
}

export function whiteGloveIntakeOpsSummary(input: {
  venueName: string;
  ownerEmail: string | null;
  enrollmentId: string;
  venueId: string;
  intake: OnboardingIntakeInput;
  materialsCount: number;
}): { subject: string; text: string; idempotencyKey: string } {
  const reviewUrl = `${productAppBase()}/admin/onboarding/${input.venueId}`;
  const materials =
    input.materialsCount <= 0
      ? "None uploaded yet (customer can add more from the waiting page)."
      : `${input.materialsCount} file(s) uploaded (review in HQ — not attached here).`;

  const subject = `White Glove intake submitted — ${input.venueName}`;
  const text = [
    "White Glove intake was submitted successfully.",
    "",
    "Venue:",
    input.venueName,
    "",
    "Customer email:",
    input.ownerEmail || "—",
    "",
    "Existing system:",
    bringBusinessLabel(input.intake.bringBusinessChoice),
    "",
    "Materials:",
    materials,
    "",
    "Enrollment id:",
    input.enrollmentId,
    "",
    "Venue id:",
    input.venueId,
    "",
    "Review intake & materials:",
    reviewUrl,
    "",
    "Next action:",
    "Open the White Glove operator workspace, review answers and materials, then configure the venue and Finish when ready for Welcome Home.",
  ].join("\n");

  return {
    subject,
    text,
    idempotencyKey: `htc-ops-wg-intake:${input.enrollmentId}`,
  };
}

export async function notifyWhiteGloveIntakeSubmitted(input: {
  venueName: string;
  ownerEmail: string | null;
  enrollmentId: string;
  venueId: string;
  intake: OnboardingIntakeInput;
  materialsCount: number;
  /** Previous enrollment.white_glove_status before this submit. */
  previousWhiteGloveStatus: string | null | undefined;
}): Promise<{ sent: boolean; reason: string }> {
  if (!isFirstWhiteGloveIntakeSubmit(input.previousWhiteGloveStatus)) {
    return { sent: false, reason: "not_first_submit" };
  }

  const payload = whiteGloveIntakeOpsSummary(input);
  const result = await sendOpsInternalEmail({
    ...payload,
    tags: [
      { name: "category", value: "ops_white_glove_intake" },
      { name: "enrollment", value: input.enrollmentId.slice(0, 64) },
    ],
  });

  if (!result.ok) {
    return { sent: false, reason: result.message };
  }
  if (result.delivery === "skipped") {
    return { sent: false, reason: "notify_email_unset" };
  }
  if (result.delivery === "simulated") {
    return { sent: false, reason: "simulated" };
  }
  return { sent: true, reason: "sent" };
}
