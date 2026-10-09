import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBookingJourney,
  commercialStepsComplete,
  initialPaymentSatisfied,
} from "@/lib/booking-journey/model";
import {
  DEFAULT_COMMERCIAL_BOOKING_PREFS,
  depositFromVenuePercent,
  formatDefaultTaxPercentInput,
  isDefaultTaxPercentDraft,
  normalizeCommercialBookingPrefs,
  normalizeDefaultTaxPercent,
} from "@/lib/booking-journey/venue-prefs";
import { buildGuidedScheduleLines } from "@/lib/booking-journey/setup-payments";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  const totalAmount = overrides.totalAmount ?? 3200;
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: "lead-1",
    clientId: "client-1",
    eventId: "event-1",
    proposalId: null,
    sourcePackageId: "pkg-1",
    name: "Garden Package",
    packageAmount: totalAmount,
    discountAmount: 0,
    discountType: null,
    discountValue: null,
    taxApplied: false,
    taxRatePercent: null,
    taxAmount: 0,
    totalAmount,
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
    assert.equal(prefs.collectInitialPayment, true);
    assert.equal(prefs.initialPaymentRequired, true);
    assert.equal(prefs.processOrder, "agreement_first");
    assert.equal(prefs.remainingBalanceMode, "final");
  });

  it("maps legacy initialPaymentRequired into collectInitialPayment", () => {
    const prefs = normalizeCommercialBookingPrefs({
      initialPaymentRequired: false,
    });
    assert.equal(prefs.collectInitialPayment, false);
    assert.equal(prefs.initialPaymentRequired, false);
  });

  it("maps legacy remainingBalanceMode varies → final", () => {
    const prefs = normalizeCommercialBookingPrefs({ remainingBalanceMode: "varies" });
    assert.equal(prefs.remainingBalanceMode, "final");
  });

  it("payment collection preferences accept methods + client instructions", () => {
    const offline = normalizeCommercialBookingPrefs({
      paymentCollection: "external",
      clientPaymentInstructions: "  Mail checks to PO Box 12  ",
    });
    assert.deepEqual(offline.acceptedPaymentMethods, ["check", "cash", "ach", "other"]);
    assert.equal(offline.clientPaymentInstructions, "Mail checks to PO Box 12");
    const explicit = normalizeCommercialBookingPrefs({
      acceptedPaymentMethods: ["check", "ach", "online"],
      clientPaymentInstructions: "ACH to routing 123",
    });
    assert.deepEqual(explicit.acceptedPaymentMethods, ["check", "ach", "online"]);
    assert.equal(explicit.clientPaymentInstructions, "ACH to routing 123");
  });

  it("forces processOrder to agreement_first even when deposit_first is stored", () => {
    const prefs = normalizeCommercialBookingPrefs({ processOrder: "deposit_first" });
    assert.equal(prefs.processOrder, "agreement_first");
  });

  it("keeps Custom when a valid defaultCustomSchedule is present", () => {
    const prefs = normalizeCommercialBookingPrefs({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "custom",
      defaultCustomSchedule: {
        mode: "percentage",
        items: [
          { label: "Initial payment", pctOfTotal: 50, amount: 0, timing: { type: "at_booking" }, obligationKind: "deposit" },
          { label: "Final payment", pctOfTotal: 50, amount: 0, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
        ],
      },
    });
    assert.equal(prefs.defaultSchedulePresetId, "custom");
    assert.equal(prefs.defaultCustomSchedule?.mode, "percentage");
    assert.equal(prefs.defaultCustomSchedule?.items.length, 2);
  });

  it("strips Custom when template is missing or invalid", () => {
    const prefs = normalizeCommercialBookingPrefs({
      remainingBalanceMode: "plan",
      defaultSchedulePresetId: "custom",
      defaultCustomSchedule: null,
    });
    assert.equal(prefs.defaultSchedulePresetId, null);
    assert.equal(prefs.defaultCustomSchedule, null);
  });

  it("suggests $800 deposit from 25% of $3200", () => {
    assert.equal(depositFromVenuePercent(3200, DEFAULT_COMMERCIAL_BOOKING_PREFS), 800);
  });

  it("default tax percent accepts two-decimal rates and rejects invalid input", () => {
    assert.equal(normalizeDefaultTaxPercent(6.25), 6.25);
    assert.equal(normalizeDefaultTaxPercent("7.50"), 7.5);
    assert.equal(normalizeDefaultTaxPercent(0), 0);
    assert.equal(normalizeDefaultTaxPercent(100), 100);
    assert.equal(normalizeDefaultTaxPercent(-0.01), null);
    assert.equal(normalizeDefaultTaxPercent(100.01), null);
    assert.equal(normalizeDefaultTaxPercent("6.255"), null);
    assert.equal(normalizeDefaultTaxPercent("6."), null);

    assert.equal(isDefaultTaxPercentDraft(""), true);
    assert.equal(isDefaultTaxPercentDraft("6"), true);
    assert.equal(isDefaultTaxPercentDraft("6."), true);
    assert.equal(isDefaultTaxPercentDraft("6.2"), true);
    assert.equal(isDefaultTaxPercentDraft("6.25"), true);
    assert.equal(isDefaultTaxPercentDraft("7.50"), true);
    assert.equal(isDefaultTaxPercentDraft("6.255"), false);
    assert.equal(isDefaultTaxPercentDraft("-1"), false);
    assert.equal(isDefaultTaxPercentDraft("101"), false);

    assert.equal(formatDefaultTaxPercentInput(6.25), "6.25");
    assert.equal(formatDefaultTaxPercentInput(7.5), "7.5");

    // Save → reload path: normalized prefs round-trip without losing decimals.
    const saved = normalizeCommercialBookingPrefs({
      useTaxes: true,
      defaultTaxPercent: 6.25,
    });
    assert.equal(saved.defaultTaxPercent, 6.25);
    const reloaded = normalizeCommercialBookingPrefs(saved);
    assert.equal(reloaded.defaultTaxPercent, 6.25);
    assert.equal(
      normalizeCommercialBookingPrefs({ useTaxes: true, defaultTaxPercent: "7.50" }).defaultTaxPercent,
      7.5,
    );
  });
});

describe("Commercial steps vs Booked", () => {
  it("contract-only acceptance does not complete commercial steps without signed contract", () => {
    const prefs = { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "contract" as const };
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs,
      }),
      false,
    );
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs,
      }),
      true,
    );
  });

  it("collectInitialPayment=false skips Deposit stage — still not Booked", () => {
    const prefs = {
      ...DEFAULT_COMMERCIAL_BOOKING_PREFS,
      collectInitialPayment: false,
      initialPaymentRequired: false,
    };
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [],
        prefs,
      }),
      false,
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
    assert.equal(j.commercialReady, true);
    assert.equal(j.currentKey, "ready");
    assert.ok(!j.stages.some((s) => s.key === "deposit"));
    assert.equal(j.depositSummary, null);
    assert.equal(j.remainingSummary, null);
    assert.match(j.direction, /Mark them Booked when you're ready/i);
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

  it("legacy deposit_first is ignored — agreement comes before deposit", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection(),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, processOrder: "deposit_first" },
    });
    assert.equal(j.currentKey, "agreement");
    assert.equal(j.stages[1]?.key, "agreement");
    assert.equal(j.stages[2]?.key, "deposit");
  });

  it("contract-only venues hide Create share link as primary", () => {
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
      contract: { id: "c1", status: "signed" },
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

  it("custom percentage schedule applies from commercial total (not deposit override)", () => {
    const result = buildGuidedScheduleLines({
      total: 7700,
      deposit: 800,
      today: "2026-09-23",
      remainingDueDate: null,
      eventDate: "2027-06-15",
      scheduleStructure: "custom",
      customSchedule: {
        mode: "percentage",
        items: [
          { label: "Initial payment", pctOfTotal: 25, amount: 0, timing: { type: "at_booking" }, obligationKind: "deposit" },
          { label: "Payment 2", pctOfTotal: 25, amount: 0, timing: { type: "before_event", days: 90 }, obligationKind: "installment" },
          { label: "Payment 3", pctOfTotal: 25, amount: 0, timing: { type: "before_event", days: 60 }, obligationKind: "installment" },
          { label: "Final payment", pctOfTotal: 25, amount: 0, timing: { type: "before_event", days: 30 }, obligationKind: "final" },
        ],
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.lines.map((l) => l.amount),
      [1925, 1925, 1925, 1925],
    );
  });
});
