/**
 * LOCKED: pipeline / sales stage is never authoritative evidence.
 *
 * Changing, omitting, or misordering sales_stage must not cause Luv to
 * claim that an underlying action occurred. Applies to observations and drafts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  buildS3UnattendedInquiryObservation,
  buildS4TourPrepObservation,
  tourPreparationEvidence,
} from "@/lib/luv/contextual-signals";
import { buildFollowUpPrompt, isAuthoritativeProposalSent } from "@/lib/luv/drafts";
import { deriveFollowUpProhibitions, deriveFollowUpWorkflowIntent } from "@/lib/luv/follow-up-workflow-context";
import { buildTourAllSetObservation, hasQualifyingCustomerContact } from "@/lib/luv/observation-quality";
import { tourFollowUpSuperseded } from "@/lib/luv/observation-supersession";
import {
  PIPELINE_STAGE_IS_NOT_EVIDENCE,
  isAuthoritativeBooked,
  isAuthoritativeContractSigned,
  isAuthoritativeLost,
  isAuthoritativePaymentReceived,
  isAuthoritativeProposalSentRecord,
  isAuthoritativeTourConfirmed,
  isAuthoritativeTourScheduled,
  stageCannotProve,
} from "@/lib/luv/pipeline-stage-evidence";
import { evaluateTourFollowupPatternRecommendation } from "@/lib/luv/tour-followup-pattern";
import type { Lead } from "@/lib/leads/types";

const VENUE = "venue-a";
const NOW = Date.parse("2026-09-30T15:00:00.000Z");
const CREATED_48H = new Date(NOW - 48 * 3_600_000).toISOString();

function src(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

function leadForDraft(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    venueId: VENUE,
    salesStage: "new_inquiry",
    status: "new_inquiry",
    firstName: "Alex",
    lastName: "Rivera",
    partnerFirstName: "Jordan",
    partnerLastName: null,
    email: "alex@example.com",
    phone: null,
    eventType: "wedding",
    eventDate: "2027-06-14",
    guestCount: 120,
    estimatedBudget: 25000,
    inquiryMessage: "Looking for a June date",
    inquiryDate: "2026-09-01",
    lastContactedAt: null,
    ...overrides,
  } as Lead;
}

describe("pipeline stage is never evidence — primitives", () => {
  it("locks the architectural sentence", () => {
    assert.match(PIPELINE_STAGE_IS_NOT_EVIDENCE, /never authoritative proof/);
    assert.match(stageCannotProve("tour scheduled"), /Do not infer tour scheduled from sales_stage/);
  });

  it("booked / lost require stamps, not a stage string", () => {
    assert.equal(isAuthoritativeBooked({ firstBookedAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(isAuthoritativeBooked({ firstBookedAt: null }), false);
    assert.equal(isAuthoritativeBooked({}), false);
    assert.equal(isAuthoritativeLost({ lostAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(isAuthoritativeLost({ lostAt: null }), false);
  });

  it("tour scheduled / confirmed require tour_appointments.status", () => {
    assert.equal(isAuthoritativeTourScheduled({ status: "scheduled" }), true);
    assert.equal(isAuthoritativeTourScheduled({ status: "confirmed" }), true);
    assert.equal(isAuthoritativeTourScheduled({ status: "completed" }), false);
    assert.equal(isAuthoritativeTourScheduled({ status: "cancelled" }), false);
    assert.equal(isAuthoritativeTourScheduled(null), false);
    assert.equal(isAuthoritativeTourConfirmed({ status: "confirmed" }), true);
    assert.equal(isAuthoritativeTourConfirmed({ status: "scheduled" }), false);
  });

  it("proposal / contract / payment require workflow records", () => {
    assert.equal(
      isAuthoritativeProposalSentRecord({ status: "sent", offeredAt: "2026-09-20T12:00:00Z" }),
      true,
    );
    assert.equal(isAuthoritativeProposalSentRecord({ status: "sent", offeredAt: null }), false);
    assert.equal(isAuthoritativeProposalSentRecord({ status: "draft", offeredAt: "2026-09-20T12:00:00Z" }), false);
    assert.equal(isAuthoritativeContractSigned({ status: "signed" }), true);
    assert.equal(isAuthoritativeContractSigned({ status: "sent", clientSigned: true }), true);
    assert.equal(isAuthoritativeContractSigned({ status: "sent", clientSigned: false }), false);
    assert.equal(isAuthoritativePaymentReceived({ linePaid: true }), true);
    assert.equal(isAuthoritativePaymentReceived({ linePaid: false }), false);
  });

  it("draft helper stays aligned with the locked proposal rule", () => {
    assert.equal(isAuthoritativeProposalSent({ status: "sent", offeredAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(isAuthoritativeProposalSent({ status: "sent", offeredAt: null }), false);
  });
});

describe("changing / omitting / misordering stage cannot invent actions", () => {
  const stages = [
    "new_inquiry",
    "tour_scheduled",
    "tour_confirmed",
    "proposal_sent",
    "contract_sent",
    "booked",
    "lost",
    "paid",
  ];

  it("S3: any stage without contact/tour/booked/lost records stays unattended", () => {
    for (const salesStage of stages) {
      const obs = buildS3UnattendedInquiryObservation(
        {
          id: "L1",
          venueId: VENUE,
          firstName: "Jordan",
          lastName: "Lee",
          salesStage,
          createdAt: CREATED_48H,
          lastContactedAt: null,
        },
        { venueId: VENUE, nowMs: NOW },
      );
      assert.ok(obs, `stage ${salesStage} must not invent contact`);
      assert.match(obs!.message, /has not been contacted yet/);
    }
  });

  it("S3: omitted or out-of-order stage still does not invent contact", () => {
    const omitted = buildS3UnattendedInquiryObservation(
      {
        id: "L1",
        venueId: VENUE,
        firstName: "Jordan",
        lastName: "Lee",
        salesStage: "",
        createdAt: CREATED_48H,
        lastContactedAt: null,
      },
      { venueId: VENUE, nowMs: NOW },
    );
    assert.ok(omitted);
    const lateTourStage = buildS3UnattendedInquiryObservation(
      {
        id: "L1",
        venueId: VENUE,
        firstName: "Jordan",
        lastName: "Lee",
        salesStage: "new_inquiry",
        createdAt: CREATED_48H,
        lastContactedAt: null,
        tourStatus: "confirmed",
      },
      { venueId: VENUE, nowMs: NOW },
    );
    assert.equal(lateTourStage, null, "tour record — not stage — proves contact");
  });

  it("S4: next_action + any stage does not manufacture tour-prep or first-contact work", () => {
    const tour = {
      id: "t1",
      venueId: VENUE,
      scheduledAt: new Date(NOW + 2 * 86_400_000).toISOString(),
      contactName: "Casey",
      durationMinutes: 60,
      leadId: "lead-1",
    };
    for (const salesStage of stages) {
      const prep = {
        leadId: "lead-1",
        venueId: VENUE,
        nextActionText: "Send brochure",
        nextActionDue: "2026-10-02",
        lastContactedAt: null,
        salesStage,
      };
      assert.equal(tourPreparationEvidence(tour, prep, { venueId: VENUE, nowMs: NOW }), null);
      assert.equal(
        buildS4TourPrepObservation(tour, prep, { venueId: VENUE, nowMs: NOW }, "Fri, Oct 2"),
        null,
      );
    }
  });

  it("upcoming tour all-set requires tour_appointments.status, not stage", () => {
    assert.equal(
      buildTourAllSetObservation({
        tourId: "t1",
        scheduledAt: new Date(NOW + 86_400_000).toISOString(),
        status: null,
        contactName: "Casey",
        leadId: "lead-1",
        daysUntil: 1,
      }),
      null,
    );
    const ready = buildTourAllSetObservation({
      tourId: "t1",
      scheduledAt: new Date(NOW + 86_400_000).toISOString(),
      status: "confirmed",
      contactName: "Casey",
      leadId: "lead-1",
      daysUntil: 1,
    });
    assert.ok(ready);
    assert.match(ready!.message, /all set/);
    assert.equal(ready!.recommendation, undefined);
  });

  it("tour follow-up is not superseded by a booked/lost stage string", () => {
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
    assert.equal(
      tourFollowUpSuperseded({
        booked: true,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      true,
    );
  });

  it("tour-followup pattern: stage booked without first_booked_at still counts", () => {
    const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
    const active = evaluateTourFollowupPatternRecommendation(
      ["l1", "l2", "l3"].map((leadId) => ({
        venueId: VENUE,
        leadId,
        status: "completed",
        followUpSentAt: null,
        scheduledAt: hoursAgo(24),
        leadSalesStage: "booked",
        firstBookedAt: null,
        lostAt: null,
      })),
      { venueId: VENUE, nowMs: NOW },
    );
    assert.equal(active?.metadata.lead_count, 3);
  });

  it("contact evidence never comes from stage", () => {
    assert.equal(hasQualifyingCustomerContact({}), false);
    assert.equal(hasQualifyingCustomerContact({ lastContactedAt: null, tourStatus: null }), false);
    assert.equal(hasQualifyingCustomerContact({ lastContactedAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(hasQualifyingCustomerContact({ hasCustomerFacingMessage: true }), true);
    assert.equal(hasQualifyingCustomerContact({ tourStatus: "scheduled" }), true);
  });
});

describe("customer-facing drafts — stage cannot invent verified facts", () => {
  it("proposal_sent / tour_scheduled / booked / paid / contract_sent stages add no verified actions", () => {
    for (const salesStage of [
      "proposal_sent",
      "tour_scheduled",
      "tour_confirmed",
      "booked",
      "paid",
      "contract_sent",
    ]) {
      const prompt = buildFollowUpPrompt(leadForDraft({ salesStage, status: salesStage }), "Fancy", "Jen", "warm", {
        proposalSent: false,
        tour: { kind: "none" },
      });
      assert.match(prompt, /Pipeline stage \(venue workflow context/);
      assert.match(prompt, /Pipeline \/ sales stage is never authoritative proof/);
      assert.match(prompt, /Verified facts:\*\* none for completed actions/);
      assert.doesNotMatch(prompt, /The proposal was sent to this client/);
      assert.doesNotMatch(prompt, /completed a venue tour/);
      assert.doesNotMatch(prompt, /upcoming venue tour/);
      assert.match(prompt, /do not infer tour scheduled or tour confirmed from stage/i);
      assert.match(prompt, /do not infer booked from a later sales stage/i);
    }
  });

  it("omitted / empty stage still cannot invent a proposal or tour", () => {
    const prompt = buildFollowUpPrompt(leadForDraft({ salesStage: "" as never, status: "" as never }), "Fancy", "Jen", "warm", {
      proposalSent: false,
    });
    assert.match(prompt, /Verified facts:\*\* none for completed actions/);
    assert.doesNotMatch(prompt, /The proposal was sent to this client/);
  });

  it("workflow intent comes from tour_appointments, not stage", () => {
    assert.equal(
      deriveFollowUpWorkflowIntent({ tour: { kind: "none" }, nextActionText: null }),
      "invite_to_schedule_tour",
    );
    assert.equal(
      deriveFollowUpWorkflowIntent({
        tour: { kind: "upcoming", scheduledAt: "2026-10-05T15:00:00Z", status: "confirmed" },
        nextActionText: null,
      }),
      "reference_upcoming_tour",
    );
    const prohibitions = deriveFollowUpProhibitions({
      tour: { kind: "none" },
      proposalSent: false,
    });
    assert.equal(prohibitions.claimProposalSent, true);
    assert.equal(prohibitions.inviteToScheduleTour, false);
  });
});

describe("source lock — Luv never treats sales_stage as proof", () => {
  it("observations never claim Tour scheduled / Proposal sent from stage", () => {
    const observations = src("lib/luv/observations.ts");
    assert.doesNotMatch(observations, /sales_stage === "proposal_sent"/);
    assert.doesNotMatch(observations, /sales_stage === "tour_scheduled"/);
    assert.doesNotMatch(observations, /sales_stage === "booked"/);
    assert.doesNotMatch(observations, /\.eq\("sales_stage", "new_inquiry"\)/);
    assert.doesNotMatch(observations, /\.not\("sales_stage", "in", "\(booked,lost\)"\)/);
    assert.match(observations, /Never sales_stage/);
    assert.match(observations, /first_booked_at/);
    assert.match(observations, /lost_at/);
  });

  it("drafts load proposal from commercial_proposals and tour from tour_appointments", () => {
    const drafts = src("lib/luv/drafts.ts");
    const loadProposal = drafts.slice(drafts.indexOf("async function loadProposalSentFact"));
    assert.doesNotMatch(loadProposal.slice(0, 700), /sales_stage/);
    assert.match(loadProposal.slice(0, 700), /commercial_proposals/);
    assert.match(loadProposal.slice(0, 700), /offered_at/);
    const loadTour = drafts.slice(drafts.indexOf("async function loadFollowUpTourState"));
    assert.match(loadTour.slice(0, 500), /tour_appointments/);
    assert.doesNotMatch(loadTour.slice(0, 500), /sales_stage/);
  });

  it("supersession and tour-followup pattern use stamps, not stage", () => {
    const supersession = src("lib/luv/observation-supersession.ts");
    assert.doesNotMatch(supersession, /salesStage/);
    assert.match(supersession, /first_booked_at/);
    const pattern = src("lib/luv/tour-followup-pattern.ts");
    assert.match(pattern, /isAuthoritativeBooked/);
    assert.match(pattern, /isAuthoritativeLost/);
    assert.doesNotMatch(pattern, /isOpenLeadLifecycle/);
  });

  it("S3 evaluator does not read salesStage", () => {
    const signals = src("lib/luv/contextual-signals.ts");
    const s3 = signals.slice(signals.indexOf("export function buildS3UnattendedInquiryObservation"));
    const body = s3.slice(0, s3.indexOf("export function buildS4TourPrepObservation"));
    assert.doesNotMatch(body, /salesStage/);
    assert.match(body, /hasQualifyingCustomerContact/);
    assert.match(body, /firstBookedAt/);
  });
});
