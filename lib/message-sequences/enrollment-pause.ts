/**
 * Pure helpers for per-enrollment pause/resume (Automation P1).
 * Enrollment status stays "active" while paused_at is set.
 */

export type PauseResumeEnrollmentState = {
  status: string;
  pausedAt: string | null;
};

/** Pause: set paused_at; status unchanged. */
export function applyEnrollmentPause(
  state: PauseResumeEnrollmentState,
  pausedAtIso: string,
): PauseResumeEnrollmentState {
  return { status: state.status, pausedAt: pausedAtIso };
}

/** Resume: clear paused_at; status unchanged; scheduled_for dates untouched. */
export function applyEnrollmentResume(
  state: PauseResumeEnrollmentState,
): PauseResumeEnrollmentState {
  return { status: state.status, pausedAt: null };
}

/**
 * Same skip rule as isEnrollmentSequencePaused: sequence-wide pause OR
 * this enrollment's paused_at.
 */
export function shouldSkipScheduledSendForPause(opts: {
  sequenceStatus: "active" | "paused";
  enrollmentPausedAt: string | null;
}): boolean {
  if (opts.enrollmentPausedAt) return true;
  return opts.sequenceStatus === "paused";
}

/** Terminal exits always apply to active enrollments, including paused ones. */
export function terminalExitStatusForLeadStatus(
  leadStatus: string,
): "exited_lost" | "exited_cancelled" | "exited_booking" | null {
  if (leadStatus === "lost") return "exited_lost";
  if (leadStatus === "cancelled") return "exited_cancelled";
  if (leadStatus === "won") return "exited_booking"; // booking path uses exited_booking
  return null;
}

/** Exit-before-enroll ordering for Lost/Cancelled (unchanged from P0). */
export function terminalExitBeforeEnrollOrder(
  status: string,
): Array<"exit" | "enroll"> {
  if (status === "lost" || status === "cancelled") return ["exit", "enroll"];
  return ["enroll"];
}

/** Resume does not rewrite future scheduled_for values. */
export function scheduledForUnchangedAfterResume(
  before: readonly string[],
  after: readonly string[],
): boolean {
  return before.length === after.length && before.every((v, i) => v === after[i]);
}

/**
 * Catch-up after resume: due rows stay scheduled (same as sequence-level pause);
 * processor sends them on the next run once pause is cleared.
 */
export function dueMessagesRemainScheduledWhilePaused(
  messageStatus: string,
  enrollmentPausedAt: string | null,
): boolean {
  return messageStatus === "scheduled" && enrollmentPausedAt != null;
}
