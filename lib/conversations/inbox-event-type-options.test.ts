/**
 * Inbox Event Type filter — venue accepted types + legacy bucket.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { EVENT_TYPES } from "@/lib/event-types/canonical";
import {
  buildInboxEventTypeFilterOptions,
  expandInboxEventTypeFilterValues,
  INBOX_EVENT_TYPE_LEGACY,
  INBOX_EVENT_TYPE_LEGACY_LABEL,
  INBOX_EVENT_TYPE_NO_MATCH,
  isStoredEventTypeOutsideAccepted,
  shouldShowInboxLegacyEventTypeBucket,
} from "@/lib/conversations/inbox-event-type-options";
import {
  inboxActiveChips,
  inboxFiltersToQuery,
  defaultInboxFilters,
  toggleInboxEventType,
} from "@/lib/conversations/inbox-filters";

describe("Inbox event-type filter options", () => {
  it("Wedding only → Wedding plus legacy bucket", () => {
    const options = buildInboxEventTypeFilterOptions(["wedding"]);
    assert.deepEqual(options.map((o) => o.value), ["wedding", INBOX_EVENT_TYPE_LEGACY]);
    assert.equal(options[0]?.label, "Wedding");
    assert.equal(options[1]?.label, INBOX_EVENT_TYPE_LEGACY_LABEL);
  });

  it("Wedding + Corporate + Social → those three plus legacy", () => {
    const options = buildInboxEventTypeFilterOptions(["wedding", "corporate", "social_event"]);
    assert.deepEqual(
      options.map((o) => o.value),
      ["wedding", "corporate", "social_event", INBOX_EVENT_TYPE_LEGACY],
    );
    assert.ok(!options.some((o) => o.value === "elopement"));
    assert.ok(!options.some((o) => o.value === "birthday"));
  });

  it("full canonical accepted set does not add a legacy bucket", () => {
    const all = EVENT_TYPES.map((t) => t.value);
    assert.equal(shouldShowInboxLegacyEventTypeBucket(all), false);
    const options = buildInboxEventTypeFilterOptions(all);
    assert.equal(options.length, EVENT_TYPES.length);
    assert.ok(!options.some((o) => o.value === INBOX_EVENT_TYPE_LEGACY));
  });

  it("keeps canonical order for accepted subset", () => {
    const options = buildInboxEventTypeFilterOptions(["social_event", "wedding", "corporate"]);
    assert.deepEqual(
      options.filter((o) => o.value !== INBOX_EVENT_TYPE_LEGACY).map((o) => o.value),
      ["wedding", "corporate", "social_event"],
    );
  });
});

describe("Inbox legacy event-type membership", () => {
  const accepted = ["wedding", "corporate", "social_event"];

  it("treats removed Elopement as legacy without renaming it", () => {
    assert.equal(isStoredEventTypeOutsideAccepted("elopement", accepted), true);
    assert.equal(isStoredEventTypeOutsideAccepted("Elopement", accepted), true);
    assert.equal(isStoredEventTypeOutsideAccepted("wedding", accepted), false);
    assert.equal(isStoredEventTypeOutsideAccepted("Wedding", accepted), false);
  });

  it("treats non-catalog historical types as legacy", () => {
    assert.equal(isStoredEventTypeOutsideAccepted("Barn Dance", accepted), true);
  });

  it("expands legacy selection to stored outside types", () => {
    const expanded = expandInboxEventTypeFilterValues(
      [INBOX_EVENT_TYPE_LEGACY],
      accepted,
      ["elopement", "Elopement", "wedding", "Barn Dance"],
    );
    assert.ok(expanded);
    assert.ok(expanded!.includes("elopement"));
    assert.ok(expanded!.includes("Elopement"));
    assert.ok(expanded!.includes("Barn Dance"));
    assert.ok(!expanded!.includes("wedding"));
    assert.ok(!expanded!.includes(INBOX_EVENT_TYPE_LEGACY));
  });

  it("combines a current type with legacy stored values", () => {
    const expanded = expandInboxEventTypeFilterValues(
      ["wedding", INBOX_EVENT_TYPE_LEGACY],
      accepted,
      ["elopement"],
    );
    assert.deepEqual(expanded, ["wedding", "elopement"]);
  });

  it("returns a no-match sentinel when legacy is selected but nothing is outside accepted", () => {
    assert.deepEqual(
      expandInboxEventTypeFilterValues([INBOX_EVENT_TYPE_LEGACY], accepted, ["wedding", "Wedding"]),
      [INBOX_EVENT_TYPE_NO_MATCH],
    );
  });

  it("passes through concrete types unchanged when legacy is not selected", () => {
    assert.deepEqual(
      expandInboxEventTypeFilterValues(["wedding", "corporate"], accepted, ["elopement"]),
      ["wedding", "corporate"],
    );
  });
});

describe("Inbox filter chips for legacy", () => {
  it("labels the legacy sentinel in active chips", () => {
    let state = defaultInboxFilters();
    state = toggleInboxEventType(state, INBOX_EVENT_TYPE_LEGACY);
    const chips = inboxActiveChips(state);
    assert.ok(chips.some((c) => c.label === INBOX_EVENT_TYPE_LEGACY_LABEL));
    const q = inboxFiltersToQuery(state, null);
    assert.deepEqual(q.eventTypes, [INBOX_EVENT_TYPE_LEGACY]);
  });
});

describe("Inbox UI wiring", () => {
  it("builds Event type options from accepted Setup types, not the full catalog constant", () => {
    const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    const page = readFileSync(resolve("app/(app)/messaging/page.tsx"), "utf8");
    assert.match(inbox, /buildInboxEventTypeFilterOptions/);
    assert.match(inbox, /eventTypeFilterOptions/);
    assert.doesNotMatch(inbox, /INBOX_EVENT_TYPE_OPTIONS\.map/);
    assert.match(page, /acceptedInquiryEventTypes/);
    assert.match(page, /getInquiryFormSettings/);
  });

  it("expands legacy in the repository before the inbox page RPC", () => {
    const repo = readFileSync(resolve("lib/conversations/repository.ts"), "utf8");
    assert.match(repo, /resolveInboxEventTypesForRpc/);
    assert.match(repo, /expandInboxEventTypeFilterValues/);
    assert.match(repo, /accepted_inquiry_event_types/);
    // HQ admins see every venue via venues_hq_select — must scope by current_user_venue_id.
    assert.match(repo, /current_user_venue_id/);
  });

  it("RPC event-type filter matches lead.event_type on Leads even when a client row exists", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261404700000_inbox_event_type_lead_filter.sql"),
      "utf8",
    );
    assert.match(sql, /inbox_owner_kind = 'lead'/);
    assert.match(sql, /p_relationship in \('leads', 'lead'\)/);
    assert.match(sql, /lead_event_type = any \(v_event_types\)/);
  });
});
