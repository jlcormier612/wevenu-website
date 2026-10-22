import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTimelineTimeForInput,
  normalizeTimelineTimeForSave,
  parseTimelineTimeInput,
} from "@/lib/timeline/time-format";

describe("timeline time format (HTC 12-hour)", () => {
  it("formats stored HH:MM as AM/PM", () => {
    assert.equal(formatTimelineTimeForInput("18:00"), "6:00 PM");
    assert.equal(formatTimelineTimeForInput("00:00"), "12:00 AM");
    assert.equal(formatTimelineTimeForInput("12:00"), "12:00 PM");
    assert.equal(formatTimelineTimeForInput("09:30"), "9:30 AM");
    assert.equal(formatTimelineTimeForInput(""), "");
    assert.equal(formatTimelineTimeForInput(null), "");
  });

  it("parses AM/PM and military into HH:MM without changing meaning", () => {
    assert.equal(parseTimelineTimeInput("6:00 PM"), "18:00");
    assert.equal(parseTimelineTimeInput("6 PM"), "18:00");
    assert.equal(parseTimelineTimeInput("6:00pm"), "18:00");
    assert.equal(parseTimelineTimeInput("12:00 AM"), "00:00");
    assert.equal(parseTimelineTimeInput("12:00 PM"), "12:00");
    assert.equal(parseTimelineTimeInput("12 AM"), "00:00");
    assert.equal(parseTimelineTimeInput("18:00"), "18:00");
    assert.equal(parseTimelineTimeInput("09:05"), "09:05");
    assert.equal(parseTimelineTimeInput(""), "");
    assert.equal(parseTimelineTimeInput("  "), "");
  });

  it("rejects invalid input", () => {
    assert.equal(parseTimelineTimeInput("25:00"), null);
    assert.equal(parseTimelineTimeInput("13:00 PM"), null);
    assert.equal(parseTimelineTimeInput("noon"), null);
    assert.equal(parseTimelineTimeInput("6:60 PM"), null);
  });

  it("round-trips common stored times", () => {
    for (const hhmm of ["00:00", "00:30", "11:59", "12:00", "12:01", "17:45", "23:59"]) {
      const display = formatTimelineTimeForInput(hhmm);
      assert.equal(parseTimelineTimeInput(display), hhmm, `${hhmm} → ${display}`);
    }
  });

  it("normalizeTimelineTimeForSave validates for batch save", () => {
    assert.deepEqual(normalizeTimelineTimeForSave("6:00 PM"), { ok: true, hhmm: "18:00" });
    assert.deepEqual(normalizeTimelineTimeForSave(""), { ok: true, hhmm: "" });
    assert.equal(normalizeTimelineTimeForSave("bad").ok, false);
  });
});
