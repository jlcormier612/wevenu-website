import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRelativeToScheduleStart,
  formatTemplateDayLabelClear,
  minutesFromRelativeForm,
  previewRelativeClock,
  relativeFormFromMinutes,
  summarizeTemplateItemTiming,
  templateHasConflictingTiming,
  timingModeFromTemplateFields,
} from "@/lib/timeline/timing-presentation";
import { resolveEntryTimeFromOffset } from "@/lib/timeline/constants";

describe("timeline timing presentation", () => {
  it("labels template days relative to event date without inventing ceremony days", () => {
    assert.equal(formatTemplateDayLabelClear(0), "Day 1 — event date");
    assert.equal(formatTemplateDayLabelClear(1), "Day 2 — day after event date");
    assert.match(formatTemplateDayLabelClear(2), /Day 3/);
  });

  it("names Day-of schedule start in relative phrases", () => {
    assert.equal(formatRelativeToScheduleStart(0), "At Day-of schedule start");
    assert.equal(formatRelativeToScheduleStart(-30), "30 minutes before Day-of schedule start");
    assert.equal(formatRelativeToScheduleStart(15), "15 minutes after Day-of schedule start");
  });

  it("round-trips before/after form to minutesOffset", () => {
    assert.equal(minutesFromRelativeForm("before", 30), -30);
    assert.equal(minutesFromRelativeForm("after", 15), 15);
    assert.equal(minutesFromRelativeForm("at", 99), 0);
    assert.deepEqual(relativeFormFromMinutes(-30), { direction: "before", minutes: 30 });
  });

  it("defaults to specific mode; flags legacy dual timing", () => {
    assert.equal(timingModeFromTemplateFields("15:00", null), "specific");
    assert.equal(timingModeFromTemplateFields(null, -30), "relative");
    assert.equal(timingModeFromTemplateFields(null, null), "untimed");
    assert.equal(templateHasConflictingTiming("15:00", -30), true);
    assert.match(summarizeTemplateItemTiming({ timeOfDay: "15:00", minutesOffset: -30 }) ?? "", /review/i);
  });

  it("preview refuses to invent a clock when schedule start is missing", () => {
    const missing = previewRelativeClock(-30, null);
    assert.equal(missing.clock, null);
    assert.match(missing.label, /Set Day-of schedule start/i);
    assert.equal(resolveEntryTimeFromOffset(-30, null), null);

    const known = previewRelativeClock(-30, "16:00");
    assert.equal(known.clock, "15:30");
    assert.match(known.label, /3:30\s*PM/i);
  });
});
