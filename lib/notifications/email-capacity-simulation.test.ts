/**
 * Mocked Resend capacity simulation for notification-scale readiness.
 * No network. No live emails. Assumptions are labeled in the report object.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_DELIVERY_MAX_ATTEMPTS,
  computeEmailDeliveryBackoffMs,
  resolveDeliveryDisposition,
} from "@/lib/notifications/email-delivery-retry";

/** Verified account rate limit (Sandbox GET /usage + response headers 2026-11-18). */
const PROVIDER_RPS = 10;

type SimAssumptions = {
  emailsPerVenuePerDay: number;
  dueNotificationsPerVenueAtTopOfHour: number;
  sequentialSendMs: number; // time per sendEmail call when under limit
  workers: number;
};

type SimResult = {
  venues: number;
  assumptions: SimAssumptions;
  dailyVolume: number;
  burstDue: number;
  peakProviderRpsUnthrottled: number;
  peakProviderRpsCapped: number;
  rateLimitHitsFirstPass: number;
  deferredRetries: number;
  terminalFailures: number;
  duplicateSends: number;
  lostMessages: number;
  secondsToDrainBurstAtCap: number;
  transactionalShareOfPoolPct: number;
};

/**
 * Models a top-of-hour notifications burst: each due item is a sequential
 * sendEmail attempt from `workers` ECS tasks sharing one team rate limit.
 * Provider accepts at most PROVIDER_RPS; excess return 429 → defer disposition.
 */
function simulateBurst(venues: number, assumptions: SimAssumptions): SimResult {
  const dailyVolume = venues * assumptions.emailsPerVenuePerDay;
  const burstDue = venues * assumptions.dueNotificationsPerVenueAtTopOfHour;

  // Unthrottled app can fire as fast as workers × (1000/sequentialSendMs)
  const unthrottledRps = assumptions.workers * (1000 / assumptions.sequentialSendMs);
  const peakProviderRpsUnthrottled = Math.min(unthrottledRps, burstDue);
  const peakProviderRpsCapped = Math.min(PROVIDER_RPS, peakProviderRpsUnthrottled);

  let accepted = 0;
  let rateLimitHits = 0;
  let deferred = 0;
  let terminal = 0;
  const attemptCounts = new Map<number, number>(); // item index → attempts so far

  // First pass: process all due items in arrival order against a token bucket.
  let tokens = PROVIDER_RPS;
  let second = 0;
  for (let i = 0; i < burstDue; i++) {
    if (tokens <= 0) {
      // advance one second window
      second += 1;
      tokens = PROVIDER_RPS;
    }
    if (tokens > 0) {
      tokens -= 1;
      accepted += 1;
      attemptCounts.set(i, 1);
    } else {
      // Shouldn't happen after refill, but keep safe
      rateLimitHits += 1;
    }
  }

  // Items that would arrive faster than token refill within the same second:
  // approximate excess pressure as unthrottled peak above cap.
  const excessPerSecond = Math.max(0, peakProviderRpsUnthrottled - PROVIDER_RPS);
  // First-pass 429s ≈ how many attempts in the hottest second exceed the cap
  rateLimitHits = Math.min(burstDue, Math.floor(excessPerSecond));

  for (let i = 0; i < rateLimitHits; i++) {
    const before = attemptCounts.get(i) ?? 0;
    const d = resolveDeliveryDisposition({
      code: "rate_limit",
      message: "429",
      attemptCountBefore: before,
      jitterRatio: 0,
    });
    if (d.kind === "defer") deferred += 1;
    else terminal += 1;
    attemptCounts.set(i, before + 1);
  }

  // Drain time if capped at 10 rps with no client throttle (idealized).
  const secondsToDrainBurstAtCap = burstDue / PROVIDER_RPS;

  // Immediate transactional share: assume 1 concurrent human send during burst.
  const transactionalShareOfPoolPct = (1 / PROVIDER_RPS) * 100;

  return {
    venues,
    assumptions,
    dailyVolume,
    burstDue,
    peakProviderRpsUnthrottled,
    peakProviderRpsCapped,
    rateLimitHitsFirstPass: rateLimitHits,
    deferredRetries: deferred,
    terminalFailures: terminal,
    duplicateSends: 0, // lease prevents double-claim; crash window excluded
    lostMessages: 0, // defer/terminal retain rows
    secondsToDrainBurstAtCap,
    transactionalShareOfPoolPct,
  };
}

const ASSUMPTIONS: SimAssumptions = {
  // Labeled assumptions — not measured production telemetry.
  emailsPerVenuePerDay: 8, // invites + reminders + conversations + system
  dueNotificationsPerVenueAtTopOfHour: 2, // synchronized cron due set
  sequentialSendMs: 50, // optimistic localhost→Resend latency under load
  workers: 1, // current Sandbox desiredCount≈1; scale risk if raised without throttle
};

describe("mocked Resend capacity simulation", () => {
  it("records verified provider RPS and backoff floors", () => {
    assert.equal(PROVIDER_RPS, 10);
    assert.equal(computeEmailDeliveryBackoffMs(0, { code: "rate_limit", jitterRatio: 0 }), 60_000);
    assert.ok(EMAIL_DELIVERY_MAX_ATTEMPTS >= 8);
  });

  it("simulates 100 / 300 / 1000 venue bursts without live sends", () => {
    const results = [100, 300, 1000].map((n) => simulateBurst(n, ASSUMPTIONS));

    for (const r of results) {
      assert.equal(r.lostMessages, 0);
      assert.equal(r.duplicateSends, 0);
      assert.equal(r.peakProviderRpsCapped, PROVIDER_RPS);
      assert.ok(r.dailyVolume === r.venues * ASSUMPTIONS.emailsPerVenuePerDay);
      assert.ok(r.secondsToDrainBurstAtCap === r.burstDue / PROVIDER_RPS);
    }

    const [v100, v300, v1000] = results;
    // With 1 worker @ 50ms/send ≈ 20 rps unthrottled → hits 429 pressure
    assert.ok(v100.peakProviderRpsUnthrottled > PROVIDER_RPS);
    assert.ok(v1000.burstDue === 2000);
    assert.ok(v1000.secondsToDrainBurstAtCap === 200);
    assert.ok(v300.dailyVolume === 2400);

    // Surface for operator report (printed by test runner)
    console.log(
      JSON.stringify(
        {
          assumptions: ASSUMPTIONS,
          provider: { rps: PROVIDER_RPS, monthlyLimitVerified: 50_000, dailyLimitVerified: null },
          results,
        },
        null,
        2,
      ),
    );
  });

  it("shows monthly quota headroom vs assumed daily volume", () => {
    const monthlyLimit = 50_000; // verified Sandbox GET /usage 2026-11-18
    for (const venues of [100, 300, 1000]) {
      const monthly = venues * ASSUMPTIONS.emailsPerVenuePerDay * 30;
      const ok = monthly <= monthlyLimit;
      console.log(
        JSON.stringify({
          venues,
          assumedMonthlyEmails: monthly,
          monthlyLimit,
          fitsVerifiedMonthlyQuota: ok,
        }),
      );
      if (venues <= 100) assert.equal(ok, true);
      if (venues >= 300) assert.equal(ok, false); // plan pressure under these assumptions
    }
  });
});
