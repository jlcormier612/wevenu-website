/**
 * Human-readable automation preview — must reflect actual configuration.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTOMATION_STOPS_SUMMARY,
  CLIENT_AUTOMATION_STOPS_SUMMARY,
  automationStopsSummaryForTrigger,
  buildAutomationBehaviorSummary,
} from "@/lib/message-sequences/behavior-summary";
import type { MessageSequenceInput, SequenceTriggerType } from "@/lib/message-sequences/types";

function base(overrides: Partial<MessageSequenceInput> = {}): MessageSequenceInput {
  return {
    name: "Test",
    triggerType: "lead_created",
    triggerStage: null,
    steps: [
      { templateId: "t1", channel: "email", offsetDays: 0 },
      { templateId: "t2", channel: "email", offsetDays: 2 },
      { templateId: "t3", channel: "sms", offsetDays: 5 },
    ],
    ...overrides,
  };
}

describe("automationStopsSummaryForTrigger", () => {
  it("keeps booking/Lost language for Sales triggers", () => {
    for (const triggerType of ["lead_created", "lead_stage_changed", "tour_completed"] as SequenceTriggerType[]) {
      assert.equal(automationStopsSummaryForTrigger(triggerType), AUTOMATION_STOPS_SUMMARY);
      assert.match(AUTOMATION_STOPS_SUMMARY, /book/i);
      assert.match(AUTOMATION_STOPS_SUMMARY, /Lost/);
    }
  });

  it("omits booking/Lost for Client triggers", () => {
    for (const triggerType of [
      "contract_signed",
      "payment_received",
      "questionnaire_submitted",
      "guest_count_submitted",
      "event_completed",
    ] as SequenceTriggerType[]) {
      assert.equal(automationStopsSummaryForTrigger(triggerType), CLIENT_AUTOMATION_STOPS_SUMMARY);
    }
    assert.doesNotMatch(CLIENT_AUTOMATION_STOPS_SUMMARY, /book/i);
    assert.doesNotMatch(CLIENT_AUTOMATION_STOPS_SUMMARY, /Lost/);
    assert.match(CLIENT_AUTOMATION_STOPS_SUMMARY, /reply to a message/);
    assert.match(CLIENT_AUTOMATION_STOPS_SUMMARY, /finish every step/);
    assert.match(CLIENT_AUTOMATION_STOPS_SUMMARY, /you stop them/);
  });

  it("keeps booking/Lost language for manual automations", () => {
    assert.equal(automationStopsSummaryForTrigger(null), AUTOMATION_STOPS_SUMMARY);
  });
});

describe("buildAutomationBehaviorSummary", () => {
  it("reflects new-inquiry timing and channels from config", () => {
    const s = buildAutomationBehaviorSummary(base());
    assert.match(s.paragraph, /new inquiry/i);
    assert.match(s.paragraph, /immediately/i);
    assert.match(s.paragraph, /2 days after the previous message/i);
    assert.match(s.paragraph, /text/i);
    assert.match(s.paragraph, /5 days after the previous message/i);
    assert.equal(s.lines.steps.length, 3);
  });

  it("reflects pipeline stage start", () => {
    const s = buildAutomationBehaviorSummary(base({
      triggerType: "lead_stage_changed",
      triggerStage: "tour_scheduled",
      steps: [{ templateId: "t1", channel: "email", offsetDays: 1 }],
    }));
    assert.match(s.paragraph, /Tour Scheduled/i);
    assert.match(s.paragraph, /1 day after they enter this automation/i);
  });

  it("reflects tour completed start", () => {
    const s = buildAutomationBehaviorSummary(base({
      triggerType: "tour_completed",
      steps: [{ templateId: "t1", channel: "email", offsetDays: 0 }],
    }));
    assert.match(s.paragraph, /tour is completed/i);
  });

  it("reflects manual-only start", () => {
    const s = buildAutomationBehaviorSummary(base({
      triggerType: null,
      steps: [{ templateId: "t1", channel: "email", offsetDays: 0 }],
    }));
    assert.match(s.paragraph, /When you add someone/i);
    assert.match(s.lines.starts, /add someone yourself/i);
  });

  it("handles empty steps without inventing sends", () => {
    const s = buildAutomationBehaviorSummary(base({ steps: [] }));
    assert.match(s.paragraph, /Add at least one message step/i);
    assert.equal(s.lines.steps.length, 0);
  });

  it("Sales automations include booking/Lost stop conditions in lines and paragraph", () => {
    const s = buildAutomationBehaviorSummary(base());
    assert.equal(s.lines.stops, AUTOMATION_STOPS_SUMMARY);
    assert.ok(s.paragraph.includes(AUTOMATION_STOPS_SUMMARY));
  });

  it("Client automations omit booking/Lost from stops and generated summary", () => {
    const s = buildAutomationBehaviorSummary(base({
      triggerType: "contract_signed",
      steps: [{ templateId: "t1", channel: "email", offsetDays: 0 }],
    }));
    assert.equal(s.lines.stops, CLIENT_AUTOMATION_STOPS_SUMMARY);
    assert.ok(s.paragraph.includes(CLIENT_AUTOMATION_STOPS_SUMMARY));
    assert.doesNotMatch(s.paragraph, /\bbook\b/i);
    assert.doesNotMatch(s.paragraph, /Lost/);
    assert.doesNotMatch(s.lines.stops, /\bbook\b/i);
    assert.doesNotMatch(s.lines.stops, /Lost/);
  });
});
