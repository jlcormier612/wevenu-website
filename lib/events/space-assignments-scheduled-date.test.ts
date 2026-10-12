import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("booking workspace passes scheduleComponents into EventDetail", () => {
    const page = readFileSync(
      new URL("../../app/(app)/clients/[id]/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /scheduleComponents=\{scheduleComponents\}/);
    assert.match(page, /scheduledDate:\s*a\.scheduledDate/);
  });
});
