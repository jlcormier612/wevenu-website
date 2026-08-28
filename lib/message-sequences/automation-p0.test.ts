/**
 * Pure helpers / ordering checks for Automation P0 terminal-stage behavior.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEQUENCE_TRIGGER_STAGES } from "@/lib/message-sequences/constants";
import { triggerStageDisplayLabel, venueStageNameForLeadStatus } from "@/lib/message-sequences/stage-labels";
import { validateSequenceInput } from "@/lib/message-sequences/validation";
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

describe("SEQUENCE_TRIGGER_STAGES (P0-1)", () => {
  it("includes all 7 sales stage values", () => {
    const values = SEQUENCE_TRIGGER_STAGES.map((s) => s.value);
    assert.deepEqual(values, LEAD_STATUSES.map((s) => s.value));
    assert.equal(values.length, 7);
    assert.ok(values.includes("booked"));
    assert.ok(values.includes("lost"));
    assert.ok(values.includes("new_inquiry"));
    assert.ok(!values.includes("cancelled"));
    assert.ok(!values.includes("won"));
  });

  it("validation accepts each sales stage as triggerStage", () => {
    for (const status of LEAD_STATUSES) {
      const errors = validateSequenceInput({
        name: "Test",
        triggerType: "lead_stage_changed",
        triggerStage: status.value,
        steps: [{ templateId: "t1", channel: "email", offsetDays: 0 }],
      });
      assert.equal(errors.triggerStage, undefined, status.value);
    }
  });

  it("validation rejects unknown triggerStage", () => {
    const errors = validateSequenceInput({
      name: "Test",
      triggerType: "lead_stage_changed",
      triggerStage: "not_a_status",
      steps: [{ templateId: "t1", channel: "email", offsetDays: 0 }],
    });
    assert.ok(errors.triggerStage);
  });
});

describe("venue stage labels (P0-2)", () => {
  const stages = [
    { name: "Just In", canonicalStage: "inquiry" as CanonicalStage, sortOrder: 0 },
    { name: "Let's Talk Numbers", canonicalStage: "proposal" as CanonicalStage, sortOrder: 2 },
    { name: "Tour Booked", canonicalStage: "tour" as CanonicalStage, sortOrder: 1 },
  ];

  it("resolves venue name via LeadStatus → canonical mapping", () => {
    assert.equal(venueStageNameForLeadStatus("new", stages), "Just In");
    assert.equal(venueStageNameForLeadStatus("proposal_sent", stages), "Let's Talk Numbers");
    assert.equal(venueStageNameForLeadStatus("contacted", stages), "Tour Booked");
    assert.equal(venueStageNameForLeadStatus("qualified", stages), "Tour Booked");
  });

  it("formats LeadStatus · venue name for display", () => {
    assert.equal(
      triggerStageDisplayLabel("proposal_sent", stages),
      "Proposal Sent · Let's Talk Numbers",
    );
  });
});

/**
 * Documents the required call order for terminal stages without hitting the DB:
 * exit existing active enrollments, THEN fire stage-change enrollment.
 */
describe("terminal-stage exit-before-enroll ordering (P0-4)", () => {
  type Call = "exit" | "enroll";

  async function simulateStatusSideEffects(
    status: string,
    exitFn: () => Promise<void>,
    enrollFn: () => Promise<void>,
  ): Promise<Call[]> {
    const calls: Call[] = [];
    if (status === "lost" || status === "cancelled") {
      await exitFn().then(() => { calls.push("exit"); });
    }
    await enrollFn().then(() => { calls.push("enroll"); });
    return calls;
  }

  it("lost: exits before enroll", async () => {
    const order = await simulateStatusSideEffects(
      "lost",
      async () => { /* exit */ },
      async () => { /* enroll */ },
    );
    assert.deepEqual(order, ["exit", "enroll"]);
  });

  it("cancelled: exits before enroll", async () => {
    const order = await simulateStatusSideEffects(
      "cancelled",
      async () => { /* exit */ },
      async () => { /* enroll */ },
    );
    assert.deepEqual(order, ["exit", "enroll"]);
  });

  it("ordinary stage change does not exit", async () => {
    const order = await simulateStatusSideEffects(
      "proposal_sent",
      async () => { /* exit */ },
      async () => { /* enroll */ },
    );
    assert.deepEqual(order, ["enroll"]);
  });

  it("exit completes before enroll starts (no race)", async () => {
    let exitDone = false;
    let enrollSawExitDone = false;
    await simulateStatusSideEffects(
      "lost",
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        exitDone = true;
      },
      async () => {
        enrollSawExitDone = exitDone;
      },
    );
    assert.equal(enrollSawExitDone, true);
  });
});
