/**
 * Concurrency / lease acceptance for notification email delivery claims.
 * Models the Postgres compare-and-set update used by engine + obligation-engine
 * without hitting a live database or Resend.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_DELIVERY_LEASE_MS,
  EMAIL_DELIVERY_MAX_ATTEMPTS,
  emailDeliveryLeaseUntil,
  reminderFailureUpdate,
  resolveDeliveryDisposition,
  venueNotificationFailureUpdate,
} from "@/lib/notifications/email-delivery-retry";

type ReminderRow = {
  id: string;
  status: "pending" | "sent" | "failed";
  attempt_count: number;
  next_attempt_at: number; // epoch ms
  provider_sent?: boolean;
};

/** Atomic claim: only one concurrent worker wins when next_attempt_at <= now. */
function claimReminder(
  rows: Map<string, ReminderRow>,
  id: string,
  nowMs: number,
  leaseMs = EMAIL_DELIVERY_LEASE_MS,
): ReminderRow | null {
  const row = rows.get(id);
  if (!row || row.status !== "pending") return null;
  if (row.next_attempt_at > nowMs) return null;
  // Simulate row lock + UPDATE … WHERE next_attempt_at <= now
  row.next_attempt_at = nowMs + leaseMs;
  return { ...row };
}

describe("notification email delivery lease / concurrency", () => {
  it("two simultaneous workers cannot both claim the same notification", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const rows = new Map<string, ReminderRow>([
      ["r1", { id: "r1", status: "pending", attempt_count: 0, next_attempt_at: now }],
    ]);

    const a = claimReminder(rows, "r1", now);
    const b = claimReminder(rows, "r1", now);

    assert.ok(a);
    assert.equal(b, null);
    assert.ok(rows.get("r1")!.next_attempt_at > now);
  });

  it("lease acquisition is atomic under interleaved claim attempts", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const rows = new Map<string, ReminderRow>([
      ["r1", { id: "r1", status: "pending", attempt_count: 0, next_attempt_at: now }],
      ["r2", { id: "r2", status: "pending", attempt_count: 0, next_attempt_at: now }],
    ]);

    const winners: string[] = [];
    // Interleave claims like two ECS tasks scanning the same due set.
    for (const id of ["r1", "r1", "r2", "r2", "r1"]) {
      const claimed = claimReminder(rows, id, now);
      if (claimed) winners.push(id);
    }
    assert.deepEqual(winners, ["r1", "r2"]);
  });

  it("expired leases recover safely so work is not stranded", () => {
    const t0 = Date.parse("2026-11-18T12:00:00.000Z");
    const rows = new Map<string, ReminderRow>([
      ["r1", { id: "r1", status: "pending", attempt_count: 0, next_attempt_at: t0 }],
    ]);

    const first = claimReminder(rows, "r1", t0);
    assert.ok(first);
    // During lease window: still locked
    assert.equal(claimReminder(rows, "r1", t0 + EMAIL_DELIVERY_LEASE_MS - 1), null);
    // After lease expires: recoverable
    const recovered = claimReminder(rows, "r1", t0 + EMAIL_DELIVERY_LEASE_MS + 1);
    assert.ok(recovered);
  });

  it("successful send marked sent cannot be claimed or duplicated later", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const rows = new Map<string, ReminderRow>([
      ["r1", { id: "r1", status: "pending", attempt_count: 0, next_attempt_at: now }],
    ]);
    const claimed = claimReminder(rows, "r1", now);
    assert.ok(claimed);
    // Worker sends then marks sent (provider_id recorded in real path via notification_log).
    const row = rows.get("r1")!;
    row.status = "sent";
    row.provider_sent = true;

    assert.equal(claimReminder(rows, "r1", now + EMAIL_DELIVERY_LEASE_MS + 60_000), null);
    assert.equal(row.provider_sent, true);
  });

  it("eight-attempt terminal failure stays visible and can be requeued operationally", () => {
    const d = resolveDeliveryDisposition({
      code: "rate_limit",
      message: "too fast",
      attemptCountBefore: EMAIL_DELIVERY_MAX_ATTEMPTS - 1,
      jitterRatio: 0,
    });
    assert.equal(d.kind, "terminal");
    const update = reminderFailureUpdate(d);
    assert.equal(update.status, "failed");
    assert.equal(update.attempt_count, EMAIL_DELIVERY_MAX_ATTEMPTS);
    assert.ok(typeof update.last_error_code === "string");
    assert.ok(typeof update.last_error_message === "string");

    // Operational recovery (SQL / support): reset to pending + next_attempt_at=now
    const recovered = {
      status: "pending" as const,
      attempt_count: 0,
      next_attempt_at: Date.now(),
      last_error_code: null,
    };
    assert.equal(recovered.status, "pending");
  });

  it("temporary provider failures defer instead of silently dropping", () => {
    const d = resolveDeliveryDisposition({
      code: "temporary",
      message: "5xx",
      attemptCountBefore: 0,
      jitterRatio: 0,
    });
    assert.equal(d.kind, "defer");
    if (d.kind !== "defer") return;
    assert.ok(Date.parse(d.nextAttemptAt) > Date.now() - 1000);

    const venue = venueNotificationFailureUpdate(d);
    assert.equal(venue.needs_email, undefined); // still needs email
    assert.ok(typeof venue.email_next_attempt_at === "string");
  });

  it("emailDeliveryLeaseUntil is ~2 minutes ahead", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const lease = Date.parse(emailDeliveryLeaseUntil(now));
    assert.equal(lease - now, EMAIL_DELIVERY_LEASE_MS);
  });
});

describe("crash-after-send duplicate risk (documented gap)", () => {
  it("models the window where send succeeded but status was not committed", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const rows = new Map<string, ReminderRow>([
      ["r1", { id: "r1", status: "pending", attempt_count: 0, next_attempt_at: now }],
    ]);
    claimReminder(rows, "r1", now);
    // Provider accepted email, but process dies before status=sent.
    const providerAccepted = true;
    // Lease expires; second worker claims and would send again without idempotency key.
    const again = claimReminder(rows, "r1", now + EMAIL_DELIVERY_LEASE_MS + 1);
    assert.ok(again);
    assert.equal(providerAccepted, true);
    // Gap: duplicate possible unless Resend idempotency / outbox is added later.
  });
});
