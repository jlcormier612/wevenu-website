/**
 * Inbox filter chips / query assembly — server-side filter contract.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearInboxChip,
  defaultInboxFilters,
  INBOX_FILTER_ALL,
  inboxActiveChips,
  inboxFiltersAreDefault,
  inboxFiltersToQuery,
  type InboxFilterState,
} from "@/lib/conversations/inbox-filters";

describe("inboxFiltersToQuery", () => {
  it("maps attention unread vs needs_response distinctly", () => {
    const unread = inboxFiltersToQuery(
      { ...defaultInboxFilters(), attention: "unread" },
      null,
    );
    assert.equal(unread.unreadOnly, true);
    assert.equal(unread.needsResponseOnly, false);

    const needs = inboxFiltersToQuery(
      { ...defaultInboxFilters(), attention: "needs_response" },
      null,
    );
    assert.equal(needs.unreadOnly, false);
    assert.equal(needs.needsResponseOnly, true);
  });

  it("maps event + channel + assignment + sort", () => {
    const q = inboxFiltersToQuery({
      ...defaultInboxFilters(),
      channel: "email",
      eventId: "ev-1",
      eventDateFrom: "2027-01-01",
      eventDateTo: "2027-12-31",
      eventStatus: "confirmed",
      hasAttachments: true,
      assignment: { mode: "staff", staffId: "staff-9" },
      sort: "oldest",
    }, "me-staff");
    assert.equal(q.channel, "email");
    assert.equal(q.eventId, "ev-1");
    assert.equal(q.eventDateFrom, "2027-01-01");
    assert.equal(q.eventDateTo, "2027-12-31");
    assert.equal(q.eventStatus, "confirmed");
    assert.equal(q.hasAttachments, true);
    assert.equal(q.assignedStaffId, "staff-9");
    assert.equal(q.unassignedOnly, false);
    assert.equal(q.sort, "oldest");
  });

  it("maps assigned to me and unassigned", () => {
    const me = inboxFiltersToQuery(
      { ...defaultInboxFilters(), assignment: { mode: "me" } },
      "staff-me",
    );
    assert.equal(me.assignedStaffId, "staff-me");
    assert.equal(me.unassignedOnly, false);

    const un = inboxFiltersToQuery(
      { ...defaultInboxFilters(), assignment: { mode: "unassigned" } },
      "staff-me",
    );
    assert.equal(un.unassignedOnly, true);
    assert.equal(un.assignedStaffId, null);
  });
});

describe("inboxActiveChips + clear", () => {
  it("lists active chips and clear restores defaults", () => {
    let state: InboxFilterState = {
      ...defaultInboxFilters(),
      attention: "unread",
      relationship: "bookings",
      channel: "portal",
      eventId: "ev-1",
      sort: "oldest",
    };
    const chips = inboxActiveChips(state, { eventLabel: "Grace · Nov 11" });
    assert.ok(chips.some((c) => c.label === "Unread"));
    assert.ok(chips.some((c) => c.label === "Bookings"));
    assert.ok(chips.some((c) => c.label === "Portal"));
    assert.ok(chips.some((c) => c.label.includes("Grace")));
    assert.ok(chips.some((c) => c.label === "Oldest activity"));

    for (const chip of chips) {
      state = clearInboxChip(state, chip.id);
    }
    assert.equal(inboxFiltersAreDefault(state), true);
    assert.equal(state.eventId, INBOX_FILTER_ALL);
  });
});
