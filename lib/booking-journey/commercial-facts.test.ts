import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeCommercialFacts } from "@/lib/booking-journey/commercial-facts";
import { commercialStepsComplete } from "@/lib/booking-journey/model";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: "lead-1",
    clientId: null,
    eventId: null,
    proposalId: null,
    sourcePackageId: "pkg-1",
    name: "Essential Wedding",
    totalAmount: 15000,
    depositAmount: 3750,
    includedItems: [],
    status: "draft",
    version: 1,
    supersededById: null,
    offeredAt: null,
    acceptedAt: null,
    acceptToken: null,
    offerMessage: null,
    invoiceId: null,
    contractId: null,
    createdAt: "2026-09-19T00:00:00Z",
    updatedAt: "2026-09-19T00:00:00Z",
    ...overrides,
  };
}

describe("commercial artifact states", () => {
  it("direct package selection does not invent a Proposal row", () => {
    const facts = describeCommercialFacts({
      selection: selection(),
      proposal: null,
      contract: null,
      paymentLines: [],
    });
    const pkg = facts.find((row) => row.key === "package");
    const proposal = facts.find((row) => row.key === "proposal");
    assert.equal(pkg?.state, "Essential Wedding · $15,000.00");
    assert.equal(pkg?.detail, "Selected internally · Not yet shared");
    assert.equal(proposal, undefined);
    assert.equal(
      commercialStepsComplete({ selection: selection(), contract: null, paymentLines: [] }),
      false,
    );
  });

  it("L1 proposal row appears only when a proposal record exists", () => {
    const facts = describeCommercialFacts({
      selection: null,
      proposal: {
        id: "prop-1",
        status: "sent",
        offeredAt: "2026-09-19T19:42:00.000Z",
        acceptToken: "tok",
        selectionId: null,
      },
      contract: null,
      paymentLines: [],
    });
    const proposal = facts.find((row) => row.key === "proposal");
    assert.equal(proposal?.state, "Sent");
    assert.match(proposal?.detail ?? "", /Waiting for the couple/);
  });

  it("a withdrawn proposal is history, not a waiting state", () => {
    const facts = describeCommercialFacts({
      selection: null,
      proposal: {
        id: "prop-1",
        status: "withdrawn",
        offeredAt: "2026-09-19T19:42:00.000Z",
        acceptToken: "tok",
        selectionId: null,
      },
      contract: null,
      paymentLines: [],
    });
    const proposal = facts.find((row) => row.key === "proposal");
    assert.equal(proposal?.state, "Withdrawn");
    assert.match(proposal?.detail ?? "", /continued manually/i);
    assert.doesNotMatch(proposal?.detail ?? "", /Waiting for the couple/);
    const pkg = facts.find((row) => row.key === "package");
    assert.equal(pkg?.state, "Not selected");
  });

  it("acceptance is not contract execution", () => {
    const facts = describeCommercialFacts({
      selection: selection({ status: "accepted", acceptedAt: "2026-09-19T19:42:00.000Z" }),
      contract: null,
      paymentLines: [],
    });
    assert.equal(facts.find((row) => row.key === "proposal"), undefined);
    assert.equal(facts.find((row) => row.key === "contract")?.state, "Not created");
  });

  it("keeps the client-first contract labels", () => {
    const sent = describeCommercialFacts({
      selection: null,
      contract: {
        id: "c1",
        status: "sent",
        venueSigned: false,
        requiredClientTotal: 1,
        requiredClientSigned: 1,
      },
      paymentLines: [],
    }).find((row) => row.key === "contract");
    assert.equal(sent?.state, "Awaiting Venue Signature");

    const executed = describeCommercialFacts({
      selection: null,
      contract: { id: "c1", status: "signed", venueSigned: true, requiredClientTotal: 1, requiredClientSigned: 1 },
      paymentLines: [],
    }).find((row) => row.key === "contract");
    assert.equal(executed?.state, "Fully Executed");
  });

  it("does not treat an unpaid deposit as paid", () => {
    const facts = describeCommercialFacts({
      selection: selection({ invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 3750, dueDate: "2026-09-28" }],
      today: "2026-09-28",
    });
    assert.equal(facts.find((row) => row.key === "invoice"), undefined);
    assert.notEqual(facts.find((row) => row.key === "deposit")?.state, "Paid");
    assert.match(facts.find((row) => row.key === "deposit")?.detail ?? "", /Included when you send/);
    assert.equal(
      commercialStepsComplete({
        selection: selection({ status: "accepted", invoiceId: "inv-1" }),
        contract: null,
        paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 3750 }],
      }),
      false,
    );
  });

  it("a paid deposit is distinct from a configured package amount", () => {
    const unpaid = describeCommercialFacts({
      selection: selection(),
      contract: null,
      paymentLines: [],
    }).find((row) => row.key === "deposit");
    assert.equal(unpaid, undefined);
    const paid = describeCommercialFacts({
      selection: selection({ status: "accepted" }),
      contract: { id: "c1", status: "signed" },
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 3750 }],
    }).find((row) => row.key === "deposit");
    assert.equal(paid?.state, "Paid");
  });

  it("before setup shows one payment-plan row and no invoice or initial-payment setup tasks", () => {
    const facts = describeCommercialFacts({
      selection: selection({ depositAmount: 4500 }),
      contract: null,
      paymentLines: [],
    });
    const keys = facts.map((row) => row.key);
    assert.deepEqual(keys.filter((k) => k === "payment_plan" || k === "invoice" || k === "deposit"), ["payment_plan"]);
    const plan = facts.find((row) => row.key === "payment_plan");
    assert.equal(plan?.title, "Payment plan");
    assert.equal(plan?.state, "Not configured");
    assert.equal(facts.find((row) => row.key === "invoice"), undefined);
    assert.equal(facts.find((row) => row.key === "deposit"), undefined);
  });

  it("after setup lists installments and shows initial payment as a request action", () => {
    const facts = describeCommercialFacts({
      selection: selection({ invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [
        { obligationKind: "deposit", status: "pending", amount: 4500, dueDate: "2026-09-28" },
        { obligationKind: "final", status: "pending", amount: 13500, dueDate: "2027-09-11" },
      ],
      today: "2026-09-28",
    });
    const plan = facts.find((row) => row.key === "payment_plan");
    assert.equal(plan?.state, "2 installments");
    assert.match(plan?.detail ?? "", /\$4,500\.00 due today/);
    assert.match(plan?.detail ?? "", /\$13,500\.00 due September 11, 2027/);
    const deposit = facts.find((row) => row.key === "deposit");
    assert.equal(deposit?.state, "$4,500.00 due today");
    assert.equal(deposit?.detail, "Included when you send");
    assert.equal(facts.find((row) => row.key === "invoice"), undefined);
  });

  it("after a successful payment request does not present another request setup", () => {
    const facts = describeCommercialFacts({
      selection: selection({ invoiceId: "inv-1" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "pending", amount: 4500, dueDate: "2026-09-28" }],
      paymentRequestSent: true,
      today: "2026-09-28",
    });
    const deposit = facts.find((row) => row.key === "deposit");
    assert.equal(deposit?.detail, null);
    assert.match(deposit?.state ?? "", /\$4,500\.00 due today/);
  });

  it("Booked fact never derives Booked from payment", () => {
    const booked = describeCommercialFacts({
      selection: selection({ status: "accepted", acceptedAt: "2026-09-20T15:00:00.000Z" }),
      contract: null,
      paymentLines: [],
    }).find((row) => row.key === "booked");
    assert.equal(booked?.state, "Venue decision");
    assert.match(booked?.detail ?? "", /do not decide Booked/i);
  });

  it("Booked fact stays venue decision even when commercial steps complete", () => {
    const booked = describeCommercialFacts({
      selection: selection({ status: "accepted" }),
      contract: null,
      paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 3750 }],
      prefs: {
        ...DEFAULT_COMMERCIAL_BOOKING_PREFS,
        agreementMethod: "contract",
      },
    }).find((row) => row.key === "booked");
    assert.equal(booked?.state, "Venue decision");
  });
});

describe("workspaces do not render the old Booking Journey", () => {
  it("Lead and Client use commercial facts, not the five-step strip", () => {
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    const lead = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const event = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(panel, /CommercialFacts/);
    assert.doesNotMatch(panel, /BookingJourneyStrip/);
    assert.match(panel, /Create share link/);
    assert.doesNotMatch(panel, /Send proposal/);
    assert.match(panel, /ArtifactReviewOverlay/);
    assert.match(lead, /Pipeline stage/);
    assert.match(lead, /BookingJourneyPanel/);
    assert.match(event, /EventReadinessCard/);
    assert.match(event, /BookingJourneyPanel/);
    assert.doesNotMatch(inbox, /Filter by booking stage/);
    assert.doesNotMatch(inbox, /value="agreement"/);
    const invoice = readFileSync(resolve("components/invoices/invoice-detail.tsx"), "utf8");
    assert.match(invoice, /ArtifactReviewOverlay/);
    assert.match(invoice, /send-invoice-and-payment-plan/);
    assert.match(invoice, /InvoicePrintDocument/);
    assert.doesNotMatch(invoice, /Request initial payment/);
    assert.doesNotMatch(invoice, /Mark as Sent/);
  });

  it("overview presents one payment setup action and no fake invoice/deposit setup", () => {
    const factsUi = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
    assert.match(factsUi, /data-testid="setup-payments"/);
    assert.match(factsUi, /Set up payments/);
    assert.doesNotMatch(factsUi, /Set up initial payment/);
    assert.doesNotMatch(factsUi, /data-testid="request-initial-payment"/);
    assert.match(factsUi, /Preview and send/);
    assert.match(factsUi, /href=\{\`\/invoices\/\$\{selection\.invoiceId\}`\}/);
    const describe = readFileSync(resolve("lib/booking-journey/commercial-facts.ts"), "utf8");
    const fn = describe.slice(describe.indexOf("export function describeCommercialFacts"));
    assert.doesNotMatch(fn, /invoiceFact\(/);
  });
});
