/**
 * Human-readable automation preview — must reflect actual configuration.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTOMATION_STOPS_SUMMARY,
  buildAutomationBehaviorSummary,
} from "@/lib/message-sequences/behavior-summary";
import type { MessageSequenceInput } from "@/lib/message-sequences/types";

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

describe("buildAutomationBehaviorSummary", () => {
  it("reflects new-inquiry timing and channels from config", () => {
    const s = buildAutomationBehaviorSummary(base());
    assert.match(s.paragraph, /new inquiry/i);
    assert.match(s.paragraph, /immediately/i);
    assert.match(s.paragraph, /2 days after the previous message/i);
    assert.match(s.paragraph, /SMS/i);
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
    assert.match(s.paragraph, /1 day after they join/i);
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

  it("always includes real stop conditions", () => {
    const s = buildAutomationBehaviorSummary(base());
    assert.equal(s.lines.stops, AUTOMATION_STOPS_SUMMARY);
    assert.ok(s.paragraph.includes(AUTOMATION_STOPS_SUMMARY));
  });
});
