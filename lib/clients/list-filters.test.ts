import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  CLIENT_LIST_FILTERS,
  clientListFilterHref,
  clientMatchesListFilter,
  comingUpHorizonEnd,
  countClientListFilters,
  parseClientListFilter,
  type ClientListFilterRecord,
} from "@/lib/clients/list-filters";

function client(
  partial: Partial<ClientListFilterRecord> & Pick<ClientListFilterRecord, "id">,
): ClientListFilterRecord {
  return {
    status: "planning",
    eventDate: null,
    ...partial,
  };
}

const TODAY = "2026-09-01";
const COMING_UP_OUT = comingUpHorizonEnd(TODAY);

function ctx(extra: Partial<Parameters<typeof clientMatchesListFilter>[2]> = {}) {
  return {
    today: TODAY,
    comingUpOut: COMING_UP_OUT,
    attentionClientIds: new Set<string>(),
    ...extra,
  };
}

describe("comingUpHorizonEnd", () => {
  it("is today plus 30 calendar days", () => {
    assert.equal(COMING_UP_OUT, "2026-10-01");
  });
});

describe("parseClientListFilter / href", () => {
  it("accepts the five buckets and maps the removed ones", () => {
    assert.deepEqual(CLIENT_LIST_FILTERS.map((f) => f.key), [
      "all",
      "coming_up",
      "needs_attention",
      "cancelled",
      "past",
    ]);
    assert.deepEqual(CLIENT_LIST_FILTERS.map((f) => f.label), [
      "All Bookings",
      "Coming up",
      "Needs Attention",
      "Cancelled",
      "Past",
    ]);
    for (const { key } of CLIENT_LIST_FILTERS) {
      assert.equal(parseClientListFilter(key), key);
      assert.equal(clientListFilterHref(key), `/clients?filter=${key}`);
    }
    assert.equal(parseClientListFilter("upcoming"), "all");
    assert.equal(parseClientListFilter("booked_business"), "all");
    assert.equal(parseClientListFilter("wedding_week"), "coming_up");
    assert.equal(parseClientListFilter("confirmed"), null);
    assert.equal(parseClientListFilter(""), null);
    assert.equal(parseClientListFilter(undefined), null);
  });
});

describe("All Bookings", () => {
  const filterCtx = ctx();

  it("is the default active population: not cancelled and not past", () => {
    const rows = [
      client({ id: "future", eventDate: "2028-08-12" }),
      client({ id: "today", eventDate: TODAY }),
      client({ id: "undated", eventDate: null }),
      client({ id: "past", eventDate: "2026-08-31" }),
      client({ id: "cancelled", status: "cancelled", eventDate: "2028-08-12" }),
    ];
    assert.equal(countClientListFilters(rows, filterCtx).all, 3);
    assert.equal(clientMatchesListFilter(rows[3], "all", filterCtx), false);
    assert.equal(clientMatchesListFilter(rows[4], "all", filterCtx), false);
  });

  it("stays on the booked set when that set is provided", () => {
    const booked = ctx({ bookedClientIds: new Set(["a"]) });
    assert.equal(clientMatchesListFilter(client({ id: "a", eventDate: "2027-01-01" }), "all", booked), true);
    assert.equal(clientMatchesListFilter(client({ id: "b", eventDate: "2027-01-01" }), "all", booked), false);
    assert.equal(clientMatchesListFilter(client({ id: "a", eventDate: "2026-08-01" }), "all", booked), false);
  });
});

describe("Coming up", () => {
  const filterCtx = ctx();

  it("is today through the next 30 days, including reporting fixtures", () => {
    const near = client({ id: "near", eventDate: "2026-09-20" });
    const edge = client({ id: "edge", eventDate: "2026-10-01" });
    const far = client({ id: "far", eventDate: "2026-10-15" });
    const fixture = client({ id: "e2e", eventDate: "2026-09-20", excludeFromBusinessReporting: true });
    assert.equal(clientMatchesListFilter(near, "coming_up", filterCtx), true);
    assert.equal(clientMatchesListFilter(edge, "coming_up", filterCtx), true);
    assert.equal(clientMatchesListFilter(far, "coming_up", filterCtx), false);
    assert.equal(clientMatchesListFilter(far, "all", filterCtx), true);
    assert.equal(clientMatchesListFilter(fixture, "coming_up", filterCtx), true);
    assert.equal(clientMatchesListFilter(client({ id: "today", eventDate: TODAY }), "coming_up", filterCtx), true);
  });
});

describe("Needs Attention, Past, and Cancelled", () => {
  const attention = new Set(["flagged", "past-flagged", "cancelled-flagged"]);
  const filterCtx = ctx({ attentionClientIds: attention });
  const rows: ClientListFilterRecord[] = [
    client({ id: "parker", eventDate: "2028-08-12" }),
    client({ id: "soon", eventDate: "2026-09-05" }),
    client({ id: "today", eventDate: TODAY }),
    client({ id: "past", eventDate: "2026-08-01" }),
    client({ id: "flagged", eventDate: "2028-01-01" }),
    client({ id: "past-flagged", eventDate: "2026-08-01" }),
    client({ id: "cancelled", status: "cancelled", eventDate: "2028-08-12" }),
    client({ id: "cancelled-flagged", status: "cancelled", eventDate: "2026-09-05" }),
    client({ id: "undated", eventDate: null }),
  ];
  const counts = countClientListFilters(rows, filterCtx);

  it("Coming up overlaps All Bookings and can also be Needs Attention", () => {
    assert.equal(clientMatchesListFilter(rows[1], "all", filterCtx), true);
    assert.equal(clientMatchesListFilter(rows[1], "coming_up", filterCtx), true);
    assert.equal(counts.coming_up, 2);
  });

  it("Needs Attention is an action subset of All Bookings, not Past or Cancelled", () => {
    assert.equal(counts.needs_attention, 1);
    assert.equal(clientMatchesListFilter(rows[4], "needs_attention", filterCtx), true);
    assert.equal(clientMatchesListFilter(rows[4], "all", filterCtx), true);
    assert.equal(clientMatchesListFilter(rows[5], "needs_attention", filterCtx), false);
    assert.equal(clientMatchesListFilter(rows[7], "needs_attention", filterCtx), false);
  });

  it("Past and Cancelled are separate historical views", () => {
    assert.equal(counts.past, 2);
    assert.equal(counts.cancelled, 2);
    assert.equal(clientMatchesListFilter(rows[3], "all", filterCtx), false);
    assert.equal(clientMatchesListFilter(rows[6], "all", filterCtx), false);
    assert.equal(clientMatchesListFilter(rows[6], "past", filterCtx), false);
    assert.equal(clientMatchesListFilter(rows[6], "coming_up", filterCtx), false);
  });
});

describe("Needs Attention conditions", () => {
  it("uses past-due payment, past-due required tasks, and needs_response — not unread or unsigned contracts", () => {
    const src = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("export async function getClientAttentionFlags"));
    assert.match(fn, /status\.eq\.overdue/);
    assert.match(fn, /is_required/);
    assert.match(fn, /needs_response/);
    assert.doesNotMatch(fn, /venue_unread/);
    assert.doesNotMatch(fn, /from\("contracts"\)/);
  });
});
