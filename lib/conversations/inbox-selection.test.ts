import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  selectionAfterInboxCategoryChange,
  selectionAfterInboxListReplace,
} from "@/lib/conversations/inbox-selection";

describe("inbox selection when switching buckets", () => {
  it("clears a Lead selection when switching to Vendors", () => {
    assert.equal(
      selectionAfterInboxCategoryChange("leads", "vendors", "lead-thread-1"),
      null,
    );
  });

  it("clears a Client selection when switching to Vendors", () => {
    assert.equal(
      selectionAfterInboxCategoryChange("clients", "vendors", "client-thread-1"),
      null,
    );
  });

  it("keeps selection when the same bucket is re-selected", () => {
    assert.equal(
      selectionAfterInboxCategoryChange("leads", "leads", "lead-thread-1"),
      "lead-thread-1",
    );
  });

  it("stays empty when switching buckets with no selection", () => {
    assert.equal(selectionAfterInboxCategoryChange("leads", "vendors", null), null);
  });

  it("drops a selection that is absent from the replaced list", () => {
    assert.equal(
      selectionAfterInboxListReplace({
        loading: false,
        conversationIds: ["vendor-a"],
        activeConversationId: "lead-thread-1",
      }),
      null,
    );
  });

  it("keeps a selection that belongs to the new list", () => {
    assert.equal(
      selectionAfterInboxListReplace({
        loading: false,
        conversationIds: ["vendor-a", "vendor-b"],
        activeConversationId: "vendor-b",
      }),
      "vendor-b",
    );
  });

  it("does not clear during load so deep links are not dropped early", () => {
    assert.equal(
      selectionAfterInboxListReplace({
        loading: true,
        conversationIds: [],
        activeConversationId: "deep-link-1",
      }),
      "deep-link-1",
    );
  });

  it("keeps a deep-linked id until its category list arrives", () => {
    assert.equal(
      selectionAfterInboxListReplace({
        loading: false,
        conversationIds: [],
        activeConversationId: "deep-link-1",
        deepLinkConversationId: "deep-link-1",
      }),
      "deep-link-1",
    );
  });

  it("clears a non-deep-link id absent from the replaced list", () => {
    assert.equal(
      selectionAfterInboxListReplace({
        loading: false,
        conversationIds: ["vendor-a"],
        activeConversationId: "lead-thread-1",
        deepLinkConversationId: "deep-link-1",
      }),
      null,
    );
  });

  it("wires category change and list replace into ConversationInbox", () => {
    const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(inbox, /selectionAfterInboxCategoryChange/);
    assert.match(inbox, /selectionAfterInboxListReplace/);
    assert.match(inbox, /setActiveId\(\(current\) => selectionAfterInboxCategoryChange/);
    assert.match(inbox, /router\.replace/);
    assert.match(inbox, /listLoadGeneration/);
  });
});
