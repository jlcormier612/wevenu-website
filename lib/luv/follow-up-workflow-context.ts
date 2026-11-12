/**
 * Follow-up workflow context — application owns workflow truth; Luv owns wording.
 *
 * Tour state comes only from tour_appointments (same source as the lead workspace).
 * Gate 1/2 inquiry filtering stays in customer-facing-inquiry-context.ts.
 */

export type FollowUpTourState =
  | { kind: "none" }
  | { kind: "upcoming"; scheduledAt: string; status: "scheduled" | "confirmed" }
  /**
   * Scheduled/confirmed appointment whose start time has passed without
   * completion — not rewritten in tour_appointments; classification only.
   * Must not be treated as an upcoming tour for sales copy.
   */
  | { kind: "past_due"; scheduledAt: string; status: "scheduled" | "confirmed" }
  | { kind: "completed"; scheduledAt: string; completedAt: string | null }
  | { kind: "cancelled"; scheduledAt: string | null };

export type FollowUpWorkflowIntent =
  | "acknowledge_completed_tour"
  | "reference_upcoming_tour"
  | "follow_recorded_next_action"
  | "invite_to_schedule_tour"
  | "answer_questions"
  | "gentle_check_in"
  | "no_outreach";

export type FollowUpTourAppointmentRow = {
  scheduled_at: string;
  status: string;
  completed_at?: string | null;
};

/**
 * Classify actionable tour state for follow-up drafting.
 *
 * Precedence matches workspace current-tour semantics:
 * 1) Prefer the most recent non-cancelled appointment (scheduled/confirmed/completed/no_show).
 * 2) Only if none exist, fall back to a cancelled historical row.
 * A cancelled row never overrides a later/active completed or upcoming tour.
 *
 * Past-due scheduled/confirmed rows are classified as `past_due` (not upcoming).
 * This does not rewrite tour_appointments status.
 */
export function classifyFollowUpTourState(
  rows: FollowUpTourAppointmentRow[],
  nowMs: number = Date.now(),
): FollowUpTourState {
  const sorted = [...rows].sort((a, b) =>
    String(b.scheduled_at).localeCompare(String(a.scheduled_at)),
  );

  const active = sorted.find((r) => r.status !== "cancelled");
  if (active) {
    if (active.status === "completed") {
      return {
        kind: "completed",
        scheduledAt: active.scheduled_at,
        completedAt: active.completed_at ?? null,
      };
    }
    if (active.status === "scheduled" || active.status === "confirmed") {
      const scheduledMs = Date.parse(active.scheduled_at);
      if (Number.isFinite(scheduledMs) && scheduledMs < nowMs) {
        return {
          kind: "past_due",
          scheduledAt: active.scheduled_at,
          status: active.status,
        };
      }
      return {
        kind: "upcoming",
        scheduledAt: active.scheduled_at,
        status: active.status,
      };
    }
    // no_show (and any other non-cancelled residual): treat like cancelled for CTA —
    // do not claim a completed visit; scheduling may be appropriate.
    return {
      kind: "cancelled",
      scheduledAt: active.scheduled_at,
    };
  }

  const cancelled = sorted.find((r) => r.status === "cancelled");
  if (cancelled) {
    return { kind: "cancelled", scheduledAt: cancelled.scheduled_at };
  }
  return { kind: "none" };
}

export function deriveFollowUpWorkflowIntent(input: {
  tour: FollowUpTourState;
  nextActionText: string | null | undefined;
  /** Specific unresolved purpose — completed tours do not default to thank-you. */
  communicationPurpose?: "unresolved_question" | "explicit_request" | "none";
}): FollowUpWorkflowIntent {
  if (input.tour.kind === "completed") {
    if (
      input.communicationPurpose === "unresolved_question"
      || input.communicationPurpose === "explicit_request"
    ) {
      return "answer_questions";
    }
    // Next-action "Follow up after tour" is not a communication purpose.
    return "no_outreach";
  }
  if (input.tour.kind === "upcoming") {
    return "reference_upcoming_tour";
  }
  // Past-due confirmed/scheduled is not "upcoming" — invite to reconnect/reschedule.
  if (
    input.tour.kind === "none"
    || input.tour.kind === "cancelled"
    || input.tour.kind === "past_due"
  ) {
    return "invite_to_schedule_tour";
  }
  return "gentle_check_in";
}

export type FollowUpWorkflowProhibitions = {
  inviteToScheduleTour: boolean;
  implyNoTourVisited: boolean;
  implyNoTourScheduled: boolean;
  claimProposalSent: boolean;
};

export function deriveFollowUpProhibitions(input: {
  tour: FollowUpTourState;
  proposalSent: boolean;
}): FollowUpWorkflowProhibitions {
  const completed = input.tour.kind === "completed";
  const upcoming = input.tour.kind === "upcoming";
  const pastDue = input.tour.kind === "past_due";
  return {
    inviteToScheduleTour: completed || upcoming,
    implyNoTourVisited: completed,
    implyNoTourScheduled: upcoming || pastDue,
    claimProposalSent: !input.proposalSent,
  };
}

export function workflowIntentLabel(intent: FollowUpWorkflowIntent): string {
  switch (intent) {
    case "acknowledge_completed_tour":
      return "Acknowledge the completed tour only if a specific unresolved customer need requires it — never a generic thank-you.";
    case "reference_upcoming_tour":
      return "Reference the upcoming scheduled tour; do not ask them to schedule a first tour.";
    case "follow_recorded_next_action":
      return "Follow the venue's recorded next-action direction for this lead (workflow context — not raw staff copy for the customer).";
    case "invite_to_schedule_tour":
      return "A gentle invitation to schedule (or reschedule) a tour is an appropriate workflow direction. Do not claim an upcoming tour is still on the calendar if it is past due.";
    case "answer_questions":
      return "Answer the specific unanswered customer question or request. Do not write a generic tour thank-you.";
    case "gentle_check_in":
      return "A gentle check-in is appropriate.";
    case "no_outreach":
      return "Do not write a customer email. Completing the tour is not itself a reason to reach out.";
  }
}

export function formatTourWorkflowFact(tour: FollowUpTourState): string {
  switch (tour.kind) {
    case "none":
      return "Tour: none on record";
    case "upcoming":
      return `Tour: upcoming (${tour.status}) at ${tour.scheduledAt}`;
    case "past_due":
      return `Tour: past due (${tour.status}) was scheduled ${tour.scheduledAt} — do not describe it as upcoming; rescheduling may be appropriate`;
    case "completed":
      return `Tour: completed (scheduled ${tour.scheduledAt}${tour.completedAt ? `; completed_at ${tour.completedAt}` : ""})`;
    case "cancelled":
      return `Tour: cancelled${tour.scheduledAt ? ` (was ${tour.scheduledAt})` : ""} — no completed visit to claim`;
  }
}
