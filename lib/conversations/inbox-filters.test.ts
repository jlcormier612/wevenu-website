/**
 * Inbox filter chips / query assembly / event-date presets.
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
  resolveInboxEventDateRange,
  toggleInboxEventType,
  type InboxFilterState,
} from "@/lib/conversations/inbox-filters";

const TODAY = new Date(2026, 8, 8); // Sep 8, 2026 local

describe("resolveInboxEventDateRange", () => {
  it("maps presets to inclusive YYYY-MM-DD ranges", () => {
    assert.deepEqual(resolveInboxEventDateRange("any", "", "", TODAY), { from: null, to: null });
    assert.deepEqual(resolveInboxEventDateRange("past", "", "", TODAY), { from: null, to: "2026-09-07" });
    assert.deepEqual(resolveInboxEventDateRange("today", "", "", TODAY), { from: "2026-09-08", to: "2026-09-08" });
    assert.deepEqual(resolveInboxEventDateRange("next_7", "", "", TODAY), { from: "2026-09-08", to: "2026-09-14" });
    assert.deepEqual(resolveInboxEventDateRange("next_30", "", "", TODAY), { from: "2026-09-08", to: "2026-10-07" });
    assert.deepEqual(resolveInboxEventDateRange("this_month", "", "", TODAY), { from: "2026-09-01", to: "2026-09-30" });
    assert.deepEqual(resolveInboxEventDateRange("next_month", "", "", TODAY), { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(resolveInboxEventDateRange("this_year", "", "", TODAY), { from: "2026-01-01", to: "2026-12-31" });
  });

  it("uses custom from/to only for custom preset", () => {
    assert.deepEqual(
      resolveInboxEventDateRange("custom", "2027-01-01", "2027-01-31", TODAY),
      { from: "2027-01-01", to: "2027-01-31" },
    );
  });
});

describe("inboxFiltersToQuery", () => {
  it("maps attention unread vs needs_response distinctly", () => {
    const unread = inboxFiltersToQuery(
      { ...defaultInboxFilters(), attention: "unread" },
      null,
      TODAY,
    );
    assert.equal(unread.unreadOnly, true);
    assert.equal(unread.needsResponseOnly, false);

    const needs = inboxFiltersToQuery(
      { ...defaultInboxFilters(), attention: "needs_response" },
      null,
      TODAY,
    );
    assert.equal(needs.unreadOnly, false);
    assert.equal(needs.needsResponseOnly, true);
  });

  it("maps event type + date preset + specific event + sort", () => {
    const q = inboxFiltersToQuery({
      ...defaultInboxFilters(),
      channel: "email",
      eventTypes: ["wedding", "corporate"],
      eventDatePreset: "next_month",
      eventId: "ev-1",
      eventStatus: "confirmed",
      hasAttachments: true,
      assignment: { mode: "staff", staffId: "staff-9" },
      sort: "event_date_asc",
    }, "me-staff", TODAY);
    assert.equal(q.channel, "email");
    assert.deepEqual(q.eventTypes, ["wedding", "corporate"]);
    assert.equal(q.eventDateFrom, "2026-10-01");
    assert.equal(q.eventDateTo, "2026-10-31");
    assert.equal(q.eventId, "ev-1");
    assert.equal(q.eventStatus, "confirmed");
    assert.equal(q.hasAttachments, true);
    assert.equal(q.assignedStaffId, "staff-9");
    assert.equal(q.unassignedOnly, false);
    assert.equal(q.sort, "event_date_asc");
  });

  it("combines event type with this_month and needs_response", () => {
    const q = inboxFiltersToQuery({
      ...defaultInboxFilters(),
      attention: "needs_response",
      eventTypes: ["wedding"],
      eventDatePreset: "this_month",
    }, null, TODAY);
    assert.equal(q.needsResponseOnly, true);
    assert.deepEqual(q.eventTypes, ["wedding"]);
    assert.equal(q.eventDateFrom, "2026-09-01");
    assert.equal(q.eventDateTo, "2026-09-30");
  });

  it("maps assigned to me and unassigned", () => {
    const me = inboxFiltersToQuery(
      { ...defaultInboxFilters(), assignment: { mode: "me" } },
      "staff-me",
      TODAY,
    );
    assert.equal(me.assignedStaffId, "staff-me");
    assert.equal(me.unassignedOnly, false);

    const un = inboxFiltersToQuery(
      { ...defaultInboxFilters(), assignment: { mode: "unassigned" } },
      "staff-me",
      TODAY,
    );
    assert.equal(un.unassignedOnly, true);
    assert.equal(un.assignedStaffId, null);
  });
});

describe("toggleInboxEventType + chips", () => {
  it("toggles multi-select event types and chips", () => {
    let state = defaultInboxFilters();
    state = toggleInboxEventType(state, "wedding");
    state = toggleInboxEventType(state, "corporate");
    assert.deepEqual(state.eventTypes, ["wedding", "corporate"]);
    state = toggleInboxEventType(state, "wedding");
    assert.deepEqual(state.eventTypes, ["corporate"]);

    const chips = inboxActiveChips({
      ...state,
      eventDatePreset: "next_30",
      sort: "event_date_asc",
      eventId: "ev-1",
    }, { eventLabel: "Grace · Nov 11" });
    assert.ok(chips.some((c) => c.label === "Corporate Event"));
    assert.ok(chips.some((c) => c.label === "Next 30 days"));
    assert.ok(chips.some((c) => c.label.includes("Specific event")));
    assert.ok(chips.some((c) => c.label === "Soonest event first"));
  });

  it("lists active chips and clear restores defaults", () => {
    let state: InboxFilterState = {
      ...defaultInboxFilters(),
      attention: "unread",
      relationship: "bookings",
      channel: "portal",
      eventTypes: ["wedding"],
      eventDatePreset: "this_month",
      eventId: "ev-1",
      sort: "oldest",
    };
    const chips = inboxActiveChips(state, { eventLabel: "Grace · Nov 11" });
    assert.ok(chips.some((c) => c.label === "Unread"));
    assert.ok(chips.some((c) => c.label === "Bookings"));
    assert.ok(chips.some((c) => c.label === "Portal"));
    assert.ok(chips.some((c) => c.label === "Wedding"));
    assert.ok(chips.some((c) => c.label === "This month"));
    assert.ok(chips.some((c) => c.label.includes("Grace")));
    assert.ok(chips.some((c) => c.label === "Oldest activity"));

    for (const chip of chips) {
      state = clearInboxChip(state, chip.id);
    }
    assert.equal(inboxFiltersAreDefault(state), true);
    assert.equal(state.eventId, INBOX_FILTER_ALL);
    assert.equal(state.eventTypes.length, 0);
    assert.equal(state.eventDatePreset, "any");
  });
});
