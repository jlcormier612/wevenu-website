/**
 * Reminder scope is an AND of the filters that are actually set.
 * No database.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { applyReminderScope, type ReminderScope } from "@/lib/notifications/reminder-scope";

type Row = { id: string; venue_id: string };

function filterQuery(rows: Row[]) {
  let current = rows;
  const api = {
    in(column: string, values: string[]) {
      if (column === "id") current = current.filter((row) => values.includes(row.id));
      return api;
    },
    eq(column: string, value: string) {
      if (column === "venue_id") current = current.filter((row) => row.venue_id === value);
      return api;
    },
    rows() {
      return current;
    },
  };
  return api;
}

const rows: Row[] = [
  { id: "r-fancy", venue_id: "fancy" },
  { id: "r-other", venue_id: "other" },
  { id: "r-fancy-2", venue_id: "fancy" },
];

function selected(scope?: ReminderScope) {
  return applyReminderScope(filterQuery(rows), scope).rows().map((row) => row.id);
}

describe("applyReminderScope", () => {
  it("returns every row when neither filter is set", () => {
    assert.deepEqual(selected(), ["r-fancy", "r-other", "r-fancy-2"]);
    assert.deepEqual(selected({}), ["r-fancy", "r-other", "r-fancy-2"]);
  });

  it("keeps only the listed ids", () => {
    assert.deepEqual(selected({ reminderIds: ["r-other"] }), ["r-other"]);
  });

  it("keeps only the venue", () => {
    assert.deepEqual(selected({ venueId: "fancy" }), ["r-fancy", "r-fancy-2"]);
  });

  it("drops an id that belongs to a different venue when both filters are set", () => {
    assert.deepEqual(
      selected({ reminderIds: ["r-fancy", "r-other"], venueId: "fancy" }),
      ["r-fancy"],
    );
  });

  it("treats an empty id list as no id filter", () => {
    assert.deepEqual(selected({ reminderIds: [] }), ["r-fancy", "r-other", "r-fancy-2"]);
    assert.deepEqual(selected({ reminderIds: [], venueId: "other" }), ["r-other"]);
  });
});

describe("reminder processors use the shared AND scope", () => {
  const engine = readFileSync("lib/notifications/engine.ts", "utf8");
  const obligation = readFileSync("lib/notifications/obligation-engine.ts", "utf8");

  it("task, payment, and contract queries call applyReminderScope once each", () => {
    assert.equal((engine.match(/applyReminderScope\(query, scope\)/g) ?? []).length, 1);
    assert.equal((obligation.match(/applyReminderScope\(query, scope\)/g) ?? []).length, 2);
    assert.doesNotMatch(engine, /else if \(scope\?\.venueId\)/);
    assert.doesNotMatch(obligation, /else if \(scope\?\.venueId\)/);
  });

  it("cron and Settings pass no scope, and the QA harness passes ids only", () => {
    const route = readFileSync("app/api/notifications/process/route.ts", "utf8");
    const settings = readFileSync("components/settings/notifications-section.tsx", "utf8");
    const harness = readFileSync("scripts/qa/couple-threading-reminder-processor-verify.mts", "utf8");
    assert.match(route, /processReminders\(\)/);
    assert.match(route, /processObligationReminders\(\)/);
    assert.doesNotMatch(route, /processReminders\(\s*\{/);
    assert.match(settings, /fetch\("\/api\/notifications\/process"/);
    assert.doesNotMatch(settings, /reminderIds/);
    assert.doesNotMatch(settings, /venueId/);
    assert.match(harness, /reminderIds:/);
    assert.doesNotMatch(harness, /venueId:/);
  });
});
