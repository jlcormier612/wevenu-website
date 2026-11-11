import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Contract tests for batch draft persistence wiring (no live DB).
 * Runtime behavior is covered by the Sandbox browser harness.
 */
describe("saveEventTimelineDraft batch contract", () => {
  const service = readFileSync(join(process.cwd(), "lib/timeline/service.ts"), "utf8");
  const actions = readFileSync(
    join(process.cwd(), "app/(app)/events/[id]/timeline-actions.ts"),
    "utf8",
  );
  const editor = readFileSync(
    join(process.cwd(), "components/events/event-timeline-setup-editor.tsx"),
    "utf8",
  );

  it("exposes saveEventTimelineDraft and wires a single revalidate action", () => {
    assert.match(service, /export async function saveEventTimelineDraft/);
    assert.match(service, /deleteIds\.length === 0 && upserts\.length === 0/);
    assert.match(actions, /saveEventTimelineDraftAction/);
    assert.match(actions, /revalidateTimelineSurfaces\(eventId\)/);
  });

  it("setup editor uses AM/PM time input and Save all changes", () => {
    assert.match(editor, /TimeAmPmInput/);
    assert.match(editor, /timeline-setup-save-all/);
    assert.match(editor, /Save all changes/);
    assert.match(editor, /pendingRemove/);
    assert.match(editor, /timeline-setup-undo-remove/);
    assert.doesNotMatch(editor, /placeholder="HH:MM"/);
  });

  it("does not confirm every row removal", () => {
    assert.doesNotMatch(editor, /confirm\("Remove this item from this event/);
  });
});
