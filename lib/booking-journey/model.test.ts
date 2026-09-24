import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBookingJourney, commercialStepsComplete } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";

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

describe("Booking Journey derivation", () => {
  it("Agreement=Either starts with Create proposal + Select package", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "either" },
    });
    assert.equal(j.currentKey, "package");
    assert.equal(j.primaryAction, "create_proposal");
    assert.equal(j.primaryLabel, "Create proposal");
    assert.equal(j.secondaryAction, "select_package");
    assert.equal(j.commercialReady, false);
  });

  it("Agreement=Contract starts with Select package only", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "contract" },
    });
    assert.equal(j.primaryAction, "select_package");
    assert.equal(j.secondaryAction, undefined);
  });

  it("Agreement=Proposal starts with Create proposal only", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(j.primaryAction, "create_proposal");
    assert.equal(j.secondaryAction, undefined);
  });

  it("after package selected offers share link / Create contract", () => {
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
    assert.equal(j.primaryLabel, "Create share link");
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

  it("commercial steps are not complete on selection alone", () => {
    assert.equal(
      commercialStepsComplete({ selection: selection(), contract: null, paymentLines: [] }),
      false,
    );
  });

  it("commercial steps incomplete when deposit unpaid", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection(),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      }),
      false,
    );
  });

  it("commercial steps complete when signed + deposit paid — still not Booked", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection(),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      }),
      true,
    );
  });

  it("commercial steps complete when accepted + deposit paid — still not Booked", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      }),
      true,
    );
  });

  it("does not treat a non-deposit payment as initial payment", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "final", status: "paid", amount: 2400 }],
      }),
      false,
    );
  });

  it("after accept shows Set up payments with deposit language", () => {
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
    assert.match(j.direction, /accepted/i);
    assert.match(j.direction, /Collect the \$800\.00 deposit/i);
    assert.match(j.direction, /\$2,400\.00/);
  });

  it("deposit pending never claims Booked from payment", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.currentKey, "deposit");
    assert.match(j.direction, /Waiting for the \$800\.00 deposit/i);
    assert.match(j.direction, /does not mark them Booked/i);
    assert.equal(j.commercialReady, false);
  });

  it("ready stage presents planning as optional without claiming Booked", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      eventId: "event-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
    });
    assert.equal(j.currentKey, "ready");
    assert.equal(j.commercialReady, true);
    assert.match(j.direction, /Mark them Booked when you're ready/i);
    assert.match(j.direction, /optional/i);
    assert.equal(j.primaryAction, "invite_portal");
    assert.equal(j.stages.find((s) => s.key === "ready")?.label, "Next steps");
  });

  it("ignores legacy processOrder deposit_first", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: {
        ...DEFAULT_COMMERCIAL_BOOKING_PREFS,
        processOrder: "deposit_first",
      },
    });
    // Deterministic: agreement first — but accepted means agreement done → deposit
    assert.equal(j.currentKey, "deposit");
    assert.ok(!j.stages.some((s) => s.key === "deposit" && j.stages.indexOf(s) < j.stages.findIndex((x) => x.key === "agreement")));
  });
});
