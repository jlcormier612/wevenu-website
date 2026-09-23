import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  conversationMessagePreview,
  isConversationMessageExpanded,
  latestConversationMessageId,
} from "@/lib/conversations/message-disclosure";

describe("conversation message progressive disclosure", () => {
  it("latest message is expanded by default", () => {
    const ids = [{ id: "newest" }, { id: "older" }, { id: "oldest" }];
    const latest = latestConversationMessageId(ids);
    assert.equal(latest, "newest");
    assert.equal(isConversationMessageExpanded("newest", latest, new Set()), true);
  });

  it("older messages are collapsed by default", () => {
    const latest = "newest";
    assert.equal(isConversationMessageExpanded("older", latest, new Set()), false);
    assert.equal(isConversationMessageExpanded("oldest", latest, new Set()), false);
  });

  it("historical message can be expanded", () => {
    const latest = "newest";
    const open = new Set(["older"]);
    assert.equal(isConversationMessageExpanded("older", latest, open), true);
  });

  it("historical message can be collapsed again", () => {
    const latest = "newest";
    const open = new Set(["older"]);
    open.delete("older");
    assert.equal(isConversationMessageExpanded("older", latest, open), false);
  });

  it("new inbound at the top becomes the current expanded message", () => {
    const before = [{ id: "old-latest" }, { id: "older" }];
    assert.equal(latestConversationMessageId(before), "old-latest");
    const after = [{ id: "inbound-new" }, { id: "old-latest" }, { id: "older" }];
    const latest = latestConversationMessageId(after);
    assert.equal(latest, "inbound-new");
    assert.equal(isConversationMessageExpanded("inbound-new", latest, new Set()), true);
    assert.equal(isConversationMessageExpanded("old-latest", latest, new Set()), false);
  });

  it("preview truncates long bodies", () => {
    const preview = conversationMessagePreview("a".repeat(100), 72);
    assert.ok(preview.length <= 72);
    assert.match(preview, /…$/);
  });

  it("ConversationThread uses shared disclosure helpers", () => {
    const src = readFileSync(
      join(process.cwd(), "components/conversations/conversation-thread.tsx"),
      "utf8",
    );
    assert.match(src, /isConversationMessageExpanded/);
    assert.match(src, /CollapsedMessageRow/);
    assert.match(src, /manuallyExpandedIds/);
  });

  it("Lead/Client and Inbox share ConversationThread", () => {
    const tab = readFileSync(
      join(process.cwd(), "components/conversations/relationship-conversation-tab.tsx"),
      "utf8",
    );
    const inbox = readFileSync(
      join(process.cwd(), "app/(app)/messaging/conversation-inbox.tsx"),
      "utf8",
    );
    assert.match(tab, /ConversationThread/);
    assert.match(inbox, /ConversationThread/);
  });
});
