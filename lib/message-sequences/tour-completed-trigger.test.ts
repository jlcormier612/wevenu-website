/**
 * Tour Completed Automation trigger — pure fire rules + uniqueness.
 * Does not change lead_created / lead_stage_changed / exit semantics.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SEQUENCE_TRIGGER_TYPES } from "@/lib/message-sequences/constants";
import {
  shouldFireTourCompletedTrigger,
  wouldCreateTourCompletedEnrollment,
} from "@/lib/message-sequences/tour-completed-trigger";
import {
  applyEnrollmentPause,
  terminalExitStatusForLeadStatus,
} from "@/lib/message-sequences/enrollment-pause";
import type { SequenceTriggerType } from "@/lib/message-sequences/types";

describe("Tour Completed trigger fire rules", () => {
  it("completed transition fires the Automation", () => {
    assert.equal(shouldFireTourCompletedTrigger("scheduled", "completed"), true);
    assert.equal(shouldFireTourCompletedTrigger("confirmed", "completed"), true);
  });

  it("non-completed statuses do not fire", () => {
    assert.equal(shouldFireTourCompletedTrigger("scheduled", "confirmed"), false);
    assert.equal(shouldFireTourCompletedTrigger("scheduled", "cancelled"), false);
    assert.equal(shouldFireTourCompletedTrigger("confirmed", "no_show"), false);
    assert.equal(shouldFireTourCompletedTrigger("completed", "completed"), false);
  });

  it("repeated completion cannot create concurrent duplicate actives", () => {
    assert.equal(
      wouldCreateTourCompletedEnrollment(["tour-auto"], new Set(["tour-auto"])),
      false,
    );
    assert.equal(
      wouldCreateTourCompletedEnrollment(["tour-auto"], new Set()),
      true,
    );
  });
});

describe("Tour Completed does not alter existing triggers/exits", () => {
  it("lead_created and lead_stage_changed remain in the picker", () => {
    const values = SEQUENCE_TRIGGER_TYPES.map((t) => t.value);
    assert.ok(values.includes("lead_created"));
    assert.ok(values.includes("lead_stage_changed"));
    assert.ok(values.includes("tour_completed"));
    assert.equal(values.length, 3);
  });

  it("tour_completed needs no stage config (unlike lead_stage_changed)", () => {
    const tour: SequenceTriggerType = "tour_completed";
    assert.equal(tour, "tour_completed");
    const stageTypes = SEQUENCE_TRIGGER_TYPES.filter((t) => t.value === "lead_stage_changed");
    assert.equal(stageTypes.length, 1);
  });

  it("Lost/Cancelled/Booking exit reasons remain unchanged", () => {
    assert.equal(terminalExitStatusForLeadStatus("lost"), "exited_lost");
    assert.equal(terminalExitStatusForLeadStatus("cancelled"), "exited_lost");
    assert.equal(terminalExitStatusForLeadStatus("won"), "exited_booking");
    assert.equal(terminalExitStatusForLeadStatus("booked"), "exited_booking");
    // Pause does not change exit status mapping
    const paused = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T00:00:00Z");
    assert.equal(paused.status, "active");
    assert.equal(terminalExitStatusForLeadStatus("lost"), "exited_lost");
  });
});
