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

describe("tour emails also carry thread context for inbound reply matching", () => {
  const source = readFileSync(resolve("lib/tours/communication.ts"), "utf8");
  it("sendTourConfirmation and sendTourConfirmationRequest pass threadId", () => {
    assert.match(source, /threadId: conversationId \?\? undefined/);
  });
});

describe("venue conversation messages are newest-first", () => {
  it("migration orders get_conversation messages by sent_at desc", () => {
    const migration = readFileSync(
      resolve("supabase/migrations/20261405700000_conversation_messages_newest_first.sql"),
      "utf8",
    );
    assert.match(migration, /order by cm\.sent_at desc/);
    assert.doesNotMatch(migration, /order by cm\.sent_at asc/);
  });

  it("Lead conversation UI sticks to the top (newest) not the bottom", () => {
    const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
    assert.match(thread, /stickToNewestRef/);
    assert.match(thread, /scrollMessagesToNewest/);
    assert.match(thread, /const last = next\[0\]/);
  });
});
