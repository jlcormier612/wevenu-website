import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TOUR_ALL_SET_MAX_DAYS,
  buildTourAllSetObservation,
  buildTourScheduledUnconfirmedObservation,
  buildUpcomingTourStatusObservation,
  coordinatorAddressName,
  hasQualifyingCustomerContact,
  isCustomerFacingContactMessage,
  observationActionCta,
  withCoordinatorAddress,
} from "@/lib/luv/observation-quality";

describe("customer-facing contact evidence", () => {
  it("internal notes are not contact", () => {
    assert.equal(
      isCustomerFacingContactMessage({ channel: "internal_note", senderType: "venue_staff" }),
      false,
    );
  });

  it("staff / system / customer messages on a real channel qualify", () => {
    assert.equal(
      isCustomerFacingContactMessage({ channel: "email", senderType: "venue_staff" }),
      true,
    );
    assert.equal(
      isCustomerFacingContactMessage({ channel: "email", senderType: "system" }),
      true,
    );
    assert.equal(
      isCustomerFacingContactMessage({ channel: "sms", senderType: "lead_or_client" }),
      true,
    );
  });

  it("hasQualifyingCustomerContact uses records, not stage", () => {
    assert.equal(hasQualifyingCustomerContact({ lastContactedAt: null }), false);
    assert.equal(hasQualifyingCustomerContact({ lastContactedAt: "2026-09-20T12:00:00Z" }), true);
    assert.equal(hasQualifyingCustomerContact({ hasCustomerFacingMessage: true }), true);
    assert.equal(hasQualifyingCustomerContact({ tourStatus: "scheduled" }), true);
    assert.equal(hasQualifyingCustomerContact({ tourStatus: "cancelled" }), false);
  });
});

describe("optional CTA — no dead same-page link", () => {
  const obs = {
    link: "/leads/L1",
    actionLabel: "Open Lead →",
    recommendation: { label: "Reach out to this inquiry", link: "/leads/L1?luv=follow_up_email", type: "draft" as const },
  };

  it("keeps a CTA that leaves the current record", () => {
    const cta = observationActionCta(obs, "/dashboard");
    assert.ok(cta);
    assert.equal(cta!.href, "/leads/L1?luv=follow_up_email");
  });

  it("omits a CTA that points at the current lead path", () => {
    assert.equal(observationActionCta(obs, "/leads/L1"), null);
    assert.equal(observationActionCta({ link: "/leads/L1", actionLabel: "Open →" }, "/leads/L1"), null);
  });

  it("omits when there is no label", () => {
    assert.equal(observationActionCta({ link: "/leads/L1" }), null);
  });
});

describe("tour all-set — confirmed only, celebration + next step, 3-day window", () => {
  it("silence when more than 3 days out, cancelled, or only scheduled", () => {
    assert.equal(TOUR_ALL_SET_MAX_DAYS, 3);
    assert.equal(
      buildTourAllSetObservation({
        tourId: "t1",
        scheduledAt: "2026-10-10T15:00:00Z",
        status: "confirmed",
        contactName: "Casey",
        leadId: "L1",
        daysUntil: 4,
      }),
      null,
    );
    assert.equal(
      buildTourAllSetObservation({
        tourId: "t1",
        scheduledAt: "2026-10-01T15:00:00Z",
        status: "cancelled",
        contactName: "Casey",
        leadId: "L1",
        daysUntil: 1,
      }),
      null,
    );
    assert.equal(
      buildTourAllSetObservation({
        tourId: "t1",
        scheduledAt: "2026-10-02T15:00:00Z",
        status: "scheduled",
        contactName: "Ursula Meadows & Brian Valley",
        leadId: "L1",
        daysUntil: 2,
      }),
      null,
    );
  });

  it("positive all-set only when status is confirmed, with logistics next step", () => {
    const obs = buildTourAllSetObservation({
      tourId: "t1",
      scheduledAt: "2026-10-02T15:00:00Z",
      status: "confirmed",
      contactName: "Casey Morgan",
      leadId: "L1",
      daysUntil: 2,
    });
    assert.ok(obs);
    assert.equal(obs!.kind, "celebration");
    assert.match(obs!.message, /all set/);
    assert.match(obs!.detail ?? "", /confirmed/i);
    assert.equal(obs!.actionLabel, "Open Lead →");
    assert.equal(obs!.recommendation?.link, "/leads/L1");
    assert.equal(obs!.id, "tour-upcoming-t1");
  });
});

describe("scheduled but unconfirmed tour factuality", () => {
  const base = {
    tourId: "t1",
    scheduledAt: "2026-10-28T15:00:00Z",
    status: "scheduled" as const,
    contactName: "Ursula Meadows & Brian Valley",
    leadId: "L1",
    daysUntil: 2,
  };

  it("does not claim all-set / good luck for scheduled tours", () => {
    const obs = buildTourScheduledUnconfirmedObservation(base);
    assert.ok(obs);
    assert.doesNotMatch(obs!.message, /all set|Good luck/i);
    assert.match(obs!.message, /not confirmed yet/i);
  });

  it("confirmation requested is still not recipient confirmation", () => {
    const obs = buildTourScheduledUnconfirmedObservation({
      ...base,
      confirmationRequestedAt: "2026-10-20T12:00:00Z",
    });
    assert.ok(obs);
    assert.doesNotMatch(obs!.message, /all set|confirmed their|Good luck/i);
    assert.match(obs!.message, /waiting for their reply/i);
  });

  it("completed and cancelled stay silent via dispatcher", () => {
    assert.equal(
      buildUpcomingTourStatusObservation({ ...base, status: "completed" }),
      null,
    );
    assert.equal(
      buildUpcomingTourStatusObservation({ ...base, status: "cancelled" }),
      null,
    );
  });

  it("dispatcher routes confirmed vs scheduled correctly", () => {
    const confirmed = buildUpcomingTourStatusObservation({ ...base, status: "confirmed" });
    assert.match(confirmed!.message, /all set/);
    const scheduled = buildUpcomingTourStatusObservation(base);
    assert.doesNotMatch(scheduled!.message, /all set/);
  });
});

describe("coordinator address", () => {
  it("solo staff uses current user; multi uses owner when present", () => {
    assert.equal(
      coordinatorAddressName({ staffCount: 1, currentUserFirstName: "Jen", ownerFirstName: "Owner" }),
      "Jen",
    );
    assert.equal(
      coordinatorAddressName({ staffCount: 3, currentUserFirstName: "Pat", ownerFirstName: "Jen" }),
      "Jen",
    );
    assert.equal(
      coordinatorAddressName({ staffCount: 3, currentUserFirstName: "Pat", ownerFirstName: null }),
      null,
    );
  });

  it("prefixes once", () => {
    assert.equal(withCoordinatorAddress("Jen", "Casey is all set for Friday."), "Jen, casey is all set for Friday.");
    assert.equal(withCoordinatorAddress("Jen", "Jen, already addressed."), "Jen, already addressed.");
    assert.equal(withCoordinatorAddress(null, "Casey is all set for Friday."), "Casey is all set for Friday.");
  });
});
