import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * P0 Inbox email-send hang — architecture + fail-safe locks.
 * Proves send completion is not gated on /messaging revalidation or
 * post-send refresh success.
 */
describe("P0 email-send hang fail-safes", () => {
  const actions = readFileSync(resolve("app/(app)/messaging/actions.ts"), "utf8");
  const compose = readFileSync(resolve("components/conversations/conversation-compose.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
  const contextPanel = readFileSync(
    resolve("components/conversations/relationship-context-panel.tsx"),
    "utf8",
  );
  const service = readFileSync(resolve("lib/conversations/service.ts"), "utf8");

  function extractFn(source: string, name: string): string {
    const start = source.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `missing ${name}`);
    const nextExport = source.indexOf("\nexport ", start + 10);
    return nextExport >= 0 ? source.slice(start, nextExport) : source.slice(start);
  }

  it("E: sendConversationMessageAction does not revalidatePath on the hot path", () => {
    const fn = extractFn(actions, "sendConversationMessageAction");
    // Mentions in comments are OK; must not *call* revalidation on send.
    assert.doesNotMatch(fn, /revalidatePath\s*\(/);
    assert.match(fn, /conversations\.sendConversationMessage/);
    assert.match(fn, /hot send path|P0/i);
  });

  it("successful send service result includes messageId (authoritative ack)", () => {
    assert.match(service, /ok: true/);
    assert.match(service, /messageId: result\.messageId!/);
    assert.match(service, /channel,/);
  });

  it("composer always clears sending in finally", () => {
    assert.match(compose, /finally \{[\s\S]*?setSending\(false\);[\s\S]*?\}/);
    assert.match(compose, /isAuthoritativeSendSuccess/);
    assert.match(compose, /toSentMessageAck/);
  });

  it("composer separates send failure from onSent/refresh failure", () => {
    assert.match(compose, /await onSent\(ack\)/);
    assert.match(compose, /Message sent\. If it doesn't appear yet/);
    // Refresh catch must not toast.error as a send failure.
    const onSentCatch = compose.match(/await onSent\(ack\);[\s\S]*?catch \{[\s\S]*?\}/)?.[0] ?? "";
    assert.ok(onSentCatch.length > 0);
    assert.doesNotMatch(onSentCatch, /toast\.error/);
  });

  it("D: preview failure/abort always clears previewing", () => {
    assert.match(compose, /previewConversationSendAction/);
    assert.match(compose, /\.finally\(\(\) => \{[\s\S]*?setPreviewing\(false\)/);
    assert.match(compose, /setPreviewing\(false\);/);
  });

  it("thread handleSent reconciles from ack when refresh fails", () => {
    assert.match(thread, /async function handleSent\(ack\?: SentMessageAck\)/);
    assert.match(thread, /mergeSentAckIntoMessages/);
    assert.match(thread, /\.catch\(\(\) => \{[\s\S]*?setMessages\(\(prev\) => prev \?\? \[\]\)/);
  });

  it("context panel recovers from load error instead of infinite Loading", () => {
    assert.match(contextPanel, /contextStatus/);
    assert.match(contextPanel, /"error"/);
    assert.match(contextPanel, /Couldn’t load requests/);
    assert.match(contextPanel, /Couldn’t load activity/);
  });

  it("does not add a client timeout that aborts the authoritative send", () => {
    const sendFn = compose.match(/async function send\(\) \{[\s\S]*?\n  async function confirmSchedule/)?.[0] ?? "";
    assert.ok(sendFn.length > 0);
    assert.doesNotMatch(sendFn, /AbortController/);
    assert.doesNotMatch(sendFn, /setTimeout\([^)]*sendConversationMessageAction/);
  });
});
