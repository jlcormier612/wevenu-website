import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatRelativeToScheduleStart,
  formatTemplateDayLabelClear,
  minutesFromRelativeForm,
  previewRelativeClock,
  relativeFormFromMinutes,
  resolveTemplateDayToEventOffset,
  summarizeTemplateItemTiming,
  templateHasConflictingTiming,
  timingModeFromTemplateFields,
} from "@/lib/timeline/timing-presentation";
import {
  clampDayOffset,
  formatEventDayOptionLabel,
  resolveEntryTimeFromOffset,
  timelineDayOptions,
} from "@/lib/timeline/constants";

describe("timeline timing presentation", () => {
  it("labels template days with explicit start/end anchors and signed offsets", () => {
    assert.equal(formatTemplateDayLabelClear(0, "event_start"), "Day 1 — event start date");
    assert.equal(formatTemplateDayLabelClear(-2, "event_start"), "2 days before event start");
    assert.equal(formatTemplateDayLabelClear(2, "event_start"), "2 days after event start");
    assert.equal(formatTemplateDayLabelClear(0, "event_end"), "On the event’s last day");
    assert.equal(formatTemplateDayLabelClear(-1, "event_end"), "1 day before event end");
    assert.equal(formatTemplateDayLabelClear(1, "event_end"), "1 day after event end");
  });

  it("resolves event-end anchors against a multi-day span without inventing an end", () => {
    assert.equal(
      resolveTemplateDayToEventOffset(0, "event_end", "2028-10-05", "2028-10-07"),
      2,
    );
    assert.equal(
      resolveTemplateDayToEventOffset(-1, "event_end", "2028-10-05", "2028-10-07"),
      1,
    );
    assert.equal(
      resolveTemplateDayToEventOffset(1, "event_end", "2028-10-05", "2028-10-07"),
      3,
    );
    // Missing / invalid end → fall back to start-relative offset (no invented end).
    assert.equal(
      resolveTemplateDayToEventOffset(-1, "event_end", "2028-10-05", null),
      -1,
    );
    assert.equal(
      resolveTemplateDayToEventOffset(0, "event_start", "2028-10-05", "2028-10-07"),
      0,
    );
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

  it("clamps signed day offsets with a planning pad and never invents an end date", () => {
    assert.equal(clampDayOffset(-2, "2028-10-05", null), -2);
    assert.equal(clampDayOffset(-20, "2028-10-05", null), -14);
    assert.equal(clampDayOffset(20, "2028-10-05", null), 14);
    assert.equal(clampDayOffset(3, "2028-10-05", "2028-10-07"), 3);
    assert.equal(clampDayOffset(20, "2028-10-05", "2028-10-07"), 16); // spanMax 2 + pad 14
  });

  it("builds event day options with before/during/after labels", () => {
    const opts = timelineDayOptions("2028-10-05", "2028-10-06", { padBefore: 2, padAfter: 1 });
    assert.deepEqual(
      opts.map((o) => o.value),
      [-2, -1, 0, 1, 2],
    );
    assert.match(opts[0]!.label, /2 days before/i);
    assert.match(opts[2]!.label, /Day 1 ·/);
    assert.match(opts[3]!.label, /Day 2 ·/);
    assert.match(opts[4]!.label, /1 day after/i);

    const single = formatEventDayOptionLabel("2028-10-05", 0, null);
    assert.match(single.label, /Day 1 ·/);
  });
});
