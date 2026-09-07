/**
 * Inbox attention — Needs response vs empty vs unread semantics.
 * List truth must equal thread truth (Case G regression).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  conversationBelongsInInbox,
  conversationNeedsResponse,
  conversationNeedsResponseFromSummary,
  isMeaningfulCommunication,
  latestMeaningfulFromInboxTip,
  latestMeaningfulFromMessages,
  pickLatestMeaningfulPerConversation,
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

function summary(partial: Partial<ConversationSummary> & Pick<ConversationSummary, "latestMessage">): ConversationSummary {
  return {
    id: "c1",
    relationshipId: "r1",
    displayName: "Alex & Sam",
    lastMessageAt: partial.latestMessage?.sentAt ?? null,
    venueUnread: partial.venueUnread ?? 0,
    contactUnread: 0,
    latestMessage: partial.latestMessage,
    latestMeaningfulMessage: partial.latestMeaningfulMessage,
    assignedStaffId: null,
    assignedStaffName: null,
    leadId: null,
    clientId: null,
  };
}

describe("isMeaningfulCommunication", () => {
  it("includes venue outbound and client inbound", () => {
    assert.equal(isMeaningfulCommunication({ senderType: "venue_staff", channel: "email" }), true);
    assert.equal(isMeaningfulCommunication({ senderType: "lead_or_client", channel: "portal" }), true);
    assert.equal(isMeaningfulCommunication({ senderType: "contact", channel: "sms" }), true);
    assert.equal(isMeaningfulCommunication({ senderType: "vendor", channel: "portal" }), true);
  });

  it("excludes system and internal notes", () => {
    assert.equal(isMeaningfulCommunication({ senderType: "system", channel: "email" }), false);
    assert.equal(isMeaningfulCommunication({ senderType: "venue_staff", channel: "internal_note" }), false);
  });
});

describe("conversationNeedsResponse — locked cases", () => {
  it("A: client inbound → needs response YES", () => {
    assert.equal(conversationNeedsResponse(preview({ senderType: "lead_or_client", channel: "email" })), true);
  });

  it("B: venue response → needs response NO", () => {
    assert.equal(conversationNeedsResponse(preview({ senderType: "venue_staff", channel: "portal" })), false);
  });

  it("E: venue outbound with no client reply → needs response NO", () => {
    assert.equal(conversationNeedsResponse(preview({ senderType: "venue_staff", channel: "sms" })), false);
  });

  it("system and internal notes alone do not create needs response", () => {
    assert.equal(conversationNeedsResponse(preview({ senderType: "system", channel: "email" })), false);
    assert.equal(conversationNeedsResponse(preview({ senderType: "venue_staff", channel: "internal_note" })), false);
  });
});

describe("latestMeaningfulFromMessages — Cases C/D and venue reply", () => {
  it("C: client inbound then internal note → still needs response", () => {
    const latest = latestMeaningfulFromMessages([
      { senderType: "lead_or_client", channel: "email", body: "Hi", sentAt: "2026-09-01T10:00:00.000Z" },
      { senderType: "venue_staff", channel: "internal_note", body: "Note", sentAt: "2026-09-03T10:00:00.000Z" },
    ]);
    assert.equal(latest?.senderType, "lead_or_client");
    assert.equal(conversationNeedsResponse(latest), true);
  });

  it("D: client inbound then system/automation → still needs response", () => {
    const latest = latestMeaningfulFromMessages([
      { senderType: "lead_or_client", channel: "email", body: "Hi", sentAt: "2026-09-01T10:00:00.000Z" },
      { senderType: "system", channel: "email", body: "Auto", sentAt: "2026-09-02T10:00:00.000Z" },
    ]);
    assert.equal(latest?.senderType, "lead_or_client");
    assert.equal(conversationNeedsResponse(latest), true);
  });

  it("venue outbound after inbound clears needs response", () => {
    const latest = latestMeaningfulFromMessages([
      { senderType: "lead_or_client", channel: "email", body: "Hi", sentAt: "2026-09-01T10:00:00.000Z" },
      { senderType: "venue_staff", channel: "email", body: "Thanks", sentAt: "2026-09-02T10:00:00.000Z" },
    ]);
    assert.equal(conversationNeedsResponse(latest), false);
  });
});

describe("Case G — list truth equals thread truth", () => {
  it("tip system/note with meaningful inbound underneath: list summary matches thread walker", () => {
    const history = [
      { senderType: "lead_or_client" as const, channel: "email" as const, body: "Hi", sentAt: "2026-09-01T10:00:00.000Z" },
      { senderType: "system" as const, channel: "email" as const, body: "Auto", sentAt: "2026-09-02T10:00:00.000Z" },
      { senderType: "venue_staff" as const, channel: "internal_note" as const, body: "Note", sentAt: "2026-09-03T10:00:00.000Z" },
    ];
    const threadMeaningful = latestMeaningfulFromMessages(history);
    const tip = preview({ senderType: "venue_staff", channel: "internal_note", body: "Note", sentAt: "2026-09-03T10:00:00.000Z" });
    assert.equal(latestMeaningfulFromInboxTip(tip).status, "needs_lookup");

    // What the repository enrich does for a non-meaningful tip: batch pick.
    const picked = pickLatestMeaningfulPerConversation(
      [...history].reverse().map((m) => ({
        conversationId: "c1",
        senderType: m.senderType,
        channel: m.channel,
        body: m.body,
        sentAt: m.sentAt,
      })),
    );
    const listMeaningful = picked.get("c1") ?? null;
    assert.deepEqual(listMeaningful?.senderType, threadMeaningful?.senderType);
    assert.equal(
      conversationNeedsResponseFromSummary(summary({
        latestMessage: tip,
        latestMeaningfulMessage: listMeaningful,
      })),
      conversationNeedsResponse(threadMeaningful),
    );
    assert.equal(conversationNeedsResponseFromSummary(summary({
      latestMessage: tip,
      latestMeaningfulMessage: listMeaningful,
    })), true);
  });

  it("F: unread does not equal needs response", () => {
    const inbound = preview({ senderType: "lead_or_client", channel: "portal" });
    const row = summary({
      latestMessage: inbound,
      latestMeaningfulMessage: inbound,
      venueUnread: 0,
    });
    assert.equal(row.venueUnread, 0);
    assert.equal(conversationNeedsResponseFromSummary(row), true);
  });
});

describe("latestMeaningfulFromInboxTip", () => {
  it("reuses meaningful tip without lookup", () => {
    const tip = preview({ senderType: "lead_or_client", channel: "sms" });
    assert.deepEqual(latestMeaningfulFromInboxTip(tip), { status: "known", value: tip });
  });

  it("empty tip is known null", () => {
    assert.deepEqual(latestMeaningfulFromInboxTip(null), { status: "known", value: null });
  });
});

describe("conversationBelongsInInbox", () => {
  it("hides empty conversation shells", () => {
    assert.equal(conversationBelongsInInbox(summary({ latestMessage: null })), false);
  });

  it("keeps conversations with a message preview", () => {
    assert.equal(
      conversationBelongsInInbox(summary({ latestMessage: preview({ senderType: "venue_staff", channel: "email" }) })),
      true,
    );
  });
});
