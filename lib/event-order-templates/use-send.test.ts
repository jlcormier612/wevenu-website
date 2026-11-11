/**
 * EO Template Use / Send orchestration — Path A (fixed) vs Path B (client selection).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const src = readFileSync(join(root, "lib/event-order-templates/use-send.ts"), "utf8");
const list = readFileSync(
  join(root, "components/event-order-templates/event-order-template-list.tsx"),
  "utf8",
);
const actions = readFileSync(
  join(root, "app/(app)/events/[id]/event-order-actions.ts"),
  "utf8",
);
const repo = readFileSync(join(root, "lib/event-order-templates/repository.ts"), "utf8");
const panel = readFileSync(join(root, "components/event-orders/event-order-panel.tsx"), "utf8");
const representation = readFileSync(
  join(root, "lib/event-orders/representation.ts"),
  "utf8",
);

describe("useEventOrderTemplate / sendEventOrderTemplate", () => {
  it("wires Use to createClientChoicesFromEventOrderTemplate + finalize when groups exist", () => {
    assert.match(src, /createClientChoicesFromEventOrderTemplate/);
    assert.match(src, /finalizeClientChoices\(created\.choicesId, \{ venueUse: true \}\)/);
    assert.match(src, /startOrApplyEventOrderTemplate/);
    assert.match(src, /templateHasSelectableGroups/);
    assert.match(src, /export async function useEventOrderTemplate/);
    assert.match(src, /export async function sendEventOrderTemplate/);
    assert.match(src, /sendClientChoices/);
  });

  it("blocks Send without selectable groups using Path A guidance (not invent choice groups)", () => {
    assert.match(src, /SEND_REQUIRES_SELECTABLE_GROUPS_MESSAGE/);
    assert.match(src, /fixed offerings/);
    assert.match(src, /Finalize and Share/);
    assert.doesNotMatch(
      src,
      /Use Apply for fixed offerings, or add choice groups first/,
    );
    // Path B still requires groups before sendClientChoices.
    const sendFn = src.slice(src.indexOf("export async function sendEventOrderTemplate"));
    assert.match(sendFn, /templateHasSelectableGroups/);
    assert.match(sendFn, /sendClientChoices/);
    assert.ok(
      sendFn.indexOf("templateHasSelectableGroups") < sendFn.indexOf("sendClientChoices"),
    );
  });

  it("Use without groups returns after apply without offerings send", () => {
    const useFn = src.slice(
      src.indexOf("export async function useEventOrderTemplate"),
      src.indexOf("export async function sendEventOrderTemplate"),
    );
    assert.match(useFn, /if \(!templateHasSelectableGroups\(template\)\)/);
    assert.match(useFn, /return \{ ok: true, eventOrderId: applied\.eventOrderId \}/);
  });

  it("exposes Use and Send actions from event-order-actions", () => {
    assert.match(actions, /useEventOrderTemplateAction/);
    assert.match(actions, /sendEventOrderTemplateAction/);
  });

  it("Library list gates Send on selectableGroupCount and offers Apply instead for fixed-only", () => {
    assert.match(list, /useEventOrderTemplateAction/);
    assert.match(list, /sendEventOrderTemplateAction/);
    assert.match(list, /LIBRARY_LABELS\.sendToClient/);
    assert.match(list, /selectableGroupCount/);
    assert.match(list, /event-order-send-fixed-only-notice/);
    assert.match(list, /event-order-apply-instead/);
    assert.match(list, /runApplyAsUse|Apply to event instead/);
    assert.match(list, /TemplateGroupAnswerChooser/);
  });

  it("list query enriches selectableGroupCount from template groups", () => {
    assert.match(repo, /selectableGroupCount/);
    assert.match(repo, /event_order_template_groups/);
  });

  it("Path A share remains finalize-gated and does not auto-invoice", () => {
    assert.match(panel, /finalizeEventOrderAction/);
    assert.match(panel, /shareEventOrderWithClientAction/);
    assert.match(representation, /shareBlockedWhenNotFinalized/);
    assert.doesNotMatch(representation, /createInvoice\(/);
  });
});
