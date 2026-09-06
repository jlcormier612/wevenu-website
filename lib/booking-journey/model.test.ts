import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingJourney, isCommerciallyBooked } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: "lead-1",
    clientId: "client-1",
    eventId: "event-1",
    sourcePackageId: "pkg-1",
    name: "Garden Package",
    totalAmount: 3200,
    depositAmount: 800,
    includedItems: [{ description: "Lawn", quantity: 1, unit: null }],
    status: "draft",
    version: 1,
    supersededById: null,
    offeredAt: null,
    acceptedAt: null,
    acceptToken: null,
    offerMessage: null,
    invoiceId: null,
    contractId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Booking Journey derivation", () => {
  it("starts at Package with Select package CTA", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.currentKey, "package");
    assert.equal(j.primaryAction, "select_package");
    assert.equal(j.isCommerciallyBooked, false);
  });

  it("after package selected offers Send offer / Create contract", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.currentKey, "agreement");
    assert.equal(j.primaryAction, "send_offer");
    assert.equal(j.secondaryLabel, "Create contract");
    assert.equal(j.secondaryAction, "create_contract");
    assert.match(j.secondaryHref ?? "", /selectionId=sel-1/);
  });

  it("Create contract remains available without an existing client id", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection({ clientId: null }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.secondaryAction, "create_contract");
    assert.match(j.secondaryHref ?? "", /leadId=lead-1/);
  });

  it("does not mark Booked on booking file alone", () => {
    assert.equal(
      isCommerciallyBooked({ selection: selection(), contract: null, paymentLines: [] }),
      false,
    );
  });

  it("does not mark Booked when contract signed but deposit unpaid", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection(),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      }),
      false,
    );
  });

  it("marks Booked when Path B signed + deposit paid", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection(),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      }),
      true,
    );
  });

  it("marks Booked when Path A accepted + deposit paid", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      }),
      true,
    );
  });

  it("does not infer Booked from a non-deposit payment", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "final", status: "paid", amount: 2400 }],
      }),
      false,
    );
  });

  it("after accept shows Set up payments", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      eventId: "event-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.currentKey, "deposit");
    assert.equal(j.primaryAction, "setup_payments");
    assert.match(j.direction, /800|\$800/);
    assert.match(j.direction, /2,400|\$2,400|2400/);
  });
});
