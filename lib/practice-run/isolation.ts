/**
 * Server-recognized Practice Run isolation helpers.
 * UI badges alone are never enough — callers must use these before writes
 * that could leave the practice boundary.
 */

import type { PracticeBlockedSideEffect } from "@/lib/practice-run/types";

export function isPracticeLinkedId(practiceRunId: string | null | undefined): boolean {
  return typeof practiceRunId === "string" && practiceRunId.trim().length > 0;
}

/** Practice-only mailbox. Optional salt (e.g. run id) keeps resets from colliding on email. */
export function practiceSampleEmail(venueId: string, salt?: string): string {
  const slug = venueId.replace(/-/g, "").slice(0, 10).toLowerCase();
  const suffix = salt ? `.${salt.replace(/-/g, "").slice(0, 8).toLowerCase()}` : "";
  return `practice.${slug}${suffix}@practice.hellotocheers.invalid`;
}

export function isPracticeSampleEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  return value.endsWith("@practice.hellotocheers.invalid");
}

export function practiceSideEffectBlockedMessage(kind: PracticeBlockedSideEffect): string {
  switch (kind) {
    case "email":
    case "sms":
      return "Practice Runs do not send messages outside Hello to Cheers.";
    case "stripe_charge":
    case "stripe_payment_intent":
    case "stripe_subscription":
    case "stripe_transfer":
      return "Practice Runs never create live payment charges.";
    case "quickbooks_sync":
      return "Practice Runs do not sync to QuickBooks.";
    case "vendor_notification":
      return "Practice Runs do not notify vendors.";
    case "client_invitation":
      return "Practice Runs do not invite real clients.";
    case "automation_dispatch":
    case "reminder_dispatch":
      return "Practice Runs do not run live automations or reminders.";
    case "public_availability_block":
      return "Practice Runs do not block your live calendar.";
    default:
      return "This action is not available inside a Practice Run.";
  }
}

/**
 * Pure guard for Pass 1 and later slices. Throws when a blocked side effect
 * is requested for a practice-linked record.
 */
export function assertPracticeSideEffectAllowed(input: {
  practiceRunId: string | null | undefined;
  kind: PracticeBlockedSideEffect;
}): void {
  if (!isPracticeLinkedId(input.practiceRunId)) return;
  throw new Error(practiceSideEffectBlockedMessage(input.kind));
}

/** Soft result form for service boundaries that return { ok:false }. */
export function practiceSideEffectBlockResult(input: {
  practiceRunId: string | null | undefined;
  kind: PracticeBlockedSideEffect;
}): { ok: false; message: string } | null {
  if (!isPracticeLinkedId(input.practiceRunId)) return null;
  return { ok: false, message: practiceSideEffectBlockedMessage(input.kind) };
}
