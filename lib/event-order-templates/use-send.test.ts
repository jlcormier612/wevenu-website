/**
 * EO Template Use / Send orchestration — fixed lines + selectable finalize path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();

describe("useEventOrderTemplate / sendEventOrderTemplate", () => {
  it("wires Use to createClientChoicesFromEventOrderTemplate + finalize", () => {
    const src = readFileSync(join(root, "lib/event-order-templates/use-send.ts"), "utf8");
    assert.match(src, /createClientChoicesFromEventOrderTemplate/);
    assert.match(src, /finalizeClientChoices/);
    assert.match(src, /startOrApplyEventOrderTemplate/);
    assert.match(src, /templateHasSelectableGroups/);
    assert.match(src, /export async function useEventOrderTemplate/);
    assert.match(src, /export async function sendEventOrderTemplate/);
    assert.match(src, /sendClientChoices/);
  });

  it("exposes Use and Send actions from event-order-actions", () => {
    const actions = readFileSync(
      join(root, "app/(app)/events/[id]/event-order-actions.ts"),
      "utf8",
    );
    assert.match(actions, /useEventOrderTemplateAction/);
    assert.match(actions, /sendEventOrderTemplateAction/);
  });

  it("Library list surfaces Use and Send for EO Templates", () => {
    const list = readFileSync(
      join(root, "components/event-order-templates/event-order-template-list.tsx"),
      "utf8",
    );
    assert.match(list, /useEventOrderTemplateAction/);
    assert.match(list, /sendEventOrderTemplateAction/);
    assert.match(list, /LIBRARY_LABELS\.sendToClient/);
    assert.match(list, /TemplateGroupAnswerChooser/);
  });
});
