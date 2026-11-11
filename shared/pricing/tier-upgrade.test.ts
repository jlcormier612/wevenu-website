import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { EligibleGrant } from "./best-offer";
import { foundingAmountCents, wevenAmountCents } from "./catalog";
import type { EventVolumeInputEvent } from "./event-volume";
import {
  evaluateTierUpgradeApplyGate,
  resolveNoticeDeliveryStatus,
} from "./tier-upgrade-apply-gate";
import { decideTierUpgrade } from "./tier-upgrade-evaluate";
import { evaluateAndPersistTierUpgrade } from "./tier-upgrade-orchestrator";
import {
  buildTierUpgradeNoticeDraft,
  renderTierUpgradeNoticeBody,
} from "./tier-upgrade-notice";
import { previewUpgradeAmounts } from "./tier-upgrade-pricing";
import {
  assessExistingSubscriptionSchedule,
  buildStripeScheduleReleaseIntent,
  buildStripeScheduleUpgradeIntent,
  classifyUpgradeWebhookEvidence,
  confirmUpgradeAppliedFromStripe,
} from "./tier-upgrade-stripe-plan";
import {
  chooseEligibleRenewal,
  noticeWindowSatisfied,
} from "./tier-upgrade-timing";
import {
  createMemoryTierUpgradeStore,
  resetTierUpgradeStoreForTests,
  setTierUpgradeStoreForTests,
} from "./tier-upgrade-store";
import type {
  StripeSubscriptionBillingSnapshot,
  TierUpgradeRecord,
} from "./tier-upgrade-types";

const DAY = 24 * 60 * 60;

function events(count: number, year: number): EventVolumeInputEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${year}-${i}`,
    status: "confirmed" as const,
    eventDate: `${year}-06-15`,
    bookedAt: "2025-01-01T00:00:00Z",
  }));
}

function sub(
  overrides: Partial<StripeSubscriptionBillingSnapshot> = {},
): StripeSubscriptionBillingSnapshot {
  const periodEnd = overrides.currentPeriodEndUnix ?? 1_800_000_000;
  return {
    subscriptionId: "sub_test_1",
    customerId: "cus_test_1",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEndUnix: periodEnd,
    currentPeriodStartUnix:
      overrides.currentPeriodStartUnix !== undefined
        ? overrides.currentPeriodStartUnix
        : periodEnd != null
          ? periodEnd - 30 * DAY
          : null,
    priceId: "price_gather_199_test",
    planKey: "starter",
    couponId: null,
    scheduleId: null,
    ...overrides,
  };
}

const foundingGrant: EligibleGrant = {
  id: "g-founding",
  offerType: "founding_pct",
  percentOff: 10,
  status: "earned",
};

const wevenGrant: EligibleGrant = {
  id: "g-weven",
  offerType: "weven_pct",
  percentOff: 20,
  status: "earned",
};

function baseUpgrade(
  overrides: Partial<TierUpgradeRecord> = {},
): TierUpgradeRecord {
  return {
    id: "up-1",
    venueId: "v1",
    stripeSubscriptionId: "sub_1",
    stripeCustomerId: "cus_1",
    currentPlanKey: "starter",
    requiredPlanKey: "growing",
    peakCount: 26,
    peakYear: 2026,
    evaluationAsOf: "2026-06-01",
    evaluatedAt: new Date().toISOString(),
    status: "notice_sent",
    noticeWindowDays: 7,
    noticeDueAt: null,
    noticeSentAt: "2026-06-01T12:00:00.000Z",
    noticeIdempotencyKey: "n1",
    noticeDeliveryStatus: "provider_accepted",
    noticeProviderMessageId: "re_123",
    currentPeriodEndAt: "2026-07-01T00:00:00.000Z",
    currentPeriodStartAt: "2026-06-01T00:00:00.000Z",
    scheduledEffectiveAt: "2026-07-01T00:00:00.000Z",
    skippedImminentRenewal: false,
    currentListAmountCents: 19900,
    requiredListAmountCents: 24900,
    appliedOfferType: "weven_pct",
    appliedPercentOff: 20,
    expectedRecurringAmountCents: 19920,
    currentStripePriceId: "price_a",
    requiredStripePriceId: "price_b",
    stripeCouponId: "6d2PFuDb",
    stripeScheduleId: "sub_sched_1",
    stripeSchedulePhaseStartAt: null,
    evaluationIdempotencyKey: "e1",
    scheduleIdempotencyKey: null,
    errorHistory: [],
    audit: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("tier-upgrade timing", () => {
  it("uses imminent renewal when full notice window fits", () => {
    const now = 1_700_000_000;
    const periodEnd = now + 14 * DAY;
    const d = chooseEligibleRenewal({
      nowUnix: now,
      currentPeriodEndUnix: periodEnd,
      currentPeriodStartUnix: periodEnd - 30 * DAY,
      noticeWindowDays: 7,
    });
    assert.equal(d.ok, true);
    if (d.ok) {
      assert.equal(d.skippedImminentRenewal, false);
      assert.equal(d.effectiveUnix, periodEnd);
    }
  });

  it("skips imminent renewal using authoritative period length", () => {
    const now = 1_700_000_000;
    const periodEnd = now + 3 * DAY;
    const periodStart = periodEnd - 31 * DAY;
    const d = chooseEligibleRenewal({
      nowUnix: now,
      currentPeriodEndUnix: periodEnd,
      currentPeriodStartUnix: periodStart,
      noticeWindowDays: 7,
    });
    assert.equal(d.ok, true);
    if (d.ok) {
      assert.equal(d.skippedImminentRenewal, true);
      assert.equal(d.effectiveUnix, periodEnd + 31 * DAY);
      assert.equal(d.billingIntervalSeconds, 31 * DAY);
    }
  });

  it("fails closed when subsequent renewal would require a 30-day guess", () => {
    const now = 1_700_000_000;
    const d = chooseEligibleRenewal({
      nowUnix: now,
      currentPeriodEndUnix: now + 3 * DAY,
      currentPeriodStartUnix: null,
      noticeWindowDays: 7,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_period_interval");
  });

  it("fails closed when period end is missing", () => {
    const d = chooseEligibleRenewal({
      nowUnix: 1_700_000_000,
      currentPeriodEndUnix: null,
      currentPeriodStartUnix: 1_700_000_000 - 30 * DAY,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "missing_period_end");
  });

  it("requires 7 full calendar days after notice", () => {
    assert.equal(
      noticeWindowSatisfied({
        noticeSentAtIso: "2026-06-01T23:00:00.000Z",
        effectiveAtIso: "2026-06-08T00:00:00.000Z",
        noticeWindowDays: 7,
      }),
      true,
    );
    assert.equal(
      noticeWindowSatisfied({
        noticeSentAtIso: "2026-06-01T00:00:00.000Z",
        effectiveAtIso: "2026-06-07T00:00:00.000Z",
        noticeWindowDays: 7,
      }),
      false,
    );
  });
});

describe("notice-before-upgrade apply gate", () => {
  it("allows apply only when provider-accepted notice and window are satisfied", () => {
    const ok = evaluateTierUpgradeApplyGate({
      upgrade: baseUpgrade(),
      noticeDeliveryStatus: "provider_accepted",
      volumeRecommendedPlan: "growing",
      activeHold: false,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      applyStripeEnabled: true,
    });
    assert.equal(ok.allowed, true);
  });

  it("rejects simulated notices for billing apply", () => {
    const blocked = evaluateTierUpgradeApplyGate({
      upgrade: baseUpgrade({ noticeDeliveryStatus: "simulated" }),
      noticeDeliveryStatus: "simulated",
      volumeRecommendedPlan: "growing",
      activeHold: false,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      applyStripeEnabled: true,
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.code, "notice_not_provider_accepted");
  });

  it("defers when notice window is unsatisfied", () => {
    const blocked = evaluateTierUpgradeApplyGate({
      upgrade: baseUpgrade({
        noticeSentAt: "2026-06-28T00:00:00.000Z",
        scheduledEffectiveAt: "2026-07-01T00:00:00.000Z",
      }),
      noticeDeliveryStatus: "provider_accepted",
      volumeRecommendedPlan: "growing",
      activeHold: false,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      applyStripeEnabled: true,
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) assert.equal(blocked.code, "notice_window_unsatisfied");
  });

  it("cancels path when volume no longer requires upgrade", () => {
    const blocked = evaluateTierUpgradeApplyGate({
      upgrade: baseUpgrade(),
      noticeDeliveryStatus: "provider_accepted",
      volumeRecommendedPlan: "starter",
      activeHold: false,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      applyStripeEnabled: true,
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.code, "volume_no_longer_requires");
      assert.equal(blocked.defer, false);
    }
  });

  it("resolves provider acceptance only with message id", () => {
    assert.equal(
      resolveNoticeDeliveryStatus({
        providerOk: true,
        providerMessageId: "re_abc",
      }),
      "provider_accepted",
    );
    assert.equal(
      resolveNoticeDeliveryStatus({ providerOk: true, providerMessageId: null }),
      "failed",
    );
    assert.equal(
      resolveNoticeDeliveryStatus({ providerOk: true, simulated: true }),
      "simulated",
    );
  });
});

describe("tier-upgrade pricing preservation", () => {
  it("preserves Weven 20% on Celebrate and Flourish", () => {
    const celebrate = previewUpgradeAmounts({
      currentPlan: "starter",
      requiredPlan: "growing",
      grants: [foundingGrant, wevenGrant],
    });
    assert.equal(celebrate.appliedOfferType, "weven_pct");
    assert.equal(celebrate.expectedRecurringAmountCents, wevenAmountCents("growing"));
    assert.equal(celebrate.expectedRecurringAmountCents, 19920);

    const flourish = previewUpgradeAmounts({
      currentPlan: "growing",
      requiredPlan: "professional",
      grants: [foundingGrant, wevenGrant],
    });
    assert.equal(flourish.expectedRecurringAmountCents, wevenAmountCents("professional"));
    assert.equal(flourish.expectedRecurringAmountCents, 27920);
  });

  it("preserves Founding 10% when Weven is absent", () => {
    const amounts = previewUpgradeAmounts({
      currentPlan: "starter",
      requiredPlan: "growing",
      grants: [foundingGrant],
    });
    assert.equal(amounts.appliedOfferType, "founding_pct");
    assert.equal(amounts.expectedRecurringAmountCents, foundingAmountCents("growing"));
    assert.equal(amounts.expectedRecurringAmountCents, 22410);
  });
});

describe("decideTierUpgrade", () => {
  const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;

  it("schedules Gather → Celebrate at 26 bookings", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(26, 2026),
      subscription: sub({
        currentPeriodEndUnix: nowUnix + 20 * DAY,
        priceId: "price_gather_199_test",
        planKey: "starter",
      }),
      grants: [foundingGrant],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "upsert_pending");
    if (decision.action === "upsert_pending") {
      assert.equal(decision.requiredPlan, "growing");
      assert.equal(decision.draft.expectedRecurringAmountCents, 22410);
      assert.equal(decision.draft.skippedImminentRenewal, false);
    }
  });

  it("schedules Gather → Flourish directly at 76 bookings", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(76, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "upsert_pending");
    if (decision.action === "upsert_pending") {
      assert.equal(decision.requiredPlan, "professional");
      assert.equal(decision.draft.requiredListAmountCents, 34900);
    }
  });

  it("never auto-downgrades", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(10, 2026),
      subscription: sub({
        planKey: "growing",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "none");
  });

  it("cancels pending when bookings fall before effective date", () => {
    const pendingDecision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(pendingDecision.action, "upsert_pending");
    if (pendingDecision.action !== "upsert_pending") return;

    const fakePending = {
      id: "up-1",
      ...pendingDecision.draft,
      errorHistory: [],
      audit: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const afterCancel = decideTierUpgrade({
      venueId: "venue-a",
      events: events(10, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: false,
      existingPending: fakePending,
      nowUnix,
    });
    assert.equal(afterCancel.action, "cancel_pending");
    if (afterCancel.action === "cancel_pending") {
      assert.equal(afterCancel.releaseScheduleId, fakePending.stripeScheduleId);
    }
  });

  it("blocks founder holds and requests cancel of prior schedule", () => {
    const prior = baseUpgrade({
      id: "up-prior",
      status: "scheduled",
      stripeScheduleId: "sub_sched_prior",
    });
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: true,
      existingPending: prior,
      nowUnix,
    });
    assert.equal(decision.action, "block_hold");
    if (decision.action === "block_hold") {
      assert.equal(decision.cancelPendingId, "up-prior");
      assert.equal(decision.releaseScheduleId, "sub_sched_prior");
    }
  });

  it("blocks legacy unmapped prices", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: null,
        priceId: "price_legacy_149",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "block_legacy");
  });

  it("skips imminent renewal inside notice window with period anchors", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 2 * DAY,
        currentPeriodStartUnix: nowUnix - 28 * DAY,
      }),
      grants: [wevenGrant],
      activeHold: false,
      existingPending: null,
      nowUnix,
      noticeWindowDays: 7,
    });
    assert.equal(decision.action, "upsert_pending");
    if (decision.action === "upsert_pending") {
      assert.equal(decision.draft.skippedImminentRenewal, true);
      assert.equal(decision.draft.expectedRecurringAmountCents, 19920);
    }
  });

  it("blocks review when short renewal lacks period start", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 2 * DAY,
        currentPeriodStartUnix: null,
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "block_review");
  });

  it("blocks foreign existing Stripe schedules", () => {
    const decision = decideTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
        scheduleId: "sub_sched_foreign",
      }),
      grants: [],
      activeHold: false,
      existingPending: null,
      nowUnix,
    });
    assert.equal(decision.action, "block_review");
  });
});

describe("tier-upgrade store + orchestrator", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199_test";
    process.env.STRIPE_PRICE_GROWING = "price_celebrate_test";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_flourish_test";
    const store = createMemoryTierUpgradeStore();
    setTierUpgradeStoreForTests(store);
  });
  afterEach(() => {
    resetTierUpgradeStoreForTests();
    delete process.env.STRIPE_PRICE_GATHER_199;
    delete process.env.STRIPE_PRICE_GROWING;
    delete process.env.STRIPE_PRICE_PROFESSIONAL;
  });

  it("is idempotent for duplicate evaluations", async () => {
    const store = createMemoryTierUpgradeStore();
    setTierUpgradeStoreForTests(store);
    const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;
    const input = {
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter" as const,
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [foundingGrant],
      store,
      nowUnix,
    };
    const first = await evaluateAndPersistTierUpgrade(input);
    const second = await evaluateAndPersistTierUpgrade(input);
    assert.equal(first.upgrade?.id, second.upgrade?.id);
    assert.equal(first.decisionAction, "upsert_pending");
    const active = await store.getActiveUpgradeForSubscription("sub_test_1");
    assert.ok(active);
    assert.equal(active.requiredPlanKey, "growing");
  });

  it("supersedes Gather→Celebrate with Gather→Flourish before renewal", async () => {
    const store = createMemoryTierUpgradeStore();
    const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;
    const base = {
      venueId: "venue-a",
      subscription: sub({
        planKey: "starter" as const,
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [] as EligibleGrant[],
      store,
      nowUnix,
    };
    const first = await evaluateAndPersistTierUpgrade({
      ...base,
      events: events(30, 2026),
    });
    assert.equal(first.upgrade?.requiredPlanKey, "growing");
    // Simulate HTC having already created a schedule for the first upgrade.
    await store.updateUpgradeStatus({
      id: first.upgrade!.id,
      status: "scheduled",
      patch: { stripeScheduleId: "sub_sched_celebrate" },
    });
    const second = await evaluateAndPersistTierUpgrade({
      ...base,
      events: events(80, 2026),
    });
    assert.equal(second.upgrade?.requiredPlanKey, "professional");
    assert.ok(second.scheduleReleaseIntent);
    assert.equal(second.scheduleReleaseIntent?.scheduleId, "sub_sched_celebrate");
    const list = await store.listUpgradesForVenue("venue-a");
    assert.ok(list.some((u) => u.status === "superseded"));
    assert.ok(
      list.some(
        (u) => u.status === "pending_notice" && u.requiredPlanKey === "professional",
      ),
    );
  });

  it("honors holds and releases prior schedules", async () => {
    const store = createMemoryTierUpgradeStore();
    const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;
    const scheduled = await evaluateAndPersistTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      store,
      nowUnix,
    });
    await store.updateUpgradeStatus({
      id: scheduled.upgrade!.id,
      status: "scheduled",
      patch: { stripeScheduleId: "sub_sched_hold_test" },
    });
    const hold = await store.placeHold({
      venueId: "venue-a",
      reason: "Commercial agreement",
      placedBy: "founder@hellotocheers.com",
    });
    assert.equal(hold.active, true);
    const result = await evaluateAndPersistTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      store,
      nowUnix,
    });
    assert.equal(result.decisionAction, "block_hold");
    assert.equal(result.scheduleIntent, null);
    assert.ok(result.scheduleReleaseIntent);
    assert.equal(result.scheduleReleaseIntent?.scheduleId, "sub_sched_hold_test");
    const released = await store.releaseHold({
      holdId: hold.id,
      releasedBy: "founder@hellotocheers.com",
      releaseReason: "Agreement ended",
    });
    assert.equal(released.active, false);
    assert.equal(released.audit.at(-1)?.action, "hold_released");
  });

  it("keeps schedule reference until Stripe release confirms on volume drop", async () => {
    const store = createMemoryTierUpgradeStore();
    const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;
    const first = await evaluateAndPersistTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      store,
      nowUnix,
    });
    await store.updateUpgradeStatus({
      id: first.upgrade!.id,
      status: "scheduled",
      patch: { stripeScheduleId: "sub_sched_drop" },
    });
    const cancelled = await evaluateAndPersistTierUpgrade({
      venueId: "venue-a",
      events: events(5, 2026),
      subscription: sub({
        planKey: "starter",
        priceId: "price_gather_199_test",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [],
      store,
      nowUnix,
    });
    assert.equal(cancelled.decisionAction, "cancel_pending");
    // Must not claim cancelled while Stripe schedule still referenced.
    assert.equal(cancelled.upgrade?.status, "failed");
    assert.equal(cancelled.upgrade?.stripeScheduleId, "sub_sched_drop");
    assert.equal(cancelled.scheduleReleaseIntent?.scheduleId, "sub_sched_drop");
  });

  it("builds schedule intent with no proration and preserved coupon", async () => {
    const store = createMemoryTierUpgradeStore();
    const nowUnix = Date.parse("2026-06-01T00:00:00Z") / 1000;
    const result = await evaluateAndPersistTierUpgrade({
      venueId: "venue-a",
      events: events(30, 2026),
      subscription: sub({
        planKey: "starter",
        priceId: "price_gather_199_test",
        couponId: "weven20",
        currentPeriodEndUnix: nowUnix + 20 * DAY,
      }),
      grants: [wevenGrant],
      store,
      nowUnix,
    });
    assert.ok(result.scheduleIntent);
    assert.equal(result.scheduleIntent?.prorationBehavior, "none");
    assert.equal(result.scheduleIntent?.preserveCouponId, "weven20");
    assert.equal(result.scheduleIntent?.nextPriceId, "price_celebrate_test");
  });
});

describe("schedule release confirmation helpers", () => {
  it("requires HTC metadata to own a schedule", async () => {
    const { htcOwnsSchedule, cancellationPersistenceDecision } = await import(
      "./tier-upgrade-stripe-execute"
    );
    assert.equal(
      htcOwnsSchedule({
        schedule: { id: "sub_sched_1", metadata: { htc_tier_upgrade: "true" } },
        expectedScheduleId: "sub_sched_1",
      }).owned,
      true,
    );
    assert.equal(
      htcOwnsSchedule({
        schedule: { id: "sub_sched_1", metadata: {} },
        expectedScheduleId: "sub_sched_1",
      }).owned,
      false,
    );
    const pending = cancellationPersistenceDecision({
      hadScheduleId: "sub_sched_1",
      releaseResult: null,
    });
    assert.equal(pending.status, "failed");
    assert.equal(pending.clearScheduleId, false);
    const ok = cancellationPersistenceDecision({
      hadScheduleId: "sub_sched_1",
      releaseResult: {
        ok: true,
        confirmed: true,
        previousScheduleId: "sub_sched_1",
        reason: "clean",
      },
    });
    assert.equal(ok.status, "cancelled");
    assert.equal(ok.clearScheduleId, true);
  });

  it("isolates venue subscription mapping", async () => {
    const { assertVenueSubscriptionIsolation } = await import(
      "./tier-upgrade-venue-guard"
    );
    const ok = assertVenueSubscriptionIsolation({
      venueId: "v1",
      venueStripeSubscriptionId: "sub_1",
      venueStripeCustomerId: "cus_1",
      snapshot: sub({ subscriptionId: "sub_1", customerId: "cus_1" }),
    });
    assert.equal(ok.ok, true);
    const bad = assertVenueSubscriptionIsolation({
      venueId: "v1",
      venueStripeSubscriptionId: "sub_1",
      venueStripeCustomerId: "cus_1",
      snapshot: sub({ subscriptionId: "sub_other", customerId: "cus_1" }),
    });
    assert.equal(bad.ok, false);
  });
});

describe("stripe subscription snapshot mapping", () => {
  it("maps period anchors, price, coupon, and schedule without guessing", async () => {
    const { billingSnapshotFromStripeSubscription } = await import(
      "./tier-upgrade-stripe-snapshot"
    );
    process.env.STRIPE_PRICE_GATHER_199 = "price_gather_199_test";
    const snap = billingSnapshotFromStripeSubscription({
      id: "sub_live",
      customer: "cus_live",
      status: "active",
      cancel_at_period_end: false,
      billing_cycle_anchor: 1_700_000_000,
      schedule: null,
      // Newer Stripe API: period anchors live on items, not subscription root.
      items: {
        data: [
          {
            price: { id: "price_gather_199_test" },
            current_period_start: 1_700_000_000,
            current_period_end: 1_700_000_000 + 30 * DAY,
          },
        ],
      },
      discounts: [{ source: { coupon: "6d2PFuDb" } }],
    });
    assert.ok(snap);
    assert.equal(snap!.currentPeriodStartUnix, 1_700_000_000);
    assert.equal(snap!.currentPeriodEndUnix, 1_700_000_000 + 30 * DAY);
    assert.equal(snap!.planKey, "starter");
    assert.equal(snap!.couponId, "6d2PFuDb");
    assert.equal(
      billingSnapshotFromStripeSubscription({
        id: "sub_bad",
        current_period_end: null,
        items: { data: [{ price: { id: "price_x" } }] },
      }),
      null,
    );
    delete process.env.STRIPE_PRICE_GATHER_199;
  });
});

describe("stripe schedule confirmation + notice + webhook", () => {
  it("confirms only when price and amount match on same subscription", () => {
    const ok = confirmUpgradeAppliedFromStripe({
      subscriptionPriceId: "price_celebrate_test",
      expectedPriceId: "price_celebrate_test",
      invoiceAmountPaidCents: 19920,
      expectedRecurringAmountCents: 19920,
      subscriptionId: "sub_1",
      expectedSubscriptionId: "sub_1",
    });
    assert.equal(ok.confirmed, true);
    const bad = confirmUpgradeAppliedFromStripe({
      subscriptionPriceId: "price_celebrate_test",
      expectedPriceId: "price_celebrate_test",
      invoiceAmountPaidCents: 24900,
      expectedRecurringAmountCents: 19920,
    });
    assert.equal(bad.confirmed, false);
  });

  it("classifies duplicate webhooks as ignore", () => {
    const dup = classifyUpgradeWebhookEvidence({
      upgradeStatus: "scheduled",
      stripeEventId: "evt_1",
      alreadyProcessedEventIds: ["evt_1"],
      confirmation: { confirmed: true, reason: "ok" },
    });
    assert.equal(dup.action, "ignore_duplicate");
  });

  it("assesses foreign schedules as block_review", () => {
    const a = assessExistingSubscriptionSchedule({
      subscription: sub({ scheduleId: "sub_sched_x" }),
      htcScheduleId: null,
    });
    assert.equal(a.action, "block_review");
  });

  it("builds release intent for cancelled upgrades", () => {
    const release = buildStripeScheduleReleaseIntent({
      subscriptionId: "sub_1",
      scheduleId: "sub_sched_1",
      reason: "volume dropped",
      idempotencyKey: "k-release",
    });
    assert.equal(release.mode, "release_or_cancel_schedule");
  });

  it("builds friendly notice without claiming unconfirmed amounts", () => {
    const intent = buildStripeScheduleUpgradeIntent({
      subscriptionId: "sub_1",
      existingScheduleId: null,
      currentPriceId: "price_a",
      nextPriceId: "price_b",
      effectiveUnix: 1_800_000_000,
      preserveCouponId: "6d2PFuDb",
      idempotencyKey: "k1",
    });
    assert.equal(intent.mode, "create_schedule_from_subscription");

    const draft = buildTierUpgradeNoticeDraft({
      venueName: "Rosewood Barn",
      upgrade: baseUpgrade({
        status: "pending_notice",
        noticeSentAt: null,
        noticeDeliveryStatus: "not_sent",
        noticeProviderMessageId: null,
        stripeScheduleId: null,
      }),
    });
    assert.match(draft.subject, /growing with you/i);
    assert.equal(draft.vars.new_amount, "$199.20");
    const body = renderTierUpgradeNoticeBody(draft);
    assert.match(body, /no immediate charge/i);
    assert.match(body, /Celebrate/);
  });
});

describe("phase3 rehearsal wiring", () => {
  const prevApply = process.env.TIER_UPGRADE_APPLY_STRIPE;
  const prevSend = process.env.TIER_UPGRADE_SEND_NOTICE;
  const prevAllow = process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO;
  const prevRehearsal = process.env.TIER_UPGRADE_REHEARSAL_ENABLED;
  const prevVenueIds = process.env.TIER_UPGRADE_REHEARSAL_VENUE_IDS;

  beforeEach(() => {
    process.env.TIER_UPGRADE_APPLY_STRIPE = "false";
    process.env.TIER_UPGRADE_SEND_NOTICE = "false";
    delete process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO;
    delete process.env.TIER_UPGRADE_REHEARSAL_ENABLED;
    delete process.env.TIER_UPGRADE_REHEARSAL_VENUE_IDS;
  });

  afterEach(() => {
    if (prevApply === undefined) delete process.env.TIER_UPGRADE_APPLY_STRIPE;
    else process.env.TIER_UPGRADE_APPLY_STRIPE = prevApply;
    if (prevSend === undefined) delete process.env.TIER_UPGRADE_SEND_NOTICE;
    else process.env.TIER_UPGRADE_SEND_NOTICE = prevSend;
    if (prevAllow === undefined) delete process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO;
    else process.env.TIER_UPGRADE_REHEARSAL_NOTICE_TO = prevAllow;
    if (prevRehearsal === undefined) delete process.env.TIER_UPGRADE_REHEARSAL_ENABLED;
    else process.env.TIER_UPGRADE_REHEARSAL_ENABLED = prevRehearsal;
    if (prevVenueIds === undefined) delete process.env.TIER_UPGRADE_REHEARSAL_VENUE_IDS;
    else process.env.TIER_UPGRADE_REHEARSAL_VENUE_IDS = prevVenueIds;
  });

  it("refuses fixture-only notice/apply unless rehearsal execution is explicitly enabled", async () => {
    const {
      assertPhase3RehearsalFixture,
      mayApplyTierUpgradeStripe,
      maySendTierUpgradeNotice,
      assertRehearsalNoticeRecipient,
      resolveTierUpgradeNoticeRecipient,
    } = await import("./tier-upgrade-rehearsal-guard").then(async () => {
      const guard = await import("./tier-upgrade-rehearsal-guard");
      const recipients = await import("./tier-upgrade-notice-recipients");
      return { ...guard, ...recipients };
    });

    // Metadata alone must never authorize.
    assert.equal(maySendTierUpgradeNotice({ isRehearsalFixture: false }), false);
    assert.equal(maySendTierUpgradeNotice({ isRehearsalFixture: true }), false);
    assert.equal(mayApplyTierUpgradeStripe({ isRehearsalFixture: false }), false);
    assert.equal(mayApplyTierUpgradeStripe({ isRehearsalFixture: true }), false);

    const deniedWithoutEnv = assertPhase3RehearsalFixture({
      venueId: "v-rehearse",
      customer: { id: "cus_1", metadata: { htc_phase3_rehearsal: "true" } },
      subscription: { id: "sub_1", metadata: { htc_phase3_rehearsal: "true" } },
    });
    assert.equal(deniedWithoutEnv.ok, false);

    process.env.TIER_UPGRADE_REHEARSAL_ENABLED = "true";
    assert.equal(maySendTierUpgradeNotice({ isRehearsalFixture: true }), true);
    assert.equal(mayApplyTierUpgradeStripe({ isRehearsalFixture: true }), true);

    const ok = assertPhase3RehearsalFixture({
      venueId: "v-rehearse",
      customer: { id: "cus_1", metadata: { htc_phase3_rehearsal: "true" } },
      subscription: { id: "sub_1", metadata: { htc_phase3_rehearsal: "true" } },
    });
    assert.equal(ok.ok, true);

    const denied = assertPhase3RehearsalFixture({
      venueId: "v-other",
      customer: { id: "cus_2", metadata: {} },
      subscription: { id: "sub_2", metadata: { htc_phase3_rehearsal: "true" } },
    });
    assert.equal(denied.ok, false);

    assert.equal(
      assertRehearsalNoticeRecipient("jennifer@hellotocheers.com").ok,
      true,
    );
    assert.equal(
      assertRehearsalNoticeRecipient("customer@example.com").ok,
      false,
    );

    // Global gates authorize without fixture; notices redirect to internal inbox.
    process.env.TIER_UPGRADE_SEND_NOTICE = "true";
    process.env.TIER_UPGRADE_APPLY_STRIPE = "true";
    assert.equal(maySendTierUpgradeNotice({ isRehearsalFixture: false }), true);
    assert.equal(mayApplyTierUpgradeStripe({ isRehearsalFixture: false }), true);
    const redirected = resolveTierUpgradeNoticeRecipient({
      billingEmail: "htc-p1-lifecycle-1794174723@example.com",
      forceInternalRedirect: true,
    });
    assert.equal(redirected.ok, true);
    if (redirected.ok) {
      assert.equal(redirected.email, "jennifer@hellotocheers.com");
      assert.equal(redirected.redirected, true);
      assert.equal(
        redirected.originalEmail,
        "htc-p1-lifecycle-1794174723@example.com",
      );
    }
  });

  it("reconciles invoice.paid into applied with idempotent retries", async () => {
    const store = createMemoryTierUpgradeStore();
    setTierUpgradeStoreForTests(store);
    const scheduled = await store.upsertPendingUpgrade({
      ...baseUpgrade({
        status: "scheduled",
        stripeScheduleId: "sub_sched_1",
        requiredStripePriceId: "price_celebrate_test",
        expectedRecurringAmountCents: 24900,
      }),
      id: "up-reconcile-1",
    });
    assert.equal(scheduled.status, "scheduled");

    const { reconcileTierUpgradeFromInvoice } = await import(
      "./tier-upgrade-reconcile"
    );

    const first = await reconcileTierUpgradeFromInvoice({
      store,
      stripeEventId: "evt_paid_1",
      subscriptionId: "sub_1",
      subscriptionPriceId: "price_celebrate_test",
      invoiceId: "in_1",
      invoiceAmountExcludingTaxCents: 24900,
      invoiceAmountPaidCents: 24900,
      invoiceStatus: "paid",
    });
    assert.equal(first.ok, true);
    assert.equal(first.action, "mark_applied");
    assert.equal(first.upgrade?.status, "applied");
    assert.equal(
      (first.upgrade?.metadata?.processedStripeEventIds as string[])?.[0],
      "evt_paid_1",
    );

    const dup = await reconcileTierUpgradeFromInvoice({
      store,
      stripeEventId: "evt_paid_1",
      subscriptionId: "sub_1",
      subscriptionPriceId: "price_celebrate_test",
      invoiceId: "in_1",
      invoiceAmountExcludingTaxCents: 24900,
      invoiceAmountPaidCents: 24900,
      invoiceStatus: "paid",
    });
    assert.equal(dup.action, "ignore_duplicate");
  });

  it("apply gate still refuses near-term increases before notice window", () => {
    const blocked = evaluateTierUpgradeApplyGate({
      upgrade: baseUpgrade({
        noticeSentAt: "2026-06-01T12:00:00.000Z",
        scheduledEffectiveAt: "2026-06-05T12:00:00.000Z",
      }),
      noticeDeliveryStatus: "provider_accepted",
      volumeRecommendedPlan: "growing",
      activeHold: false,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      applyStripeEnabled: true,
      nowIso: "2026-06-02T12:00:00.000Z",
    });
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.code, "notice_window_unsatisfied");
    }
  });
});
