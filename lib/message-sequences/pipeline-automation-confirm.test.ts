/**
 * Pipeline → Automation trust safety (new-venue-morning P0) + P1 preview.
 * Pure decision helpers only — no DB.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTOMATION_PREVIEW_UNAVAILABLE,
  resolveFirstStepPreview,
} from "@/lib/message-sequences/confirm-preview";
import {
  resolveStageMoveConfirmGate,
  wouldCreateEnrollmentForSequences,
} from "@/lib/message-sequences/would-enroll";
import { CANONICAL_STAGE_TO_LEAD_STATUS } from "@/lib/leads/pipeline-stage-mapping";
import type { MergeContext } from "@/lib/message-templates/merge";

const baseCtx: MergeContext = {
  venueName: "Sweet Daisy",
  clientName: "Alex & Jordan",
  coordinatorName: "Sam",
  eventDate: "2027-06-12",
};

describe("wouldCreateEnrollmentForSequences (same rule as triggerSequencesForRelationship)", () => {
  it("ordinary destination with no matching Automation → false (no confirm)", () => {
    assert.equal(wouldCreateEnrollmentForSequences([], new Set()), false);
  });

  it("matching active Automation, not already enrolled → true", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["auto-proposal"], new Set()),
      true,
    );
  });

  it("matching Automation but already actively enrolled → false (no double enroll)", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["auto-proposal"], new Set(["auto-proposal"])),
      false,
    );
  });

  it("one of several matching sequences would newly enroll → true", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(
        ["already", "fresh"],
        new Set(["already"]),
      ),
      true,
    );
  });

  it("Lost destination with active Lost Automation → true", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["auto-lost"], new Set()),
      true,
    );
  });

  it("Lost destination with no matching Automation → false (exit still happens on commit; confirm only for enroll)", () => {
    assert.equal(wouldCreateEnrollmentForSequences([], new Set()), false);
  });

  it("Cancelled destination with active Cancelled Automation → true", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["auto-cancelled"], new Set()),
      true,
    );
  });

  it("Booked (won) destination with active Booked Automation → true", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["auto-booked"], new Set()),
      true,
    );
  });

  it("Booked destination with no matching Automation → false", () => {
    assert.equal(wouldCreateEnrollmentForSequences([], new Set()), false);
  });
});

describe("resolveStageMoveConfirmGate", () => {
  it("ordinary move (wouldEnroll=false): commit immediately, never show confirm", () => {
    assert.equal(resolveStageMoveConfirmGate(false, null), "commit");
    assert.equal(resolveStageMoveConfirmGate(false, "cancel"), "commit");
    assert.equal(resolveStageMoveConfirmGate(false, "continue"), "commit");
  });

  it("would enroll + no answer yet → show confirm (before any commit)", () => {
    assert.equal(resolveStageMoveConfirmGate(true, null), "show_confirm");
  });

  it("would enroll + Cancel → abort (lead stays, no enroll)", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "cancel"), "abort");
  });

  it("would enroll + Continue → commit (existing stage-change path proceeds)", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "continue"), "commit");
  });
});

describe("destination LeadStatus mapping used for enrollment preview", () => {
  it("maps Pipeline canonical stages to the same LeadStatus enrollment keys as updateLeadPipelineStage", () => {
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.proposal, "proposal_sent");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.booked, "won");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.lost, "lost");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.cancelled, "cancelled");
  });
});

describe("resolved first-step preview (P1 confirm dialog only)", () => {
  it("1. no matching Automation → no confirmation (gate commit)", () => {
    assert.equal(wouldCreateEnrollmentForSequences([], new Set()), false);
    assert.equal(resolveStageMoveConfirmGate(false, null), "commit");
  });

  it("2. matching Automation → existing confirmation appears", () => {
    assert.equal(wouldCreateEnrollmentForSequences(["auto"], new Set()), true);
    assert.equal(resolveStageMoveConfirmGate(true, null), "show_confirm");
  });

  it("3. confirmation includes resolved first-message preview", () => {
    const preview = resolveFirstStepPreview({
      channel: "email",
      emailSubject: "Hello {{client_name}}",
      emailBody: "Welcome to {{venue_name}}.",
      smsBody: null,
      mergeContext: baseCtx,
    });
    assert.equal(preview.ok, true);
    if (preview.ok) {
      assert.equal(preview.subject, "Hello Alex & Jordan");
      assert.match(preview.body, /Sweet Daisy/);
    }
  });

  it("4. merge fields resolve using the existing send-time resolution path", () => {
    const preview = resolveFirstStepPreview({
      channel: "sms",
      emailSubject: null,
      emailBody: null,
      smsBody: "Hi {{client_name}} from {{venue_name}}",
      mergeContext: baseCtx,
    });
    assert.equal(preview.ok, true);
    if (preview.ok) {
      assert.equal(preview.body, "Hi Alex & Jordan from Sweet Daisy");
      assert.equal(preview.subject, null);
    }
  });

  it("5. Cancel still causes no move/enrollment/send", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "cancel"), "abort");
  });

  it("6. Continue still causes the existing move/enrollment behavior", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "continue"), "commit");
  });

  it("7. preview itself causes no mutation (pure resolve)", () => {
    const ctx = { ...baseCtx };
    const before = JSON.stringify(ctx);
    resolveFirstStepPreview({
      channel: "email",
      emailSubject: "S",
      emailBody: "B {{venue_name}}",
      smsBody: null,
      mergeContext: ctx,
    });
    assert.equal(JSON.stringify(ctx), before);
  });

  it("8. Lost/Cancelled/Booked confirmation semantics remain unchanged", () => {
    assert.equal(resolveStageMoveConfirmGate(true, null), "show_confirm");
    assert.equal(resolveStageMoveConfirmGate(true, "cancel"), "abort");
    assert.equal(resolveStageMoveConfirmGate(true, "continue"), "commit");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.lost, "lost");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.cancelled, "cancelled");
    assert.equal(CANONICAL_STAGE_TO_LEAD_STATUS.booked, "won");
  });

  it("unresolved merge → truthful minimal fallback (dialog must not fail)", () => {
    const preview = resolveFirstStepPreview({
      channel: "email",
      emailSubject: "Tour {{tour_datetime}}",
      emailBody: "See you then",
      smsBody: null,
      mergeContext: baseCtx,
    });
    assert.equal(preview.ok, false);
    if (!preview.ok) {
      assert.equal(preview.fallback, AUTOMATION_PREVIEW_UNAVAILABLE);
    }
  });

  it("missing merge context → truthful fallback", () => {
    const preview = resolveFirstStepPreview({
      channel: "email",
      emailSubject: "Hi",
      emailBody: "Hello",
      smsBody: null,
      mergeContext: null,
    });
    assert.equal(preview.ok, false);
  });
});
