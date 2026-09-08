import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("conversation composer send surface", () => {
  const compose = readFileSync(resolve("components/conversations/conversation-compose.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
  const channels = readFileSync(resolve("lib/conversations/channels.ts"), "utf8");

  it("offers only Email, Text, and Portal as outbound channels", () => {
    assert.match(compose, /OUTBOUND_CHANNELS/);
    assert.match(compose, /OUTBOUND_CHANNEL_LABEL/);
    assert.match(channels, /sms: "Text"/);
    assert.doesNotMatch(compose, /voicemail/);
    assert.doesNotMatch(compose, /phone_log/);
    assert.doesNotMatch(compose, /Phone call/);
    assert.doesNotMatch(compose, />Push</);
  });

  it("keeps Internal note as a separate staff mode, not an outbound channel option", () => {
    assert.match(compose, /Compose mode/);
    assert.match(compose, /Internal note/);
    assert.match(compose, /Staff note for your venue team/);
    assert.match(compose, /switchMode\("internal_note"\)/);
    const outboundSelect = compose.match(/OUTBOUND_CHANNELS\.map\(\(c\) => \{[\s\S]*?\}\)/)?.[0] ?? "";
    assert.ok(outboundSelect.length > 0, "outbound channel select should map OUTBOUND_CHANNELS");
    assert.doesNotMatch(outboundSelect, /internal_note/);
  });

  it("does not use a one-line Enter-to-send footer", () => {
    assert.doesNotMatch(compose, /rows=\{1\}/);
    assert.doesNotMatch(compose, /e\.key === "Enter"/);
    assert.match(compose, /rows=\{4\}/);
    assert.match(compose, /min-h-\[6rem\]/);
    assert.match(compose, /Send email now/);
    assert.match(compose, /Send text now/);
    assert.match(compose, /Send portal message/);
    assert.match(compose, /Save internal note/);
    assert.match(compose, /Schedule/);
    assert.match(compose, /Enter does not send/);
  });

  it("shows destination and progressive preview/template (not permanent chrome)", () => {
    assert.match(compose, /recipientLine/);
    assert.match(compose, /Email subject/);
    assert.match(compose, /Email preview/);
    assert.match(compose, /Text preview/);
    assert.match(compose, /previewConversationSendAction/);
    assert.match(compose, /Template \(optional\)/);
    assert.doesNotMatch(compose, /max-h-\[min\(42vh,26rem\)\]/);
  });

  it("allows attachments on Email, Text, Portal, and Internal note with channel constraints", () => {
    assert.match(compose, /validateAttachmentsForChannel/);
    assert.match(compose, /acceptAttributeForChannel/);
    assert.match(compose, /Text\/MMS: images, PDF/);
    assert.doesNotMatch(compose, /Attachments can only be sent on Portal/);
  });

  it("keeps historical channel icons on the thread without using them as the send selector", () => {
    assert.match(thread, /CHANNEL_META/);
    assert.match(thread, /ConversationCompose/);
    assert.doesNotMatch(thread, /Object\.keys\(CHANNEL_META\)/);
    assert.doesNotMatch(thread, /rows=\{1\}/);
    assert.match(thread, /Lead/);
    assert.match(thread, /Booking/);
    assert.doesNotMatch(thread, /> Client</);
  });

  it("middle header keeps identity and actions without booking-stage orientation (D02)", () => {
    assert.match(thread, /summary\.clientId \? "Booking" : "Lead"/);
    assert.match(thread, /Open lead/);
    assert.match(thread, /Open booking/);
    assert.match(thread, /Create Request/);
    assert.doesNotMatch(thread, /headerStageLabel/);
    assert.doesNotMatch(thread, /bookingStageLabel/);
  });
});
