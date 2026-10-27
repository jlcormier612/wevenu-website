/**
 * Timeline template activities must display/apply in chronological order
 * (earliest → latest), not insertion or raw sort_order alone.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  compareTimelineTemplateItems,
  groupTimelineItemsByDay,
  sortTimelineTemplateItems,
} from "@/lib/timeline-templates/constants";

describe("compareTimelineTemplateItems chronological order", () => {
  it("orders the Corporate 90/60/30-before example earliest to latest", () => {
    const rows = [
      { id: "setup", title: "Set-up", dayOffset: 0, minutesOffset: -90, timeOfDay: null, sortOrder: 0 },
      { id: "guests", title: "Guests Arrive", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 1 },
      { id: "vendor", title: "Vendor Load-in", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 2 },
    ];
    const sorted = sortTimelineTemplateItems(rows);
    assert.deepEqual(
      sorted.map((r) => r.title),
      ["Set-up", "Vendor Load-in", "Guests Arrive"],
    );
  });

  it("places an activity added out of chronological order correctly", () => {
    const existing = [
      { id: "a", dayOffset: 0, minutesOffset: -90, timeOfDay: null, sortOrder: 0 },
      { id: "b", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 1 },
    ];
    const withNew = [
      ...existing,
      { id: "c", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 2 },
    ];
    assert.deepEqual(
      sortTimelineTemplateItems(withNew).map((r) => r.id),
      ["a", "c", "b"],
    );
  });

  it("moves an activity earlier when its timing is edited earlier", () => {
    const before = [
      { id: "a", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 0 },
      { id: "b", dayOffset: 0, minutesOffset: -20, timeOfDay: null, sortOrder: 1 },
      { id: "c", dayOffset: 0, minutesOffset: -10, timeOfDay: null, sortOrder: 2 },
    ];
    const afterEdit = before.map((r) =>
      r.id === "c" ? { ...r, minutesOffset: -45 } : r,
    );
    assert.deepEqual(
      sortTimelineTemplateItems(afterEdit).map((r) => r.id),
      ["c", "a", "b"],
    );
  });

  it("moves an activity later when its timing is edited later", () => {
    const before = [
      { id: "a", dayOffset: 0, minutesOffset: -90, timeOfDay: null, sortOrder: 0 },
      { id: "b", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 1 },
      { id: "c", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 2 },
    ];
    const afterEdit = before.map((r) =>
      r.id === "a" ? { ...r, minutesOffset: -15 } : r,
    );
    assert.deepEqual(
      sortTimelineTemplateItems(afterEdit).map((r) => r.id),
      ["b", "c", "a"],
    );
  });

  it("keeps equal-time activities ordered by sortOrder (intentional tie-break)", () => {
    const rows = [
      { id: "x", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 2 },
      { id: "y", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 0 },
      { id: "z", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 1 },
    ];
    assert.deepEqual(
      sortTimelineTemplateItems(rows).map((r) => r.id),
      ["y", "z", "x"],
    );
  });

  it("keeps intentional drag order among equal-time items when sortOrder is remapped first", () => {
    // Mirrors editor handleDrop: assign sortOrder from drag array index, then chrono-sort.
    const afterDrag = [
      { id: "x", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 2 },
      { id: "y", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 0 },
      { id: "z", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 1 },
    ].map((r, i) => ({ ...r, sortOrder: i }));
    assert.deepEqual(
      sortTimelineTemplateItems(afterDrag).map((r) => r.id),
      ["x", "y", "z"],
    );
  });

  it("rejects drag that would break distinct relative times", () => {
    const afterDrag = [
      { id: "guests", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 0 },
      { id: "setup", dayOffset: 0, minutesOffset: -90, timeOfDay: null, sortOrder: 1 },
      { id: "vendor", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 2 },
    ].map((r, i) => ({ ...r, sortOrder: i }));
    assert.deepEqual(
      sortTimelineTemplateItems(afterDrag).map((r) => r.id),
      ["setup", "vendor", "guests"],
    );
  });

  it("places untimed activities after timed ones on the same day", () => {
    const rows = [
      { id: "u1", dayOffset: 0, minutesOffset: null, timeOfDay: null, sortOrder: 0 },
      { id: "t", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 1 },
      { id: "u2", dayOffset: 0, minutesOffset: null, timeOfDay: null, sortOrder: 2 },
    ];
    const sorted = sortTimelineTemplateItems(rows);
    assert.equal(sorted[0]!.id, "t");
    assert.deepEqual(
      sorted.slice(1).map((r) => r.id),
      ["u1", "u2"],
    );
  });

  it("orders absolute timeOfDay earliest to latest", () => {
    const rows = [
      { id: "c", dayOffset: 0, minutesOffset: null, timeOfDay: "18:00", sortOrder: 0 },
      { id: "a", dayOffset: 0, minutesOffset: null, timeOfDay: "10:00", sortOrder: 1 },
      { id: "b", dayOffset: 0, minutesOffset: null, timeOfDay: "14:30", sortOrder: 2 },
    ];
    assert.deepEqual(
      sortTimelineTemplateItems(rows).map((r) => r.id),
      ["a", "b", "c"],
    );
  });

  it("orders earlier days before later days", () => {
    const rows = [
      { id: "d1", dayOffset: 1, minutesOffset: -30, timeOfDay: null, sortOrder: 0 },
      { id: "d0", dayOffset: 0, minutesOffset: 60, timeOfDay: null, sortOrder: 1 },
      { id: "dm1", dayOffset: -1, minutesOffset: null, timeOfDay: null, sortOrder: 2 },
    ];
    assert.deepEqual(
      sortTimelineTemplateItems(rows).map((r) => r.id),
      ["dm1", "d0", "d1"],
    );
  });

  it("places event_start before event_end on the same day offset", () => {
    const rows = [
      { id: "end", dayOffset: 0, dayAnchor: "event_end" as const, minutesOffset: -10, timeOfDay: null, sortOrder: 0 },
      { id: "start", dayOffset: 0, dayAnchor: "event_start" as const, minutesOffset: 120, timeOfDay: null, sortOrder: 1 },
    ];
    assert.deepEqual(
      sortTimelineTemplateItems(rows).map((r) => r.id),
      ["start", "end"],
    );
  });

  it("groupTimelineItemsByDay keeps chronological order within each day", () => {
    const rows = [
      { title: "Guests Arrive", dayOffset: 0, minutesOffset: -30, timeOfDay: null, sortOrder: 1 },
      { title: "Set-up", dayOffset: 0, minutesOffset: -90, timeOfDay: null, sortOrder: 0 },
      { title: "Vendor Load-in", dayOffset: 0, minutesOffset: -60, timeOfDay: null, sortOrder: 2 },
      { title: "Day-after note", dayOffset: 1, minutesOffset: null, timeOfDay: null, sortOrder: 3 },
    ];
    const groups = groupTimelineItemsByDay(rows);
    assert.equal(groups[0]!.dayOffset, 0);
    assert.deepEqual(
      groups[0]!.items.map((i) => i.title),
      ["Set-up", "Vendor Load-in", "Guests Arrive"],
    );
  });

  it("editor, preview, apply, and repository use chronological sort", () => {
    const editor = readFileSync(
      resolve("components/timeline-templates/timeline-template-editor.tsx"),
      "utf8",
    );
    assert.match(editor, /sortTimelineTemplateItems/);
    assert.match(editor, /Activities with times sort chronologically/);

    const preview = readFileSync(
      resolve("app/(app)/library/timeline-templates/[id]/preview/page.tsx"),
      "utf8",
    );
    assert.match(preview, /groupTimelineItemsByDay/);

    const apply = readFileSync(resolve("lib/timeline-templates/apply.ts"), "utf8");
    assert.match(apply, /sortTimelineTemplateItems/);

    const repo = readFileSync(resolve("lib/timeline-templates/repository.ts"), "utf8");
    assert.match(repo, /sortTimelineTemplateItems/);
    assert.match(repo, /rechronoItems/);

    const service = readFileSync(resolve("lib/timeline-templates/service.ts"), "utf8");
    assert.match(service, /rechronoItems/);

    // Comparator must not prefer title or insertion-only order.
    assert.equal(
      compareTimelineTemplateItems(
        { minutesOffset: -30, sortOrder: 0 },
        { minutesOffset: -60, sortOrder: 99 },
      ) > 0,
      true,
    );
  });
});
