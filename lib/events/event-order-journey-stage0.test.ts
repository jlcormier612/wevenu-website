/**
 * Stage 0 — Event Order journey composition (one primary progress UI).
 * Run: npx tsx --test lib/events/event-order-journey-stage0.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  describeEventOrderJourney,
  panelEmphasisForStep,
  shouldShowChoicesFinancialImpact,
} from "@/lib/event-orders/event-order-journey";

describe("Stage 0 Event Order journey facts", () => {
  it("marks selections current when building", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [],
      eventOrder: null,
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "build");
    assert.equal(rows.filter((r) => r.isCurrent).length, 1);
    assert.equal(rows.find((r) => r.isCurrent)?.key, "selections");
    assert.equal(rows.find((r) => r.key === "selections")?.primaryLabel, "Build selections");
  });

  it("marks selections current on couple submission with Review selections", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "submitted" }],
      eventOrder: { status: "draft", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "review");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "selections");
    assert.equal(rows.find((r) => r.key === "selections")!.primaryLabel, "Review selections");
  });

  it("marks event_order current after selections applied, before finalize", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "draft", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "order");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "event_order");
    assert.equal(rows.find((r) => r.key === "event_order")!.primaryLabel, "Review Event Order");
  });

  it("marks invoice current after Event Order finalize (share not required)", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "invoice");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "invoice");
    assert.equal(
      rows.find((r) => r.key === "invoice")!.primaryLabel,
      "Create invoice & payment plan",
    );
  });

  it("invoice action becomes Open invoice & payment plan when linked", () => {
    const { rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: null },
      hasEoInvoice: true,
      eoInvoiceStatus: "sent",
    });
    assert.equal(
      rows.find((r) => r.key === "invoice")!.primaryLabel,
      "Open invoice & payment plan",
    );
  });

  it("every row keeps a meaningful action label (never View)", () => {
    const { rows } = describeEventOrderJourney({
      choices: [{ status: "draft" }],
      eventOrder: null,
      hasEoInvoice: false,
    });
    for (const row of rows) {
      assert.ok(row.primaryLabel, `${row.key} missing label`);
      assert.doesNotMatch(row.primaryLabel, /^View$/i);
    }
  });

  it("awaiting copy does not claim email was sent", () => {
    const { rows } = describeEventOrderJourney({
      choices: [{ status: "sent" }],
      eventOrder: null,
      hasEoInvoice: false,
    });
    const detail = rows.find((r) => r.key === "selections")!.detail;
    assert.doesNotMatch(detail, /email (was |has been )?sent/i);
    assert.match(detail, /portal/i);
  });

  it("emphasizes choices for build/awaiting/review and order for order/invoice", () => {
    assert.deepEqual(panelEmphasisForStep("build"), {
      emphasizeChoices: true,
      emphasizeOrder: false,
    });
    assert.deepEqual(panelEmphasisForStep("review"), {
      emphasizeChoices: true,
      emphasizeOrder: false,
    });
    assert.deepEqual(panelEmphasisForStep("order"), {
      emphasizeChoices: false,
      emphasizeOrder: true,
    });
    assert.deepEqual(panelEmphasisForStep("invoice"), {
      emphasizeChoices: false,
      emphasizeOrder: true,
    });
  });

  it("hides Choices financial impact when EO-linked invoice exists", () => {
    assert.equal(shouldShowChoicesFinancialImpact(false), true);
    assert.equal(shouldShowChoicesFinancialImpact(true), false);
  });
});

describe("Stage 0 workflow composition source", () => {
  it("uses EventOrderJourney and does not mount competing strip/spine on EO tab", () => {
    const workflow = readFileSync(
      resolve("components/event-orders/event-commercial-workflow.tsx"),
      "utf8",
    );
    assert.match(workflow, /EventOrderJourney/);
    assert.doesNotMatch(workflow, /EventCommercialStatusStrip/);
    assert.doesNotMatch(workflow, /event-commercial-workflow-spine/);
    assert.doesNotMatch(workflow, /Open Inventory|commercial-open-inventory/);
    assert.match(workflow, /event-order-choices/);
    assert.match(workflow, /event-order-order/);
    assert.match(workflow, /ClientChoicesPanel/);
    assert.match(workflow, /EventOrderPanel/);
  });

  it("portal-only CTA remains distinct from email send", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /Make available in portal/);
    assert.match(panel, /choices-portal-only/);
    assert.match(panel, /No email was sent/);
    assert.match(panel, /Send selection request/);
  });

  it("composer includes template select, RH preview, and ArtifactReviewOverlay", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /choices-template-select/);
    assert.match(panel, /choices-template-preview/);
    assert.match(panel, /EventOrderTemplatePreviewView|ChoicesDefinitionView/);
    assert.match(panel, /ArtifactReviewOverlay/);
    assert.match(panel, /ShareDialog/);
  });

  it("journey UI never renders generic View label", () => {
    const journeyUi = readFileSync(
      resolve("components/event-orders/event-order-journey.tsx"),
      "utf8",
    );
    assert.doesNotMatch(journeyUi, />\s*View\s*</);
  });

  it("invoice link uses Create/Open invoice & payment plan labels", () => {
    const link = readFileSync(
      resolve("components/event-orders/event-order-invoice-link.tsx"),
      "utf8",
    );
    assert.match(link, /Create invoice & payment plan/);
    assert.match(link, /Open invoice & payment plan/);
  });
});
