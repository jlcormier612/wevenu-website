/**
 * Staff send-preview and couple form must surface the complete frozen offering
 * (fixed lines + choice groups), not an empty "No offerings" shell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

describe("selection offering context (preview + couple form)", () => {
  it("staff send-preview uses ArtifactReviewOverlay + ChoicesDefinitionView with canonical test id", () => {
    const panel = readFileSync(
      resolve(root, "components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /ArtifactReviewOverlay/);
    assert.match(panel, /ChoicesDefinitionView/);
    const overlaySrc = readFileSync(
      resolve(root, "components/artifacts/artifact-review-overlay.tsx"),
      "utf8",
    );
    assert.match(overlaySrc, /id="artifact-review-title"/);
    // Composer aside must not steal the overlay's harness selector.
    assert.match(panel, /testId="choices-composer-definition-preview"/);
    const overlayBlock = panel.slice(panel.indexOf("Full send preview"));
    assert.match(overlayBlock, /ChoicesDefinitionView/);
    assert.doesNotMatch(
      overlayBlock,
      /testId="choices-composer-definition-preview"/,
    );
  });

  it("ChoicesDefinitionView defaults to choices-definition-view and renders fixed + groups", () => {
    const view = readFileSync(
      resolve(root, "components/client-choices/choices-definition-view.tsx"),
      "utf8",
    );
    assert.match(view, /testId = "choices-definition-view"/);
    assert.match(view, /Included with your event|Pick one|Pick many/);
    assert.match(view, /fieldset/);
    assert.match(view, /fixedLines/);
  });

  it("couple portal form shows Included context and accessible fieldsets from frozen definition", () => {
    const portal = readFileSync(
      resolve(root, "components/portal/choices-section.tsx"),
      "utf8",
    );
    assert.match(portal, /Your Choices/);
    assert.match(portal, /Included with your event/);
    assert.match(portal, /fieldset/);
    assert.match(portal, /Pick one|Pick many/);
    assert.match(portal, /fixedLines/);
    assert.match(portal, /data-testid="choices-definition-view"/);
  });

  it("send + list hydrate incomplete EO freezes before portal delivery", () => {
    const service = readFileSync(resolve(root, "lib/client-choices/service.ts"), "utf8");
    assert.match(service, /hydrateClientChoicesDefinitionFromEventOrderTemplate/);
    assert.match(service, /selectionDefinitionNeedsHydration/);
    const sendFn = service.slice(service.indexOf("export async function sendClientChoices"));
    assert.match(
      sendFn.slice(0, 1200),
      /hydrateClientChoicesDefinitionFromEventOrderTemplate/,
    );
    const listFn = service.slice(service.indexOf("export async function listClientChoicesForEvent"));
    assert.match(
      listFn.slice(0, 800),
      /hydrateClientChoicesDefinitionFromEventOrderTemplate/,
    );
  });
});
