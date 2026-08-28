/**
 * Pure helpers / ordering checks for Automation P0 terminal-stage behavior.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEQUENCE_TRIGGER_STAGES } from "@/lib/message-sequences/constants";
import { terminalExitBeforeEnrollOrder } from "@/lib/message-sequences/enrollment-pause";
import { validateSequenceInput } from "@/lib/message-sequences/validation";
import { LEAD_STATUSES } from "@/lib/leads/constants";

describe("SEQUENCE_TRIGGER_STAGES (P0-1)", () => {
  it("includes all 7 sales stage values", () => {
    const values: string[] = SEQUENCE_TRIGGER_STAGES.map((s) => s.value);
    assert.deepEqual(values, LEAD_STATUSES.map((s) => s.value));
    assert.equal(values.length, 7);
    assert.ok(values.includes("booked"));
    assert.ok(values.includes("lost"));
    assert.ok(values.includes("new_inquiry"));
    assert.ok(!(values as string[]).includes("cancelled"));
    assert.ok(!(values as string[]).includes("won"));
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

/**
 * Documents the required call order for terminal stages without hitting the DB:
 * exit existing active enrollments, THEN fire stage-change enrollment.
 * Calls the real terminalExitBeforeEnrollOrder() (lib/message-sequences/
 * enrollment-pause.ts) rather than a hand-simulated duplicate — a prior
 * version of this test hardcoded its own copy of this logic, which is
 * exactly what let it go stale when the status vocabulary changed to the
 * seven-stage model. See enrollment-pause.test.ts for full P1 coverage of
 * the same function.
 */
describe("terminal-stage exit-before-enroll ordering (P0-4)", () => {
  it("lost: exits before enroll", () => {
    assert.deepEqual(terminalExitBeforeEnrollOrder("lost"), ["exit", "enroll"]);
  });

  it("cancelled (legacy alias): exits before enroll", () => {
    assert.deepEqual(terminalExitBeforeEnrollOrder("cancelled"), ["exit", "enroll"]);
  });

  it("ordinary stage change does not exit", () => {
    assert.deepEqual(terminalExitBeforeEnrollOrder("proposal_sent"), ["enroll"]);
  });
});
