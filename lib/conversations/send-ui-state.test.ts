import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  confirmationAfterSend,
  isAuthoritativeSendSuccess,
  mergeSentAckIntoMessages,
  optimisticMessageFromAck,
  toSentMessageAck,
} from "@/lib/conversations/send-ui-state";
import type { ConversationMessage, SendMessageResult } from "@/lib/conversations/types";

describe("send UI state — P0 send vs refresh separation", () => {
  it("A: successful send result is authoritative", () => {
    const result: SendMessageResult = {
      ok: true,
      messageId: "msg-1",
      channel: "email",
      status: "accepted",
    };
    assert.equal(isAuthoritativeSendSuccess(result), true);
    const ack = toSentMessageAck(result, "Hello", "email");
    assert.equal(ack.messageId, "msg-1");
    assert.equal(ack.channel, "email");
    assert.equal(ack.body, "Hello");
    const confirm = confirmationAfterSend({
      sendOk: true,
      refreshFailed: false,
      channel: "email",
    });
    assert.deepEqual(confirm, { kind: "sent", channel: "email" });
  });

  it("B: successful send + refresh failure still confirms sent (not failed)", () => {
    const confirm = confirmationAfterSend({
      sendOk: true,
      refreshFailed: true,
      channel: "email",
    });
    assert.equal(confirm.kind, "sent");
    assert.notEqual(confirm.kind, "failed");
  });

  it("C: genuine send failure stays failed with human-readable message", () => {
    const result: SendMessageResult = { ok: false, message: "An email needs a subject line." };
    assert.equal(isAuthoritativeSendSuccess(result), false);
    const confirm = confirmationAfterSend({
      sendOk: false,
      refreshFailed: false,
      channel: "email",
      sendErrorMessage: result.message,
    });
    assert.deepEqual(confirm, {
      kind: "failed",
      message: "An email needs a subject line.",
    });
  });

  it("merges ack into thread without duplicating messageId", () => {
    const ack = {
      messageId: "msg-2",
      channel: "email",
      body: "Sent body",
      status: "accepted",
    };
    const first = mergeSentAckIntoMessages(null, ack);
    assert.equal(first.length, 1);
    assert.equal(first[0].id, "msg-2");
    const second = mergeSentAckIntoMessages(first, ack);
    assert.equal(second.length, 1);
  });

  it("optimistic message uses venue_staff and preserves body/channel", () => {
    const msg: ConversationMessage = optimisticMessageFromAck(
      { messageId: "m", channel: "email", body: "Hi", status: "accepted" },
      "2026-01-01T00:00:00.000Z",
    );
    assert.equal(msg.senderType, "venue_staff");
    assert.equal(msg.channel, "email");
    assert.equal(msg.body, "Hi");
    assert.equal(msg.status, "accepted");
  });
});
