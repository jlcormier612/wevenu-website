/**
 * Inbox search matching — name / email / phone / event date.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  conversationMatchesInboxSearch,
  digitsOnly,
  parseEventDateQuery,
} from "@/lib/conversations/inbox-search";
import type { ConversationSummary } from "@/lib/conversations/types";

function row(partial: Partial<ConversationSummary>): ConversationSummary {
  return {
    id: "c1",
    relationshipId: "r1",
    displayName: "Alex & Sam",
    lastMessageAt: null,
    venueUnread: 0,
    contactUnread: 0,
    latestMessage: null,
    assignedStaffId: null,
    assignedStaffName: null,
    leadId: null,
    clientId: null,
    searchEmail: "alex@example.com",
    searchPhone: "+1 (555) 123-4567",
    eventDate: "2027-10-18",
    eventType: "Wedding",
    ...partial,
  };
}

describe("digitsOnly", () => {
  it("strips non-digits", () => {
    assert.equal(digitsOnly("+1 (555) 123-4567"), "15551234567");
  });
});

describe("parseEventDateQuery", () => {
  it("parses month name and year", () => {
    const p = parseEventDateQuery("october 2027");
    assert.equal(p.monthIndex, 9);
    assert.equal(p.year, 2027);
  });

  it("parses wedding in october", () => {
    const p = parseEventDateQuery("wedding in october");
    assert.equal(p.monthIndex, 9);
  });

  it("parses ISO month", () => {
    const p = parseEventDateQuery("2027-10");
    assert.equal(p.yearMonth, "2027-10");
    assert.equal(p.monthIndex, 9);
  });
});

describe("conversationMatchesInboxSearch", () => {
  it("matches display name", () => {
    assert.equal(conversationMatchesInboxSearch(row({}), "alex"), true);
  });

  it("matches email", () => {
    assert.equal(conversationMatchesInboxSearch(row({}), "alex@example"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "nobody@x.com"), false);
  });

  it("matches phone digits", () => {
    assert.equal(conversationMatchesInboxSearch(row({}), "555123"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "(555) 123"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "999"), false);
  });

  it("matches event date ISO and October", () => {
    assert.equal(conversationMatchesInboxSearch(row({}), "2027-10-18"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "2027-10"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "october"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "wedding in october"), true);
    assert.equal(conversationMatchesInboxSearch(row({}), "november"), false);
  });

  it("empty query matches all", () => {
    assert.equal(conversationMatchesInboxSearch(row({}), "  "), true);
  });
});
