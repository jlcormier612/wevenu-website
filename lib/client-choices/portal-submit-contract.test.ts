/**
 * Portal Choices submit contract — selection persists; EO/invoice untouched.
 * Run: npx tsx --test lib/client-choices/portal-submit-contract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const submitRoute = readFileSync(resolve("app/api/portal/choices/submit/route.ts"), "utf8");
const saveRoute = readFileSync(resolve("app/api/portal/choices/save/route.ts"), "utf8");
const portal = readFileSync(resolve("components/portal/choices-section.tsx"), "utf8");
const panel = readFileSync(resolve("components/client-choices/client-choices-panel.tsx"), "utf8");

describe("portal Choices submit contract", () => {
  it("submit validates answers then calls submit_client_choices RPC", () => {
    assert.match(submitRoute, /validateChoicesAnswers/);
    assert.match(submitRoute, /reconcileAnswersForDependencies/);
    assert.match(submitRoute, /submit_client_choices/);
    assert.match(submitRoute, /Does NOT mutate Event Order or invoice/);
    assert.doesNotMatch(submitRoute, /shareEventOrder|createInvoice|finalizeEventOrder|finalizeClientChoices/);
  });

  it("save path is distinct from submit and does not finalize", () => {
    assert.match(saveRoute, /save|answers/i);
    assert.doesNotMatch(saveRoute, /submit_client_choices/);
    assert.match(portal, /\/api\/portal\/choices\/save/);
    assert.match(portal, /\/api\/portal\/choices\/submit/);
  });

  it("portal UI exposes Save vs Submit and truthful submitted copy", () => {
    assert.match(portal, /portal-choices-submit|Submit/);
    assert.match(portal, /portal-choices-save|Save/);
    assert.match(portal, /Submitted — waiting for your venue to review/);
    assert.match(portal, /not a payment/);
  });

  it("venue panel surfaces couple-submitted choices for review", () => {
    assert.match(panel, /choices-submission-summary/);
    assert.match(panel, /Couple-submitted choices/);
  });
});
