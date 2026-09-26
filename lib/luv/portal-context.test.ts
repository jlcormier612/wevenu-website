/**
 * Phase 2A — Luv Ask portal context: typed snapshot, prompt layer, chips.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCoupleAskLuvSystemPrompt } from "@/lib/luv/couple-ask-prompt";
import { retrieveCoupleHtcKnowledge } from "@/lib/luv/couple-htc-knowledge";
import {
  buildLuvAskContractFact,
  buildLuvAskDocumentFact,
  buildLuvAskPaymentFacts,
  buildLuvAskPortalContext,
  formatPortalContextForPrompt,
  hasAuthoritativeNextPayment,
  LUV_ASK_CHIP_NEXT_PAYMENT,
  resolveLuvAskSuggestedChips,
  type LuvAskPortalContext,
} from "@/lib/luv/portal-context";

const NOW = new Date("2030-06-15T12:00:00.000Z");

function scheduleWithLines(
  lineItems: {
    id: string;
    label: string;
    amount: number;
    dueDate: string | null;
    status: string;
  }[],
) {
  return {
    id: "sched_1",
    title: "Wedding Payment Plan",
    invoiceId: "inv_1",
    createdAt: "2030-01-01T00:00:00.000Z",
    lineItems,
  };
}

describe("LuvAskPortalContext — payments", () => {
  it("includes payment plan totals and next payment when schedule present", () => {
    const facts = buildLuvAskPaymentFacts({
      now: NOW,
      schedules: [
        scheduleWithLines([
          {
            id: "li_1",
            label: "Deposit",
            amount: 500,
            dueDate: "2030-01-10",
            status: "paid",
          },
          {
            id: "li_2",
            label: "Final Payment",
            amount: 1500,
            dueDate: "2030-08-01",
            status: "pending",
          },
        ]),
      ],
    });

    assert.equal(facts.hasPaymentPlan, true);
    assert.equal(facts.planTotal, 2000);
    assert.equal(facts.amountPaid, 500);
    assert.equal(facts.remainingBalance, 1500);
    assert.ok(facts.nextScheduledPayment);
    assert.equal(facts.nextScheduledPayment!.label, "Final Payment");
    assert.equal(facts.nextScheduledPayment!.amount, 1500);
    assert.equal(facts.nextScheduledPayment!.dueDate, "2030-08-01");
    assert.equal(facts.nextScheduledPayment!.isOverdue, false);
    assert.ok(facts.nextScheduledPayment!.dueDateLabel.length > 0);
  });

  it("marks next payment overdue when due date is past", () => {
    const facts = buildLuvAskPaymentFacts({
      now: NOW,
      schedules: [
        scheduleWithLines([
          {
            id: "li_1",
            label: "Balance",
            amount: 800,
            dueDate: "2030-05-01",
            status: "pending",
          },
        ]),
      ],
    });
    assert.equal(facts.nextScheduledPayment!.isOverdue, true);
  });

  it("leaves next scheduled payment unset when schedule has no due dates", () => {
    const facts = buildLuvAskPaymentFacts({
      now: NOW,
      schedules: [
        scheduleWithLines([
          {
            id: "li_1",
            label: "Balance",
            amount: 750,
            dueDate: null,
            status: "pending",
          },
        ]),
      ],
    });
    assert.equal(facts.hasPaymentPlan, true);
    assert.equal(facts.nextScheduledPayment, null);
    assert.equal(facts.remainingBalance, 750);
  });

  it("does not convert unscheduled invoice balance into a due date", () => {
    const facts = buildLuvAskPaymentFacts({
      now: NOW,
      schedules: [],
      invoices: [
        {
          id: "inv_bare",
          invoiceNumber: "INV-100",
          displayName: "Venue Invoice",
          status: "sent",
          total: 750,
          balanceDue: 750,
          dueDate: null,
        },
      ],
    });

    assert.equal(facts.hasPaymentPlan, false);
    assert.equal(facts.nextScheduledPayment, null);
    assert.equal(facts.unscheduledBalances.length, 1);
    assert.equal(facts.unscheduledBalances[0]!.balance, 750);
    assert.equal(facts.unscheduledBalances[0]!.invoiceDueDate, null);
    assert.equal(facts.unscheduledBalances[0]!.invoiceDueDateLabel, null);

    const prompt = formatPortalContextForPrompt(
      buildLuvAskPortalContext({
        schedules: [],
        invoices: [
          {
            id: "inv_bare",
            invoiceNumber: "INV-100",
            displayName: "Venue Invoice",
            status: "sent",
            total: 750,
            balanceDue: 750,
            dueDate: null,
          },
        ],
        now: NOW,
      }),
    );
    assert.match(prompt, /Balance: \$750\.00/);
    assert.match(prompt, /No payment schedule has been set for this invoice yet/);
    assert.doesNotMatch(prompt, /Next scheduled payment:.*due/);
  });

  it("omits payment facts entirely when schedules and invoices are not provided", () => {
    const ctx = buildLuvAskPortalContext({ documents: [] });
    assert.equal(ctx.payments, null);
  });
});

describe("LuvAskPortalContext — contracts", () => {
  it("maps sent + unsigned clients to Sent to Client", () => {
    const fact = buildLuvAskContractFact(
      { name: "Venue Agreement", docType: "contract", status: "sent", id: "c1" },
      [
        { signerType: "client", signedAt: null, isRequired: true },
        { signerType: "venue", signedAt: null, isRequired: true },
      ],
    );
    assert.ok(fact);
    assert.equal(fact!.lifecycleState, "sent_to_client");
    assert.equal(fact!.lifecycleLabel, "Sent to Client");
    assert.equal(fact!.signedByCouple, false);
    assert.equal(fact!.signedByVenue, false);
    assert.equal(fact!.fullyExecuted, false);
  });

  it("maps client-signed / venue-unsigned to Awaiting Venue Signature", () => {
    const fact = buildLuvAskContractFact(
      { name: "Venue Agreement", docType: "contract", status: "sent", id: "c1" },
      [
        { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
        { signerType: "venue", signedAt: null, isRequired: true },
      ],
    );
    assert.ok(fact);
    assert.equal(fact!.lifecycleState, "awaiting_venue_signature");
    assert.equal(fact!.lifecycleLabel, "Awaiting Venue Signature");
    assert.equal(fact!.signedByCouple, true);
    assert.equal(fact!.signedByVenue, false);
    assert.equal(fact!.fullyExecuted, false);
  });

  it("requires both signatures for Fully Executed", () => {
    const fact = buildLuvAskContractFact(
      {
        name: "Venue Agreement",
        docType: "contract",
        status: "signed",
        signedAt: "2030-06-01T00:00:00.000Z",
        id: "c1",
      },
      [
        { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
        { signerType: "venue", signedAt: "2030-06-01T00:00:00.000Z", isRequired: true },
      ],
    );
    assert.ok(fact);
    assert.equal(fact!.lifecycleState, "fully_signed");
    assert.equal(fact!.lifecycleLabel, "Fully Executed");
    assert.equal(fact!.fullyExecuted, true);
    assert.equal(fact!.signedByCouple, true);
    assert.equal(fact!.signedByVenue, true);
    assert.ok(fact!.signedAtLabel);
  });

  it("does not invent Fully Executed from client signature alone", () => {
    const fact = buildLuvAskContractFact(
      { name: "Venue Agreement", docType: "contract", status: "sent", id: "c1" },
      [
        { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
        { signerType: "venue", signedAt: null, isRequired: true },
      ],
    );
    assert.equal(fact!.fullyExecuted, false);
    assert.notEqual(fact!.lifecycleLabel, "Fully Executed");
  });
});

describe("LuvAskPortalContext — documents", () => {
  it("exposes customer-visible names and type-specific status labels", () => {
    const contract = buildLuvAskDocumentFact({
      name: "Venue Agreement",
      docType: "contract",
      status: "sent",
    });
    const invoice = buildLuvAskDocumentFact({
      name: "Invoice #42",
      docType: "invoice",
      status: "sent",
    });
    assert.equal(contract!.statusLabel, "Awaiting your signature");
    assert.equal(invoice!.statusLabel, "Issued");
    assert.notEqual(invoice!.statusLabel, "Awaiting your signature");
  });

  it("does not expose internal ids or private fields on the snapshot", () => {
    const ctx = buildLuvAskPortalContext({
      schedules: [
        scheduleWithLines([
          {
            id: "li_secret",
            label: "Deposit",
            amount: 100,
            dueDate: "2030-07-01",
            status: "pending",
          },
        ]),
      ],
      documents: [
        {
          id: "doc_internal_uuid",
          name: "Venue Agreement",
          docType: "contract",
          status: "sent",
          signToken: "tok_should_not_leak",
        },
      ],
      contractSignersById: {
        doc_internal_uuid: [
          { signerType: "client", signedAt: null, isRequired: true },
          { signerType: "venue", signedAt: null, isRequired: true },
        ],
      },
      now: NOW,
    });

    const json = JSON.stringify(ctx);
    assert.doesNotMatch(json, /doc_internal_uuid/);
    assert.doesNotMatch(json, /tok_should_not_leak/);
    assert.doesNotMatch(json, /li_secret/);
    assert.doesNotMatch(json, /signToken/);
    assert.equal(ctx.source, "portal_context");
    assert.ok(ctx.contracts[0]);
    assert.equal(ctx.documents[0]!.name, "Venue Agreement");
  });

  it("omits missing contract rather than inventing unsigned state", () => {
    const ctx = buildLuvAskPortalContext({ schedules: [], documents: [] });
    assert.equal(ctx.contracts.length, 0);
    const prompt = formatPortalContextForPrompt(ctx);
    assert.match(prompt, /Contracts: \(none visible/);
    assert.doesNotMatch(prompt, /you haven't signed/);
  });
});

describe("Ask Luv — portal context prompt layer", () => {
  it("passes HTC and Portal Context as distinct layers", () => {
    const htcHits = retrieveCoupleHtcKnowledge("How do I sign my contract?");
    const portal = buildLuvAskPortalContext({
      documents: [
        { name: "Venue Agreement", docType: "contract", status: "sent", id: "c1" },
      ],
      contractSignersById: {
        c1: [
          { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
          { signerType: "venue", signedAt: null, isRequired: true },
        ],
      },
    });
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits,
      venueInfo: { parkingInfo: "Oak Street lot." },
      portalContext: portal,
    });

    const htcIdx = prompt.indexOf("--- HTC PRODUCT KNOWLEDGE ---");
    const venueIdx = prompt.indexOf("--- VENUE KNOWLEDGE ---");
    const portalIdx = prompt.indexOf("--- CURRENT PORTAL CONTEXT ---");
    const unknownIdx = prompt.indexOf("--- UNKNOWN ---");
    assert.ok(htcIdx > 0 && venueIdx > htcIdx && portalIdx > venueIdx && unknownIdx > portalIdx);
    assert.match(prompt, /source: htc_product/);
    assert.match(prompt, /source: portal_context/);
    assert.match(prompt, /status: provided/);
    assert.match(prompt, /Awaiting Venue Signature/);
  });

  it("instructs portal facts to take precedence over generic HTC how-tos", () => {
    const portal = buildLuvAskPortalContext({
      documents: [
        { name: "Venue Agreement", docType: "contract", status: "sent", id: "c1" },
      ],
      contractSignersById: {
        c1: [
          { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
          { signerType: "venue", signedAt: null, isRequired: true },
        ],
      },
    });
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits: retrieveCoupleHtcKnowledge("How do I sign my contract?"),
      venueInfo: {},
      portalContext: portal,
    });
    assert.match(prompt, /takes precedence over generic HTC/);
    assert.match(prompt, /do NOT tell them to sign from Documents/);
    assert.match(prompt, /Awaiting Venue Signature/);
  });

  it("keeps Phase 1 placeholder when portal context is omitted", () => {
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits: [],
      venueInfo: {},
    });
    assert.match(prompt, /status: not_provided_in_phase_1/);
    assert.doesNotMatch(prompt, /status: provided/);
  });

  it("formats authoritative next payment for answering payment questions", () => {
    const portal = buildLuvAskPortalContext({
      now: NOW,
      schedules: [
        scheduleWithLines([
          {
            id: "li_2",
            label: "Final Payment",
            amount: 1500,
            dueDate: "2030-08-01",
            status: "pending",
          },
        ]),
      ],
    });
    const prompt = formatPortalContextForPrompt(portal);
    assert.match(prompt, /Next scheduled payment: Final Payment/);
    assert.match(prompt, /\$1,500\.00/);
    assert.match(prompt, /2030|August|Aug/i);
  });

  it("does not invent a payment due date when schedule is absent", () => {
    const portal = buildLuvAskPortalContext({
      schedules: [],
      invoices: [
        {
          id: "inv_bare",
          invoiceNumber: "INV-9",
          displayName: "Invoice",
          status: "sent",
          total: 750,
          balanceDue: 750,
          dueDate: null,
        },
      ],
    });
    const prompt = formatPortalContextForPrompt(portal);
    assert.doesNotMatch(prompt, /Next scheduled payment: [^n].*due/);
    assert.match(prompt, /Do not invent a due date/);
  });

  it("surfaces actual portal contract state for contract questions", () => {
    const portal = buildLuvAskPortalContext({
      documents: [
        { name: "Primary Contract", docType: "contract", status: "signed", id: "c1", signedAt: "2030-06-01" },
      ],
      contractSignersById: {
        c1: [
          { signerType: "client", signedAt: "2030-05-01T00:00:00.000Z", isRequired: true },
          { signerType: "venue", signedAt: "2030-06-01T00:00:00.000Z", isRequired: true },
        ],
      },
    });
    const prompt = buildCoupleAskLuvSystemPrompt({
      venueName: "Test Venue",
      voiceInstruction: "Be warm and clear.",
      htcHits: [],
      venueInfo: {},
      portalContext: portal,
    });
    assert.match(prompt, /Fully Executed/);
    assert.match(prompt, /Primary Contract/);
  });
});

describe("Ask Luv — portal-context barrel boundary", () => {
  it("does not re-export the server loader from the client-safe barrel", async () => {
    const barrel = await import("@/lib/luv/portal-context");
    assert.equal(
      "loadLuvAskPortalContext" in barrel,
      false,
      "loadLuvAskPortalContext must stay on ./load so client components cannot pull supabase/server",
    );
  });
});

describe("Ask Luv — suggested chips", () => {
  it("shows next-payment chip only when authoritative next payment exists", () => {
    const withNext = buildLuvAskPortalContext({
      now: NOW,
      schedules: [
        scheduleWithLines([
          {
            id: "li_1",
            label: "Final Payment",
            amount: 1000,
            dueDate: "2030-09-01",
            status: "pending",
          },
        ]),
      ],
    });
    assert.equal(hasAuthoritativeNextPayment(withNext), true);
    const chips = resolveLuvAskSuggestedChips(withNext);
    assert.ok(chips.includes(LUV_ASK_CHIP_NEXT_PAYMENT));
    assert.equal(chips[0], LUV_ASK_CHIP_NEXT_PAYMENT);

    const noSchedule: LuvAskPortalContext = buildLuvAskPortalContext({
      schedules: [],
      invoices: [
        {
          id: "inv_bare",
          invoiceNumber: "INV-1",
          displayName: "Invoice",
          status: "sent",
          total: 750,
          balanceDue: 750,
          dueDate: null,
        },
      ],
    });
    assert.equal(hasAuthoritativeNextPayment(noSchedule), false);
    assert.ok(!resolveLuvAskSuggestedChips(noSchedule).includes(LUV_ASK_CHIP_NEXT_PAYMENT));
    assert.ok(!resolveLuvAskSuggestedChips(null).includes(LUV_ASK_CHIP_NEXT_PAYMENT));
  });
});
