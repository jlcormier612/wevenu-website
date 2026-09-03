import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildCommunicationsReview,
  invitationDetail,
  isActiveBookedStageAutomation,
} from "@/lib/clients/communications-review";

function review(
  overrides: Partial<Parameters<typeof buildCommunicationsReview>[0]> = {},
) {
  return buildCommunicationsReview({
    clientId: "c1",
    invitation: null,
    clientHasEmail: true,
    automations: [],
    ...overrides,
  });
}

describe("buildCommunicationsReview", () => {
  it("shows invitation pending release when the client has email and has not been invited", () => {
    const model = review({ invitation: null, clientHasEmail: true });
    const invitation = model.rows.find((r) => r.key === "invitation");
    assert.equal(
      invitation?.detail,
      "Not sent — the client will be invited when you release their planning.",
    );
    assert.equal(invitation?.onFile, false);
    assert.doesNotMatch(invitation?.detail ?? "", /Invitation sent/);
  });

  it("says no invitation can be sent when there is no client email", () => {
    const model = review({ invitation: null, clientHasEmail: false });
    const invitation = model.rows.find((r) => r.key === "invitation");
    assert.equal(invitation?.detail, "Not sent — no client email on file");
    assert.equal(invitation?.needsAttention, true);
    assert.doesNotMatch(invitation?.detail ?? "", /Invitation sent/);
  });

  it("reflects an existing sent invitation record", () => {
    const model = review({ invitation: { status: "pending" } });
    assert.equal(model.rows.find((r) => r.key === "invitation")?.detail, "Invitation sent");
    assert.equal(model.rows.find((r) => r.key === "invitation")?.onFile, true);
  });

  it("reflects an accepted invitation record", () => {
    const model = review({ invitation: { status: "accepted" } });
    assert.equal(
      model.rows.find((r) => r.key === "invitation")?.detail,
      "Client accepted their invitation",
    );
  });

  it("treats a revoked invitation as needs attention and does not claim it was sent", () => {
    const model = review({ invitation: { status: "revoked" } });
    const invitation = model.rows.find((r) => r.key === "invitation");
    assert.equal(invitation?.detail, "Invitation revoked");
    assert.equal(invitation?.needsAttention, true);
    assert.equal(invitation?.onFile, false);
    assert.doesNotMatch(invitation?.detail ?? "", /Invitation sent/);
  });

  it("says nothing is scheduled when no Booked-stage Automation exists", () => {
    const model = review({
      automations: [
        {
          id: "a1",
          name: "New Inquiry Welcome",
          status: "active",
          triggerType: "lead_created",
          triggerStage: null,
        },
        {
          id: "a2",
          name: "Paused Booked",
          status: "paused",
          triggerType: "lead_stage_changed",
          triggerStage: "booked",
        },
      ],
    });
    const automated = model.rows.find((r) => r.key === "automated_messages");
    assert.equal(automated?.detail, "Nothing is scheduled to send automatically after booking.");
    assert.equal(automated?.onFile, false);
    assert.equal(
      isActiveBookedStageAutomation({
        id: "a2",
        name: "Paused Booked",
        status: "paused",
        triggerType: "lead_stage_changed",
        triggerStage: "booked",
      }),
      false,
    );
  });

  it("reflects an existing Booked-stage Automation without changing it", () => {
    const model = review({
      automations: [
        {
          id: "booked-1",
          name: "Post-Booking Follow-up",
          status: "active",
          triggerType: "lead_stage_changed",
          triggerStage: "booked",
        },
      ],
    });
    const automated = model.rows.find((r) => r.key === "automated_messages");
    assert.equal(automated?.detail, "Post-Booking Follow-up is set to start after booking.");
    assert.equal(automated?.href, "/communication/series/booked-1/edit");
    assert.equal(automated?.actionLabel, "Edit");
    assert.doesNotMatch(automated?.detail ?? "", /enroll/i);
    assert.doesNotMatch(automated?.detail ?? "", /trigger/i);
    assert.doesNotMatch(automated?.detail ?? "", /sequence/i);
  });

  it("notes when messages for this client have already started", () => {
    const model = review({
      automations: [
        {
          id: "booked-1",
          name: "Post-Booking Follow-up",
          status: "active",
          triggerType: "lead_stage_changed",
          triggerStage: "booked",
        },
      ],
      activeEnrollmentSequenceIds: ["booked-1"],
    });
    assert.match(
      model.rows.find((r) => r.key === "automated_messages")?.detail ?? "",
      /already started/,
    );
  });

  it("does not guess invitation success without a pending or accepted record", () => {
    assert.equal(invitationDetail(null, true), "Not sent — the client will be invited when you release their planning.");
    assert.doesNotMatch(invitationDetail(null, true), /Invitation sent/);
    assert.doesNotMatch(invitationDetail({ status: "revoked" }, true), /Invitation sent/);
    assert.doesNotMatch(invitationDetail({ status: "revoked" }, true), /accepted/i);
  });
});

describe("Phase 5 communications review seams", () => {
  it("opening Prepare does not send a message", () => {
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(page, /buildCommunicationsReview/);
    assert.doesNotMatch(page, /inviteClient\(/);
    assert.doesNotMatch(page, /triggerSequencesForRelationship/);
    assert.doesNotMatch(page, /enrollRelationshipManually/);
    assert.doesNotMatch(page, /ensureStarterAutomationsForCurrentVenue/);
    const panel = readFileSync(resolve("components/clients/communications-review-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /fetch\(/);
    assert.doesNotMatch(panel, /inviteClient/);
    const helper = readFileSync(resolve("lib/clients/communications-review.ts"), "utf8");
    assert.doesNotMatch(helper, /inviteClient/);
    assert.doesNotMatch(helper, /insertEnrollment/);
    assert.match(helper, /Opening this page does not send a message/);
  });

  it("applying Client Planning does not send the invitation", () => {
    const panel = readFileSync(resolve("components/clients/prepare-planning-panel.tsx"), "utf8");
    assert.match(panel, /applyPlaybookAction/);
    assert.doesNotMatch(panel, /inviteClient/);
    assert.doesNotMatch(panel, /releasePlaybookAction/);
    const apply = readFileSync(resolve("lib/playbooks/repository.ts"), "utf8");
    const fnStart = apply.indexOf("export async function applyPlaybookToEvent");
    const fn = apply.slice(fnStart, apply.indexOf("export type ReleasePlaybookResult", fnStart));
    assert.doesNotMatch(fn, /inviteClient/);
  });

  it("financial readiness does not send communication", () => {
    const helper = readFileSync(resolve("lib/clients/financial-readiness.ts"), "utf8");
    assert.doesNotMatch(helper, /inviteClient/);
    assert.doesNotMatch(helper, /sendEmail/);
    const panel = readFileSync(resolve("components/clients/financial-readiness-panel.tsx"), "utf8");
    assert.doesNotMatch(panel, /inviteClient/);
    assert.doesNotMatch(panel, /fetch\(/);
  });

  it("release still sends the invitation only after Client Planning is released", () => {
    const src = readFileSync(resolve("lib/playbooks/service.ts"), "utf8");
    const fnStart = src.indexOf("export async function releasePlaybookApplication");
    const fn = src.slice(fnStart, src.indexOf("export async function updateEventTaskDaysOffset", fnStart));
    assert.ok(fn.indexOf("inviteClient(") > fn.indexOf("if (!released.ok)"));
    assert.match(fn, /The invitation could not be sent/);
    assert.doesNotMatch(fn, /buildCommunicationsReview/);
  });

  it("does not invent a welcome message or Booked Automation", () => {
    const empty = JSON.stringify(review());
    assert.doesNotMatch(empty, /welcome/i);
    assert.doesNotMatch(empty, /insertSequence/);
    assert.doesNotMatch(empty, /createSequence/);
    const helper = readFileSync(resolve("lib/clients/communications-review.ts"), "utf8");
    assert.doesNotMatch(helper, /insertSequence/);
    assert.doesNotMatch(helper, /createSequence/);
    const page = readFileSync(resolve("app/(app)/clients/[id]/booked/page.tsx"), "utf8");
    assert.match(page, /getSequences/);
    assert.match(page, /getActiveEnrollmentsForRelationship/);
  });

  it("existing Conversation and Automation engines are not modified by this review", () => {
    const helper = readFileSync(resolve("lib/clients/communications-review.ts"), "utf8");
    assert.doesNotMatch(helper, /conversation_messages/);
    assert.doesNotMatch(helper, /processAutomationEvents/);
    const engine = readFileSync(resolve("lib/automation/engine.ts"), "utf8");
    assert.doesNotMatch(engine, /buildCommunicationsReview/);
    const sequences = readFileSync(resolve("lib/message-sequences/service.ts"), "utf8");
    assert.doesNotMatch(sequences, /buildCommunicationsReview/);
  });

  it("wedding wording and Phase 1–4 panels remain on Prepare", () => {
    const celebration = readFileSync(resolve("components/clients/booking-celebration.tsx"), "utf8");
    assert.match(celebration, /eventTypeLabel/);
    assert.match(celebration, /PreparePlanningPanel/);
    assert.match(celebration, /FinancialReadinessPanel/);
    assert.match(celebration, /EventExperienceReviewPanel/);
    assert.match(celebration, /CommunicationsReviewPanel/);
    assert.doesNotMatch(celebration, /Their workspace is ready/);
    assert.doesNotMatch(celebration, /Wedding website ready/);
  });
});
