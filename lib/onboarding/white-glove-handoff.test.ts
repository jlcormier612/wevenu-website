/**
 * Finish White Glove Setup — access-email idempotency + retry helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveActivationTokenForHandoff,
  shouldSendWhiteGloveAccessEmail,
} from "./white-glove-handoff.ts";

describe("Finish White Glove access email gate", () => {
  it("sends when access_email_sent_at is null", () => {
    assert.equal(
      shouldSendWhiteGloveAccessEmail({ access_email_sent_at: null }),
      true,
    );
  });

  it("skips when access_email_sent_at is already set (duplicate Finish)", () => {
    assert.equal(
      shouldSendWhiteGloveAccessEmail({
        access_email_sent_at: "2026-09-12T12:00:00.000Z",
      }),
      false,
    );
  });
});

describe("Finish White Glove activation token reuse", () => {
  it("reuses an existing token on email-failure retry", () => {
    const existing = "act_existing_token_abc";
    const resolved = resolveActivationTokenForHandoff(existing, () => "act_new");
    assert.equal(resolved.token, existing);
    assert.equal(resolved.mintedNew, false);
  });

  it("mints once when no token exists yet", () => {
    const resolved = resolveActivationTokenForHandoff(null, () => "act_fresh");
    assert.equal(resolved.token, "act_fresh");
    assert.equal(resolved.mintedNew, true);
  });
});
