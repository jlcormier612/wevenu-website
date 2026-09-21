import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  QUICKCLOUD_CAMPAIGN_SID,
  QUICKCLOUD_TWILIO_ACCOUNT_SID,
  assertNotProtectedTwilioSid,
} from "@/lib/sms/twilio-protected-resources";

/** Non-secret disposable-shaped account id for collision tests (not a live credential). */
const NON_PROTECTED_ACCOUNT_SID = `AC${"d".repeat(32)}`;

describe("assertNotProtectedTwilioSid mock SID collisions", () => {
  it("always refuses protected account SIDs", () => {
    assert.throws(
      () => assertNotProtectedTwilioSid(QUICKCLOUD_TWILIO_ACCOUNT_SID, "test"),
      /protected Twilio resource/,
    );
  });

  it("refuses denylist SIDs when no owning account is provided", () => {
    assert.throws(
      () => assertNotProtectedTwilioSid(QUICKCLOUD_CAMPAIGN_SID, "test"),
      /protected Twilio resource/,
    );
  });

  it("allows denylist string collisions on a non-protected owning account", () => {
    assert.doesNotThrow(() =>
      assertNotProtectedTwilioSid(QUICKCLOUD_CAMPAIGN_SID, "test", {
        owningAccountSid: NON_PROTECTED_ACCOUNT_SID,
      }),
    );
  });

  it("refuses denylist SIDs when the owning account is itself protected", () => {
    assert.throws(
      () =>
        assertNotProtectedTwilioSid(QUICKCLOUD_CAMPAIGN_SID, "test", {
          owningAccountSid: QUICKCLOUD_TWILIO_ACCOUNT_SID,
        }),
      /protected Twilio resource/,
    );
  });
});
