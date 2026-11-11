/**
 * Shared Phase 3 evaluate / notice / apply cycle helpers for population cron.
 */

import type { EligibleGrant } from "./best-offer";
import {
  applyTierUpgradeSchedule,
  type ApplyTierUpgradeResult,
} from "./tier-upgrade-apply";
import {
  evaluateAndPersistTierUpgrade,
  type TierUpgradeOrchestrationResult,
} from "./tier-upgrade-orchestrator";
import { resolveTierUpgradeNoticeRecipient } from "./tier-upgrade-notice-recipients";
import {
  mayApplyTierUpgradeStripe,
  maySendTierUpgradeNotice,
} from "./tier-upgrade-rehearsal-guard";
import { sendTierUpgradeNotice } from "./tier-upgrade-notice-send";
import {
  billingSnapshotFromStripeSubscription,
  type StripeSubscriptionLike,
} from "./tier-upgrade-stripe-snapshot";
import { assertVenueSubscriptionIsolation } from "./tier-upgrade-venue-guard";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import type { EventVolumeInputEvent } from "./event-volume";
import {
  mapEventRowsToVolumeInputs,
  type EventVolumeRow,
} from "./event-volume-repository";
import type { TierUpgradeRecord } from "./tier-upgrade-types";

export type VenueTierUpgradeSource = {
  id: string;
  name: string | null;
  saas_stripe_subscription_id: string | null;
  saas_stripe_customer_id: string | null;
};

export type StripeLikeClient = {
  subscriptions: {
    retrieve: (
      id: string,
      opts?: { expand?: string[] },
    ) => Promise<StripeSubscriptionLike>;
  };
  customers: {
    retrieve: (id: string) => Promise<{
      id: string;
      deleted?: boolean;
      email?: string | null;
      metadata?: Record<string, string> | null;
    }>;
  };
};

export type EvaluateVenueDeps = {
  store: TierUpgradeStore;
  stripe: StripeLikeClient;
  listEvents: (venueId: string) => Promise<EventVolumeRow[]>;
  listGrants: (venueId: string) => Promise<EligibleGrant[]>;
};

export type EvaluateVenueOutcome = {
  venueId: string;
  skipped?: boolean;
  reason?: string;
  decision?: string;
  upgradeId?: string | null;
  status?: string | null;
  requiredPlan?: string | null;
  currentPlan?: string | null;
  peakCount?: number;
  orchestration?: TierUpgradeOrchestrationResult;
};

export async function evaluateVenueTierUpgrade(
  venue: VenueTierUpgradeSource,
  deps: EvaluateVenueDeps,
): Promise<EvaluateVenueOutcome> {
  const subscriptionId = venue.saas_stripe_subscription_id;
  if (!subscriptionId) {
    return {
      venueId: venue.id,
      skipped: true,
      reason: "missing_subscription",
    };
  }

  try {
    const sub = (await deps.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["discounts.source.coupon", "items.data.price"],
    })) as StripeSubscriptionLike;
    const snapshot = billingSnapshotFromStripeSubscription(sub);
    if (!snapshot) {
      return {
        venueId: venue.id,
        skipped: true,
        reason: "Stripe subscription missing current_period_end — fail closed",
      };
    }

    const isolation = assertVenueSubscriptionIsolation({
      venueId: venue.id,
      venueStripeSubscriptionId: subscriptionId,
      venueStripeCustomerId: venue.saas_stripe_customer_id,
      snapshot,
    });
    if (!isolation.ok) {
      return { venueId: venue.id, skipped: true, reason: isolation.reason };
    }

    if (!snapshot.planKey) {
      return {
        venueId: venue.id,
        skipped: true,
        reason:
          "Subscription price is not a known Launch V1 Price — refuse automatic evaluation",
      };
    }

    const rows = await deps.listEvents(venue.id);
    const events = mapEventRowsToVolumeInputs(rows);
    const grants = await deps.listGrants(venue.id);

    const result = await evaluateAndPersistTierUpgrade({
      venueId: venue.id,
      events,
      subscription: snapshot,
      grants,
      store: deps.store,
    });

    return {
      venueId: venue.id,
      decision: result.decisionAction,
      reason: result.reason,
      upgradeId: result.upgrade?.id ?? null,
      status: result.upgrade?.status ?? null,
      requiredPlan: result.upgrade?.requiredPlanKey ?? null,
      currentPlan: result.upgrade?.currentPlanKey ?? null,
      peakCount: result.volumePeakCount,
      orchestration: result,
    };
  } catch (err) {
    return {
      venueId: venue.id,
      skipped: true,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export type NoticeVenueOutcome = {
  venueId: string;
  upgradeId: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  deliveryStatus?: string;
  providerMessageId?: string | null;
  to?: string;
  redirected?: boolean;
  originalEmail?: string | null;
};

export async function sendNoticeForUpgrade(input: {
  store: TierUpgradeStore;
  stripe: StripeLikeClient;
  venue: VenueTierUpgradeSource;
  upgrade: TierUpgradeRecord;
  forceInternalRedirect: boolean;
}): Promise<NoticeVenueOutcome> {
  if (!maySendTierUpgradeNotice({ isRehearsalFixture: false })) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      skipped: true,
      reason: "send_notice_gate_off",
    };
  }

  const customerId =
    input.venue.saas_stripe_customer_id || input.upgrade.stripeCustomerId;
  if (!customerId) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      skipped: true,
      reason: "missing_customer",
    };
  }

  const customer = await input.stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      skipped: true,
      reason: "customer_deleted",
    };
  }

  const recipient = resolveTierUpgradeNoticeRecipient({
    billingEmail: customer.email,
    forceInternalRedirect: input.forceInternalRedirect,
  });
  if (!recipient.ok) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      reason: recipient.reason,
    };
  }

  const sent = await sendTierUpgradeNotice({
    store: input.store,
    upgrade: input.upgrade,
    venueName: input.venue.name || "Your venue",
    toEmail: recipient.email,
    contactEmail: "jennifer@hellotocheers.com",
  });

  if (!sent.ok) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      reason: sent.message,
      deliveryStatus: sent.deliveryStatus,
      redirected: recipient.redirected,
      originalEmail: recipient.originalEmail,
    };
  }

  return {
    venueId: input.venue.id,
    upgradeId: sent.upgrade.id,
    ok: true,
    deliveryStatus: sent.deliveryStatus,
    providerMessageId: sent.providerMessageId,
    to: sent.to,
    redirected: recipient.redirected,
    originalEmail: recipient.originalEmail,
  };
}

export type ApplyVenueOutcome = {
  venueId: string;
  upgradeId: string;
  ok: boolean;
  skipped?: boolean;
  defer?: boolean;
  reason?: string;
  scheduleId?: string;
  status?: string;
};

export async function applyScheduleForUpgrade(input: {
  store: TierUpgradeStore;
  stripe: StripeLikeClient &
    Parameters<typeof applyTierUpgradeSchedule>[0]["stripe"];
  venue: VenueTierUpgradeSource;
  upgrade: TierUpgradeRecord;
  listEvents: (venueId: string) => Promise<EventVolumeRow[]>;
}): Promise<ApplyVenueOutcome> {
  if (!mayApplyTierUpgradeStripe({ isRehearsalFixture: false })) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      skipped: true,
      reason: "apply_stripe_gate_off",
    };
  }

  const subscriptionId =
    input.venue.saas_stripe_subscription_id ||
    input.upgrade.stripeSubscriptionId;
  if (!subscriptionId) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      skipped: true,
      reason: "missing_subscription",
    };
  }

  const subRaw = await input.stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["discounts.source.coupon", "items.data.price"],
  });
  const snapshot = billingSnapshotFromStripeSubscription(
    subRaw as StripeSubscriptionLike,
  );
  if (!snapshot) {
    return {
      venueId: input.venue.id,
      upgradeId: input.upgrade.id,
      ok: false,
      reason: "Stripe subscription missing current_period_end",
    };
  }

  const rows = await input.listEvents(input.venue.id);
  const events = mapEventRowsToVolumeInputs(rows) as EventVolumeInputEvent[];
  const hold = await input.store.getActiveHoldForVenue(input.venue.id);

  const applied: ApplyTierUpgradeResult = await applyTierUpgradeSchedule({
    store: input.store,
    stripe: input.stripe,
    upgrade: input.upgrade,
    subscription: snapshot,
    events,
    activeHold: Boolean(hold),
    applyAuthorized: true,
  });

  if (!applied.ok) {
    return {
      venueId: input.venue.id,
      upgradeId: applied.upgrade?.id ?? input.upgrade.id,
      ok: false,
      defer: applied.defer,
      reason: applied.message,
      status: applied.upgrade?.status ?? input.upgrade.status,
    };
  }

  return {
    venueId: input.venue.id,
    upgradeId: applied.upgrade.id,
    ok: true,
    scheduleId: applied.scheduleId,
    status: applied.upgrade.status,
    reason: applied.reason,
  };
}
