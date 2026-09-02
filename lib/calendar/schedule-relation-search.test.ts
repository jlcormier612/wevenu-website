import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupScheduleRelationOptions,
  hasScheduleRelationResults,
  scheduleRelationOptionKey,
  scheduleRelationRowMatchesQuery,
  scheduleRelationSubtitle,
  toScheduleRelationOption,
  type ScheduleRelationRow,
} from "@/lib/calendar/schedule-relation-search";

function row(overrides: Partial<ScheduleRelationRow> = {}): ScheduleRelationRow {
  return {
    id: "r1",
    first_name: "Sara",
    last_name: "Parker",
    partner_first_name: "Peter",
    partner_last_name: "Parker",
    email: "sara@example.com",
    event_type: "wedding",
    event_date: "2028-08-12",
    ...overrides,
  };
}

describe("searching leads", () => {
  it("matches a lead row by first name", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row(), "sara"), true);
  });

  it("matches a lead row by partner name, case-insensitively", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row(), "PETER"), true);
  });

  it("matches a lead row by email", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row(), "sara@example"), true);
  });

  it("does not match an unrelated query", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row(), "Nguyen"), false);
  });

  it("maps a lead row into a lead-kind option with its couple name", () => {
    const option = toScheduleRelationOption("lead", row());
    assert.equal(option.kind, "lead");
    assert.equal(option.name, "Sara Parker & Peter Parker");
  });
});

describe("searching clients", () => {
  it("matches a client row by last name", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row({ last_name: "Nguyen" }), "nguyen"), true);
  });

  it("blank query never matches", () => {
    assert.equal(scheduleRelationRowMatchesQuery(row(), ""), false);
    assert.equal(scheduleRelationRowMatchesQuery(row(), "   "), false);
  });

  it("maps a client row into a client-kind option with its couple name", () => {
    const option = toScheduleRelationOption("client", row({ id: "c1" }));
    assert.equal(option.kind, "client");
    assert.equal(option.id, "c1");
    assert.equal(option.name, "Sara Parker & Peter Parker");
  });

  it("falls back to a single name when there is no partner", () => {
    const option = toScheduleRelationOption("client", row({ partner_first_name: null, partner_last_name: null }));
    assert.equal(option.name, "Sara Parker");
  });
});

describe("scheduleRelationSubtitle — enough context to tell same-named couples apart", () => {
  it("combines event type and date", () => {
    assert.equal(
      scheduleRelationSubtitle({ eventType: "wedding", eventDate: "2028-08-12" }),
      "Wedding · Aug 12, 2028",
    );
  });

  it("falls back to just the event type when there is no date yet", () => {
    assert.equal(scheduleRelationSubtitle({ eventType: "wedding", eventDate: null }), "Wedding");
  });

  it("falls back to just the date when there is no event type", () => {
    assert.equal(scheduleRelationSubtitle({ eventType: null, eventDate: "2028-08-12" }), "Aug 12, 2028");
  });

  it("is null when neither is known", () => {
    assert.equal(scheduleRelationSubtitle({ eventType: null, eventDate: null }), null);
  });
});

describe("grouping results — LEADS / CLIENTS", () => {
  const lead = toScheduleRelationOption("lead", row({ id: "l1" }));
  const client = toScheduleRelationOption("client", row({ id: "c1" }));

  it("always returns a Leads group and a Clients group, in that order", () => {
    const groups = groupScheduleRelationOptions([lead], [client]);
    assert.deepEqual(groups.map((g) => g.label), ["Leads", "Clients"]);
    assert.deepEqual(groups[0]!.options, [lead]);
    assert.deepEqual(groups[1]!.options, [client]);
  });

  it("no-results state — hasScheduleRelationResults is false when both groups are empty", () => {
    assert.equal(hasScheduleRelationResults(groupScheduleRelationOptions([], [])), false);
  });

  it("hasScheduleRelationResults is true when at least one group has a match", () => {
    assert.equal(hasScheduleRelationResults(groupScheduleRelationOptions([], [client])), true);
  });
});

describe("scheduleRelationOptionKey — the composite id the schedule-item payload uses", () => {
  it("distinguishes a lead and a client that happen to share an id", () => {
    assert.equal(scheduleRelationOptionKey({ kind: "lead", id: "1" }), "lead:1");
    assert.equal(scheduleRelationOptionKey({ kind: "client", id: "1" }), "client:1");
  });
});
