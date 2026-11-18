import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_DELIVERY_MAX_ATTEMPTS,
  computeEmailDeliveryBackoffMs,
  parseRetryAfterSeconds,
  resolveDeliveryDisposition,
} from "@/lib/notifications/email-delivery-retry";

describe("parseRetryAfterSeconds", () => {
  it("parses integer seconds and caps at 24h", () => {
    assert.equal(parseRetryAfterSeconds("12"), 12);
    assert.equal(parseRetryAfterSeconds("999999"), 24 * 60 * 60);
    assert.equal(parseRetryAfterSeconds(""), null);
    assert.equal(parseRetryAfterSeconds(null), null);
    assert.equal(parseRetryAfterSeconds("not-a-date"), null);
  });
});

describe("computeEmailDeliveryBackoffMs", () => {
  it("doubles from 1m and caps at 6h", () => {
    assert.equal(computeEmailDeliveryBackoffMs(0, { jitterRatio: 0 }), 60_000);
    assert.equal(computeEmailDeliveryBackoffMs(1, { jitterRatio: 0 }), 120_000);
    assert.equal(computeEmailDeliveryBackoffMs(2, { jitterRatio: 0 }), 240_000);
    assert.equal(computeEmailDeliveryBackoffMs(20, { jitterRatio: 0 }), 6 * 60 * 60_000);
  });

  it("honors Retry-After when larger than exponential backoff", () => {
    assert.equal(
      computeEmailDeliveryBackoffMs(0, { retryAfterSeconds: 300, jitterRatio: 0 }),
      300_000,
    );
  });

  it("uses a longer floor for quota than bare rate_limit", () => {
    const rate = computeEmailDeliveryBackoffMs(0, { code: "rate_limit", jitterRatio: 0 });
    const quota = computeEmailDeliveryBackoffMs(0, { code: "quota", jitterRatio: 0 });
    assert.equal(rate, 60_000);
    assert.equal(quota, 60 * 60_000);
  });

  it("increases across successive rate_limit attempts", () => {
    const a0 = computeEmailDeliveryBackoffMs(0, { code: "rate_limit", jitterRatio: 0 });
    const a1 = computeEmailDeliveryBackoffMs(1, { code: "rate_limit", jitterRatio: 0 });
    const a2 = computeEmailDeliveryBackoffMs(2, { code: "rate_limit", jitterRatio: 0 });
    assert.ok(a1 > a0);
    assert.ok(a2 > a1);
  });
});

describe("resolveDeliveryDisposition", () => {
  it("marks invalid_recipient terminal immediately", () => {
    const d = resolveDeliveryDisposition({
      code: "invalid_recipient",
      message: "bad recipient",
      attemptCountBefore: 0,
      jitterRatio: 0,
    });
    assert.equal(d.kind, "terminal");
    assert.equal(d.attemptCount, 1);
    assert.equal(d.code, "invalid_recipient");
  });

  it("defers rate_limit with backoff and Retry-After", () => {
    const nowMs = Date.parse("2026-11-18T12:00:00.000Z");
    const d = resolveDeliveryDisposition({
      code: "rate_limit",
      message: "too fast",
      attemptCountBefore: 0,
      retryAfterSeconds: 90,
      jitterRatio: 0,
      nowMs,
    });
    assert.equal(d.kind, "defer");
    if (d.kind !== "defer") return;
    assert.equal(d.attemptCount, 1);
    assert.equal(d.delayMs, 90_000);
    assert.equal(d.nextAttemptAt, "2026-11-18T12:01:30.000Z");
  });

  it("defers quota without treating it as permanent", () => {
    const d = resolveDeliveryDisposition({
      code: "quota",
      message: "daily quota",
      attemptCountBefore: 0,
      jitterRatio: 0,
    });
    assert.equal(d.kind, "defer");
    if (d.kind !== "defer") return;
    assert.ok(d.delayMs >= 60 * 60_000);
  });

  it("terminates after max attempts of repeated rate_limit", () => {
    const d = resolveDeliveryDisposition({
      code: "rate_limit",
      message: "too fast",
      attemptCountBefore: EMAIL_DELIVERY_MAX_ATTEMPTS - 1,
      jitterRatio: 0,
    });
    assert.equal(d.kind, "terminal");
    assert.match(d.message, /retries exhausted/);
  });

  it("marks configuration and disabled as terminal", () => {
    assert.equal(
      resolveDeliveryDisposition({
        code: "configuration",
        message: "domain",
        attemptCountBefore: 0,
      }).kind,
      "terminal",
    );
    assert.equal(
      resolveDeliveryDisposition({
        code: "disabled",
        message: "off",
        attemptCountBefore: 0,
      }).kind,
      "terminal",
    );
  });
});
