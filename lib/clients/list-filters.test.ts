import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLIENT_LIST_FILTERS,
  clientListFilterHref,
  clientMatchesListFilter,
  countClientListFilters,
  parseClientListFilter,
  weddingWeekEnd,
  comingUpHorizonEnd,
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
const WEEK_OUT = weddingWeekEnd(TODAY);
const COMING_UP_OUT = comingUpHorizonEnd(TODAY);

describe("weddingWeekEnd", () => {
  it("is today plus 7 calendar days", () => {
    assert.equal(WEEK_OUT, "2026-09-08");
  });
});

describe("comingUpHorizonEnd", () => {
  it("is today plus 60 calendar days", () => {
    assert.equal(COMING_UP_OUT, "2026-10-31");
  });
});

describe("parseClientListFilter / href", () => {
  it("accepts every canonical key and rejects anything else", () => {
    for (const { key } of CLIENT_LIST_FILTERS) {
      assert.equal(parseClientListFilter(key), key);
      assert.equal(clientListFilterHref(key), `/clients?filter=${key}`);
    }
    assert.equal(parseClientListFilter("confirmed"), null);
    assert.equal(parseClientListFilter(""), null);
    assert.equal(parseClientListFilter(undefined), null);
  });
});

describe("Clients Upcoming — the Dashboard must use this same population", () => {
  const ctx = { today: TODAY, weekOut: WEEK_OUT, comingUpOut: COMING_UP_OUT, attentionClientIds: new Set<string>() };

  it("counts a future Planning booking (Sara Parker, Aug 12 2028)", () => {
    const parker = client({ id: "parker", status: "planning", eventDate: "2028-08-12" });
    assert.equal(clientMatchesListFilter(parker, "upcoming", ctx), true);
    assert.equal(countClientListFilters([parker], ctx).upcoming, 1);
  });

  it("counts Confirmed and Complete future bookings, not only a special confirmed status", () => {
    const rows = [
      client({ id: "c1", status: "planning", eventDate: "2027-01-01" }),
      client({ id: "c2", status: "confirmed", eventDate: "2027-06-01" }),
      client({ id: "c3", status: "complete", eventDate: "2027-12-01" }),
    ];
    assert.equal(countClientListFilters(rows, ctx).upcoming, 3);
  });

  it("does not count cancelled, past, or undated bookings", () => {
    const rows = [
      client({ id: "cancelled", status: "cancelled", eventDate: "2028-08-12" }),
      client({ id: "past", status: "planning", eventDate: "2026-08-31" }),
      client({ id: "undated", status: "planning", eventDate: null }),
    ];
    assert.equal(countClientListFilters(rows, ctx).upcoming, 0);
    assert.equal(countClientListFilters(rows, ctx).cancelled, 1);
    assert.equal(countClientListFilters(rows, ctx).past, 1);
    assert.equal(countClientListFilters(rows, ctx).all, 2);
  });

  it("includes today's event date (Clients uses >= today, not strictly after)", () => {
    const todayEvent = client({ id: "today", status: "planning", eventDate: TODAY });
    assert.equal(clientMatchesListFilter(todayEvent, "upcoming", ctx), true);
  });
});

describe("Dashboard Coming up — 60-day horizon", () => {
  const ctx = { today: TODAY, weekOut: WEEK_OUT, comingUpOut: COMING_UP_OUT, attentionClientIds: new Set<string>() };

  it("includes events within 60 days and excludes farther future bookings", () => {
    const near = client({ id: "near", status: "planning", eventDate: "2026-10-15" });
    const far = client({ id: "far", status: "planning", eventDate: "2028-08-12" });
    assert.equal(clientMatchesListFilter(near, "coming_up", ctx), true);
    assert.equal(clientMatchesListFilter(far, "coming_up", ctx), false);
    const fixture = client({ id: "e2e", status: "planning", eventDate: "2026-10-15", excludeFromBusinessReporting: true });
    assert.equal(clientMatchesListFilter(fixture, "coming_up", ctx), false);
    assert.equal(clientMatchesListFilter(fixture, "upcoming", ctx), true);
  });
});

describe("the other Client list filters stay internally consistent", () => {
  const attention = new Set(["flagged"]);
  const ctx = { today: TODAY, weekOut: WEEK_OUT, comingUpOut: COMING_UP_OUT, attentionClientIds: attention };
  const rows: ClientListFilterRecord[] = [
    client({ id: "parker", status: "planning", eventDate: "2028-08-12" }),
    client({ id: "week", status: "confirmed", eventDate: "2026-09-05" }),
    client({ id: "today", status: "planning", eventDate: TODAY }),
    client({ id: "past", status: "planning", eventDate: "2026-08-01" }),
    client({ id: "flagged", status: "planning", eventDate: "2028-01-01" }),
    client({ id: "cancelled", status: "cancelled", eventDate: "2028-08-12" }),
    client({ id: "undated", status: "planning", eventDate: null }),
  ];
  const counts = countClientListFilters(rows, ctx);

  it("All excludes cancelled only", () => {
    assert.equal(counts.all, 6);
  });

  it("Wedding Week is upcoming within 7 days, including today", () => {
    assert.equal(counts.wedding_week, 2);
    assert.equal(clientMatchesListFilter(rows[1], "wedding_week", ctx), true);
    assert.equal(clientMatchesListFilter(rows[0], "wedding_week", ctx), false);
  });

  it("Needs Attention is the attention-flag set, excluding cancelled", () => {
    assert.equal(counts.needs_attention, 1);
  });

  it("Past is a non-cancelled event date before today", () => {
    assert.equal(counts.past, 1);
  });

  it("Cancelled is status === cancelled, even with a future date", () => {
    assert.equal(counts.cancelled, 1);
  });

  it("Upcoming is every future-or-today non-cancelled dated booking", () => {
    assert.equal(counts.upcoming, 4);
  });
});
