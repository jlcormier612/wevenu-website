import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const shared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
const view = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const detail = readFileSync(resolve("components/calendar/schedule-item-detail-dialog.tsx"), "utf8");

describe("read-only schedule item details", () => {
  it("opens view from the row body and keeps edit on an explicit control", () => {
    assert.match(shared, /onViewBlock\?: \(blockId: string\) => void/);
    assert.match(shared, /data-testid="schedule-item-view"/);
    assert.match(shared, /data-testid="schedule-item-edit"/);
    assert.match(shared, /onClick=\{\(\) => onViewBlock\(item\.rawId!\)\}/);
    assert.match(shared, /onClick=\{\(\) => onEditBlock\(item\.rawId!\)\}/);
  });

  it("wires view separately from edit in CalendarView", () => {
    assert.match(view, /function handleViewBlock/);
    assert.match(view, /function handleEditBlock/);
    assert.match(view, /onViewBlock=\{handleViewBlock\}/);
    assert.match(view, /ScheduleItemDetailDialog/);
    // Opening view must not open the Schedule Item form.
    const viewFn = view.slice(view.indexOf("function handleViewBlock"), view.indexOf("function handleEditBlock"));
    assert.doesNotMatch(viewFn, /setShowBlockForm\(true\)/);
    assert.match(viewFn, /setViewingBlockId/);
  });

  it("detail dialog offers Edit and workspace navigation without auto-editing", () => {
    assert.match(detail, /data-testid="schedule-item-detail"/);
    assert.match(detail, /data-testid="schedule-item-detail-edit"/);
    assert.match(detail, /Open lead workspace|Open client workspace|Open \$\{/);
    assert.match(detail, /onEdit/);
  });
});
