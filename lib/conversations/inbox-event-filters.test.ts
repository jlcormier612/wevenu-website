/**
 * Inbox page RPC arg contract — event attributes + expanded sort.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inboxFiltersToQuery, defaultInboxFilters } from "@/lib/conversations/inbox-filters";

/** Mirror of repository inboxPageRpcArgs for contract tests (no DB). */
function rpcArgsFromQuery(query: ReturnType<typeof inboxFiltersToQuery> & {
  cursorLastMessageAt?: string | null;
  cursorId?: string | null;
  cursorSortKey?: string | null;
  search?: string | null;
  limit?: number;
}) {
  return {
    p_limit: query.limit ?? 40,
    p_cursor_last_message_at: query.cursorLastMessageAt ?? null,
    p_cursor_id: query.cursorId ?? null,
    p_search: query.search ?? null,
    p_unread_only: query.unreadOnly,
    p_needs_response_only: query.needsResponseOnly,
    p_relationship: query.relationship,
    p_channel: query.channel,
    p_assigned_staff_id: query.unassignedOnly ? null : query.assignedStaffId,
    p_event_id: query.eventId,
    p_event_date_from: query.eventDateFrom,
    p_event_date_to: query.eventDateTo,
    p_event_status: query.eventStatus,
    p_has_attachments: query.hasAttachments,
    p_unassigned_only: query.unassignedOnly,
    p_sort: query.sort,
    p_event_types: query.eventTypes && query.eventTypes.length > 0 ? query.eventTypes : null,
    p_cursor_sort_key: query.cursorSortKey ?? null,
  };
}

const TODAY = new Date(2026, 8, 8);

describe("Inbox RPC filter/sort contract", () => {
  it("Wedding + this month resolves to wedding type and September range", () => {
    const q = inboxFiltersToQuery({
      ...defaultInboxFilters(),
      eventTypes: ["wedding"],
      eventDatePreset: "this_month",
    }, null, TODAY);
    const rpc = rpcArgsFromQuery(q);
    assert.deepEqual(rpc.p_event_types, ["wedding"]);
    assert.equal(rpc.p_event_date_from, "2026-09-01");
    assert.equal(rpc.p_event_date_to, "2026-09-30");
    assert.equal(rpc.p_sort, "recent");
  });

  it("next 30 days + next month + type combination", () => {
    const next30 = rpcArgsFromQuery(inboxFiltersToQuery({
      ...defaultInboxFilters(),
      eventDatePreset: "next_30",
    }, null, TODAY));
    assert.equal(next30.p_event_date_from, "2026-09-08");
    assert.equal(next30.p_event_date_to, "2026-10-07");

    const combo = rpcArgsFromQuery(inboxFiltersToQuery({
      ...defaultInboxFilters(),
      eventTypes: ["corporate"],
      eventDatePreset: "next_month",
      attention: "needs_response",
      sort: "event_date_asc",
    }, null, TODAY));
    assert.deepEqual(combo.p_event_types, ["corporate"]);
    assert.equal(combo.p_event_date_from, "2026-10-01");
    assert.equal(combo.p_event_date_to, "2026-10-31");
    assert.equal(combo.p_needs_response_only, true);
    assert.equal(combo.p_sort, "event_date_asc");
  });

  it("passes sort cursor key for event-date pagination", () => {
    const q = inboxFiltersToQuery({
      ...defaultInboxFilters(),
      sort: "event_date_asc",
    }, null, TODAY);
    const rpc = rpcArgsFromQuery({
      ...q,
      cursorId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      cursorSortKey: "2027-06-12",
    });
    assert.equal(rpc.p_sort, "event_date_asc");
    assert.equal(rpc.p_cursor_sort_key, "2027-06-12");
    assert.equal(rpc.p_cursor_id, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
  });

  it("specific event id remains secondary filter arg", () => {
    const rpc = rpcArgsFromQuery(inboxFiltersToQuery({
      ...defaultInboxFilters(),
      eventId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      eventTypes: ["wedding"],
    }, null, TODAY));
    assert.equal(rpc.p_event_id, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    assert.deepEqual(rpc.p_event_types, ["wedding"]);
  });
});
