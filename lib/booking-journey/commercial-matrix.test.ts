import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingJourney, commercialStepsComplete } from "@/lib/booking-journey/model";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";
import { suggestDepositAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: "lead-1",
    clientId: "client-1",
    eventId: "event-1",
    proposalId: null,
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

const prefs = DEFAULT_COMMERCIAL_BOOKING_PREFS;

describe("Commercial variants A–F (simplified)", () => {
  it("A — accept is not commercially ready until deposit paid; never Booked", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [],
        prefs,
      }),
      false,
    );
    const unpaid = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs,
    });
    assert.equal(unpaid.currentKey, "deposit");
    assert.equal(unpaid.commercialReady, false);
    assert.ok(unpaid.stages.some((s) => s.key === "deposit"));
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs,
      }),
      true,
    );
  });

  it("B — full payment / no remaining balance is one deposit line for the total", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", depositAmount: 3200 }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 3200 }],
      portalInvited: false,
      planningStarted: false,
      prefs,
    });
    assert.equal(j.commercialReady, true);
    assert.equal(j.remainingSummary, "$0.00");
  });

  it("C — signed contract completes agreement without selection acceptance", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "draft" }),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs,
      }),
      true,
    );
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "draft" }),
      contract: { id: "c1", status: "signed" },
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
      prefs,
    });
    assert.equal(j.currentKey, "deposit");
    assert.equal(j.stages.find((s) => s.key === "agreement")?.state, "complete");
  });

  it("D — processOrder deposit_first is ignored (always agreement then deposit)", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...prefs, processOrder: "deposit_first" },
    });
    assert.equal(j.stages[1]?.key, "agreement");
    assert.equal(j.stages[2]?.key, "deposit");
    assert.equal(j.currentKey, "agreement");
  });

  it("E — pending deposit offers Record deposit received when external collection is allowed", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...prefs, paymentCollection: "either" },
    });
    assert.equal(j.secondaryAction, "record_deposit");
    assert.equal(j.secondaryLabel, "Record deposit received");
  });

  it("F — collectInitialPayment=false skips Deposit; commercial ready ≠ Booked", () => {
    const noPay = {
      ...prefs,
      collectInitialPayment: false,
      initialPaymentRequired: false,
    };
    assert.equal(suggestDepositAmount(3200, 800, { collectInitialPayment: false }), 0);
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", depositAmount: 0 }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: noPay,
    });
    assert.equal(j.commercialReady, true);
    assert.equal(j.currentKey, "ready");
    assert.ok(!j.stages.some((s) => s.key === "deposit"));
    assert.equal(j.depositSummary, null);
    assert.match(j.direction, /Mark them Booked when you're ready/i);
  });

  it("selection acceptance completes agreement without a contract", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
      prefs,
    });
    assert.equal(j.stages.find((s) => s.key === "agreement")?.state, "complete");
    assert.equal(j.commercialReady, true);
  });

  it("draft selection is not commercially ready", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "draft" }),
        contract: null,
        paymentLines: [],
        prefs,
      }),
      false,
    );
  });
});
