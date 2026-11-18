import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("notification email delivery retry contracts", () => {
  it("reminder engines filter next_attempt_at and no longer leave pending forever on catch", () => {
    const engine = read("lib/notifications/engine.ts");
    assert.match(engine, /\.lte\("next_attempt_at", now\)/);
    assert.match(engine, /applyReminderDeliveryFailure/);
    assert.match(engine, /EmailDeliveryFailure/);
    assert.doesNotMatch(engine, /keep pending for retry/);

    const obligation = read("lib/notifications/obligation-engine.ts");
    assert.match(obligation, /\.lte\("next_attempt_at", now\)/);
    assert.match(obligation, /applyReminderDeliveryFailure/);
    assert.match(obligation, /applyVenueNotificationDeliveryFailure/);
    assert.match(obligation, /emailDeliveryLeaseUntil/);
  });

  it("sendEmail surfaces Retry-After for deferred retries", () => {
    const send = read("lib/email/send.ts");
    assert.match(send, /parseRetryAfterSeconds/);
    assert.match(send, /retryAfterSeconds/);
  });

  it("migration adds failed status and backoff columns", () => {
    const mig = read("supabase/migrations/20270131120000_notification_email_delivery_retry.sql");
    assert.match(mig, /'failed'/);
    assert.match(mig, /next_attempt_at/);
    assert.match(mig, /email_next_attempt_at/);
    assert.match(mig, /attempt_count/);
  });
});
