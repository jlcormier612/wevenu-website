import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const view = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const shared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");

describe("calendar usability — times, end date, Day vs Month list", () => {
  it("shows All day on schedule rows that have no clock time", () => {
    assert.match(shared, /!item\.time && isBlock/);
    assert.match(shared, /All day/);
  });

  it("keeps end date from falling before start date when start moves forward", () => {
    assert.match(view, /if \(!blockEnd \|\| blockEnd < next\) setBlockEnd\(next\)/);
  });

  it("labels Agenda as Month list and Day as one day", () => {
    assert.match(view, /label: "Month list"/);
    assert.match(view, /title: "One day"/);
    assert.match(view, /title: "Upcoming list for this month"/);
  });
});
