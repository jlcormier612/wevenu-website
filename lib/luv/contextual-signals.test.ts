/**
 * Contextual intelligence S1–S4 — pure evaluator tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CONTEXTUAL_EVENT_WINDOW_DAYS,
  UNATTENDED_INQUIRY_HOURS,
  applyContextualSupersession,
  buildS1EventContractObservation,
  buildS2EventPaymentObservation,
  buildS3UnattendedInquiryObservation,
  buildS4TourPrepObservation,
  isUnattendedInquiryAge,
  isWithinEventWindow,
  shouldSuppressLegacyContractObservation,
  shouldSuppressLegacyFollowupObservation,
  tourPreparationEvidence,
  type ContextualContract,
  type ContextualEvent,
  type ContextualLead,
  type ContextualPaymentAttention,
  type ContextualTour,
  type ContextualTourLeadPrep,
} from "@/lib/luv/contextual-signals";
import type { LuvObservation } from "@/lib/luv/types";

const VENUE = "venue-a";
const OTHER = "venue-b";
const NOW = Date.parse("2026-09-30T15:00:00.000Z");

function eventDateOffset(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function event(partial: Partial<ContextualEvent> & Pick<ContextualEvent, "id">): ContextualEvent {
  return {
    venueId: VENUE,
    name: "Alex & Sam — wedding",
    eventDate: eventDateOffset(12),
    status: "confirmed",
    clientId: "client-1",
    ...partial,
  };
}

function contract(partial: Partial<ContextualContract> & Pick<ContextualContract, "id" | "eventId">): ContextualContract {
  return {
    venueId: VENUE,
    title: "Venue Agreement",
    status: "sent",
    sentAt: "2026-09-20T12:00:00.000Z",
    clientId: "client-1",
    clientFirstName: "Alex",
    clientLastName: "Rivera",
    ...partial,
  };
}

function lead(partial: Partial<ContextualLead> & Pick<ContextualLead, "id">): ContextualLead {
  return {
    venueId: VENUE,
    firstName: "Jordan",
    lastName: "Lee",
    salesStage: "new_inquiry",
    createdAt: new Date(NOW - UNATTENDED_INQUIRY_HOURS * 3_600_000).toISOString(),
    lastContactedAt: null,
    ...partial,
  };
}

function tour(partial: Partial<ContextualTour> & Pick<ContextualTour, "id">): ContextualTour {
  return {
    venueId: VENUE,
    scheduledAt: new Date(NOW + 2 * 86_400_000).toISOString(),
    contactName: "Casey Morgan",
    durationMinutes: 60,
    leadId: "lead-tour-1",
    ...partial,
  };
}

describe("contextual window helpers", () => {
  it("S1/S2: event 21 days away qualifies; 22 days does not", () => {
    assert.equal(isWithinEventWindow(eventDateOffset(21), { venueId: VENUE, nowMs: NOW }), true);
    assert.equal(isWithinEventWindow(eventDateOffset(22), { venueId: VENUE, nowMs: NOW }), false);
    assert.equal(isWithinEventWindow(eventDateOffset(0), { venueId: VENUE, nowMs: NOW }), true);
    assert.equal(CONTEXTUAL_EVENT_WINDOW_DAYS, 21);
  });

  it("S3: 47h does not qualify; 48h does", () => {
    const at47 = new Date(NOW - 47 * 3_600_000).toISOString();
    const at48 = new Date(NOW - 48 * 3_600_000).toISOString();
    assert.equal(isUnattendedInquiryAge(at47, { venueId: VENUE, nowMs: NOW }), false);
    assert.equal(isUnattendedInquiryAge(at48, { venueId: VENUE, nowMs: NOW }), true);
  });
});

describe("S1 event + contract", () => {
  it("positive: approaching event + sent contract", () => {
    const obs = buildS1EventContractObservation(
      event({ id: "ev1", eventDate: eventDateOffset(12) }),
      contract({ id: "c1", eventId: "ev1" }),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(obs);
    assert.equal(obs!.id, "event-contract-unsigned-c1");
    assert.match(obs!.message, /12 days/);
    assert.match(obs!.message, /awaiting signature/);
    assert.match(obs!.detail ?? "", /signed agreement|planning|payment/i);
    assert.equal(obs!.link, "/contracts/c1");
    assert.equal(obs!.recommendation?.link, "/contracts/c1");
    // Prefix gate — Dashboard L1 tests cover UUID hrefs + id family.
    assert.match(obs!.id, /^event-contract-unsigned-/);
  });

  it("boundary 21 days qualifies; 22 does not", () => {
    assert.ok(
      buildS1EventContractObservation(
        event({ id: "ev1", eventDate: eventDateOffset(21) }),
        contract({ id: "c1", eventId: "ev1" }),
        { venueId: VENUE, nowMs: NOW },
      ),
    );
    assert.equal(
      buildS1EventContractObservation(
        event({ id: "ev1", eventDate: eventDateOffset(22) }),
        contract({ id: "c1", eventId: "ev1" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });

  it("negative: draft contract / wrong venue / resolved signed", () => {
    assert.equal(
      buildS1EventContractObservation(
        event({ id: "ev1" }),
        contract({ id: "c1", eventId: "ev1", status: "draft" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildS1EventContractObservation(
        event({ id: "ev1" }),
        contract({ id: "c1", eventId: "ev1", status: "signed" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildS1EventContractObservation(
        event({ id: "ev1", venueId: OTHER }),
        contract({ id: "c1", eventId: "ev1" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });
});

describe("S2 event + payment", () => {
  const payment = (partial: Partial<ContextualPaymentAttention> = {}): ContextualPaymentAttention => ({
    eventId: "ev1",
    venueId: VENUE,
    status: "needs_attention",
    detail: "2 payments overdue.",
    href: "/invoices/inv-1",
    ...partial,
  });

  it("positive: approaching event + needs_attention", () => {
    const obs = buildS2EventPaymentObservation(
      event({ id: "ev1", eventDate: eventDateOffset(10) }),
      payment(),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(obs);
    assert.equal(obs!.id, "event-payment-attention-ev1");
    assert.match(obs!.message, /payment still needs attention/);
    assert.equal(obs!.detail, "2 payments overdue.");
    assert.equal(obs!.link, "/invoices/inv-1");
    assert.match(obs!.id, /^event-payment-attention-/);
  });

  it("boundary 21 qualifies; 22 does not; waiting status does not", () => {
    assert.ok(
      buildS2EventPaymentObservation(
        event({ id: "ev1", eventDate: eventDateOffset(21) }),
        payment(),
        { venueId: VENUE, nowMs: NOW },
      ),
    );
    assert.equal(
      buildS2EventPaymentObservation(
        event({ id: "ev1", eventDate: eventDateOffset(22) }),
        payment(),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildS2EventPaymentObservation(
        event({ id: "ev1", eventDate: eventDateOffset(5) }),
        payment({ status: "waiting" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });

  it("wrong venue excluded", () => {
    assert.equal(
      buildS2EventPaymentObservation(
        event({ id: "ev1" }),
        payment({ venueId: OTHER }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });
});

describe("S3 unattended inquiry", () => {
  it("positive: >=48h + never contacted", () => {
    const obs = buildS3UnattendedInquiryObservation(lead({ id: "L1" }), {
      venueId: VENUE,
      nowMs: NOW,
    });
    assert.ok(obs);
    assert.equal(obs!.id, "inquiry-unattended-L1");
    assert.match(obs!.message, /not been contacted/);
    assert.equal(obs!.link, "/leads/L1");
    assert.match(obs!.id, /^inquiry-unattended-/);
  });

  it("47h does not; contacted does not; wrong stage does not", () => {
    assert.equal(
      buildS3UnattendedInquiryObservation(
        lead({
          id: "L1",
          createdAt: new Date(NOW - 47 * 3_600_000).toISOString(),
        }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildS3UnattendedInquiryObservation(
        lead({ id: "L1", lastContactedAt: "2026-09-29T12:00:00.000Z" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
    assert.equal(
      buildS3UnattendedInquiryObservation(
        lead({ id: "L1", salesStage: "tour_scheduled" }),
        { venueId: VENUE, nowMs: NOW },
      ),
      null,
    );
  });

  it("wrong venue excluded", () => {
    assert.equal(
      buildS3UnattendedInquiryObservation(lead({ id: "L1", venueId: OTHER }), {
        venueId: VENUE,
        nowMs: NOW,
      }),
      null,
    );
  });
});

describe("S4 tour + evidence-based prep", () => {
  it("upcoming tour with next_action evidence qualifies", () => {
    const t = tour({ id: "t1" });
    const prep: ContextualTourLeadPrep = {
      leadId: "lead-tour-1",
      venueId: VENUE,
      nextActionText: "Send venue brochure",
      nextActionDue: t.scheduledAt.slice(0, 10),
      lastContactedAt: "2026-09-28T12:00:00.000Z",
      salesStage: "tour_scheduled",
    };
    assert.ok(tourPreparationEvidence(t, prep, { venueId: VENUE, nowMs: NOW }));
    const obs = buildS4TourPrepObservation(t, prep, { venueId: VENUE, nowMs: NOW }, "Fri, Oct 2, 2:00 PM");
    assert.ok(obs);
    assert.equal(obs!.id, "tour-upcoming-t1");
    assert.match(obs!.message, /preparation is still incomplete/);
    assert.match(obs!.detail ?? "", /Send venue brochure/);
    assert.match(obs!.id, /^tour-upcoming-/);
  });

  it("upcoming tour with no meaningful gap does not qualify", () => {
    const t = tour({ id: "t1" });
    const prep: ContextualTourLeadPrep = {
      leadId: "lead-tour-1",
      venueId: VENUE,
      nextActionText: null,
      nextActionDue: null,
      lastContactedAt: "2026-09-28T12:00:00.000Z",
      salesStage: "tour_scheduled",
    };
    assert.equal(tourPreparationEvidence(t, prep, { venueId: VENUE, nowMs: NOW }), null);
    assert.equal(
      buildS4TourPrepObservation(t, prep, { venueId: VENUE, nowMs: NOW }, "Fri, Oct 2, 2:00 PM"),
      null,
    );
  });

  it("never-contacted lead before tour is evidence", () => {
    const evidence = tourPreparationEvidence(
      tour({ id: "t1" }),
      {
        leadId: "lead-tour-1",
        venueId: VENUE,
        nextActionText: null,
        nextActionDue: null,
        lastContactedAt: null,
        salesStage: "new_inquiry",
      },
      { venueId: VENUE, nowMs: NOW },
    );
    assert.equal(evidence?.kind, "never_contacted");
  });
});

describe("duplicate suppression + Dashboard exclusion", () => {
  it("suppresses legacy contract-* when S1 active for same contract", () => {
    assert.equal(
      shouldSuppressLegacyContractObservation("contract-c1", new Set(["c1"])),
      true,
    );
    assert.equal(
      shouldSuppressLegacyContractObservation("contract-expiry-c1", new Set(["c1"])),
      false,
    );
    assert.equal(
      shouldSuppressLegacyFollowupObservation("followup-L1", new Set(["L1"])),
      true,
    );
  });

  it("applyContextualSupersession drops legacy duplicates", () => {
    const list: LuvObservation[] = [
      {
        id: "event-contract-unsigned-c1",
        kind: "risk",
        priority: "medium",
        message: "contextual",
        link: "/contracts/c1",
      },
      {
        id: "contract-c1",
        kind: "waiting",
        priority: "medium",
        message: "generic waiting",
        link: "/contracts",
      },
      {
        id: "inquiry-unattended-L1",
        kind: "risk",
        priority: "medium",
        message: "unattended",
        link: "/leads/L1",
      },
      {
        id: "followup-L1",
        kind: "risk",
        priority: "low",
        message: "legacy followup",
        link: "/leads/L1",
      },
      {
        id: "briefing-ev1",
        kind: "risk",
        priority: "medium",
        message: "unrelated",
        link: "/events/ev1",
      },
    ];
    const filtered = applyContextualSupersession(list);
    assert.deepEqual(
      filtered.map((o) => o.id),
      ["event-contract-unsigned-c1", "inquiry-unattended-L1", "briefing-ev1"],
    );
  });
});
