import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: Day-of Sheet missing saved times.
 * TimeAmPmInput used to commit only on blur; Save All clicked in the same
 * gesture read a stale empty entryTime while the input still showed AM/PM.
 */
describe("TimeAmPmInput save race (Day-of Sheet times)", () => {
  const inputSrc = readFileSync(
    join(process.cwd(), "components/ui/time-ampm-input.tsx"),
    "utf8",
  );
  const editorSrc = readFileSync(
    join(process.cwd(), "components/events/event-timeline-setup-editor.tsx"),
    "utf8",
  );

  it("publishes parseable times during typing and flushSync on publish", () => {
    assert.match(inputSrc, /flushSync/);
    assert.match(inputSrc, /parseTimelineTimeInput\(raw\)/);
    assert.match(inputSrc, /publish\(parsed\)/);
    assert.match(inputSrc, /publish\(""\)/);
  });

  it("Save all blurs the active input and reads rowsRef after commit", () => {
    assert.match(editorSrc, /rowsRef\.current/);
    assert.match(editorSrc, /active\.blur\(\)/);
    assert.match(editorSrc, /saveEventTimelineDraftAction/);
  });
});
