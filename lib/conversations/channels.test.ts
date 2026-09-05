import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OUTBOUND_CHANNELS,
  OUTBOUND_CHANNEL_LABEL,
  SENDABLE_CHANNELS,
  STAFF_ONLY_CHANNELS,
  isClientVisibleChannel,
  isOutboundChannel,
  isSendableChannel,
  isStaffOnlyChannel,
} from "@/lib/conversations/channels";

describe("sendable conversation channels", () => {
  it("offers Email, Text, and Portal as outbound — Internal note stays sendable but separate", () => {
    assert.deepEqual([...OUTBOUND_CHANNELS], ["email", "sms", "portal"]);
    assert.deepEqual([...SENDABLE_CHANNELS], ["email", "sms", "portal", "internal_note"]);
    assert.equal(OUTBOUND_CHANNEL_LABEL.sms, "Text");
    assert.equal(isOutboundChannel("internal_note"), false);
    assert.equal(isSendableChannel("internal_note"), true);
  });

  it("does not treat voicemail, push, or phone call as sendable", () => {
    assert.equal(isSendableChannel("voicemail"), false);
    assert.equal(isSendableChannel("push"), false);
    assert.equal(isSendableChannel("phone_log"), false);
    assert.equal(isOutboundChannel("voicemail"), false);
  });
});

describe("staff-only channels stay off client surfaces", () => {
  it("keeps internal notes and unused log channels staff-only", () => {
    assert.deepEqual([...STAFF_ONLY_CHANNELS], ["internal_note", "phone_log", "voicemail", "push"]);
    assert.equal(isStaffOnlyChannel("internal_note"), true);
    assert.equal(isClientVisibleChannel("internal_note"), false);
  });

  it("lets couples see email, SMS, and portal messages", () => {
    assert.equal(isClientVisibleChannel("email"), true);
    assert.equal(isClientVisibleChannel("sms"), true);
    assert.equal(isClientVisibleChannel("portal"), true);
  });
});
