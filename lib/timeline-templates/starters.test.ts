/**
 * Starter Timeline Templates — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveEntryTimeFromOffset, TIMELINE_TEMPLATES } from "@/lib/timeline/constants";
import {
  STANDARD_WEDDING_DAY_TITLES,
  TIMELINE_STARTER_MASTERS,
  getBookingPickerStarters,
  getTimelineStarterMaster,
  shouldSkipTimelineStarterProvision,
} from "@/lib/timeline-templates/starters";

const CLOCK_PATTERNS = [
  /\d{1,2}:\d{2}/,
  /\d{1,2}\s*(AM|PM)/i,
  /o'?clock/i,
];

describe("Starter Timeline masters", () => {
  it("ships TL-01 / TL-02 / TL-03 with customer-facing names", () => {
    assert.equal(TIMELINE_STARTER_MASTERS.length, 3);
    assert.equal(getTimelineStarterMaster("TL-01")!.name, "Standard Wedding Day Timeline");
    assert.equal(getTimelineStarterMaster("TL-02")!.name, "Reception Only Timeline");
    assert.equal(getTimelineStarterMaster("TL-03")!.name, "Wedding Weekend Timeline");
  });

  it("does not invent clock times on any starter activity", () => {
    for (const master of TIMELINE_STARTER_MASTERS) {
      for (const item of master.items) {
        for (const pat of CLOCK_PATTERNS) {
          assert.doesNotMatch(item.title, pat, `${master.key}: ${item.title}`);
          if (item.description) assert.doesNotMatch(item.description, pat);
        }
      }
    }
    for (const picker of getBookingPickerStarters()) {
      for (const entry of picker.entries) {
        assert.equal(entry.minutesOffset, null, picker.id);
      }
    }
    for (const t of TIMELINE_TEMPLATES) {
      for (const e of t.entries) {
        assert.equal(e.minutesOffset, null, t.id);
      }
    }
  });

  it("Wedding Weekend uses dayOffset 0 / 1 / 2 with Standard Wedding Day on offset 1", () => {
    const weekend = getTimelineStarterMaster("TL-03")!;
    const offsets = new Set(weekend.items.map((i) => i.dayOffset));
    assert.deepEqual([...offsets].sort(), [0, 1, 2]);

    const dayBefore = weekend.items.filter((i) => i.dayOffset === 0);
    const weddingDay = weekend.items.filter((i) => i.dayOffset === 1);
    const dayAfter = weekend.items.filter((i) => i.dayOffset === 2);

    assert.ok(dayBefore.length >= 4);
    assert.ok(dayAfter.length >= 3);
    assert.deepEqual(
      weddingDay.map((i) => i.title),
      [...STANDARD_WEDDING_DAY_TITLES],
    );

    const single = getTimelineStarterMaster("TL-01")!;
    assert.ok(single.items.every((i) => i.dayOffset === 0));
  });

  it("Reception Only omits ceremony seating / begins (on-site ceremony)", () => {
    const reception = getTimelineStarterMaster("TL-02")!;
    const titles = reception.items.map((i) => i.title);
    assert.equal(titles.includes("Ceremony Begins"), false);
    assert.equal(titles.includes("Ceremony Seating"), false);
    assert.ok(titles.includes("Reception Begins"));
  });
});

describe("Timeline starter provision skip rules", () => {
  it("skips when source_master_key already exists (idempotent)", () => {
    assert.equal(
      shouldSkipTimelineStarterProvision({
        masterKey: "TL-01",
        masterName: "Standard Wedding Day Timeline",
        existingByKey: new Set(["TL-01"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
  });

  it("skips same-named customized templates (never overwrite)", () => {
    assert.equal(
      shouldSkipTimelineStarterProvision({
        masterKey: "TL-01",
        masterName: "Standard Wedding Day Timeline",
        existingByKey: new Set(),
        existingNames: new Set(["Standard Wedding Day Timeline"]),
      }),
      "skip_name",
    );
  });

  it("creates when key and name are free", () => {
    assert.equal(
      shouldSkipTimelineStarterProvision({
        masterKey: "TL-02",
        masterName: "Reception Only Timeline",
        existingByKey: new Set(["TL-01"]),
        existingNames: new Set(["Standard Wedding Day Timeline"]),
      }),
      "create",
    );
  });
});

describe("Apply without inventing times", () => {
  it("returns null entry time when minutesOffset is null", () => {
    assert.equal(resolveEntryTimeFromOffset(null, "16:00"), null);
    assert.equal(resolveEntryTimeFromOffset(undefined, "16:00"), null);
  });

  it("still resolves explicit relative offsets when present", () => {
    assert.equal(resolveEntryTimeFromOffset(0, "16:00"), "16:00");
    assert.equal(resolveEntryTimeFromOffset(60, "16:00"), "17:00");
    assert.equal(resolveEntryTimeFromOffset(-60, "16:00"), "15:00");
  });

  it("booking-picker starters align with master keys and weekend dayOffsets", () => {
    const starters = getBookingPickerStarters();
    assert.deepEqual(starters.map((s) => s.id), ["TL-01", "TL-02", "TL-03"]);
    const weekend = starters.find((s) => s.id === "TL-03")!;
    assert.ok(weekend.entries.some((e) => e.dayOffset === 0));
    assert.ok(weekend.entries.some((e) => e.dayOffset === 1));
    assert.ok(weekend.entries.some((e) => e.dayOffset === 2));
  });
});
