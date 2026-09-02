import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("conversation composer send surface", () => {
  const compose = readFileSync(resolve("components/conversations/conversation-compose.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");

  it("offers only Email, SMS, Portal message, and Internal note", () => {
    assert.match(compose, /SENDABLE_CHANNELS/);
    assert.match(compose, /SENDABLE_CHANNEL_LABEL/);
    assert.doesNotMatch(compose, /voicemail/);
    assert.doesNotMatch(compose, /phone_log/);
    assert.doesNotMatch(compose, /Phone call/);
    assert.doesNotMatch(compose, />Push</);
  });

  it("does not use a one-line Enter-to-send footer", () => {
    assert.doesNotMatch(compose, /rows=\{1\}/);
    assert.doesNotMatch(compose, /e\.key === "Enter"/);
    assert.match(compose, /rows=\{8\}/);
    assert.match(compose, /Send email now/);
    assert.match(compose, /Send text now/);
    assert.match(compose, /Send portal message/);
    assert.match(compose, /Save internal note/);
    assert.match(compose, /Schedule/);
  });

  it("shows destination, subject, and preview for the real send", () => {
    assert.match(compose, /Recipient/);
    assert.match(compose, /Email subject/);
    assert.match(compose, /Email preview/);
    assert.match(compose, /Text preview/);
    assert.match(compose, /previewConversationSendAction/);
  });

  it("keeps historical channel icons on the thread without using them as the send selector", () => {
    assert.match(thread, /CHANNEL_META/);
    assert.match(thread, /ConversationCompose/);
    assert.doesNotMatch(thread, /Object\.keys\(CHANNEL_META\)/);
    assert.doesNotMatch(thread, /rows=\{1\}/);
  });
});
