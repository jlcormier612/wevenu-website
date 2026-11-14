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
  emptyEventOrderStartCopy,
  eventOrderOverviewSummary,
  isEventOrderApprovedNow,
  panelEmphasisForStep,
  selectionPacketPresence,
  shouldShowChoicesFinancialImpact,
} from "@/lib/event-orders/event-order-journey";

describe("Event Order journey rows (lead card pattern)", () => {
  const sent = "2026-10-01T00:00:00Z";

  it("has the four lead-card rows in order, exactly one current", () => {
    const { rows } = describeEventOrderJourney({ choices: [], eventOrder: null, hasEoInvoice: false });
    assert.deepEqual(rows.map((r) => r.title), [
      "Event Order", "Couple approval", "New charges invoice", "Payment plan",
    ]);
    assert.equal(rows.filter((r) => r.isCurrent).length, 1);
    assert.equal(rows.find((r) => r.isCurrent)?.key, "event_order");
    assert.equal(rows[0]!.primaryLabel, "Build Event Order");
  });

  it("draft Event Order: Send to couple with Preview", () => {
    const { current } = describeEventOrderJourney({
      choices: [{ status: "draft" }],
      eventOrder: { status: "open", sharedAt: null },
      hasEoInvoice: false,
    });
    assert.equal(current.key, "event_order");
    assert.equal(current.action, "send");
    assert.equal(current.primaryLabel, "Send to couple");
    assert.equal(current.preview, true);
  });

  it("sent and waiting: approval row is next, with Copy couple link", () => {
    const { current, rows } = describeEventOrderJourney({
      choices: [{ status: "in_progress" }],
      eventOrder: { status: "finalized", sharedAt: sent, revision: 2 },
      hasEoInvoice: false,
    });
    assert.equal(current.key, "approval");
    assert.equal(current.state, "Waiting on couple");
    assert.equal(current.action, "copy_link");
    assert.match(rows[0]!.state, /^Sent /);
  });

  it("approved with new charges: next step is Invoice new charges (never automatic)", () => {
    const { current, rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: sent, clientAgreedAt: sent, clientAgreedRevision: 3, revision: 3 },
      hasEoInvoice: false,
      unbilledAmount: 450,
    });
    assert.match(rows.find((r) => r.key === "approval")!.state, /^Approved /);
    assert.equal(current.key, "invoice");
    assert.equal(current.primaryLabel, "Invoice new charges");
    assert.match(current.state, /\$450\.00 not invoiced yet/);
    assert.match(current.detail, /Nothing is sent until you send it/);
  });

  it("approved with nothing to invoice: next step shows Approved", () => {
    const { current } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: sent, clientAgreedAt: sent, clientAgreedRevision: 3, revision: 3 },
      hasEoInvoice: false,
      unbilledAmount: 0,
    });
    assert.equal(current.key, "approval");
    assert.match(current.state, /^Approved /);
    assert.equal(current.action, null);
  });

  it("venue change after approval asks the couple again", () => {
    const reopened = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "open", sharedAt: sent, clientAgreedAt: null, revision: 3 },
      hasEoInvoice: false,
    });
    assert.equal(reopened.current.key, "event_order");
    assert.equal(reopened.current.primaryLabel, "Send updated copy");
    assert.equal(reopened.rows.find((r) => r.key === "approval")!.state, "Approval needed again");

    const stale = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: sent, clientAgreedAt: sent, clientAgreedRevision: 3, revision: 3 },
      hasEoInvoice: false,
      shareCommitmentStale: true,
    });
    assert.equal(stale.current.action, "resend");
    assert.equal(stale.rows.find((r) => r.key === "approval")!.state, "Approval needed again");
  });

  it("approval at an older revision is not current approval", () => {
    assert.equal(isEventOrderApprovedNow({ status: "finalized", clientAgreedAt: sent, clientAgreedRevision: 2, revision: 3 }), false);
    assert.equal(isEventOrderApprovedNow({ status: "finalized", clientAgreedAt: sent, clientAgreedRevision: 3, revision: 3 }), true);
  });

  it("portal-submitted choices still route the venue to Review choices", () => {
    const { current } = describeEventOrderJourney({
      choices: [{ status: "submitted" }],
      eventOrder: { status: "finalized", sharedAt: sent, revision: 2 },
      hasEoInvoice: false,
    });
    assert.equal(current.key, "approval");
    assert.equal(current.action, "review_choices");
  });

  it("invoice and payment plan rows follow the linked invoice", () => {
    const { rows } = describeEventOrderJourney({
      choices: [{ status: "finalized" }],
      eventOrder: { status: "finalized", sharedAt: sent, clientAgreedAt: sent, clientAgreedRevision: 3, revision: 3 },
      hasEoInvoice: true,
      eoInvoiceStatus: "sent",
    });
    assert.equal(rows.find((r) => r.key === "invoice")!.primaryLabel, "Open invoice");
    assert.equal(rows.find((r) => r.key === "payment_plan")!.primaryLabel, "Create payment plan");
    const withPlan = describeEventOrderJourney({
      choices: [], eventOrder: { status: "finalized", sharedAt: sent }, hasEoInvoice: true, hasPaymentPlan: true,
    });
    assert.equal(withPlan.rows.find((r) => r.key === "payment_plan")!.primaryLabel, "Open payment plan");
  });

  it("no row ever uses a generic View label", () => {
    for (const input of [
      { choices: [], eventOrder: null, hasEoInvoice: false },
      { choices: [{ status: "sent" }], eventOrder: { status: "finalized", sharedAt: sent }, hasEoInvoice: true, unbilledAmount: 10 },
    ]) {
      for (const row of describeEventOrderJourney(input).rows) {
        if (row.primaryLabel) assert.doesNotMatch(row.primaryLabel, /^View$/i);
      }
    }
  });

  it("overview summary names the next step", () => {
    assert.equal(
      eventOrderOverviewSummary({ choices: [], eventOrder: { status: "open", sharedAt: null }, hasEoInvoice: false }),
      "Event Order: Configure — not shared yet",
    );
  });

  it("Path B sent packet without Event Order is awaiting — not Not started", () => {
    const { current, rows } = describeEventOrderJourney({
      choices: [{ status: "sent" }],
      eventOrder: null,
      hasEoInvoice: false,
    });
    assert.equal(current.key, "approval");
    assert.equal(current.state, "Awaiting couple selections");
    assert.doesNotMatch(rows[0]!.state, /Not started/);
    assert.doesNotMatch(rows[0]!.detail, /couple sees nothing/i);
    assert.equal(
      eventOrderOverviewSummary({ choices: [{ status: "sent" }], eventOrder: null, hasEoInvoice: false }),
      "Couple approval: Awaiting couple selections",
    );
  });

  it("Path B submitted packet without Event Order asks the venue to review selections", () => {
    const { current, rows } = describeEventOrderJourney({
      choices: [{ status: "submitted" }],
      eventOrder: null,
      hasEoInvoice: false,
    });
    assert.equal(current.key, "approval");
    assert.equal(current.state, "Choices submitted — venue to act");
    assert.equal(current.action, "review_choices");
    assert.equal(current.primaryLabel, "Review selections");
    assert.equal(current.nav.kind, "tab");
    assert.equal(current.nav.kind === "tab" ? current.nav.anchor : null, "event-order-choices");
    assert.equal(rows[0]!.state, "Selections submitted — Event Order not created");
    assert.equal(rows[0]!.isCurrent, false);
    assert.doesNotMatch(rows[0]!.detail, /couple sees nothing/i);
    assert.doesNotMatch(
      eventOrderOverviewSummary({ choices: [{ status: "submitted" }], eventOrder: null, hasEoInvoice: false }),
      /Not started/,
    );
  });

  it("Path A empty event without a packet still starts at Build Event Order", () => {
    const { current } = describeEventOrderJourney({ choices: [], eventOrder: null, hasEoInvoice: false });
    assert.equal(current.key, "event_order");
    assert.equal(current.primaryLabel, "Build Event Order");
    assert.equal(current.state, "Not started");
    assert.equal(selectionPacketPresence([]), "none");
    assert.match(emptyEventOrderStartCopy("none").description, /couple sees nothing/i);
    assert.doesNotMatch(emptyEventOrderStartCopy("awaiting").description, /couple sees nothing/i);
    assert.doesNotMatch(emptyEventOrderStartCopy("needs_review").description, /couple sees nothing/i);
  });

  it("emphasizes choices for build/awaiting/review and order for order/invoice", () => {
    assert.deepEqual(panelEmphasisForStep("build"), { emphasizeChoices: true, emphasizeOrder: false });
    assert.deepEqual(panelEmphasisForStep("invoice"), { emphasizeChoices: false, emphasizeOrder: true });
  });

  it("hides Choices financial impact when EO-linked invoice exists and nothing is unbilled", () => {
    assert.equal(shouldShowChoicesFinancialImpact(false), true);
    assert.equal(shouldShowChoicesFinancialImpact(true), false);
    assert.equal(shouldShowChoicesFinancialImpact(true, 0), false);
    assert.equal(shouldShowChoicesFinancialImpact(true, 200), true);
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
    assert.match(workflow, /actionsOwnedByJourney/);
    assert.match(workflow, /selectionRequestComposer=\{false\}/);
  });

  it("portal-only CTA remains available on the full selection-request composer", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /Make available in portal/);
    assert.match(panel, /choices-portal-only/);
    assert.match(panel, /No email was sent/);
    assert.match(panel, /Send selection request/);
    assert.match(panel, /selectionRequestComposer/);
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

  it("invoice link component retains Create/Open labels for non-journey surfaces", () => {
    const link = readFileSync(
      resolve("components/event-orders/event-order-invoice-link.tsx"),
      "utf8",
    );
    assert.match(link, /Create invoice & payment plan/);
    assert.match(link, /Open invoice & payment plan/);
  });
});
