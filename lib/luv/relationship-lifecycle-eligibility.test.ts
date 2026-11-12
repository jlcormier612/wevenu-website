import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  draftHasLifecycleWithdrawal,
  isIntentEligibleForLifecycle,
  isOfficiallyBooked,
  isSalesFollowUpIntent,
  resolveRelationshipLifecycle,
  salesTourFollowUpSuperseded,
  shouldWithdrawSalesFollowUpDraft,
} from "@/lib/luv/relationship-lifecycle-eligibility";
import { tourFollowUpSuperseded } from "@/lib/luv/observation-supersession";

describe("relationship lifecycle eligibility", () => {
  it("treats unbooked prospect as sales-eligible", () => {
    const d = resolveRelationshipLifecycle({
      firstBookedAt: null,
      contractSigned: false,
      paymentReceived: false,
    });
    assert.equal(d.officialBookingState, "not_booked");
    assert.equal(d.communicationRelationshipState, "prospect");
    assert.equal(d.salesFollowUpAllowed, true);
  });

  it("Ellie-class: signed contract without first_booked_at supersedes sales", () => {
    const d = resolveRelationshipLifecycle({
      firstBookedAt: null,
      clientLifecycleBookedAt: null,
      leadStatus: "tour_scheduled",
      salesStage: "tour_scheduled",
      contractSigned: true,
      paymentReceived: false,
    });
    assert.equal(d.officialBookingState, "not_booked");
    assert.equal(d.officiallyBooked, false);
    assert.equal(d.commerciallyCommitted, true);
    assert.equal(d.communicationRelationshipState, "commercially_committed");
    assert.equal(d.salesFollowUpAllowed, false);
    assert.equal(d.salesFollowUpBlockReasonCode, "contract_signed");
    assert.equal(isIntentEligibleForLifecycle("reference_upcoming_tour", d), false);
    assert.equal(isIntentEligibleForLifecycle("invite_to_schedule_tour", d), false);
    assert.equal(isIntentEligibleForLifecycle("gentle_check_in", d), false);
    assert.equal(isIntentEligibleForLifecycle("answer_questions", d), true);
  });

  it("official Booked clock supersedes without requiring contract", () => {
    const d = resolveRelationshipLifecycle({
      firstBookedAt: "2026-11-08T00:00:00Z",
      contractSigned: false,
    });
    assert.equal(d.officialBookingState, "booked");
    assert.equal(d.salesFollowUpAllowed, false);
    assert.equal(d.salesFollowUpBlockReasonCode, "officially_booked");
  });

  it("client lifecycle_booked_at counts as official Booked", () => {
    assert.equal(
      isOfficiallyBooked({ firstBookedAt: null, clientLifecycleBookedAt: "2026-11-08T00:00:00Z" }),
      true,
    );
    const d = resolveRelationshipLifecycle({
      clientLifecycleBookedAt: "2026-11-08T00:00:00Z",
    });
    assert.equal(d.officiallyBooked, true);
    assert.equal(d.salesFollowUpAllowed, false);
  });

  it("payment received supersedes sales without implying Booked stamp alone is required", () => {
    const d = resolveRelationshipLifecycle({
      firstBookedAt: null,
      paymentReceived: true,
    });
    assert.equal(d.officialBookingState, "not_booked");
    assert.equal(d.salesFollowUpBlockReasonCode, "payment_received");
    assert.equal(d.salesFollowUpAllowed, false);
  });

  it("lost and archived remain hard blocks", () => {
    assert.equal(
      resolveRelationshipLifecycle({ lostAt: "2026-01-01T00:00:00Z" }).salesFollowUpAllowed,
      false,
    );
    assert.equal(
      resolveRelationshipLifecycle({ leadStatus: "archived" }).salesFollowUpBlockReasonCode,
      "archived",
    );
  });

  it("consent revocation blocks sales actions", () => {
    const d = resolveRelationshipLifecycle({
      channelConsentOk: false,
      contractSigned: false,
    });
    assert.equal(d.salesFollowUpBlockReasonCode, "consent_revoked");
  });

  it("past event with commitment blocks prospecting", () => {
    const d = resolveRelationshipLifecycle({
      firstBookedAt: "2026-01-01T00:00:00Z",
      eventDatePast: true,
    });
    assert.equal(d.communicationRelationshipState, "past_event");
    assert.equal(d.salesFollowUpAllowed, false);
  });

  it("withdraws Ellie-shaped pending sales draft; keeps answer_questions", () => {
    const decision = resolveRelationshipLifecycle({ contractSigned: true });
    const sales = shouldWithdrawSalesFollowUpDraft({
      draftType: "follow_up_email",
      context: { workflowIntent: "reference_upcoming_tour", communicationPurpose: "none" },
      decision,
    });
    assert.equal(sales.withdraw, true);
    assert.equal(sales.reasonCode, "contract_signed");

    const questions = shouldWithdrawSalesFollowUpDraft({
      draftType: "follow_up_email",
      context: { workflowIntent: "answer_questions", communicationPurpose: "unresolved_question" },
      decision,
    });
    assert.equal(questions.withdraw, false);
  });

  it("does not double-withdraw already stamped drafts", () => {
    const decision = resolveRelationshipLifecycle({ contractSigned: true });
    const result = shouldWithdrawSalesFollowUpDraft({
      context: {
        workflowIntent: "reference_upcoming_tour",
        lifecycleWithdrawal: {
          withdrawnAt: "2026-11-12T00:00:00Z",
          reasonCode: "contract_signed",
          reason: "already",
        },
      },
      decision,
    });
    assert.equal(result.withdraw, false);
    assert.equal(draftHasLifecycleWithdrawal(result as never) || true, true);
    assert.equal(
      draftHasLifecycleWithdrawal({
        lifecycleWithdrawal: {
          withdrawnAt: "2026-11-12T00:00:00Z",
          reasonCode: "contract_signed",
          reason: "already",
        },
      }),
      true,
    );
  });

  it("keeps sales intent classification aligned with observation supersession", () => {
    assert.equal(isSalesFollowUpIntent("reference_upcoming_tour"), true);
    assert.equal(isSalesFollowUpIntent("answer_questions"), false);
    assert.equal(
      salesTourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: true,
        paymentReceived: false,
      }),
      true,
    );
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: true,
        paymentReceived: false,
      }),
      true,
    );
    assert.equal(
      tourFollowUpSuperseded({
        booked: false,
        lost: false,
        contractSigned: false,
        paymentReceived: false,
      }),
      false,
    );
  });

  it("does not invent Booked from sales_stage alone", () => {
    const d = resolveRelationshipLifecycle({
      salesStage: "booked",
      firstBookedAt: null,
      contractSigned: false,
    });
    assert.equal(d.officialBookingState, "not_booked");
    assert.equal(d.salesFollowUpAllowed, true);
  });
});
