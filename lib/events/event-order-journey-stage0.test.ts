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

  it("marks selections current on couple submission", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "submitted" }],
      eventOrder: { status: "draft", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "review");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "selections");
    assert.match(rows.find((r) => r.key === "selections")!.primaryLabel ?? "", /Review/);
  });

  it("marks event_order current after selections applied, before share", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "order");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "event_order");
  });

  it("marks invoice current after share", () => {
    const { currentStep, rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: "2026-10-23T00:00:00Z" },
      hasEoInvoice: false,
    });
    assert.equal(currentStep, "invoice");
    assert.equal(rows.find((r) => r.isCurrent)?.key, "invoice");
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

  it("portal availability CTA does not claim email send", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /Make available in portal/);
    assert.match(panel, /No email was sent/);
    assert.doesNotMatch(panel, /Sent to client\./);
  });
});
