import { randomUUID } from "crypto";

import { sendEnrollmentProductEmails } from "@shared/email";
import { enqueueProductSync } from "@shared/product-sync";
import { notifySubscriptionEnrollment } from "@/lib/crm/notify";
import { storeVenueEnrollment } from "@/lib/crm/store";
import type { CreateVenueEnrollmentInput, VenueEnrollmentRecord } from "@/lib/crm/types";
import { onboardingLabel, yesNo } from "@/lib/marketing/enrollment";
import { getPlanDisplayName } from "@/lib/marketing/onboarding-packages";
import { syncEnrollmentToRelationship } from "@/lib/relationships/bridge";

/**
 * Create a CRM venue enrollment record when a subscription succeeds.
 * Welcome Back Verified starts as `pending` only when Welcome Back was requested —
 * never auto-verified. Persists `onboardingType` on the venue record.
 * Also upserts the shared Relationship (timeline + subscription metadata),
 * then sends Project 3 product emails (Welcome / Founder / Welcome Back / WG),
 * then enqueues Project 10 product sync (Venue → … → Launch).
 */
export async function createVenueEnrollment(
  input: CreateVenueEnrollmentInput,
): Promise<VenueEnrollmentRecord> {
  const now = new Date().toISOString();
  const record: VenueEnrollmentRecord = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    venueName: input.venueName?.trim() || "Unknown venue",
    customerEmail: input.customerEmail?.trim() || null,
    plan: input.plan,
    planName: input.planName?.trim() || getPlanDisplayName(input.plan),
    foundingMember: input.foundingMember,
    welcomeBackRequested: input.welcomeBackRequested,
    welcomeBackVerified: input.welcomeBackRequested ? "pending" : "none",
    onboardingType: input.onboardingType,
    paymentStatus: input.paymentStatus ?? "successful",
    mrrCents: input.mrrCents ?? null,
  };

  await storeVenueEnrollment(record);
  await notifySubscriptionEnrollment(record);
  const synced = await syncEnrollmentToRelationship(record);

  if (synced?.relationshipId && record.customerEmail) {
    try {
      const emailResults = await sendEnrollmentProductEmails({
        relationshipId: synced.relationshipId,
        customerEmail: record.customerEmail,
        venueName: record.venueName,
        planName: record.planName || getPlanDisplayName(record.plan),
        foundingMember: record.foundingMember,
        welcomeBackRequested: record.welcomeBackRequested,
        onboardingType: record.onboardingType,
      });
      console.info("[crm] enrollment product emails", {
        enrollmentId: record.id,
        relationshipId: synced.relationshipId,
        results: emailResults.map((r) => ({
          templateId: r.templateId,
          delivery: r.delivery,
          ok: r.ok,
        })),
      });
    } catch (error) {
      console.error("[crm] enrollment product emails failed", record.id, error);
    }
  }

  if (synced?.relationshipId) {
    await enqueueProductSync(
      synced.relationshipId,
      "checkout.session.completed",
    );
  }

  return record;
}

/** Human-readable summary lines for ops notifications. */
export function enrollmentSummaryLines(record: VenueEnrollmentRecord): string[] {
  return [
    "Venue:",
    record.venueName,
    "",
    "Plan:",
    record.planName || getPlanDisplayName(record.plan),
    "",
    "Founding Member:",
    yesNo(record.foundingMember),
    "",
    "Welcome Back:",
    yesNo(record.welcomeBackRequested),
    "",
    "Onboarding:",
    onboardingLabel(record.onboardingType),
    "",
    "Payment:",
    record.paymentStatus === "successful" ? "Successful" : record.paymentStatus,
    "",
    "Customer Email:",
    record.customerEmail || "—",
    "",
    "Stripe Customer:",
    record.stripeCustomerId || "—",
    "",
    "Subscription:",
    record.stripeSubscriptionId || "—",
    "",
    "Purchase Date:",
    record.createdAt,
  ];
}
