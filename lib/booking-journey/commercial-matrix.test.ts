import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingJourney, isCommerciallyBooked } from "@/lib/booking-journey/model";
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

describe("Commercial variants A–F", () => {
  it("A — proposal path with required initial payment: accept is not Booked until deposit paid", () => {
    assert.equal(
      isCommerciallyBooked({
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
    assert.equal(unpaid.isCommerciallyBooked, false);
    assert.ok(unpaid.stages.some((s) => s.key === "deposit"));
    assert.equal(
      isCommerciallyBooked({
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
    assert.equal(j.isCommerciallyBooked, true);
    assert.equal(j.remainingSummary, "$0.00");
  });

  it("C — signed contract completes agreement without proposal acceptance", () => {
    assert.equal(
      isCommerciallyBooked({
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

  it("D — deposit-first shows Deposit before Agreement", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...prefs, processOrder: "deposit_first" },
    });
    assert.equal(j.stages[1]?.key, "deposit");
    assert.equal(j.stages[2]?.key, "agreement");
    assert.equal(j.currentKey, "deposit");
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

  it("F — initialPaymentRequired=false skips Deposit and books on agreement", () => {
    const noPay = { ...prefs, initialPaymentRequired: false };
    assert.equal(suggestDepositAmount(3200, 800, { initialPaymentRequired: false }), 0);
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", depositAmount: 0 }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: noPay,
    });
    assert.equal(j.isCommerciallyBooked, true);
    assert.equal(j.currentKey, "booked");
    assert.ok(!j.stages.some((s) => s.key === "deposit"));
    assert.equal(j.depositSummary, null);
    assert.doesNotMatch(j.direction, /deposit/i);
  });

  it("proposal acceptance completes agreement without a contract", () => {
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
    assert.equal(j.isCommerciallyBooked, true);
  });

  it("Start booking file / draft selection is not commercially Booked", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "draft" }),
        contract: null,
        paymentLines: [],
        prefs,
      }),
      false,
    );
  });
});
