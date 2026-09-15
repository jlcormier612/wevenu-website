/**
 * Create a CRM venue enrollment record when a subscription succeeds.
 * Welcome Back Verified starts as `pending` only when Welcome Back was requested —
 * never auto-verified. Persists `onboardingType` on the venue record.
 * Also upserts the shared Relationship (timeline + subscription metadata),
 * then sends product emails (Welcome / Founder / White Glove Welcome),
 * then enqueues Product Sync for Self-Setup (Launch Yourself). White Glove
 * venue provisioning still runs immediately; customer access waits for
 * Product HQ Finish White Glove Setup.
 *
 * Idempotent on stripeCheckoutSessionId / stripeSubscriptionId — webhook retries
 * must not duplicate venues, emails, or activations.
 */

import { randomUUID } from "crypto";

import { activationUrlFromToken, sendEnrollmentProductEmails, whiteGloveIntakeUrlFromToken } from "@shared/email";
import { enqueueProductSync } from "@shared/product-sync";
import { provisionVenueEnrollment, upsertVenueEnrollment } from "@shared/product-account";
import { notifySubscriptionEnrollment } from "@/lib/crm/notify";
import {
  findEnrollmentByCheckoutSessionId,
  findEnrollmentBySubscriptionId,
  storeVenueEnrollment,
} from "@/lib/crm/store";
import type { CreateVenueEnrollmentInput, VenueEnrollmentRecord } from "@/lib/crm/types";
import { onboardingLabel, yesNo } from "@/lib/marketing/enrollment";
import { getPlanDisplayName } from "@/lib/marketing/onboarding-packages";
import { syncEnrollmentToRelationship } from "@/lib/relationships/bridge";

/**
 * Create a CRM venue enrollment record when a subscription succeeds.
 * Welcome Back Verified starts as `pending` only when Welcome Back was requested —
 * never auto-verified. Persists `onboardingType` on the venue record.
 * Also upserts the shared Relationship, bridges product enrollment, provisions
 * the real venue workspace (Self-Setup + White Glove), then sends product emails.
 * White Glove does NOT receive activation credentials at purchase.
 */
export async function createVenueEnrollment(
  input: CreateVenueEnrollmentInput,
): Promise<VenueEnrollmentRecord> {
  const existing =
    (await findEnrollmentByCheckoutSessionId(input.stripeCheckoutSessionId)) ||
    (await findEnrollmentBySubscriptionId(input.stripeSubscriptionId));

  const now = new Date().toISOString();
  const record: VenueEnrollmentRecord = existing
    ? {
        ...existing,
        // Prefer fresh webhook payload for CRM sync fields that may have been
        // missing on a partial first attempt.
        venueName: input.venueName?.trim() || existing.venueName,
        customerEmail: input.customerEmail?.trim() || existing.customerEmail,
        customerFirstName: input.customerFirstName?.trim() || existing.customerFirstName,
        customerLastName: input.customerLastName?.trim() || existing.customerLastName,
        plan: input.plan || existing.plan,
        planName: input.planName?.trim() || existing.planName || getPlanDisplayName(input.plan),
        foundingMember: input.foundingMember || existing.foundingMember,
        welcomeBackRequested: input.welcomeBackRequested || existing.welcomeBackRequested,
        onboardingType: input.onboardingType || existing.onboardingType,
        mrrCents: input.mrrCents ?? existing.mrrCents ?? null,
        updatedAt: now,
      }
    : {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        venueName: input.venueName?.trim() || "Unknown venue",
        customerEmail: input.customerEmail?.trim() || null,
        customerFirstName: input.customerFirstName?.trim() || null,
        customerLastName: input.customerLastName?.trim() || null,
        plan: input.plan,
        planName: input.planName?.trim() || getPlanDisplayName(input.plan),
        foundingMember: input.foundingMember,
        welcomeBackRequested: input.welcomeBackRequested,
        welcomeBackVerified: input.welcomeBackRequested ? "pending" : "none",
        onboardingType: input.onboardingType,
        paymentStatus: input.paymentStatus ?? "successful",
        mrrCents: input.mrrCents ?? null,
      };

  if (existing) {
    console.info("[crm] idempotent enrollment reuse — re-syncing Relationship CRM", {
      enrollmentId: existing.id,
      checkoutSessionId: existing.stripeCheckoutSessionId,
      subscriptionId: existing.stripeSubscriptionId,
    });
  } else {
    await storeVenueEnrollment(record);
    await notifySubscriptionEnrollment(record);
  }

  const synced = await syncEnrollmentToRelationship(record, {
    firstName: record.customerFirstName,
    lastName: record.customerLastName,
  });

  // Order: token minted in enterOnboardingAfterPurchase → durable Postgres
  // venue_enrollments (product SoT) → welcome email → product sync (Launch
  // Yourself only). Marketing no longer keeps a parallel JSONL enrollment file.
  if (synced?.relationshipId && record.customerEmail) {
    const isLaunchYourself = record.onboardingType !== "white_glove";
    const activateUrl =
      isLaunchYourself && synced.activationToken
        ? activationUrlFromToken(synced.activationToken)
        : null;

    const bridged = await upsertVenueEnrollment({
      stripeCheckoutSessionId: record.stripeCheckoutSessionId,
      stripeCustomerId: record.stripeCustomerId,
      stripeSubscriptionId: record.stripeSubscriptionId,
      venueName: record.venueName,
      ownerEmail: record.customerEmail,
      ownerFirstName: record.customerFirstName,
      ownerLastName: record.customerLastName,
      plan: record.plan,
      onboardingType: isLaunchYourself ? "self_setup" : "white_glove",
      activationToken: isLaunchYourself ? synced.activationToken ?? null : null,
    });
    if (!bridged.ok) {
      // Fatal for activation: do not send Activate Account links when the
      // durable enrollment row was not written.
      console.error("[crm] Postgres enrollment bridge failed — refusing welcome/activate path", {
        enrollmentId: record.id,
        error: bridged.error,
      });
      throw new Error(
        `Could not persist venue enrollment: ${bridged.error}. Stripe webhook should retry.`,
      );
    }

    // Provision the real venue immediately (both Self-Setup and White Glove).
    // Idempotent — webhook retries must not duplicate venues or starters.
    // White Glove customers still do NOT receive product access until handoff.
    const provisioned = await provisionVenueEnrollment(bridged.id);
    if (!provisioned.ok) {
      console.error("[crm] workspace provision failed — webhook should retry", {
        enrollmentId: record.id,
        productEnrollmentId: bridged.id,
        error: provisioned.error,
      });
      throw new Error(
        `Could not provision venue workspace: ${provisioned.error}. Stripe webhook should retry.`,
      );
    }

    // Ensure CRM productSync.venueId even if the product provision route's
    // bind step could not reach the CRM store (idempotent).
    if (provisioned.venueId) {
      try {
        const { bindCrmProductVenueId } = await import("@shared/relationships");
        await bindCrmProductVenueId({
          productVenueId: provisioned.venueId,
          ownerEmail: record.customerEmail,
          stripeCustomerId: record.stripeCustomerId,
          stripeSubscriptionId: record.stripeSubscriptionId,
        });
      } catch (bindErr) {
        console.error("[crm] productSync.venueId bind failed", bindErr);
      }
    }

    const intakeUrl =
      !isLaunchYourself && provisioned.intakeToken
        ? whiteGloveIntakeUrlFromToken(provisioned.intakeToken)
        : null;

    // Webhook retries must re-sync CRM + ensure enrollment, but must not
    // re-send welcome emails or re-notify ops.
    if (!existing) {
      try {
        const emailResults = await sendEnrollmentProductEmails({
          relationshipId: synced.relationshipId,
          customerEmail: record.customerEmail,
          venueName: synced.venueName || record.venueName,
          planName: record.planName || getPlanDisplayName(record.plan),
          firstName: record.customerFirstName || synced.firstName || null,
          fullName:
            record.customerFirstName && record.customerLastName
              ? `${record.customerFirstName} ${record.customerLastName}`
              : null,
          foundingMember: record.foundingMember,
          welcomeBackRequested: record.welcomeBackRequested,
          onboardingType: record.onboardingType,
          activateUrl,
          intakeUrl,
        });
        console.info("[crm] enrollment product emails", {
          enrollmentId: record.id,
          relationshipId: synced.relationshipId,
          hasActivateUrl: Boolean(activateUrl),
          hasIntakeUrl: Boolean(intakeUrl),
          venueId: provisioned.venueId,
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
  }

  // Product Sync enqueue remains for Launch Yourself (subscription/onboarding
  // pipeline). Venue + starters are already provisioned above for both paths.
  if (!existing && synced?.relationshipId && record.onboardingType !== "white_glove") {
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
