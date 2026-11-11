import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("event space assignment scheduledDate persistence", () => {
  const source = readFileSync(new URL("./space-assignments.ts", import.meta.url), "utf8");

  it("loads scheduled_date into scheduledDate", () => {
    assert.match(source, /scheduled_date/);
    assert.match(source, /scheduledDate:\s*r\.scheduled_date/);
  });

  it("writes scheduledDate through replace_event_space_assignments", () => {
    const replace = source.slice(source.indexOf("replaceEventSpaceAssignments"));
    assert.match(replace, /scheduledDate:\s*a\.scheduledDate/);
    assert.match(replace, /replace_event_space_assignments/);
  });

  it("timed editor materializes missing scheduledDate into state before submit", () => {
    const editor = readFileSync(resolve("components/events/event-space-assignments-editor.tsx"), "utf8");
    assert.match(editor, /materializeMissingScheduledDates/);
    assert.doesNotMatch(
      editor,
      /scheduledDate = \(current\?\.scheduledDate \?\? ""\)\.trim\(\)\s*\|\|\s*\(withTimes && currentSpace \? eventDate : ""\)/,
    );
  });

  it("booking summary exposes Edit schedule for booked events", () => {
    const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    assert.match(detail, /data-testid="edit-booking-schedule"/);
    assert.match(detail, /EditBookingScheduleDialog/);
  });

  it("booking workspace passes scheduleComponents into EventDetail", () => {
    const page = readFileSync(
      new URL("../../app/(app)/clients/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /scheduleComponents=\{scheduleComponents\}/);
    assert.match(page, /scheduledDate:\s*a\.scheduledDate/);
  });
});
