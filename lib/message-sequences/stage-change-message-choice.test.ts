/**
 * Stage-change Send / Don't send / Cancel.
 * Pure effects plus source contracts for the confirm dialog and enrollment path.
 * No email or SMS is sent.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveStageMoveConfirmGate } from "@/lib/message-sequences/would-enroll";
import {
  isDispatchableScheduledStatus,
  previewCoversEveryStep,
  queueMessagesAfterStageWrite,
  shouldRecordAnotherSkip,
  stageChangeEffects,
  STAGE_CHANGE_SKIP_WINDOW_MS,
  type StageChangeSequenceEffect,
} from "@/lib/message-sequences/stage-change-message-choice";

const oneMessage: StageChangeSequenceEffect[] = [
  { id: "proposal", updatePipelineOnEnroll: false, stepIds: ["step-1"] },
];

const twoAutomations: StageChangeSequenceEffect[] = [
  { id: "proposal", updatePipelineOnEnroll: false, stepIds: ["step-1", "step-2"] },
  { id: "follow-up", updatePipelineOnEnroll: true, stepIds: ["step-3"] },
];

function source(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

describe("stage-change message choice", () => {
  it("1. Send updates the stage and schedules every matching message step", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "send"), "commit");
    const effects = stageChangeEffects({ choice: "send", sequences: oneMessage });
    assert.equal(effects.writesStage, true);
    assert.equal(effects.messageStatus, "scheduled");
    assert.equal(effects.enrollmentStatus, "active");
    assert.deepEqual(effects.stepIds, ["step-1"]);
    assert.equal(isDispatchableScheduledStatus("scheduled"), true);
  });

  it("2. Don't send updates the stage and does not leave a dispatchable message", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "skip"), "commit_skip");
    const effects = stageChangeEffects({ choice: "skip", sequences: oneMessage });
    assert.equal(effects.writesStage, true);
    assert.equal(effects.messageStatus, "cancelled");
    assert.equal(isDispatchableScheduledStatus(effects.messageStatus), false);
  });

  it("3. Cancel leaves the stage unchanged and queues nothing", () => {
    assert.equal(resolveStageMoveConfirmGate(true, "cancel"), "abort");
    const effects = stageChangeEffects({ choice: "cancel", sequences: twoAutomations });
    assert.equal(effects.writesStage, false);
    assert.equal(effects.messageStatus, null);
    assert.equal(effects.enrollmentStatus, null);
    assert.deepEqual(effects.stepIds, []);
  });

  it("4. multiple matching automations are all in the send and skip scope", () => {
    const send = stageChangeEffects({ choice: "send", sequences: twoAutomations });
    const skip = stageChangeEffects({ choice: "skip", sequences: twoAutomations });
    assert.deepEqual(send.stepIds, ["step-1", "step-2", "step-3"]);
    assert.deepEqual(skip.stepIds, send.stepIds);
    assert.equal(skip.messageStatus, "cancelled");
  });

  it("5. every message step is disclosed, including later steps", () => {
    const effects = stageChangeEffects({ choice: "send", sequences: twoAutomations });
    assert.equal(previewCoversEveryStep(["step-1", "step-2", "step-3"], effects.stepIds), true);
    assert.equal(previewCoversEveryStep(["step-1"], effects.stepIds), false);
  });

  it("6. pipeline advance stays on Send and Don't send; Cancel drops it", () => {
    const send = stageChangeEffects({ choice: "send", sequences: twoAutomations });
    const skip = stageChangeEffects({ choice: "skip", sequences: twoAutomations });
    const cancel = stageChangeEffects({ choice: "cancel", sequences: twoAutomations });
    assert.deepEqual(send.pipelineAdvanceSequenceIds, ["follow-up"]);
    assert.deepEqual(skip.pipelineAdvanceSequenceIds, ["follow-up"]);
    assert.deepEqual(cancel.pipelineAdvanceSequenceIds, []);
  });

  it("7. a failed stage write does not queue messages", () => {
    assert.equal(queueMessagesAfterStageWrite(false), false);
    assert.equal(queueMessagesAfterStageWrite(true), true);
    const leads = source("lib/leads/service.ts");
    const start = leads.indexOf("export async function updateLeadSalesStage");
    const end = leads.indexOf("export async function updateLeadStatus", start);
    const fn = leads.slice(start, end);
    const writeAt = fn.indexOf("await repo.updateLeadSalesStage");
    const triggerAt = fn.indexOf("triggerSequencesForRelationship");
    assert.ok(writeAt >= 0 && triggerAt > writeAt);
  });

  it("8. a repeated skip inside the window does not create another run", () => {
    const now = 1_000_000;
    assert.equal(shouldRecordAnotherSkip(
      { status: "cancelled", enrolledAtMs: now - 1_000 },
      now,
    ), false);
    assert.equal(shouldRecordAnotherSkip(null, now), true);
  });

  it("9. a one-time skip does not change the saved automation and a later move can enroll", () => {
    const skip = stageChangeEffects({ choice: "skip", sequences: oneMessage });
    assert.equal(skip.mutatesSavedAutomation, false);
    const now = 1_000_000;
    assert.equal(shouldRecordAnotherSkip(
      { status: "cancelled", enrolledAtMs: now - STAGE_CHANGE_SKIP_WINDOW_MS - 1 },
      now,
    ), true);
    const service = source("lib/message-sequences/service.ts");
    const triggerStart = service.indexOf("export async function triggerSequencesForRelationship");
    const triggerEnd = service.indexOf("async function maybeAdvanceLeadOnSequenceEnroll", triggerStart);
    const trigger = service.slice(triggerStart, triggerEnd);
    assert.doesNotMatch(trigger, /setSequenceStatus/);
    assert.doesNotMatch(trigger, /message_sequences/);
  });

  it("10. pause, exit, consent, and recipient checks stay on the sender", () => {
    const processor = source("lib/scheduled-messages/processor.ts");
    const due = source("lib/scheduled-messages/repository.ts");
    assert.match(processor, /assertChannelAllowed/);
    assert.match(processor, /isEnrollmentSequencePaused/);
    assert.match(processor, /getRecipientContactForRelationship/);
    assert.match(due, /\.eq\("status", "scheduled"\)/);
    assert.equal(isDispatchableScheduledStatus("cancelled"), false);
    assert.equal(isDispatchableScheduledStatus("sent"), false);
  });

  it("11. skip applies only to the sequences in this stage-change plan", () => {
    const effects = stageChangeEffects({ choice: "skip", sequences: oneMessage });
    assert.deepEqual(effects.stepIds, ["step-1"]);
    assert.equal(effects.stepIds.includes("unrelated-step"), false);
  });

  it("12. a stage with no matching automation still commits without the dialog", () => {
    assert.equal(resolveStageMoveConfirmGate(false, null), "commit");
    assert.equal(resolveStageMoveConfirmGate(false, "cancel"), "commit");
  });

  it("the dialog offers Send, Don't send, and Cancel, and lists every step", () => {
    const dialog = source("components/leads/pipeline-automation-confirm.tsx");
    const detail = source("components/leads/lead-detail.tsx");
    const board = source("components/leads/pipeline-board.tsx");
    const preview = source("lib/leads/service.ts");
    assert.match(dialog, /Send message &amp; continue/);
    assert.match(dialog, /Don&apos;t send &amp; continue/);
    assert.match(dialog, />\s*Cancel\s*</);
    assert.match(dialog, /plan\?\.steps/);
    assert.match(detail, /commitStageChange\(stageId, "send"\)/);
    assert.match(detail, /commitStageChange\(stageId, "skip"\)/);
    assert.match(detail, /updateLeadStatusAction\(lead\.id, stageKey, customerMessages\)/);
    assert.doesNotMatch(detail, /onContinue=/);
    assert.match(board, /commitMove\(leadId, targetKey, "skip"\)/);
    assert.match(board, /commitMove\(leadId, targetKey, "send"\)/);
    assert.match(preview, /previewStepsForSequence/);
    assert.match(preview, /customerMessages === "skip"/);
  });

  it("skip inserts cancelled message rows and does not edit the automation definition", () => {
    const sequences = source("lib/message-sequences/service.ts");
    const repo = source("lib/message-sequences/repository.ts");
    assert.match(sequences, /skipMessages \? "cancelled" : "scheduled"/);
    assert.match(sequences, /cancelEnrollmentImmediately/);
    assert.match(repo, /status: messageStatus/);
    assert.doesNotMatch(sequences, /from\("message_sequences"\)[\s\S]{0,80}update/);
  });
});
