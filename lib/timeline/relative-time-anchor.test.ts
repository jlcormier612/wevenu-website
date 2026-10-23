/**
 * Relative Time (template minutesOffset) resolves against events.start_time
 * at apply time — not ceremony/reception/getting-ready space-use times.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEntryTimeFromOffset } from "@/lib/timeline/constants";

describe("timeline relative-time anchor (events.start_time)", () => {
  const EVENT_START = "16:00"; // day-of Start time on the event
  const CEREMONY = "16:00";
  const RECEPTION = "18:00";
  const GETTING_READY = "10:00";

  it("offsets resolve from event start, not reception or getting-ready", () => {
    assert.equal(resolveEntryTimeFromOffset(-60, EVENT_START), "15:00");
    assert.equal(resolveEntryTimeFromOffset(0, EVENT_START), "16:00");
    assert.equal(resolveEntryTimeFromOffset(30, EVENT_START), "16:30");
    assert.equal(resolveEntryTimeFromOffset(120, EVENT_START), "18:00");
    // Prove reception/getting-ready are NOT the anchor used by this helper
    assert.notEqual(resolveEntryTimeFromOffset(0, GETTING_READY), resolveEntryTimeFromOffset(0, EVENT_START));
    assert.notEqual(resolveEntryTimeFromOffset(0, RECEPTION), resolveEntryTimeFromOffset(0, EVENT_START));
    assert.equal(CEREMONY, EVENT_START); // coincidence in this fixture; still not a separate field
  });

  it("null event start falls back to noon (12:00), not ceremony times", () => {
    assert.equal(resolveEntryTimeFromOffset(0, null), "12:00");
    assert.equal(resolveEntryTimeFromOffset(-30, null), "11:30");
    assert.equal(resolveEntryTimeFromOffset(60, null), "13:00");
  });

  it("out-of-day offsets return null (no wrap inventing next day)", () => {
    assert.equal(resolveEntryTimeFromOffset(-17 * 60, "16:00"), null);
    assert.equal(resolveEntryTimeFromOffset(10 * 60, "16:00"), null);
  });

  it("documents timeOfDay precedence: apply prefers fixed clock over offset", () => {
    // apply.ts: entryTime = item.timeOfDay ?? resolveEntryTimeFromOffset(...)
    const timeOfDay = "14:30";
    const fromOffset = resolveEntryTimeFromOffset(30, EVENT_START);
    const applied = timeOfDay ?? fromOffset;
    assert.equal(applied, "14:30");
    assert.equal(fromOffset, "16:30");
  });
});
