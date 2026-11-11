import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { totalUnreadAfterConversationCleared } from "@/lib/conversations/inbox-unread-totals";
import {
  NAV_ATTENTION_REFRESH_EVENT,
  requestNavAttentionRefresh,
} from "@/lib/navigation/attention";

describe("totalUnreadAfterConversationCleared", () => {
  it("subtracts N unread from the header when a conversation with N is cleared", () => {
    assert.equal(totalUnreadAfterConversationCleared(5, 3), 2);
    assert.equal(totalUnreadAfterConversationCleared(3, 3), 0);
  });

  it("does not subtract again when prior venueUnread is already 0 (repeat open)", () => {
    const afterFirst = totalUnreadAfterConversationCleared(5, 3);
    assert.equal(afterFirst, 2);
    assert.equal(totalUnreadAfterConversationCleared(afterFirst, 0), 2);
  });

  it("leaves other conversations' unread in the total", () => {
    // Venue total 7 = A(3) + B(4). Clearing A leaves B's 4.
    assert.equal(totalUnreadAfterConversationCleared(7, 3), 4);
  });

  it("floors at zero and ignores negative / non-finite prior", () => {
    assert.equal(totalUnreadAfterConversationCleared(2, 5), 0);
    assert.equal(totalUnreadAfterConversationCleared(2, -1), 2);
    assert.equal(totalUnreadAfterConversationCleared(2, Number.NaN), 2);
  });
});

describe("Inbox unread indicator wiring", () => {
  const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
  const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");

  it("open path updates header total and requests nav refresh only after clear", () => {
    assert.match(inbox, /totalUnreadAfterConversationCleared/);
    assert.match(inbox, /requestNavAttentionRefresh/);
    assert.match(inbox, /markConversationOpened/);
    assert.match(inbox, /priorUnread > 0/);
  });

  it("send path applies the same unread-total correction when prior unread remains", () => {
    const sent = inbox.slice(inbox.indexOf("function markConversationSent"));
    assert.match(sent, /totalUnreadAfterConversationCleared/);
    assert.match(sent, /requestNavAttentionRefresh/);
  });

  it("failed get_conversation does not notify inbox opened (counts stay)", () => {
    assert.match(thread, /onInboxOpenedRef\.current\?\.\(persistedNeeds\)/);
    const catchBlock = thread.slice(thread.indexOf(".catch(() => {"), thread.indexOf(".catch(() => {") + 280);
    assert.doesNotMatch(catchBlock, /onInboxOpened/);
  });

  it("open keeps needs_response from persisted detail (does not clear)", () => {
    assert.match(thread, /Open clears unread only — pass persisted Needs Response unchanged/);
    assert.match(inbox, /needsResponse/);
  });

  it("sidebar refreshes attention on event without requiring a new pathname", () => {
    assert.match(sidebar, /NAV_ATTENTION_REFRESH_EVENT/);
    assert.match(sidebar, /addEventListener\(NAV_ATTENTION_REFRESH_EVENT/);
    assert.match(sidebar, /pathname/);
  });

  it("requestNavAttentionRefresh dispatches the shared event name", () => {
    assert.equal(NAV_ATTENTION_REFRESH_EVENT, "htc:nav-attention-refresh");
    const events: string[] = [];
    const prev = globalThis.window;
    // Minimal window stub for node:test
    (globalThis as { window?: { dispatchEvent: (e: Event) => boolean } }).window = {
      dispatchEvent(e: Event) {
        events.push(e.type);
        return true;
      },
    };
    try {
      requestNavAttentionRefresh();
      assert.deepEqual(events, [NAV_ATTENTION_REFRESH_EVENT]);
    } finally {
      if (prev === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = prev;
      }
    }
  });
});
