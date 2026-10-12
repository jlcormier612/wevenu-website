/**
 * Edit event must not wipe booked component schedule dates/times.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const editPage = readFileSync(resolve("app/(app)/events/[id]/edit/page.tsx"), "utf8");
const service = readFileSync(resolve("lib/events/service.ts"), "utf8");
const editForm = readFileSync(resolve("components/events/event-edit-form.tsx"), "utf8");
const scheduleDialog = readFileSync(
  resolve("components/events/edit-booking-schedule-dialog.tsx"),
  "utf8",
);

describe("Edit event preserves component schedule", () => {
  it("loads full assignment schedule fields into EventEditForm initial state", () => {
    assert.match(editPage, /initialAssignments=\{assignments\.map/);
    assert.match(editPage, /startTime:\s*a\.startTime/);
    assert.match(editPage, /endTime:\s*a\.endTime/);
    assert.match(editPage, /scheduledDate:\s*a\.scheduledDate/);
  });

  it("updateEvent_ merges omitted schedule fields before replace", () => {
    const updateFn = service.slice(
      service.indexOf("export async function updateEvent_"),
      service.indexOf("export async function updateEventStatus_"),
    );
    assert.match(updateFn, /preserveOmittedComponentScheduleFields/);
    assert.match(updateFn, /getEventSpaceAssignments/);
    assert.match(updateFn, /replaceEventSpaceAssignments/);
  });

  it("Edit event still submits through updateEventAction; Edit schedule stays separate", () => {
    assert.match(editForm, /updateEventAction/);
    assert.match(scheduleDialog, /saveEventSpaceAssignmentsAction/);
    assert.match(scheduleDialog, /Edit schedule/);
  });
});
