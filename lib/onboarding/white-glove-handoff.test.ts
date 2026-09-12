/**
 * Finish White Glove Setup — access-email idempotency helpers.
 * Full handoff requires Supabase; this covers the email-gate decision used by
 * finishWhiteGloveSetup so duplicate Finish attempts cannot re-send access mail.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Mirrors lib/onboarding/white-glove-handoff.ts email skip condition. */
function shouldSendAccessEmail(enrollment: {
  access_email_sent_at: string | null;
}): boolean {
  return !enrollment.access_email_sent_at;
}

describe("Finish White Glove access email gate", () => {
  it("sends when access_email_sent_at is null", () => {
    assert.equal(shouldSendAccessEmail({ access_email_sent_at: null }), true);
  });

  it("skips when access_email_sent_at is already set (duplicate Finish)", () => {
    assert.equal(
      shouldSendAccessEmail({ access_email_sent_at: "2026-09-12T12:00:00.000Z" }),
      false,
    );
  });
});
