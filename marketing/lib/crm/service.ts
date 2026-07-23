/**
 * Create a CRM venue enrollment record when a subscription succeeds.
 * Welcome Back Verified starts as `pending` only when Welcome Back was requested —
 * never auto-verified. Persists `onboardingType` on the venue record.
 * Also upserts the shared Relationship (timeline + subscription metadata),
 * then sends product emails (Welcome / Founder / White Glove Welcome),
 * then enqueues Product Sync for Launch Yourself only (White Glove defers until Launch Workspace).
 */

import { randomUUID } from "crypto";

import { sendEnrollmentProductEmails } from "@shared/email";
import { enqueueProductSync } from "@shared/product-sync";
import {
  DEFAULT_WHITE_GLOVE_TIMELINE_DAYS,
  whiteGloveTimelineLabel,
} from "@shared/relationships";
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
 * then sends product emails (Welcome / Founder / White Glove Welcome),
 * then enqueues Product Sync for Launch Yourself only (White Glove defers until Launch Workspace).
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
        implementationTimeline: whiteGloveTimelineLabel({
          minBusinessDays: DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.min,
          maxBusinessDays: DEFAULT_WHITE_GLOVE_TIMELINE_DAYS.max,
        }),
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

  // Launch Yourself: provision product access now.
  // White Glove: defer until Implementation Launch Workspace.
  if (synced?.relationshipId && record.onboardingType !== "white_glove") {
    await enqueueProductSync(
      synced.relationshipId,
      "checkout.session.completed",
    );
  } else if (synced?.relationshipId && record.onboardingType === "white_glove") {
    console.info("[crm] defer product sync for White Glove", {
      relationshipId: synced.relationshipId,
      enrollmentId: record.id,
    });
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
