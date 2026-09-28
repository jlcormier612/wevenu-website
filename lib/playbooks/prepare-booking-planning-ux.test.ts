import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
} from "@/lib/playbooks/constants";

describe("Prepare Booking / Planning UX — single checklist entry + pre-book Apply", () => {
  it("pre-book prepare workspace mounts Checklists only — not PreparePlanningPanel", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
    // The !linkedEventId prepare branch must not stack the duplicate panel.
    assert.doesNotMatch(page, /PreparePlanningPanel/);
    assert.match(page, /Checklists/);
    assert.match(page, /EventTaskList/);
  });

  it("booking celebration may still surface PreparePlanningPanel (no Checklists list there)", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /PreparePlanningPanel/);
    assert.doesNotMatch(celebration, /EventTaskList/);
  });

  it("PlaybookApplyPreviewSheet enables Apply for clientId + eventDate (pre-book)", () => {
    const sheet = readFileSync(resolve("components/playbooks/playbook-apply-preview-sheet.tsx"), "utf8");
    assert.match(sheet, /applyEnabled = canApply && !!eventDate && \(!!eventId \|\| !!clientId\)/);
    assert.match(sheet, /applyPlaybookToClientAction/);
    assert.match(sheet, /applyPlaybookAction/);
    // Preview load path does not call apply.
    const effect = sheet.slice(sheet.indexOf("React.useEffect"), sheet.indexOf("function handleApply"));
    assert.match(effect, /getPlaybookApplyPreviewAction/);
    assert.doesNotMatch(effect, /applyPlaybook/);
  });

  it("canonical Checklists row passes clientId into the preview sheet for pre-book apply", () => {
    const list = readFileSync(resolve("components/playbooks/event-task-list.tsx"), "utf8");
    const start = list.indexOf("<PlaybookApplyPreviewSheet");
    assert.ok(start >= 0);
    const sheetMount = list.slice(start, start + 350);
    assert.match(sheetMount, /clientId=\{clientId \?\? undefined\}/);
    assert.match(sheetMount, /eventId=\{eventId \|\| undefined\}/);
  });

  it("Client Planning starter content stays 3/8 with no Booking/contract/package tasks", () => {
    assert.deepEqual(
      STANDARD_CLIENT_PLANNING_MILESTONES.map((m) => m.name),
      ["Planning", "Final Details", "After Your Day"],
    );
    const titles = STANDARD_CLIENT_PLANNING_TASKS.map((t) => t.title);
    assert.equal(titles.length, 8);
    assert.ok(!titles.includes("Sign your contract"));
    assert.ok(!titles.includes("Choose your package"));
    assert.ok(!STANDARD_CLIENT_PLANNING_MILESTONES.some((m) => m.name === "Booking"));
  });

  it("empty TimelineView mounts exactly one TemplatePicker with Add First Entry", () => {
    const view = readFileSync(resolve("components/events/timeline/timeline-view.tsx"), "utf8");
    const emptyStart = view.indexOf("if (totalCount === 0 && sections.length === 0");
    assert.ok(emptyStart >= 0);
    const afterEmpty = view.indexOf("return (\n    <div className=\"space-y-4\">\n      <TimelineSummaryBar itemCount={totalCount}", emptyStart);
    assert.ok(afterEmpty > emptyStart);
    const emptyBranch = view.slice(emptyStart, afterEmpty);
    const pickerCount = (emptyBranch.match(/<TemplatePicker/g) ?? []).length;
    assert.equal(pickerCount, 1, `expected 1 TemplatePicker in empty state, found ${pickerCount}`);
    assert.match(emptyBranch, /Add First Entry/);
    assert.doesNotMatch(emptyBranch, /flex items-center justify-end/);
  });

  it("populated TimelineView retains a toolbar TemplatePicker", () => {
    const view = readFileSync(resolve("components/events/timeline/timeline-view.tsx"), "utf8");
    const populated = view.slice(view.indexOf("{/* Toolbar */}"));
    assert.match(populated, /<TemplatePicker/);
    assert.match(populated, /existingEntryCount=\{totalCount\}/);
  });

  it("TemplatePicker still wires library and starter apply paths", () => {
    const picker = readFileSync(resolve("components/events/timeline/template-picker.tsx"), "utf8");
    assert.match(picker, /applyTimelineTemplateAction/);
    assert.match(picker, /applyClientTimelineTemplateAction/);
    assert.match(picker, /applyTemplateAction/);
    assert.match(picker, /applyClientStarterTimelineAction/);
    assert.match(picker, /existingEntryCount/);
  });
});
