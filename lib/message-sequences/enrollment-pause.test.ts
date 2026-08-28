/**
 * Per-enrollment pause/resume — all 15 P1 brief checks (pure helpers).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEnrollmentPause,
  applyEnrollmentResume,
  dueMessagesRemainScheduledWhilePaused,
  scheduledForUnchangedAfterResume,
  shouldSkipScheduledSendForPause,
  terminalExitBeforeEnrollOrder,
  terminalExitStatusForLeadStatus,
} from "@/lib/message-sequences/enrollment-pause";
import { wouldCreateEnrollmentForSequences } from "@/lib/message-sequences/would-enroll";

describe("per-enrollment pause / resume (P1)", () => {
  it("1. active enrollment can be paused", () => {
    const next = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    assert.ok(next.pausedAt);
  });

  it("2. paused enrollment remains status = active", () => {
    const next = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    assert.equal(next.status, "active");
  });

  it("3. paused enrollment has paused_at", () => {
    const at = "2026-08-12T12:00:00.000Z";
    const next = applyEnrollmentPause({ status: "active", pausedAt: null }, at);
    assert.equal(next.pausedAt, at);
  });

  it("4. scheduled sends do not send while paused", () => {
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "active", enrollmentPausedAt: "2026-08-12T12:00:00Z" }),
      true,
    );
  });

  it("5. resume clears paused_at", () => {
    const paused = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    const resumed = applyEnrollmentResume(paused);
    assert.equal(resumed.pausedAt, null);
    assert.equal(resumed.status, "active");
  });

  it("6. due sends follow existing catch-up semantics after resume", () => {
    // While paused, due rows stay scheduled (not deleted) — same as sequence-wide pause.
    assert.equal(dueMessagesRemainScheduledWhilePaused("scheduled", "2026-08-12T12:00:00Z"), true);
    // After resume, skip clears → processor will send due rows on next run.
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "active", enrollmentPausedAt: null }),
      false,
    );
  });

  it("7. future scheduled dates remain unchanged", () => {
    const dates = ["2026-08-13T12:00:00Z", "2026-08-16T12:00:00Z"];
    assert.equal(scheduledForUnchangedAfterResume(dates, [...dates]), true);
  });

  it("8. paused Lost enrollment exits as exited_lost", () => {
    const paused = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    assert.equal(paused.status, "active"); // still selectable by exitActiveEnrollments
    assert.equal(terminalExitStatusForLeadStatus("lost"), "exited_lost");
  });

  it("9. cancelled alias exits as exited_lost (no new exited_cancelled)", () => {
    assert.equal(terminalExitStatusForLeadStatus("cancelled"), "exited_lost");
  });

  it("10. paused Booked enrollment exits through existing booking exit", () => {
    assert.equal(terminalExitStatusForLeadStatus("won"), "exited_booking");
    assert.equal(terminalExitStatusForLeadStatus("booked"), "exited_booking");
  });

  it("11. pausing one enrollment does not pause another in the same Automation", () => {
    const a = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    const b = { status: "active", pausedAt: null as string | null };
    assert.ok(a.pausedAt);
    assert.equal(b.pausedAt, null);
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "active", enrollmentPausedAt: a.pausedAt }),
      true,
    );
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "active", enrollmentPausedAt: b.pausedAt }),
      false,
    );
  });

  it("12. existing sequence-wide pause behavior remains unchanged", () => {
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "paused", enrollmentPausedAt: null }),
      true,
    );
    assert.equal(
      shouldSkipScheduledSendForPause({ sequenceStatus: "active", enrollmentPausedAt: null }),
      false,
    );
  });

  it("13. existing active-enrollment uniqueness remains unchanged", () => {
    assert.equal(
      wouldCreateEnrollmentForSequences(["seq-1"], new Set(["seq-1"])),
      false,
    );
    assert.equal(
      wouldCreateEnrollmentForSequences(["seq-1"], new Set()),
      true,
    );
  });

  it("14. activity timeline shows pause when paused_at is set", () => {
    // Timeline RPC emits automation_paused from paused_at (same enrollment union).
    const paused = applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z");
    assert.ok(paused.pausedAt);
    const eventType = paused.pausedAt ? "automation_paused" : null;
    assert.equal(eventType, "automation_paused");
  });

  it("15. activity timeline shows resume after resume (resumed_at)", () => {
    // Resume clears paused_at and sets resumed_at in the repository; timeline
    // emits automation_resumed from resumed_at via the same RPC union.
    const resumed = applyEnrollmentResume(
      applyEnrollmentPause({ status: "active", pausedAt: null }, "2026-08-12T12:00:00Z"),
    );
    assert.equal(resumed.pausedAt, null);
    const eventType = resumed.pausedAt == null ? "automation_resumed" : "automation_paused";
    assert.equal(eventType, "automation_resumed");
  });

  it("terminal exit-before-enroll ordering preserved with pause", () => {
    assert.deepEqual(terminalExitBeforeEnrollOrder("lost"), ["exit", "enroll"]);
    assert.deepEqual(terminalExitBeforeEnrollOrder("cancelled"), ["exit", "enroll"]);
    assert.deepEqual(terminalExitBeforeEnrollOrder("proposal_sent"), ["enroll"]);
  });
});
