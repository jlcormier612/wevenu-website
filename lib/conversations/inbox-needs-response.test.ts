/**
 * Locked Inbox semantics: Read/Unread ⊥ Needs Response.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  conversationNeedsResponse,
  conversationNeedsResponseFromSummary,
  inboxAttentionState,
  latestMeaningfulFromMessages,
} from "@/lib/conversations/inbox-attention";
import type { ConversationMessagePreview, ConversationSummary } from "@/lib/conversations/types";

function preview(
  partial: Partial<ConversationMessagePreview> & Pick<ConversationMessagePreview, "senderType" | "channel">,
): ConversationMessagePreview {
  return {
    body: partial.body ?? "Hello",
    sentAt: partial.sentAt ?? "2026-09-06T12:00:00.000Z",
    senderType: partial.senderType,
    channel: partial.channel,
  };
}

function row(
  partial: Partial<ConversationSummary> & Pick<ConversationSummary, "venueUnread" | "needsResponse">,
): ConversationSummary {
  const inbound = preview({ senderType: "lead_or_client", channel: "portal" });
  return {
    id: "c1",
    relationshipId: "r1",
    displayName: "Alex & Sam",
    lastMessageAt: inbound.sentAt,
    venueUnread: partial.venueUnread,
    contactUnread: 0,
    needsResponse: partial.needsResponse,
    latestMessage: partial.latestMessage ?? inbound,
    latestMeaningfulMessage: partial.latestMeaningfulMessage ?? inbound,
    assignedStaffId: null,
    assignedStaffName: null,
    leadId: null,
    clientId: null,
  };
}

describe("four independent state combinations", () => {
  it("Unread + Needs Response", () => {
    const s = inboxAttentionState({ venueUnread: 2, needsResponse: true });
    assert.equal(s.label, "unread_needs_response");
    assert.equal(conversationNeedsResponseFromSummary(row({ venueUnread: 2, needsResponse: true })), true);
  });

  it("Read + Needs Response (opening must not clear Needs Response)", () => {
    const s = inboxAttentionState({ venueUnread: 0, needsResponse: true });
    assert.equal(s.label, "read_needs_response");
    assert.equal(conversationNeedsResponseFromSummary(row({ venueUnread: 0, needsResponse: true })), true);
  });

  it("Unread + No Response Needed (dismissal without reading)", () => {
    const s = inboxAttentionState({ venueUnread: 3, needsResponse: false });
    assert.equal(s.label, "unread_no_response");
    assert.equal(conversationNeedsResponseFromSummary(row({ venueUnread: 3, needsResponse: false })), false);
  });

  it("Read + No Response Needed", () => {
    const s = inboxAttentionState({ venueUnread: 0, needsResponse: false });
    assert.equal(s.label, "read_no_response");
    assert.equal(conversationNeedsResponseFromSummary(row({ venueUnread: 0, needsResponse: false })), false);
  });
});

describe("lifecycle scenarios", () => {
  it("A: inbound classifier creates needs response", () => {
    assert.equal(
      conversationNeedsResponse(preview({ senderType: "lead_or_client", channel: "email" })),
      true,
    );
  });

  it("B→C: persisted needsResponse stays true when unread is cleared", () => {
    const afterOpen = row({ venueUnread: 0, needsResponse: true });
    assert.equal(conversationNeedsResponseFromSummary(afterOpen), true);
    assert.equal(afterOpen.venueUnread, 0);
  });

  it("D: venue reply classifier clears needs response", () => {
    const latest = latestMeaningfulFromMessages([
      { senderType: "lead_or_client", channel: "email", body: "Hi", sentAt: "2026-09-01T10:00:00.000Z" },
      { senderType: "venue_staff", channel: "email", body: "Thanks", sentAt: "2026-09-02T10:00:00.000Z" },
    ]);
    assert.equal(conversationNeedsResponse(latest), false);
  });

  it("E: explicit dismissal uses persisted false even if tip is still inbound", () => {
    const dismissed = row({
      venueUnread: 0,
      needsResponse: false,
      latestMeaningfulMessage: preview({ senderType: "lead_or_client", channel: "sms" }),
    });
    assert.equal(conversationNeedsResponse(dismissed.latestMeaningfulMessage), true);
    assert.equal(conversationNeedsResponseFromSummary(dismissed), false);
  });

  it("F: new inbound after dismissal reactivates via persisted true", () => {
    const reactivated = row({ venueUnread: 1, needsResponse: true });
    assert.equal(conversationNeedsResponseFromSummary(reactivated), true);
    assert.equal(inboxAttentionState({ venueUnread: 1, needsResponse: true }).label, "unread_needs_response");
  });

  it("G: unread informational / dismissed does not appear as Needs Response", () => {
    const informational = row({ venueUnread: 1, needsResponse: false });
    assert.equal(conversationNeedsResponseFromSummary(informational), false);
    assert.equal(inboxAttentionState(informational).unread, true);
  });
});

describe("persisted model wiring", () => {
  it("migration persists needs_response and clear RPC", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261402100000_inbox_needs_response_persisted.sql"),
      "utf8",
    );
    assert.match(sql, /add column if not exists needs_response boolean not null default false/);
    assert.match(sql, /clear_conversation_needs_response/);
    assert.match(sql, /or e\.needs_response/);
    assert.match(sql, /total_needs_response/);
    assert.match(sql, /set venue_unread = 0/);
    assert.match(sql, /'needs_response', coalesce\(v_needs_response/);
    // get_conversation clears unread only — must not clear needs_response in the same UPDATE.
    assert.match(
      sql,
      /update public\.conversations\s+set venue_unread = 0\s+where id = p_conversation_id\s+returning needs_response/,
    );
  });

  it("UI exposes No response needed and does not clear needs on open", () => {
    const inbox = readFileSync(join(process.cwd(), "app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    const thread = readFileSync(join(process.cwd(), "components/conversations/conversation-thread.tsx"), "utf8");
    assert.match(inbox, /No response needed/);
    assert.match(thread, /No response needed/);
    assert.match(thread, /persisted Needs Response unchanged/);
    assert.match(inbox, /totalNeedsResponse/);
    assert.match(inbox, /unread messages/);
  });

  it("bubble is unread count, not needs-response count", () => {
    const inbox = readFileSync(join(process.cwd(), "app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(inbox, /venueUnread > 0/);
    assert.match(inbox, /unread message/);
  });
});
