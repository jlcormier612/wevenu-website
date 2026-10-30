/**
 * Flow-review items 5–6 — Event Order page simplify.
 * 5 — one invoice entry (journey) + no leftover selection-request panel; no Finalize vs Send duel
 * 6 — clearer empty-state wording
 *
 * Run: npx tsx --test lib/flow-review/eo-page-simplify.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("EO page simplify (5–6)", () => {
  const workflow = read("components/event-orders/event-commercial-workflow.tsx");
  const panel = read("components/event-orders/event-order-panel.tsx");
  const choices = read("components/client-choices/client-choices-panel.tsx");

  it("journey owns Send/Invoice — panel mounts with actionsOwnedByJourney", () => {
    assert.match(workflow, /actionsOwnedByJourney/);
    assert.match(panel, /actionsOwnedByJourney/);
  });

  it("under journey, Finalize and Create invoice strip are not competing CTAs", () => {
    assert.match(panel, /actionsOwnedByJourney/);
    // Finalize only when journey does not own actions
    assert.match(panel, /preBooking \|\| actionsOwnedByJourney/);
    assert.match(panel, /!preBooking && !actionsOwnedByJourney/);
    assert.match(panel, /EventOrderInvoiceLink/);
  });

  it("drops leftover selection-request composer on the EO tab", () => {
    assert.match(workflow, /selectionRequestComposer=\{false\}/);
    assert.match(workflow, /choices\.length > 0/);
    assert.match(workflow, /showFinancialImpact=\{false\}/);
    assert.match(choices, /selectionRequestComposer/);
    assert.match(choices, /choices-review-only/);
    assert.match(choices, /The couple makes choices on their Event Order link/);
  });

  it("empty Event Order state uses plain language (no Setup Profile / deliverables jargon)", () => {
    assert.match(panel, /eo-empty-start/);
    assert.match(panel, /Pick a template or start blank below\. The couple sees nothing until you send it\./);
    assert.doesNotMatch(panel, /agreed deliverables record/);
    assert.doesNotMatch(panel, /Release to client portal from Overview/);
    assert.doesNotMatch(panel, /Events that use a sales Package only can skip this/);
  });

  it("journey remains the single invoice CTA path on the EO tab", () => {
    assert.match(workflow, /invoice_new_charges/);
    assert.match(workflow, /createInvoiceFromEventOrderAction/);
    // No second Create invoice from Choices FinancialImpact on this tab
    assert.match(workflow, /financialImpact=\{null\}/);
  });
});
