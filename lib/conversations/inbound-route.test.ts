import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("inbound email route writes the conversation system of record", () => {
  const source = readFileSync(resolve("app/api/messaging/inbound/route.ts"), "utf8");

  it("records replies through the conversation inbound module", () => {
    assert.match(source, /recordInboundConversationEmail/);
    assert.match(source, /resolveInboundEmailConversation/);
    assert.match(source, /from\("conversation_messages"\)/);
  });

  it("does not insert inbound replies into the legacy messages table", () => {
    assert.doesNotMatch(source, /from\("messages"\)\.insert/);
    assert.doesNotMatch(source, /from\("message_threads"\)\.insert/);
  });
});

describe("conversation email send carries thread context", () => {
  const source = readFileSync(resolve("lib/conversations/service.ts"), "utf8");
  it("passes the conversation id as threadId so replies route back", () => {
    assert.match(source, /threadId: conversationId/);
    assert.match(source, /acceptOutboundEmail/);
    assert.match(source, /acceptOutboundSms/);
    assert.match(source, /isSendableChannel/);
  });
});
