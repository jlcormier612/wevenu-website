/**
 * P2-B — Venue commercial workflow composition (labels, step resolution, CTA).
 * Run: npx tsx --test lib/events/event-commercial-workflow-p2b.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventOrderApplyConfirmMessage,
  eventOrderApplyLabel,
} from "@/lib/client-choices/event-order-apply-cta";
import { resolveCommercialWorkflowStep } from "@/lib/event-orders/commercial-workflow-step";

describe("P2-B Create / Update Event Order CTA", () => {
  it("labels Create when no Event Order exists yet", () => {
    assert.equal(
      eventOrderApplyLabel({
        hasEventOrder: false,
        eventOrderId: null,
        appliedLineIds: [],
      }),
      "Create Event Order",
    );
  });

  it("labels Update when an Event Order already exists", () => {
    assert.equal(
      eventOrderApplyLabel({
        hasEventOrder: true,
        eventOrderId: null,
        appliedLineIds: [],
      }),
      "Update Event Order from selections",
    );
  });

  it("labels Update when prior selection lines were applied", () => {
    assert.equal(
      eventOrderApplyLabel({
        hasEventOrder: false,
        eventOrderId: "eo-1",
        appliedLineIds: ["line-a"],
      }),
      "Update Event Order from selections",
    );
  });

  it("confirm copy explains replace-not-duplicate and no booking/send side effects", () => {
    const create = eventOrderApplyConfirmMessage({
      hasEventOrder: false,
      eventOrderId: null,
      appliedLineIds: [],
    });
    assert.match(create, /Create the Event Order/);
    assert.match(create, /does not change/i);
    assert.match(create, /later step/i);
    assert.doesNotMatch(create, /email sent/i);

    const update = eventOrderApplyConfirmMessage({
      hasEventOrder: true,
      eventOrderId: "eo-1",
      appliedLineIds: ["x"],
    });
    assert.match(update, /Update the Event Order/);
    assert.match(update, /duplicate/i);
    assert.match(update, /Venue-authored fixed lines/i);
    assert.match(update, /Booking status does not change/i);
  });
});

describe("P2-B workflow step resolution", () => {
  it("starts at build with no choices", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [],
        eventOrder: null,
        hasEoInvoice: false,
      }),
      "build",
    );
  });

  it("highlights review when couple submitted", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [{ status: "submitted" }],
        eventOrder: { sharedAt: null },
        hasEoInvoice: false,
      }),
      "review",
    );
  });

  it("highlights awaiting while couple has the packet", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [{ status: "sent" }],
        eventOrder: null,
        hasEoInvoice: false,
      }),
      "awaiting",
    );
  });

  it("moves to order when selections applied but Event Order not finalized", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [{ status: "finalized" }],
        eventOrder: { sharedAt: null, status: "draft" },
        hasEoInvoice: false,
      }),
      "order",
    );
  });

  it("moves to invoice after Event Order finalize (share not required)", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [{ status: "finalized" }],
        eventOrder: { sharedAt: null, status: "finalized" },
        hasEoInvoice: false,
      }),
      "invoice",
    );
  });

  it("moves to invoice after share", () => {
    assert.equal(
      resolveCommercialWorkflowStep({
        choices: [{ status: "finalized" }],
        eventOrder: { sharedAt: new Date().toISOString(), status: "finalized" },
        hasEoInvoice: false,
      }),
      "invoice",
    );
  });
});
