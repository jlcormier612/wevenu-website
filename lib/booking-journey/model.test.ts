import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBookingJourney,
  canCreateContract,
  commercialStepsComplete,
  isVenueManualTakeover,
} from "@/lib/booking-journey/model";
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

  it("a sent proposal waits and does not offer Select package", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      proposal: {
        id: "prop-1",
        status: "sent",
        offeredAt: "2026-09-26T00:00:00Z",
        acceptToken: "tok",
        selectionId: null,
      },
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "either" },
    });
    assert.match(j.direction, /waiting for the couple/i);
    assert.equal(j.primaryAction, "copy_proposal_link");
    assert.notEqual(j.primaryAction, "select_package");
    assert.notEqual(j.secondaryAction, "select_package");
  });

  it("a withdrawn proposal unlocks Select package and stops waiting", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      proposal: {
        id: "prop-1",
        status: "withdrawn",
        offeredAt: "2026-09-26T00:00:00Z",
        acceptToken: "tok",
        selectionId: null,
      },
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "either" },
    });
    assert.doesNotMatch(j.direction, /waiting for the couple/i);
    assert.equal(j.primaryAction, "select_package");
    assert.equal(j.primaryLabel, "Select package");
    assert.equal(j.proposal?.status, "withdrawn");
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

  it("1–12. withdrawn proposal + venue selection + no contract → Create contract is primary", () => {
    const withdrawn = {
      id: "prop-1",
      status: "withdrawn" as const,
      offeredAt: "2026-09-26T00:00:00Z",
      acceptToken: "tok",
      selectionId: null,
    };
    const venueSel = selection({ proposalId: null, status: "draft" });
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      selection: venueSel,
      proposal: withdrawn,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "either" },
    });
    assert.equal(isVenueManualTakeover({ proposal: withdrawn, selection: venueSel, contract: null }), true);
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.primaryLabel, "Create contract");
    assert.match(j.primaryHref ?? "", /selectionId=sel-1/);
    assert.equal(j.secondaryAction, "create_proposal");
    assert.equal(j.secondaryLabel, "Start a new proposal");
    assert.equal(j.proposal?.status, "withdrawn");
    assert.equal(j.selection?.proposalId, null);
    assert.equal(j.selection?.status, "draft");
    assert.doesNotMatch(j.direction, /waiting for the couple/i);
    assert.doesNotMatch(j.direction, /Create a share link/i);
    assert.equal(
      commercialStepsComplete({ selection: venueSel, contract: null, paymentLines: [] }),
      false,
    );
  });

  it("13. offer-only takeover exposes Create contract as the scoped exception", () => {
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: selection({ proposalId: null, status: "draft" }),
      proposal: {
        id: "prop-1",
        status: "withdrawn",
        offeredAt: "2026-09-26T00:00:00Z",
        acceptToken: "tok",
        selectionId: null,
      },
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.primaryLabel, "Create contract");
    assert.equal(j.secondaryAction, "create_proposal");
    assert.equal(j.secondaryLabel, "Start a new proposal");
  });

  it("14. offer-only normal workflow stays proposal-first without a withdrawn proposal", () => {
    const start = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(start.primaryAction, "create_proposal");
    assert.equal(start.secondaryAction, undefined);

    const pathB = buildBookingJourney({
      leadId: "lead-1",
      selection: selection(),
      proposal: null,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(pathB.primaryAction, "send_offer");
    assert.notEqual(pathB.primaryAction, "create_contract");
    assert.equal(pathB.secondaryAction, undefined);
  });

  it("15. couple-approved proposal is not takeover; Create contract is the next step", () => {
    const approved = {
      id: "prop-1",
      status: "approved" as const,
      offeredAt: "2026-09-26T00:00:00Z",
      acceptToken: "tok",
      selectionId: "sel-1",
    };
    const coupleSel = selection({ proposalId: "prop-1", status: "accepted" });
    assert.equal(
      isVenueManualTakeover({ proposal: approved, selection: coupleSel, contract: null }),
      false,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      eventId: "event-1",
      selection: coupleSel,
      proposal: approved,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.primaryLabel, "Create contract");
    assert.match(j.primaryHref ?? "", /\/contracts\/new\?/);
    assert.match(j.primaryHref ?? "", /selectionId=sel-1/);
    assert.equal(j.currentKey, "agreement");
    assert.equal(j.commercialReady, false);
    assert.doesNotMatch(j.direction, /Collect the .* deposit/i);
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

  it("manual takeover is not a couple acceptance and is not commercial-complete", () => {
    const venueSel = selection({ proposalId: null, status: "draft" });
    const withdrawn = {
      id: "prop-1",
      status: "withdrawn" as const,
      offeredAt: "2026-09-26T00:00:00Z",
      acceptToken: "tok",
      selectionId: null,
    };
    assert.equal(
      isVenueManualTakeover({
        proposal: withdrawn,
        selection: venueSel,
        contract: { id: "c1", status: "draft" },
      }),
      false,
    );
    assert.equal(venueSel.proposalId, null);
    assert.equal(venueSel.status, "draft");
    assert.equal(
      commercialStepsComplete({ selection: venueSel, contract: null, paymentLines: [] }),
      false,
    );
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

  it("accepted + deposit paid is not commercially complete without a signed contract", () => {
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      }),
      false,
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

  it("after accept shows Create contract — acceptance is not the deposit step", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      eventId: "event-1",
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" },
    });
    assert.equal(j.currentKey, "agreement");
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.primaryLabel, "Create contract");
    assert.match(j.direction, /Create a contract to continue/i);
    assert.match(j.direction, /does not execute the contract/i);
    assert.doesNotMatch(j.direction, /They accepted\. Collect the/i);
  });

  it("deposit pending never claims Booked from payment", () => {
    const j = buildBookingJourney({
      clientId: "client-1",
      selection: selection({ status: "accepted", invoiceId: "inv-1" }),
      contract: { id: "c1", status: "signed" },
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
      contract: { id: "c1", status: "signed" },
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
    assert.equal(j.currentKey, "agreement");
    assert.equal(j.primaryAction, "create_contract");
    assert.ok(!j.stages.some((s) => s.key === "deposit" && j.stages.indexOf(s) < j.stages.findIndex((x) => x.key === "agreement")));
  });
});

describe("Create contract after proposal / package resolution", () => {
  const offerPrefs = { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: "offer" as const };
  const approved = {
    id: "prop-1",
    status: "approved" as const,
    offeredAt: "2026-09-26T00:00:00Z",
    acceptToken: "tok",
    selectionId: "sel-1",
  };

  it("venue-authored proposal sent then couple-accepted makes Create contract available", () => {
    const sent = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      proposal: { id: "prop-1", status: "sent", offeredAt: "2026-09-26T00:00:00Z", acceptToken: "tok", selectionId: null },
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(sent.primaryAction, "copy_proposal_link");
    assert.notEqual(sent.primaryAction, "create_contract");

    const acceptedSel = selection({ proposalId: "prop-1", status: "accepted" });
    assert.equal(
      canCreateContract({ selection: acceptedSel, proposal: approved, contract: null, prefs: offerPrefs }),
      true,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      clientId: "client-1",
      selection: acceptedSel,
      proposal: approved,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.match(j.primaryHref ?? "", /\/contracts\/new\?/);
    assert.match(j.primaryHref ?? "", /selectionId=sel-1/);
  });

  it("couple-chosen accepted option makes Create contract available without payment", () => {
    const coupleSel = selection({
      proposalId: "prop-1",
      status: "accepted",
      invoiceId: null,
      contractId: null,
    });
    assert.equal(
      canCreateContract({ selection: coupleSel, proposal: approved, contract: null, prefs: offerPrefs }),
      true,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: coupleSel,
      proposal: approved,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.equal(j.commercialReady, false);
    assert.doesNotMatch(j.direction, /Collect the .* deposit/i);
  });

  it("take-back then venue-resolved package makes Create contract available", () => {
    const withdrawn = {
      id: "prop-1",
      status: "withdrawn" as const,
      offeredAt: "2026-09-26T00:00:00Z",
      acceptToken: "tok",
      selectionId: null,
    };
    const waiting = buildBookingJourney({
      leadId: "lead-1",
      selection: null,
      proposal: withdrawn,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(waiting.primaryAction, "select_package");

    const venueSel = selection({ proposalId: null, status: "draft" });
    assert.equal(
      canCreateContract({ selection: venueSel, proposal: withdrawn, contract: null, prefs: offerPrefs }),
      true,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: venueSel,
      proposal: withdrawn,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.match(j.primaryHref ?? "", /\/contracts\/new\?/);
  });

  it("approved + no contract cannot dead-end for offer, contract, or either", () => {
    const coupleSel = selection({ proposalId: "prop-1", status: "accepted" });
    for (const method of ["offer", "contract", "either"] as const) {
      const prefs = { ...DEFAULT_COMMERCIAL_BOOKING_PREFS, agreementMethod: method };
      assert.equal(
        canCreateContract({ selection: coupleSel, proposal: approved, contract: null, prefs }),
        true,
      );
      const j = buildBookingJourney({
        leadId: "lead-1",
        selection: coupleSel,
        proposal: approved,
        contract: null,
        paymentLines: [],
        portalInvited: false,
        planningStarted: false,
        prefs,
      });
      assert.equal(j.primaryAction, "create_contract", method);
      assert.equal(j.currentKey, "agreement", method);
    }
  });

  it("Create contract does not require payment, payment plan, invoice, or Booked", () => {
    const coupleSel = selection({
      proposalId: "prop-1",
      status: "accepted",
      invoiceId: null,
      contractId: null,
    });
    assert.equal(
      canCreateContract({ selection: coupleSel, proposal: approved, contract: null, prefs: offerPrefs }),
      true,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: coupleSel,
      proposal: approved,
      contract: null,
      paymentLines: [],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(j.primaryAction, "create_contract");
    assert.notEqual(j.primaryAction, "setup_payments");
    assert.equal(j.commercialReady, false);
  });

  it("superseded selection or existing contract hides Create contract", () => {
    assert.equal(
      canCreateContract({
        selection: selection({ status: "superseded" }),
        proposal: approved,
        contract: null,
        prefs: offerPrefs,
      }),
      false,
    );
    assert.equal(
      canCreateContract({
        selection: selection({ status: "accepted" }),
        proposal: approved,
        contract: { id: "c1", status: "draft" },
        prefs: offerPrefs,
      }),
      false,
    );
  });

  it("approval is not a signed contract and is not Booked", () => {
    const coupleSel = selection({ proposalId: "prop-1", status: "accepted" });
    assert.equal(
      commercialStepsComplete({
        selection: coupleSel,
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs: offerPrefs,
      }),
      false,
    );
    const j = buildBookingJourney({
      leadId: "lead-1",
      selection: coupleSel,
      proposal: approved,
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
      portalInvited: false,
      planningStarted: false,
      prefs: offerPrefs,
    });
    assert.equal(j.stages.find((s) => s.key === "agreement")?.state, "current");
    assert.equal(j.commercialReady, false);
    assert.doesNotMatch(j.direction, /Mark them Booked when you're ready/i);
  });
});
