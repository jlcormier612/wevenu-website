import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("subscription ops notify content + wiring", () => {
  const summary = readFileSync(
    resolve("marketing/lib/crm/enrollment-summary.ts"),
    "utf8",
  );
  const notify = readFileSync(resolve("marketing/lib/crm/notify.ts"), "utf8");
  const service = readFileSync(resolve("marketing/lib/crm/service.ts"), "utf8");

  it("summary includes venue, purchaser, tier, MRR, discount, onboarding, refs, next action", () => {
    assert.match(summary, /Purchaser:/);
    assert.match(summary, /Contact email:/);
    assert.match(summary, /Subscription tier:/);
    assert.match(summary, /Monthly recurring \(after discount\):/);
    assert.match(summary, /Discount:/);
    assert.match(summary, /Onboarding choice:/);
    assert.match(summary, /White Glove purchase:/);
    assert.match(summary, /Enrollment id:/);
    assert.match(summary, /Checkout session:/);
    assert.match(summary, /Next action:/);
    assert.match(summary, /CRM relationship:/);
    assert.doesNotMatch(summary, /password|activation_token|card number/i);
  });

  it("notifies only on first enrollment insert with Resend idempotency key", () => {
    assert.match(
      service,
      /if \(!existing\) \{\s*await notifySubscriptionEnrollment\(record,\s*\{\s*relationshipId: synced\.relationshipId,\s*\}\);/,
    );
    assert.match(notify, /htc-ops-subscription:/);
    assert.match(notify, /sendOpsInternalEmail/);
    assert.match(notify, /enrollmentSummaryLines/);
  });

  it("Launch Yourself next-action differs from White Glove", () => {
    assert.match(summary, /White Glove: wait for customer intake/);
    assert.match(summary, /Launch Yourself email/);
  });
});
