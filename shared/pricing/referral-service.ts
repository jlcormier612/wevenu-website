/**
 * Phase 6 — Refer a Venue service (submission → attribution → qualification → reward).
 */

import type { EligibleGrant } from "./best-offer";
import type { FounderArrangementRecord } from "./founder-types";
import { addDaysIso, getReferralProgramPolicy } from "./referral-policy";
import {
  findAppliedReferralCreditInvoice,
  issueReferralSubscriptionCredit,
  type StripeReferralExecutor,
} from "./referral-stripe-execute";
import type { ReferralStore } from "./referral-store";
import type {
  ReferralAttributionMatchMethod,
  ReferralRewardRecord,
  ReferralWorkflowStatus,
  VenueReferralRecord,
} from "./referral-types";
import {
  extractWebsiteDomain,
  toCustomerReferralView,
  validateReferralSubmission,
  type ReferralSubmissionInput,
} from "./referral-validate";
import { valueReferrerReward } from "./referral-value";
import {
  getReferralProgramReadiness,
  isReferralProgramReady,
  isReferralRewardIssueEnabled,
} from "./readiness";
import type { SaasPlanKey } from "./types";

export type ReferralVenueBillingSnapshot = {
  venueId: string;
  name?: string | null;
  website?: string | null;
  websiteDomain?: string | null;
  organizationId?: string | null;
  planKey: SaasPlanKey;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  grants: EligibleGrant[];
  groupEligible: boolean;
  arrangements: FounderArrangementRecord[];
};

export type ReferralServiceContext = {
  store: ReferralStore;
  loadVenue: (venueId: string) => Promise<ReferralVenueBillingSnapshot | null>;
  listOrgVenueIds?: (organizationId: string) => Promise<string[]>;
  stripe?: StripeReferralExecutor | null;
  nowIso?: () => string;
  /** Test hook: force qualification window elapsed without waiting. */
  forceQualificationNow?: boolean;
};

function nowOf(ctx: ReferralServiceContext): string {
  return ctx.nowIso?.() ?? new Date().toISOString();
}

export type SubmitReferralResult =
  | {
      ok: true;
      referral: VenueReferralRecord;
      customerView: ReturnType<typeof toCustomerReferralView>;
      confirmation: { title: string; body: string };
    }
  | {
      ok: false;
      code: string;
      message: string;
      errors?: Record<string, string>;
    };

export async function submitVenueReferral(
  ctx: ReferralServiceContext,
  input: {
    referringVenueId: string;
    submittedByUserId?: string | null;
    submittedByEmail?: string | null;
    form: ReferralSubmissionInput;
  },
): Promise<SubmitReferralResult> {
  const readiness = getReferralProgramReadiness();
  if (!isReferralProgramReady(readiness)) {
    return {
      ok: false,
      code: "not_ready",
      message: readiness.diagnosticMessage,
    };
  }

  const validated = validateReferralSubmission(input.form);
  if (!validated.ok) {
    return {
      ok: false,
      code: "validation",
      message: validated.message,
      errors: validated.errors as Record<string, string>,
    };
  }

  const referrer = await ctx.loadVenue(input.referringVenueId);
  if (!referrer) {
    return { ok: false, code: "venue_not_found", message: "Venue not found." };
  }

  const policy = getReferralProgramPolicy();
  const domain = extractWebsiteDomain(validated.cleaned.website)!;
  const referrerDomain =
    referrer.websiteDomain ||
    (referrer.website ? extractWebsiteDomain(referrer.website) : null);

  let isSelfReferral = false;
  let isSameOrganization = false;
  let isExistingPayingCustomer = false;
  let isDuplicateClaim = false;
  let blockedReason: string | null = null;
  let status: ReferralWorkflowStatus = "submitted";

  if (referrerDomain && referrerDomain === domain) {
    isSelfReferral = true;
    blockedReason = "self_referral_domain";
    status = "closed_not_eligible";
  }

  if (
    !isSelfReferral &&
    referrer.organizationId &&
    ctx.listOrgVenueIds
  ) {
    const siblingIds = await ctx.listOrgVenueIds(referrer.organizationId);
    for (const siblingId of siblingIds) {
      if (siblingId === referrer.venueId) continue;
      const sibling = await ctx.loadVenue(siblingId);
      const siblingDomain =
        sibling?.websiteDomain ||
        (sibling?.website ? extractWebsiteDomain(sibling.website) : null);
      if (siblingDomain && siblingDomain === domain) {
        isSameOrganization = true;
        blockedReason = "same_organization_property";
        status = "closed_not_eligible";
        break;
      }
    }
  }

  // Existing open duplicate from this referrer (same domain or email)
  const openMatches = await ctx.store.findOpenByDomainOrEmail({
    domain,
    email: validated.cleaned.contactEmail,
  });
  const priorFromSame = openMatches.find(
    (r) =>
      r.referringVenueId === referrer.venueId &&
      (r.referredWebsiteDomain === domain ||
        r.referredContactEmail === validated.cleaned.contactEmail),
  );
  if (priorFromSame && status === "submitted") {
    isDuplicateClaim = true;
    blockedReason = "duplicate_submission";
    status = "closed_duplicate";
  }

  // Later referrers for same domain are accepted for CRM visibility but flagged.
  const earlierOther = openMatches
    .filter((r) => r.referringVenueId !== referrer.venueId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (earlierOther && status === "submitted") {
    isDuplicateClaim = true;
    blockedReason = `later_claim_after:${earlierOther.id}`;
    // Keep under review — founders decide; earliest wins for reward.
    status = "under_review";
  }

  const referral = await ctx.store.createReferral({
    referringVenueId: referrer.venueId,
    referringOrganizationId: referrer.organizationId ?? null,
    submittedByUserId: input.submittedByUserId ?? null,
    submittedByEmail: input.submittedByEmail ?? null,
    referredVenueName: validated.cleaned.venueName,
    referredCity: validated.cleaned.city,
    referredState: validated.cleaned.state,
    referredWebsite: validated.cleaned.website,
    referredWebsiteDomain: domain,
    referredContactEmail: validated.cleaned.contactEmail,
    referredContactName: validated.cleaned.contactName,
    referredContactRole: validated.cleaned.contactRole,
    notes: validated.cleaned.notes,
    programPolicyVersion: policy.version,
    qualificationDays: policy.qualificationDays,
    isSelfReferral,
    isSameOrganization,
    isExistingPayingCustomer,
    isDuplicateClaim,
    blockedReason,
    status,
    metadata: {
      referrerPlanKey: referrer.planKey,
      earlierReferralId: earlierOther?.id ?? null,
    },
  });

  // Do NOT auto-email the prospect. Confirmation is in-app only here.
  // Founders review referrals in workspace CRM and follow up personally.
  return {
    ok: true,
    referral,
    customerView: toCustomerReferralView(referral, null),
    confirmation: {
      title: "Thanks for sharing the Luv!",
      body: "We've received your referral, and we'll take it from here. We appreciate you helping more venues discover Hello to Cheers!",
    },
  };
}

export async function listCustomerReferrals(
  ctx: ReferralServiceContext,
  venueId: string,
) {
  const rows = await ctx.store.listReferralsForVenue(venueId);
  const views = [];
  for (const row of rows) {
    const reward = await ctx.store.getRewardForReferral(row.id);
    views.push(
      toCustomerReferralView(
        row,
        reward
          ? {
              status: reward.status,
              rewardAmountCents: reward.rewardAmountCents,
              currency: reward.currency,
              appliedInvoiceId: reward.appliedInvoiceId,
              issuedAt: reward.issuedAt,
              appliedAt: reward.appliedAt,
            }
          : null,
      ),
    );
  }
  return views;
}

export async function founderUpdateReferral(
  ctx: ReferralServiceContext,
  input: {
    referralId: string;
    actorEmail: string;
    status?: ReferralWorkflowStatus;
    assignedOwnerEmail?: string | null;
    linkedRelationshipId?: string | null;
    linkedVenueId?: string | null;
    note?: string | null;
    markExistingPayingCustomer?: boolean;
  },
): Promise<VenueReferralRecord> {
  const existing = await ctx.store.getReferral(input.referralId);
  if (!existing) throw new Error("referral_not_found");

  let patch: Parameters<ReferralStore["updateReferral"]>[1] = {
    auditEntry: {
      at: nowOf(ctx),
      by: input.actorEmail,
      action: "founder_update",
      status: input.status ?? existing.status,
    },
  };
  if (input.status) patch.status = input.status;
  if (input.assignedOwnerEmail !== undefined) {
    patch.assignedOwnerEmail = input.assignedOwnerEmail;
  }
  if (input.linkedRelationshipId !== undefined) {
    patch.linkedRelationshipId = input.linkedRelationshipId;
  }
  if (input.linkedVenueId !== undefined) {
    patch.linkedVenueId = input.linkedVenueId;
  }
  if (input.markExistingPayingCustomer) {
    patch.isExistingPayingCustomer = true;
    patch.blockedReason = "existing_paying_customer_at_submission";
    patch.status = "closed_not_eligible";
  }

  const updated = await ctx.store.updateReferral(input.referralId, patch);
  if (input.note?.trim()) {
    await ctx.store.addActivity({
      referralId: input.referralId,
      actorEmail: input.actorEmail,
      kind: "note",
      body: input.note.trim(),
    });
  }
  if (input.status && input.status !== existing.status) {
    await ctx.store.addActivity({
      referralId: input.referralId,
      actorEmail: input.actorEmail,
      kind: "status_change",
      body: `${existing.status} → ${input.status}`,
    });
  }
  if (input.assignedOwnerEmail !== undefined) {
    await ctx.store.addActivity({
      referralId: input.referralId,
      actorEmail: input.actorEmail,
      kind: "assignment",
      body: `Assigned to ${input.assignedOwnerEmail || "unassigned"}`,
    });
  }
  return updated;
}

/**
 * Confirm attribution to a newly acquired venue.
 * Rejects if referred venue was already paying at referral submission time.
 */
export async function confirmReferralAttribution(
  ctx: ReferralServiceContext,
  input: {
    referralId: string;
    referredVenueId: string;
    actorEmail: string;
    matchMethod?: ReferralAttributionMatchMethod;
    matchEvidence?: Record<string, unknown>;
    firstPaidInvoiceId?: string | null;
    firstPaidInvoiceAt?: string | null;
    convertedAt?: string | null;
  },
) {
  const referral = await ctx.store.getReferral(input.referralId);
  if (!referral) throw new Error("referral_not_found");
  if (
    referral.isSelfReferral ||
    referral.isSameOrganization ||
    referral.status === "closed_not_eligible" ||
    referral.status === "closed_duplicate" ||
    referral.status === "closed_declined"
  ) {
    throw new Error("referral_not_eligible_for_attribution");
  }

  const referred = await ctx.loadVenue(input.referredVenueId);
  if (!referred) throw new Error("referred_venue_not_found");

  // Existing customer protection: if already paying before submission, block.
  const payingStatuses = new Set(["active", "trialing", "past_due"]);
  if (
    referred.stripeSubscriptionId &&
    referred.subscriptionStatus &&
    payingStatuses.has(referred.subscriptionStatus) &&
    // Heuristic for "already existed": founder may also pass evidence.
    (input.matchEvidence?.wasPayingAtSubmission === true ||
      referral.isExistingPayingCustomer)
  ) {
    await ctx.store.updateReferral(referral.id, {
      isExistingPayingCustomer: true,
      blockedReason: "existing_paying_customer",
      status: "closed_not_eligible",
      auditEntry: {
        at: nowOf(ctx),
        by: input.actorEmail,
        action: "blocked_existing_customer",
      },
    });
    throw new Error("existing_paying_customer");
  }

  const existingConfirmed = await ctx.store.getConfirmedAttributionForVenue(
    input.referredVenueId,
  );
  if (existingConfirmed && existingConfirmed.referralId !== referral.id) {
    await ctx.store.updateReferral(referral.id, {
      isDuplicateClaim: true,
      blockedReason: `duplicate_converted_venue:${existingConfirmed.referralId}`,
      status: "closed_duplicate",
      auditEntry: {
        at: nowOf(ctx),
        by: input.actorEmail,
        action: "blocked_duplicate_converted_venue",
      },
    });
    throw new Error("duplicate_converted_venue");
  }

  // Earliest valid referral for domain wins unless founder overrides.
  const domainPeers = await ctx.store.findByDomain(referral.referredWebsiteDomain);
  const earlierValid = domainPeers
    .filter(
      (r) =>
        r.id !== referral.id &&
        !r.isSelfReferral &&
        !r.isSameOrganization &&
        r.status !== "closed_not_eligible" &&
        r.status !== "closed_duplicate" &&
        r.status !== "closed_declined" &&
        r.createdAt < referral.createdAt,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (earlierValid && input.matchMethod !== "founder_confirmed") {
    throw new Error(`earlier_referral_exists:${earlierValid.id}`);
  }

  const idempotencyKey = `attr:v1:${referral.id}:${input.referredVenueId}`;
  const now = nowOf(ctx);
  const convertedAt = input.convertedAt ?? now;
  const firstPaidAt = input.firstPaidInvoiceAt ?? null;
  const qualificationStartsAt = firstPaidAt;
  const qualificationEndsAt = firstPaidAt
    ? addDaysIso(firstPaidAt, referral.qualificationDays)
    : null;

  const attribution = await ctx.store.createAttribution({
    referralId: referral.id,
    referredVenueId: input.referredVenueId,
    referredStripeSubscriptionId: referred.stripeSubscriptionId,
    referredStripeCustomerId: referred.stripeCustomerId,
    matchMethod: input.matchMethod ?? "founder_confirmed",
    matchEvidence: input.matchEvidence ?? {},
    confirmedByEmail: input.actorEmail,
    confirmedAt: now,
    status: "confirmed",
    idempotencyKey,
  });

  const updatedAttr = await ctx.store.updateAttribution(attribution.id, {
    convertedAt,
    firstPaidInvoiceId: input.firstPaidInvoiceId ?? null,
    firstPaidInvoiceAt: firstPaidAt,
    qualificationStartsAt,
    qualificationEndsAt,
    auditEntry: {
      at: now,
      by: input.actorEmail,
      action: "confirmed",
    },
  });

  await ctx.store.updateReferral(referral.id, {
    linkedVenueId: input.referredVenueId,
    status: firstPaidAt ? "qualification_pending" : "converted",
    auditEntry: {
      at: now,
      by: input.actorEmail,
      action: "attributed",
      referredVenueId: input.referredVenueId,
    },
  });

  await ctx.store.addActivity({
    referralId: referral.id,
    actorEmail: input.actorEmail,
    kind: "attribution",
    body: `Linked to venue ${input.referredVenueId} via ${input.matchMethod ?? "founder_confirmed"}`,
    metadata: { attributionId: updatedAttr.id },
  });

  // Create pending reward shell if paid invoice already known.
  if (firstPaidAt && referred.stripeSubscriptionId && referred.stripeCustomerId) {
    // Reward valuation happens at eligibility — shell uses placeholder until then.
    const referrer = await ctx.loadVenue(referral.referringVenueId);
    if (referrer?.stripeSubscriptionId && referrer.stripeCustomerId) {
      await ctx.store.createReward({
        referralId: referral.id,
        attributionId: updatedAttr.id,
        referringVenueId: referral.referringVenueId,
        referringStripeSubscriptionId: referrer.stripeSubscriptionId,
        referringStripeCustomerId: referrer.stripeCustomerId,
        referredVenueId: input.referredVenueId,
        qualifyingInvoiceId: input.firstPaidInvoiceId ?? null,
        rewardAmountCents: 1, // placeholder until valuation; updated at eligibility
        valuationAt: now,
        valuationSnapshot: { placeholder: true },
        status: "pending_qualification",
      });
    }
  }

  return updatedAttr;
}

export async function markAttributionPaid(
  ctx: ReferralServiceContext,
  input: {
    attributionId: string;
    firstPaidInvoiceId: string;
    firstPaidInvoiceAt: string;
    actorEmail?: string;
  },
) {
  const attr = await ctx.store.getAttribution(input.attributionId);
  if (!attr || attr.status !== "confirmed") {
    throw new Error("attribution_not_confirmed");
  }
  if (attr.firstPaidInvoiceId && attr.firstPaidInvoiceId !== input.firstPaidInvoiceId) {
    // Keep earliest paid invoice — ignore later duplicates.
    return attr;
  }
  const referral = await ctx.store.getReferral(attr.referralId);
  if (!referral) throw new Error("referral_not_found");

  const qualificationStartsAt = input.firstPaidInvoiceAt;
  const qualificationEndsAt = addDaysIso(
    input.firstPaidInvoiceAt,
    referral.qualificationDays,
  );

  const updated = await ctx.store.updateAttribution(attr.id, {
    convertedAt: attr.convertedAt ?? input.firstPaidInvoiceAt,
    firstPaidInvoiceId: input.firstPaidInvoiceId,
    firstPaidInvoiceAt: input.firstPaidInvoiceAt,
    qualificationStartsAt,
    qualificationEndsAt,
    auditEntry: {
      at: nowOf(ctx),
      by: input.actorEmail ?? "system",
      action: "first_paid_invoice",
      invoiceId: input.firstPaidInvoiceId,
    },
  });

  await ctx.store.updateReferral(referral.id, {
    status: "qualification_pending",
    auditEntry: {
      at: nowOf(ctx),
      by: input.actorEmail ?? "system",
      action: "qualification_pending",
    },
  });

  const referrer = await ctx.loadVenue(referral.referringVenueId);
  if (referrer?.stripeSubscriptionId && referrer.stripeCustomerId) {
    await ctx.store.createReward({
      referralId: referral.id,
      attributionId: attr.id,
      referringVenueId: referral.referringVenueId,
      referringStripeSubscriptionId: referrer.stripeSubscriptionId,
      referringStripeCustomerId: referrer.stripeCustomerId,
      referredVenueId: attr.referredVenueId,
      qualifyingInvoiceId: input.firstPaidInvoiceId,
      rewardAmountCents: 1,
      valuationAt: nowOf(ctx),
      valuationSnapshot: { placeholder: true },
      status: "pending_qualification",
    });
  }

  return updated;
}

/**
 * Evaluate qualification for a confirmed attribution whose window has elapsed.
 */
export async function evaluateReferralQualification(
  ctx: ReferralServiceContext,
  attributionId: string,
  opts?: { actorEmail?: string; forceNow?: boolean },
): Promise<ReferralRewardRecord | null> {
  const attr = await ctx.store.getAttribution(attributionId);
  if (!attr || attr.status !== "confirmed") return null;
  if (!attr.firstPaidInvoiceAt || !attr.qualificationEndsAt) return null;

  const now = nowOf(ctx);
  const force = opts?.forceNow || ctx.forceQualificationNow;
  if (!force && attr.qualificationEndsAt > now) {
    return ctx.store.getRewardForReferral(attr.referralId);
  }

  const referral = await ctx.store.getReferral(attr.referralId);
  if (!referral) return null;
  if (
    referral.isSelfReferral ||
    referral.isSameOrganization ||
    referral.isExistingPayingCustomer
  ) {
    await ctx.store.updateReferral(referral.id, {
      status: "closed_not_eligible",
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "disqualified",
      },
    });
    return null;
  }

  const referred = await ctx.loadVenue(attr.referredVenueId);
  if (!referred) return null;
  const eligibleStatuses = new Set(["active", "past_due", "trialing"]);
  if (
    !referred.stripeSubscriptionId ||
    !referred.subscriptionStatus ||
    !eligibleStatuses.has(referred.subscriptionStatus)
  ) {
    await ctx.store.updateReferral(referral.id, {
      status: "closed_not_eligible",
      blockedReason: "referred_not_active_through_window",
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "disqualified_inactive",
        status: referred.subscriptionStatus,
      },
    });
    const reward = await ctx.store.getRewardForReferral(referral.id);
    if (reward && reward.status === "pending_qualification") {
      await ctx.store.updateReward(reward.id, {
        status: "voided",
        rejectionReason: "referred_not_active_through_window",
        auditEntry: { at: now, action: "voided_inactive" },
      });
    }
    return null;
  }

  const referrer = await ctx.loadVenue(referral.referringVenueId);
  if (
    !referrer?.stripeSubscriptionId ||
    !referrer.stripeCustomerId
  ) {
    throw new Error("referrer_billing_missing");
  }

  const valuation = valueReferrerReward({
    planKey: referrer.planKey,
    grants: referrer.grants,
    groupEligible: referrer.groupEligible,
    arrangements: referrer.arrangements,
    valuedAt: now,
  });
  if (valuation.amountCents <= 0) {
    throw new Error("reward_amount_zero");
  }

  let reward = await ctx.store.getRewardForReferral(referral.id);
  if (!reward) {
    reward = await ctx.store.createReward({
      referralId: referral.id,
      attributionId: attr.id,
      referringVenueId: referral.referringVenueId,
      referringStripeSubscriptionId: referrer.stripeSubscriptionId,
      referringStripeCustomerId: referrer.stripeCustomerId,
      referredVenueId: attr.referredVenueId,
      qualifyingInvoiceId: attr.firstPaidInvoiceId,
      eligibilityAt: now,
      rewardAmountCents: valuation.amountCents,
      currency: valuation.currency,
      valuationAt: valuation.valuedAt,
      valuationPlanKey: valuation.planKey,
      valuationListAmountCents: valuation.listAmountCents,
      valuationSource: valuation.source,
      valuationSnapshot: valuation.snapshot,
      status: "eligible",
    });
  } else if (
    reward.status === "pending_qualification" ||
    reward.valuationSnapshot?.placeholder === true
  ) {
    reward = await ctx.store.updateReward(reward.id, {
      status: "eligible",
      eligibilityAt: now,
      qualifyingInvoiceId: attr.firstPaidInvoiceId,
      rewardAmountCents: valuation.amountCents,
      valuationAt: valuation.valuedAt,
      valuationPlanKey: valuation.planKey,
      valuationListAmountCents: valuation.listAmountCents,
      valuationSource: valuation.source,
      valuationSnapshot: valuation.snapshot,
      metadata: {
        ...reward.metadata,
        subscriptionAtEligibility: referrer.stripeSubscriptionId,
        customerAtEligibility: referrer.stripeCustomerId,
      },
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "valued_eligible",
        amountCents: valuation.amountCents,
      },
    });
  } else {
    reward = await ctx.store.updateReward(reward.id, {
      metadata: {
        ...reward.metadata,
        subscriptionAtEligibility: referrer.stripeSubscriptionId,
        customerAtEligibility: referrer.stripeCustomerId,
      },
    });
  }

  await ctx.store.updateReferral(referral.id, {
    status: "reward_eligible",
    auditEntry: {
      at: now,
      by: opts?.actorEmail ?? "system",
      action: "reward_eligible",
      amountCents: valuation.amountCents,
    },
  });

  await ctx.store.addActivity({
    referralId: referral.id,
    actorEmail: opts?.actorEmail ?? "system",
    kind: "qualification",
    body: `Reward eligible for ${valuation.amountCents} cents (${valuation.source})`,
  });

  return reward;
}

export async function approveReferralReward(
  ctx: ReferralServiceContext,
  input: {
    rewardId: string;
    actorEmail: string;
    notes?: string | null;
  },
) {
  const reward = await ctx.store.getReward(input.rewardId);
  if (!reward) throw new Error("reward_not_found");
  if (reward.status !== "eligible" && reward.status !== "failed") {
    throw new Error(`reward_not_approvable:${reward.status}`);
  }
  const now = nowOf(ctx);
  const updated = await ctx.store.updateReward(reward.id, {
    status: "approved",
    approvedByEmail: input.actorEmail,
    approvedAt: now,
    approvalNotes: input.notes ?? null,
    lastError: null,
    auditEntry: { at: now, by: input.actorEmail, action: "approved" },
  });
  await ctx.store.addActivity({
    referralId: reward.referralId,
    actorEmail: input.actorEmail,
    kind: "reward",
    body: "Reward approved for issuance",
  });
  return updated;
}

export async function rejectReferralReward(
  ctx: ReferralServiceContext,
  input: {
    rewardId: string;
    actorEmail: string;
    reason: string;
  },
) {
  const reward = await ctx.store.getReward(input.rewardId);
  if (!reward) throw new Error("reward_not_found");
  const now = nowOf(ctx);
  const updated = await ctx.store.updateReward(reward.id, {
    status: "voided",
    rejectedByEmail: input.actorEmail,
    rejectedAt: now,
    rejectionReason: input.reason,
    auditEntry: { at: now, by: input.actorEmail, action: "rejected", reason: input.reason },
  });
  await ctx.store.updateReferral(reward.referralId, {
    status: "closed_not_eligible",
    blockedReason: input.reason,
  });
  await ctx.store.addActivity({
    referralId: reward.referralId,
    actorEmail: input.actorEmail,
    kind: "reward",
    body: `Reward rejected: ${input.reason}`,
  });
  return updated;
}

/**
 * Issue Stripe subscription-scoped credit for an approved reward.
 */
export async function issueReferralRewardCredit(
  ctx: ReferralServiceContext,
  rewardId: string,
  opts?: { actorEmail?: string },
): Promise<ReferralRewardRecord> {
  if (!isReferralRewardIssueEnabled()) {
    throw new Error("referral_reward_issue_disabled");
  }
  if (!ctx.stripe) throw new Error("stripe_executor_missing");

  let reward = await ctx.store.getReward(rewardId);
  if (!reward) throw new Error("reward_not_found");
  if (reward.status === "issued" || reward.status === "applied") {
    return reward;
  }
  if (reward.status !== "approved" && reward.status !== "issuing" && reward.status !== "failed") {
    throw new Error(`reward_not_issuable:${reward.status}`);
  }
  if (reward.rewardAmountCents <= 1 && reward.valuationSnapshot?.placeholder) {
    throw new Error("reward_not_valued");
  }

  const now = nowOf(ctx);
  reward = await ctx.store.updateReward(reward.id, {
    status: "issuing",
    auditEntry: {
      at: now,
      by: opts?.actorEmail ?? "system",
      action: "issuing",
    },
  });

  try {
    const result = await issueReferralSubscriptionCredit(ctx.stripe, {
      rewardId: reward.id,
      referralId: reward.referralId,
      customerId: reward.referringStripeCustomerId,
      subscriptionId: reward.referringStripeSubscriptionId,
      amountCents: reward.rewardAmountCents,
      currency: reward.currency,
    });

    reward = await ctx.store.updateReward(reward.id, {
      status: "issued",
      stripeInvoiceItemId: result.invoiceItemId,
      stripeCreditIdempotencyKey: result.idempotencyKey,
      issuedAt: now,
      lastError: null,
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "issued",
        invoiceItemId: result.invoiceItemId,
      },
    });

    await ctx.store.updateReferral(reward.referralId, {
      status: "reward_issued",
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "reward_issued",
      },
    });

    await ctx.store.addActivity({
      referralId: reward.referralId,
      actorEmail: opts?.actorEmail ?? "system",
      kind: "reward",
      body: `Stripe credit issued (${result.invoiceItemId}) for ${reward.rewardAmountCents} cents`,
    });

    return reward;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return ctx.store.updateReward(reward.id, {
      status: "failed",
      lastError: message,
      retryCount: reward.retryCount + 1,
      auditEntry: {
        at: now,
        by: opts?.actorEmail ?? "system",
        action: "issue_failed",
        error: message,
      },
    });
  }
}

export async function reconcileIssuedReferralRewards(
  ctx: ReferralServiceContext,
  limit = 25,
) {
  if (!ctx.stripe) return { checked: 0, applied: 0 };
  const issued = await ctx.store.listRewardsByStatus(["issued"], limit);
  let applied = 0;
  for (const reward of issued) {
    if (!reward.stripeInvoiceItemId) continue;
    const hit = await findAppliedReferralCreditInvoice(ctx.stripe, {
      customerId: reward.referringStripeCustomerId,
      subscriptionId: reward.referringStripeSubscriptionId,
      invoiceItemId: reward.stripeInvoiceItemId,
    });
    if (!hit) continue;
    // Only mark applied when invoice is paid or finalized with the line present.
    const status = hit.invoice.status;
    if (status !== "paid" && status !== "open") continue;
    await ctx.store.updateReward(reward.id, {
      status: "applied",
      appliedInvoiceId: hit.invoiceId,
      appliedAt: nowOf(ctx),
      auditEntry: {
        at: nowOf(ctx),
        action: "applied",
        invoiceId: hit.invoiceId,
        invoiceStatus: status,
      },
    });
    applied += 1;
  }
  return { checked: issued.length, applied };
}

/**
 * Scheduler tick — qualification, optional auto-issue after approval, reconcile.
 * Never throws into Phase 3/4 paths; callers isolate failures.
 */
export async function processReferralLifecycle(
  ctx: ReferralServiceContext,
  opts?: {
    limit?: number;
    autoIssueApproved?: boolean;
    actorEmail?: string;
  },
) {
  const readiness = getReferralProgramReadiness();
  if (!isReferralProgramReady(readiness)) {
    return {
      ok: false as const,
      skipped: true,
      reason: readiness.diagnosticMessage,
      qualified: 0,
      issued: 0,
      applied: 0,
      errors: [] as string[],
    };
  }

  const limit = opts?.limit ?? 25;
  const now = nowOf(ctx);
  const due = await ctx.store.listAttributionsDueForQualification(now, limit);
  const errors: string[] = [];
  let qualified = 0;
  let issued = 0;

  for (const attr of due) {
    try {
      const existingReward = await ctx.store.getRewardForReferral(attr.referralId);
      if (
        existingReward &&
        ["eligible", "approved", "issuing", "issued", "applied"].includes(
          existingReward.status,
        )
      ) {
        continue;
      }
      const reward = await evaluateReferralQualification(ctx, attr.id, {
        actorEmail: opts?.actorEmail ?? "scheduler",
      });
      if (reward?.status === "eligible") qualified += 1;
    } catch (err) {
      errors.push(
        `qualify:${attr.id}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (opts?.autoIssueApproved && isReferralRewardIssueEnabled()) {
    const approved = await ctx.store.listRewardsByStatus(
      ["approved", "failed"],
      limit,
    );
    for (const reward of approved) {
      try {
        const result = await issueReferralRewardCredit(ctx, reward.id, {
          actorEmail: opts?.actorEmail ?? "scheduler",
        });
        if (result.status === "issued") issued += 1;
      } catch (err) {
        errors.push(
          `issue:${reward.id}:${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  let applied = 0;
  try {
    const recon = await reconcileIssuedReferralRewards(ctx, limit);
    applied = recon.applied;
  } catch (err) {
    errors.push(
      `reconcile:${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    qualified,
    issued,
    applied,
    errors,
  };
}
