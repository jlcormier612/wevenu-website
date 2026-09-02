import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const picker = readFileSync(resolve("components/calendar/schedule-relation-picker.tsx"), "utf8");
const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const calendarPage = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");

describe("ScheduleRelationPicker — searchable, not an unbounded list", () => {
  it("labels the search box exactly as specified", () => {
    assert.match(picker, /placeholder="Search leads and clients…"/);
  });

  it("searches through the server action, never fetching every lead/client up front", () => {
    assert.match(picker, /searchScheduleRelationOptionsAction/);
    assert.doesNotMatch(picker, /getScheduleRelationOptions\(\)/);
  });

  it("groups results into Leads and Clients", () => {
    assert.match(picker, /groupScheduleRelationOptions/);
  });

  it("shows the exact no-results copy", () => {
    assert.match(picker, /No leads or clients found\./);
  });

  it("preserves \"Not related to anyone\" as an explicit, always-available option", () => {
    assert.match(picker, /Not related to anyone/);
  });

  it("selecting a result populates the field and closes the picker", () => {
    assert.match(picker, /function handleSelect\(option: ScheduleRelationOption\) \{\s*onChange\(option\);\s*closePicker\(\);/);
  });

  it("clearing the relation calls onChange(null) and closes the picker", () => {
    assert.match(picker, /function handleClearRelation\(\) \{\s*onChange\(null\);\s*closePicker\(\);/);
  });

  it("the trigger always shows a way back into the picker to change the selection", () => {
    // The clear (X) affordance only appears once something is selected...
    assert.match(picker, /aria-label="Clear related-to"/);
    // ...and the trigger button itself remains clickable to reopen/search again.
    assert.match(picker, /onClick=\{\(\) => \(open \? closePicker\(\) : openPicker\(\)\)\}/);
  });
});

describe("Calendar's Add/Edit Schedule Item form uses the searchable picker", () => {
  it("renders ScheduleRelationPicker instead of the old unbounded Select", () => {
    assert.match(calendarView, /<ScheduleRelationPicker value=\{blockRelatedTo\} onChange=\{setBlockRelatedTo\} \/>/);
  });

  it("no longer receives a preloaded relationOptions list", () => {
    assert.doesNotMatch(calendarView, /relationOptions/);
  });

  it("pre-populates \"Related to\" from an existing item's relationship instead of making the user search again", () => {
    assert.match(calendarView, /getScheduleRelationOptionAction\("lead", block\.leadId\)/);
    assert.match(calendarView, /getScheduleRelationOptionAction\("client", block\.clientId\)/);
  });
});

describe("Calendar page no longer preloads every Lead/Client for the form", () => {
  it("does not call the removed unbounded getScheduleRelationOptions", () => {
    assert.doesNotMatch(calendarPage, /getScheduleRelationOptions/);
  });
});
