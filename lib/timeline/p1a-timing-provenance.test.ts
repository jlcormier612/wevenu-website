/**
 * Timeline P1a — provenance, T1/T2/D3/T4 boundaries, and additive apply.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { addDaysToIsoDate } from "@/lib/timeline/constants";
import { reconcileSavedDraftRows } from "@/lib/timeline/draft-save-state";
import { scheduleSyncWriteForExistingRow } from "@/lib/timeline/schedule-sync";
import {
  clockRecalcEligible,
  provenanceFromTemplateApply,
  provenanceFromVenueChoice,
  projectTimingAfterEventDateChange,
  relativeDayOffsetForRecalc,
  timingColumnsForUntypedDisplaySave,
  timingDbColumns,
  type TimingProvenance,
} from "@/lib/timeline/timing-provenance";

function relativeStart(over?: Partial<TimingProvenance>): TimingProvenance {
  return {
    dayIntent: "relative",
    dayAnchor: "event_start",
    relativeDayOffset: 2,
    dayOffsetOverridden: false,
    templateDayOffset: 2,
    templateDayAnchor: "event_start",
    fixedDate: null,
    clockIntent: "explicit",
    relativeMinutes: null,
    clockOverridden: true,
    attention: null,
    ...over,
  };
}

describe("P1a timing provenance", () => {
  it("keeps a fixed calendar date when the wedding start changes (T1)", () => {
    const timing: TimingProvenance = {
      ...relativeStart(),
      dayIntent: "fixed",
      dayAnchor: null,
      relativeDayOffset: null,
      fixedDate: "2028-10-20",
      clockIntent: "explicit",
      clockOverridden: true,
    };
    const projected = projectTimingAfterEventDateChange(
      timing,
      { dayOffset: 15, entryTime: "15:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2028-11-01",
        nextEndDate: "2028-11-03",
        sharedWithCouple: false,
      },
    );
    assert.equal(projected.eligible, true);
    assert.equal(projected.fixedDate, "2028-10-20");
    assert.equal(projected.entryTime, "15:00");
    assert.equal(addDaysToIsoDate(projected.fixedDate!, 0), "2028-10-20");
    assert.equal(addDaysToIsoDate("2028-11-01", projected.dayOffset), "2028-10-20");
  });

  it("keeps a start-anchored relative offset, including a venue adjustment", () => {
    const adjusted = relativeStart({
      relativeDayOffset: 4,
      dayOffsetOverridden: true,
      templateDayOffset: 0,
    });
    assert.equal(relativeDayOffsetForRecalc(adjusted, 4), 4);
    const projected = projectTimingAfterEventDateChange(
      adjusted,
      { dayOffset: 4, entryTime: "11:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2028-10-12",
        nextEndDate: "2028-10-12",
        sharedWithCouple: false,
      },
    );
    assert.equal(projected.dayOffset, 4);
    assert.notEqual(projected.dayOffset, adjusted.templateDayOffset);
    assert.equal(addDaysToIsoDate("2028-10-12", projected.dayOffset), "2028-10-16");
  });

  it("resolves an end-anchored offset from a valid wedding end", () => {
    const applied = provenanceFromTemplateApply({
      dayOffset: -1,
      dayAnchor: "event_end",
      timeOfDay: null,
      minutesOffset: 30,
      eventDate: "2028-10-05",
      eventEndDate: "2028-10-07",
      eventStartTime: "16:00",
    });
    assert.equal(applied.attention, null);
    assert.equal(applied.relativeDayOffset, -1);
    assert.equal(applied.dayOffset, 1);
    assert.equal(applied.clockIntent, "relative");
    assert.equal(applied.relativeMinutes, 30);
    assert.equal(applied.entryTime, "16:30");
    assert.equal(applied.clockOverridden, false);
  });

  it("does not rewrite timing when the wedding end is missing or invalid (T2)", () => {
    const missing = provenanceFromTemplateApply({
      dayOffset: -1,
      dayAnchor: "event_end",
      timeOfDay: "18:00",
      minutesOffset: null,
      eventDate: "2028-10-05",
      eventEndDate: null,
      eventStartTime: "16:00",
      preserveDayOffset: 3,
    });
    assert.equal(missing.attention, "missing_event_end");
    assert.equal(missing.dayOffset, 3);
    assert.equal(missing.relativeDayOffset, -1);
    assert.notEqual(missing.dayOffset, -1);
    assert.equal(missing.entryTime, "18:00");
    assert.equal(missing.clockIntent, "explicit");

    const invalid = projectTimingAfterEventDateChange(
      relativeStart({ dayAnchor: "event_end", relativeDayOffset: 0, templateDayOffset: 0, templateDayAnchor: "event_end" }),
      { dayOffset: 2, entryTime: "12:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2028-10-05",
        nextEndDate: "2028-10-01",
        sharedWithCouple: false,
      },
    );
    assert.equal(invalid.eligible, false);
    assert.equal(invalid.blockedReason, "invalid_event_end");
    assert.equal(invalid.dayOffset, 2);
    assert.equal(invalid.entryTime, "12:00");

    const venueEnd = provenanceFromVenueChoice({
      choice: "relative",
      dayAnchor: "event_end",
      relativeDayOffset: -1,
      templateDayOffset: -1,
      templateDayAnchor: "event_end",
      fixedDate: null,
      eventDate: "2028-10-05",
      eventEndDate: null,
      previousDayOffset: 5,
      clockIntent: "explicit",
      relativeMinutes: null,
      explicitEntryTime: "18:00",
      clockOverridden: true,
    });
    assert.equal(venueEnd.attention, "missing_event_end");
    assert.equal(venueEnd.dayOffset, 5);
    assert.equal(venueEnd.relativeDayOffset, -1);
    assert.equal(venueEnd.entryTime, "18:00");
  });

  it("does not rebake explicit or overridden clocks", () => {
    const explicit = relativeStart({ clockIntent: "explicit", clockOverridden: true, relativeMinutes: 30 });
    assert.equal(clockRecalcEligible(explicit), false);
    const projected = projectTimingAfterEventDateChange(
      explicit,
      { dayOffset: 2, entryTime: "15:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2028-10-20",
        nextEndDate: null,
        sharedWithCouple: false,
      },
    );
    assert.equal(projected.entryTime, "15:00");
    assert.equal(projected.clockRecalcEligible, false);

    const chosen = provenanceFromVenueChoice({
      choice: "relative",
      dayAnchor: "event_start",
      relativeDayOffset: 2,
      templateDayOffset: 2,
      templateDayAnchor: "event_start",
      fixedDate: null,
      eventDate: "2028-10-05",
      eventEndDate: null,
      previousDayOffset: 2,
      clockIntent: "explicit",
      relativeMinutes: null,
      explicitEntryTime: "09:15",
      clockOverridden: true,
    });
    assert.equal(chosen.entryTime, "09:15");
    assert.equal(chosen.clockIntent, "explicit");
    assert.equal(clockRecalcEligible(chosen), false);
  });

  it("leaves unknown legacy intent ineligible (D3)", () => {
    const unknown: TimingProvenance = {
      dayIntent: null,
      dayAnchor: null,
      relativeDayOffset: null,
      dayOffsetOverridden: false,
      templateDayOffset: null,
      templateDayAnchor: null,
      fixedDate: null,
      clockIntent: null,
      relativeMinutes: null,
      clockOverridden: false,
      attention: "unknown_intent",
    };
    const projected = projectTimingAfterEventDateChange(
      unknown,
      { dayOffset: 1, entryTime: "10:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2028-12-01",
        nextEndDate: "2028-12-02",
        sharedWithCouple: false,
      },
    );
    assert.equal(projected.eligible, false);
    assert.equal(projected.blockedReason, "unknown_intent");
    assert.equal(projected.dayOffset, 1);
    assert.equal(projected.entryTime, "10:00");
    assert.equal(projected.fixedDate, null);
    assert.equal(unknown.dayIntent, null);
  });

  it("does not shift an already-shared schedule (T4)", () => {
    const projected = projectTimingAfterEventDateChange(
      relativeStart(),
      { dayOffset: 2, entryTime: "15:00" },
      {
        previousEventDate: "2028-10-05",
        nextEventDate: "2029-01-01",
        nextEndDate: "2029-01-02",
        sharedWithCouple: true,
      },
    );
    assert.equal(projected.eligible, false);
    assert.equal(projected.blockedReason, "shared_schedule");
    assert.equal(projected.dayOffset, 2);
    assert.equal(projected.entryTime, "15:00");
  });

  it("persists provenance columns without inventing a mode for an omitted choice", () => {
    const write = provenanceFromTemplateApply({
      dayOffset: 0,
      dayAnchor: "event_start",
      timeOfDay: null,
      minutesOffset: null,
      eventDate: "2028-10-05",
      eventEndDate: null,
      eventStartTime: null,
    });
    const cols = timingDbColumns(write);
    assert.equal(cols.timing_day_intent, "relative");
    assert.equal(cols.timing_clock_intent, "untimed");
    assert.equal(cols.timing_fixed_date, null);
    assert.equal(cols.entry_time, null);
    assert.equal(cols.day_offset, 0);
    assert.equal("timing_day_intent" in cols, true);
  });
});

describe("P1a setup-editor save without a timing choice", () => {
  it("leaves unknown legacy intent unknown", () => {
    const saved = timingColumnsForUntypedDisplaySave(
      { dayIntent: null, dayAnchor: null, clockIntent: null, dayOffset: 1, entryTime: "10:00" },
      { dayOffset: 3, entryTime: "11:00" },
    );
    assert.equal(saved.dayOffset, 3);
    assert.equal(saved.entryTime, "11:00");
    assert.deepEqual(saved.timingColumns, {});
  });

  it("records a start-anchored relative day override and does not restore the template default", () => {
    const saved = timingColumnsForUntypedDisplaySave(
      { dayIntent: "relative", dayAnchor: "event_start", clockIntent: "explicit", dayOffset: 0, entryTime: "09:00" },
      { dayOffset: 2, entryTime: "09:00" },
    );
    assert.equal(saved.dayOffset, 2);
    assert.equal(saved.timingColumns.timing_relative_day_offset, 2);
    assert.equal(saved.timingColumns.timing_day_offset_overridden, true);
    assert.equal("timing_template_day_offset" in saved.timingColumns, false);
    assert.equal("timing_day_intent" in saved.timingColumns, false);
  });

  it("does not move a fixed date or an end-anchored day", () => {
    const fixed = timingColumnsForUntypedDisplaySave(
      { dayIntent: "fixed", dayAnchor: null, clockIntent: "explicit", dayOffset: 4, entryTime: "15:00" },
      { dayOffset: 9, entryTime: "15:00" },
    );
    assert.equal(fixed.dayOffset, 4);
    assert.deepEqual(fixed.timingColumns, {});

    const endAnchored = timingColumnsForUntypedDisplaySave(
      { dayIntent: "relative", dayAnchor: "event_end", clockIntent: "untimed", dayOffset: 2, entryTime: null },
      { dayOffset: 6, entryTime: null },
    );
    assert.equal(endAnchored.dayOffset, 2);
    assert.equal("timing_relative_day_offset" in endAnchored.timingColumns, false);
  });

  it("stores a clock edit as explicit, not relative", () => {
    const fromRelative = timingColumnsForUntypedDisplaySave(
      { dayIntent: "relative", dayAnchor: "event_start", clockIntent: "relative", dayOffset: 0, entryTime: "16:30" },
      { dayOffset: 0, entryTime: "18:00" },
    );
    assert.equal(fromRelative.entryTime, "18:00");
    assert.equal(fromRelative.timingColumns.timing_clock_intent, "explicit");
    assert.equal(fromRelative.timingColumns.timing_relative_minutes, null);
    assert.notEqual(fromRelative.timingColumns.timing_clock_intent, "relative");

    const fromUntimed = timingColumnsForUntypedDisplaySave(
      { dayIntent: "relative", dayAnchor: "event_start", clockIntent: "untimed", dayOffset: 0, entryTime: null },
      { dayOffset: 0, entryTime: "12:00" },
    );
    assert.equal(fromUntimed.timingColumns.timing_clock_intent, "explicit");
  });

  it("clears a set clock to untimed and keeps a fixed or wedding-end day", () => {
    const clearedFixed = timingColumnsForUntypedDisplaySave(
      { dayIntent: "fixed", dayAnchor: null, clockIntent: "explicit", dayOffset: 4, entryTime: "15:00" },
      { dayOffset: 9, entryTime: null },
    );
    assert.equal(clearedFixed.dayOffset, 4);
    assert.equal(clearedFixed.entryTime, null);
    assert.equal(clearedFixed.timingColumns.timing_clock_intent, "untimed");
    assert.equal(clearedFixed.timingColumns.timing_relative_minutes, null);
    assert.equal("timing_fixed_date" in clearedFixed.timingColumns, false);
    assert.equal("timing_day_intent" in clearedFixed.timingColumns, false);

    const clearedEnd = timingColumnsForUntypedDisplaySave(
      { dayIntent: "relative", dayAnchor: "event_end", clockIntent: "relative", dayOffset: 2, entryTime: "18:00" },
      { dayOffset: 6, entryTime: null },
    );
    assert.equal(clearedEnd.dayOffset, 2);
    assert.equal(clearedEnd.entryTime, null);
    assert.equal(clearedEnd.timingColumns.timing_clock_intent, "untimed");
    assert.equal("timing_relative_day_offset" in clearedEnd.timingColumns, false);
    assert.equal("timing_day_intent" in clearedEnd.timingColumns, false);

    const clearedUnknown = timingColumnsForUntypedDisplaySave(
      { dayIntent: null, dayAnchor: null, clockIntent: null, dayOffset: 1, entryTime: "10:00" },
      { dayOffset: 1, entryTime: null },
    );
    assert.equal(clearedUnknown.entryTime, null);
    assert.deepEqual(clearedUnknown.timingColumns, {});
  });
});

describe("P1a setup editor shows the persisted day", () => {
  it("replaces a rejected fixed or wedding-end day with the saved day", () => {
    const rows = [
      { id: "fixed-1", title: "Ceremony", dayOffset: 9, entryTime: "15:00", isNew: false, dirty: true, pendingRemove: false },
      { id: "end-1", title: "Send-off", dayOffset: 6, entryTime: "", isNew: false, dirty: true, pendingRemove: false },
      { id: "unknown-1", title: "Legacy", dayOffset: 3, entryTime: "11:00", isNew: false, dirty: true, pendingRemove: false },
      { id: "new:1", title: "Added", dayOffset: 1, entryTime: "", isNew: true, dirty: true, pendingRemove: false },
      { id: "gone", title: "Removed", dayOffset: 0, entryTime: "09:00", isNew: false, dirty: false, pendingRemove: true },
    ];
    const next = reconcileSavedDraftRows(rows, {
      createdIds: ["created-1"],
      persisted: [
        { id: "fixed-1", dayOffset: 4, entryTime: "15:00" },
        { id: "end-1", dayOffset: 2, entryTime: null },
        { id: "unknown-1", dayOffset: 3, entryTime: "11:00" },
        { id: "created-1", dayOffset: 1, entryTime: null },
      ],
    });
    const byId = Object.fromEntries(next.map((row) => [row.id, row]));
    assert.equal(byId["fixed-1"]!.dayOffset, 4);
    assert.equal(byId["fixed-1"]!.dirty, false);
    assert.equal(byId["end-1"]!.dayOffset, 2);
    assert.equal(byId["end-1"]!.entryTime, "");
    assert.equal(byId["unknown-1"]!.dayOffset, 3);
    assert.equal(byId["created-1"]!.isNew, false);
    assert.equal(byId["created-1"]!.dayOffset, 1);
    assert.equal(byId["gone"], undefined);
  });
});

describe("P1a boundaries in source", () => {
  const apply = readFileSync(resolve("lib/timeline-templates/apply.ts"), "utf8");
  const inherit = readFileSync(resolve("lib/event-setup/inherit.ts"), "utf8");
  const prepare = readFileSync(resolve("lib/event-setup/prepare-release.ts"), "utf8");
  const migration = readFileSync(
    resolve("supabase/migrations/20261423600000_timeline_timing_provenance.sql"),
    "utf8",
  );
  const exportSql = readFileSync(
    resolve("supabase/migrations/20261423700000_venue_export_timeline_timing.sql"),
    "utf8",
  );
  const draftService = readFileSync(resolve("lib/timeline/service.ts"), "utf8");
  const editor = readFileSync(resolve("components/events/event-timeline-setup-editor.tsx"), "utf8");
  const scheduleSync = readFileSync(resolve("lib/timeline/schedule-sync.ts"), "utf8");
  const eventsDir = readFileSync(resolve("lib/timeline/timing-provenance.ts"), "utf8");
  const timelineView = readFileSync(resolve("components/events/timeline/timeline-view.tsx"), "utf8");
  const entryForm = readFileSync(resolve("components/events/timeline/timeline-entry-form.tsx"), "utf8");

  it("template apply records provenance and does not update the library", () => {
    assert.match(apply, /provenanceFromTemplateApply/);
    assert.match(apply, /timing,/);
    assert.doesNotMatch(apply, /timeline_template_items/);
    assert.doesNotMatch(apply, /from\("timeline_templates"\)\.update/);
  });

  it("inherit and prepare-release stay on additive apply", () => {
    assert.match(inherit, /applyTimelineTemplateToEvent/);
    assert.match(inherit, /entries\.length === 0/);
    assert.doesNotMatch(inherit, /replaceEventTimelineFromTemplate/);
    assert.match(prepare, /applyTimelineTemplateToEvent/);
    assert.match(prepare, /!entries \|\| entries\.length === 0/);
    assert.doesNotMatch(prepare, /replaceEventTimelineFromTemplate/);
  });

  it("migration does not classify legacy rows as relative or fixed", () => {
    assert.match(migration, /unknown_intent/);
    assert.doesNotMatch(migration, /set timing_day_intent = 'relative'/);
    assert.doesNotMatch(migration, /set timing_day_intent = 'fixed'/);
    assert.match(migration, /NULL means legacy intent was not recorded/);
  });

  it("venue export allowlist keeps timing provenance and does not touch couple snapshots", () => {
    const row = exportSql.match(/\('timeline_entries', 'venue_id', '([^']+)'\)/)?.[1] ?? "";
    for (const column of [
      "timing_day_intent",
      "timing_day_anchor",
      "timing_relative_day_offset",
      "timing_day_offset_overridden",
      "timing_template_day_offset",
      "timing_template_day_anchor",
      "timing_fixed_date",
      "timing_clock_intent",
      "timing_relative_minutes",
      "timing_clock_overridden",
      "timing_attention",
      "day_offset",
      "entry_time",
    ]) {
      assert.equal(row.split(",").includes(column), true, column);
    }
    assert.doesNotMatch(exportSql, /get_portal_run_of_show|timeline_submissions/);
  });

  it("Save all does not send a timing choice", () => {
    const fn = draftService.slice(draftService.indexOf("export async function saveEventTimelineDraft"));
    const body = fn.slice(0, fn.indexOf("\nexport async function", 1));
    assert.match(body, /dayOffset: row\.dayOffset/);
    assert.doesNotMatch(body, /timing:/);
    assert.match(body, /persisted/);
    assert.match(editor, /reconcileSavedDraftRows/);
  });

  it("timeline edit form receives persisted timing for unknown and end attention", () => {
    assert.match(timelineView, /timing:\s*entry\.timing/);
    assert.match(entryForm, /timeline-timing-unknown/);
    assert.match(entryForm, /timeline-timing-end-attention/);
    assert.match(entryForm, /timeline-timing-controls/);
  });

  it("schedule sync uses the untyped timing rules and does not invent intent on insert", () => {
    const unknown = scheduleSyncWriteForExistingRow(
      { dayIntent: null, dayAnchor: null, clockIntent: null, dayOffset: 0, entryTime: "18:00" },
      { dayOffset: 1, entryTime: "19:00" },
    );
    assert.equal(unknown.dayOffset, 1);
    assert.equal(unknown.entryTime, "19:00");
    assert.deepEqual(unknown.timingColumns, {});

    const fixed = scheduleSyncWriteForExistingRow(
      { dayIntent: "fixed", dayAnchor: null, clockIntent: "explicit", dayOffset: 0, entryTime: "18:00" },
      { dayOffset: 2, entryTime: "19:00" },
    );
    assert.equal(fixed.dayOffset, 0);
    assert.equal(fixed.entryTime, "19:00");
    assert.equal(fixed.timingColumns.timing_clock_intent, "explicit");
    assert.equal("timing_fixed_date" in fixed.timingColumns, false);
    assert.equal("timing_day_intent" in fixed.timingColumns, false);

    const endAnchored = scheduleSyncWriteForExistingRow(
      { dayIntent: "relative", dayAnchor: "event_end", clockIntent: "explicit", dayOffset: 1, entryTime: "16:00" },
      { dayOffset: 4, entryTime: "16:00" },
    );
    assert.equal(endAnchored.dayOffset, 1);
    assert.deepEqual(endAnchored.timingColumns, {});

    const overridden = scheduleSyncWriteForExistingRow(
      { dayIntent: "relative", dayAnchor: "event_start", clockIntent: "relative", dayOffset: 0, entryTime: "18:00" },
      { dayOffset: 2, entryTime: null },
    );
    assert.equal(overridden.dayOffset, 2);
    assert.equal(overridden.timingColumns.timing_relative_day_offset, 2);
    assert.equal(overridden.timingColumns.timing_day_offset_overridden, true);
    assert.equal("timing_template_day_offset" in overridden.timingColumns, false);
    assert.equal(overridden.timingColumns.timing_clock_intent, "untimed");

    assert.match(scheduleSync, /scheduleSyncWriteForExistingRow/);
    assert.match(scheduleSync, /\.insert\(payload\)/);
    assert.doesNotMatch(scheduleSync, /timing_day_intent:\s*["']relative["']/);
    assert.doesNotMatch(scheduleSync, /projectTimingAfterEventDateChange/);
  });

  it("does not wire automatic date recalculation from this module", () => {
    assert.match(eventsDir, /This function does not write/);
    assert.doesNotMatch(eventsDir, /updateEntry|from\("timeline_entries"\)/);
  });
});
