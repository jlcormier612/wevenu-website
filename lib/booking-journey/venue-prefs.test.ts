import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBookingJourney,
  initialPaymentSatisfied,
  isCommerciallyBooked,
} from "@/lib/booking-journey/model";
import {
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  depositFromVenuePercent,
  normalizeCommercialBookingPrefs,
} from "@/lib/booking-journey/venue-prefs";
import { buildGuidedScheduleLines } from "@/lib/booking-journey/setup-payments";
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

describe("Venue commercial booking prefs", () => {
  it("normalizes defaults and clamps deposit percent", () => {
    const prefs = normalizeCommercialBookingPrefs({
      defaultDepositPercent: 150,
      agreementMethod: "nope",
    });
    assert.equal(prefs.defaultDepositPercent, 100);
    assert.equal(prefs.agreementMethod, "either");
    assert.equal(prefs.initialPaymentRequired, true);
  });

  it("suggests $800 deposit from 25% of $3200", () => {
    assert.equal(depositFromVenuePercent(3200, DEFAULT_COMMERCIAL_BOOKING_PREFS), 800);
  });
});

describe("Configurable commercial Booked conditions", () => {
  it("F — agreement alone books when initial payment not required", () => {
    const prefs = { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, initialPaymentRequired: false };
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [],
        prefs,
      }),
      true,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      selection: selection({ status: "accepted", depositAmount: 800 }),
      contract: { id: "c1", status: "signed" },
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs,
    });
    assert.equal(j.isCommerciallyBooked, true);
    assert.equal(j.currentKey, "booked");
    assert.ok(!j.stages.some((s) => s.key === "deposit"));
    assert.equal(j.depositSummary, null);
    assert.equal(j.remainingSummary, null);
    assert.doesNotMatch(j.direction, /\$800|deposit/i);
  });

  it("D — full payment deposit line satisfies payment condition", () => {
    assert.equal(
      initialPaymentSatisfied({
        selection: selection({ depositAmount: 3200 }),
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 3200 }],
      }),
      true,
    );
  });

  it("zero deposit commitment is satisfied without a payment line", () => {
    assert.equal(
      initialPaymentSatisfied({
        selection: selection({ depositAmount: 0 }),
        paymentLines: [],
      }),
      true,
    );
  });

  it("C — deposit-first shows deposit before agreement", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, processOrder: "deposit_first" },
    });
    assert.equal(j.currentKey, "deposit");
    assert.equal(j.primaryAction, "setup_payments");
    assert.equal(j.stages[1]?.key, "deposit");
    assert.equal(j.stages[2]?.key, "agreement");
  });

  it("contract-only venues hide Send proposal as primary", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "contract" },
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.secondaryAction, undefined);
  });

  it("E — pending deposit offers Record deposit received when external allowed", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, paymentCollection: "either" },
    });
    assert.equal(j.secondaryAction, "record_deposit");
  });
});

describe("buildGuidedScheduleLines", () => {
  it("deposit + remaining reconciles to $3200", () => {
    const result = buildGuidedScheduleLines({
      total: 3200,
      deposit: 800,
      today: "2026-09-14",
      remainingDueDate: "2026-12-01",
      scheduleStructure: "deposit_remaining",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines.reduce((s, l) => s + l.amount, 0), 3200);
  });

  it("full payment is one deposit line for the commitment", () => {
    const result = buildGuidedScheduleLines({
      total: 3200,
      deposit: 3200,
      today: "2026-09-14",
      remainingDueDate: null,
      scheduleStructure: "full",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]?.amount, 3200);
    assert.equal(result.lines[0]?.obligationKind, "deposit");
  });

  it("thirds preset keeps editable $800 deposit and reconciles", () => {
    const result = buildGuidedScheduleLines({
      total: 3200,
      deposit: 800,
      today: "2026-09-14",
      remainingDueDate: "2026-12-01",
      eventDate: "2026-12-01",
      scheduleStructure: "thirds",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lines[0]?.amount, 800);
    assert.equal(result.lines.reduce((s, l) => s + l.amount, 0), 3200);
    assert.ok(result.lines.length >= 3);
  });
});
