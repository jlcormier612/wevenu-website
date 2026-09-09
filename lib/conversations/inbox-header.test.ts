/**
 * Inbox header orientation + list event cues.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  conversationHeaderOrientation,
  formatInboxListEventCue,
} from "@/lib/conversations/inbox-header";
import type { ConversationSummary } from "@/lib/conversations/types";

function row(partial: Partial<ConversationSummary>): ConversationSummary {
  return {
    id: "c1",
    relationshipId: "r1",
    displayName: "Grace Langa & Sammy Patel",
    lastMessageAt: null,
    venueUnread: 0,
    contactUnread: 0,
    latestMessage: null,
    assignedStaffId: null,
    assignedStaffName: null,
    leadId: "lead-1",
    clientId: "client-1",
    eventCount: 1,
    eventId: "ev-1",
    eventName: "Grace Langa & Sammy Patel",
    eventDate: "2027-11-11",
    eventType: "Wedding",
    ...partial,
  };
}

describe("conversationHeaderOrientation", () => {
  it("shows Booking + single Event line without repeating wedding type", () => {
    const o = conversationHeaderOrientation(row({}));
    assert.equal(o.relationshipLabel, "Booking");
    assert.equal(o.eventLine, "Event · Grace Langa & Sammy Patel · November 11, 2027");
    assert.equal(o.workspaceHref, "/clients/client-1");
    assert.equal(o.workspaceLabel, "Open booking workspace →");
    assert.doesNotMatch(o.eventLine ?? "", /Wedding/i);
  });

  it("does not invent a primary event when multiple exist", () => {
    const o = conversationHeaderOrientation(row({
      eventCount: 2,
      eventId: null,
      eventName: null,
      eventDate: null,
    }));
    assert.match(o.eventLine ?? "", /Multiple events/);
  });

  it("uses preferred date for leads", () => {
    const o = conversationHeaderOrientation(row({
      clientId: null,
      eventCount: 0,
      preferredDate: "2027-06-01",
    }));
    assert.equal(o.relationshipLabel, "Lead");
    assert.equal(o.workspaceHref, "/leads/lead-1");
    assert.match(o.eventLine ?? "", /Preferred date/);
  });
});

describe("formatInboxListEventCue", () => {
  it("uses date + year + type for list rows", () => {
    assert.equal(formatInboxListEventCue(row({})), "November 11, 2027 Wedding");
  });

  it("shows Multiple events when count > 1", () => {
    assert.equal(formatInboxListEventCue(row({ eventCount: 2, eventDate: null })), "Multiple events");
  });
});
