/**
 * Timeline display must stay chronological by entry_time (earliest → latest).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { compareTimelineEntries } from "@/lib/timeline/constants";

describe("compareTimelineEntries chronological order", () => {
  it("orders timed entries earliest to latest on the same day", () => {
    const rows = [
      { dayOffset: 0, entryTime: "18:00", sortOrder: 0 },
      { dayOffset: 0, entryTime: "10:00", sortOrder: 5 },
      { dayOffset: 0, entryTime: "14:30", sortOrder: 1 },
    ];
    const sorted = [...rows].sort(compareTimelineEntries);
    assert.deepEqual(
      sorted.map((r) => r.entryTime),
      ["10:00", "14:30", "18:00"],
    );
  });

  it("places an entry edited earlier ahead of former neighbors", () => {
    const before = [
      { id: "a", dayOffset: 0, entryTime: "12:00", sortOrder: 0 },
      { id: "b", dayOffset: 0, entryTime: "15:00", sortOrder: 1 },
      { id: "c", dayOffset: 0, entryTime: "17:00", sortOrder: 2 },
    ];
    const afterEdit = before.map((r) =>
      r.id === "c" ? { ...r, entryTime: "11:00" } : r,
    );
    const sorted = [...afterEdit].sort(compareTimelineEntries);
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["c", "a", "b"],
    );
  });

  it("places an entry edited later after former neighbors", () => {
    const before = [
      { id: "a", dayOffset: 0, entryTime: "10:00", sortOrder: 0 },
      { id: "b", dayOffset: 0, entryTime: "12:00", sortOrder: 1 },
      { id: "c", dayOffset: 0, entryTime: "14:00", sortOrder: 2 },
    ];
    const afterEdit = before.map((r) =>
      r.id === "a" ? { ...r, entryTime: "16:00" } : r,
    );
    const sorted = [...afterEdit].sort(compareTimelineEntries);
    assert.deepEqual(
      sorted.map((r) => r.id),
      ["b", "c", "a"],
    );
  });

  it("keeps equal-time entries ordered by sortOrder then createdAt", () => {
    const rows = [
      { dayOffset: 0, entryTime: "12:00", sortOrder: 2, createdAt: "2026-01-01T00:00:02Z" },
      { dayOffset: 0, entryTime: "12:00", sortOrder: 0, createdAt: "2026-01-01T00:00:01Z" },
      { dayOffset: 0, entryTime: "12:00", sortOrder: 1, createdAt: "2026-01-01T00:00:00Z" },
    ];
    const sorted = [...rows].sort(compareTimelineEntries);
    assert.deepEqual(
      sorted.map((r) => r.sortOrder),
      [0, 1, 2],
    );
  });

  it("places untimed entries after timed ones on the same day", () => {
    const rows = [
      { dayOffset: 0, entryTime: null, sortOrder: 0 },
      { dayOffset: 0, entryTime: "09:00", sortOrder: 1 },
      { dayOffset: 0, entryTime: null, sortOrder: 2 },
    ];
    const sorted = [...rows].sort(compareTimelineEntries);
    assert.equal(sorted[0]!.entryTime, "09:00");
    assert.equal(sorted[1]!.entryTime, null);
    assert.equal(sorted[2]!.entryTime, null);
  });

  it("venue Timeline view and document use compareTimelineEntries for display", () => {
    const view = readFileSync(resolve("components/events/timeline/timeline-view.tsx"), "utf8");
    assert.match(view, /import \{ compareTimelineEntries \}/);
    assert.match(view, /list\.sort\(compareTimelineEntries\)/);
    assert.doesNotMatch(
      view,
      /for \(const \[, list\] of map\) list\.sort\(\(a, b\) => a\.sortOrder - b\.sortOrder\)/,
    );

    const doc = readFileSync(resolve("components/events/timeline/timeline-document.tsx"), "utf8");
    assert.match(doc, /list\.sort\(compareTimelineEntries\)/);

    const setup = readFileSync(resolve("components/events/event-timeline-setup-editor.tsx"), "utf8");
    assert.match(setup, /\.sort\(compareTimelineEntries\)/);
  });
});
