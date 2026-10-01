/**
 * Follow-up completion — resolve the current outstanding relationship
 * action and establish what happens next.
 *
 * Outstanding follow-up = next_action_text + follow_up_date.
 * follow_up_date is the only due/overdue date. next_action_due is unused.
 */

export type FollowUpCompletionKind =
  | "another_follow_up"
  | "other_next_action"
  | "no_further_follow_up";

export type FollowUpCompletionInput = {
  kind: FollowUpCompletionKind;
  nextActionText?: string;
  followUpDate?: string;
};

export type OutstandingFollowUp = {
  nextActionText: string | null;
  followUpDate: string | null;
};

export type FollowUpCompletionResolution =
  | {
      ok: true;
      nextActionText: string | null;
      followUpDate: string | null;
      writeFollowUpSet: boolean;
      completedAction: string | null;
      completedDate: string | null;
    }
  | { ok: false; message: string };

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function resolveFollowUpCompletion(
  current: OutstandingFollowUp,
  input: FollowUpCompletionInput,
): FollowUpCompletionResolution {
  const completedAction = trimOrNull(current.nextActionText);
  const completedDate = trimOrNull(current.followUpDate);
  if (!completedDate) {
    return { ok: false, message: "No outstanding follow-up to complete." };
  }

  if (input.kind === "no_further_follow_up") {
    return {
      ok: true,
      nextActionText: null,
      followUpDate: null,
      writeFollowUpSet: false,
      completedAction,
      completedDate,
    };
  }

  const nextActionText = trimOrNull(input.nextActionText);
  if (!nextActionText) {
    return { ok: false, message: "Enter the next action." };
  }

  if (input.kind === "another_follow_up") {
    const followUpDate = trimOrNull(input.followUpDate);
    if (!followUpDate) {
      return { ok: false, message: "Enter the next follow-up date." };
    }
    return {
      ok: true,
      nextActionText,
      followUpDate,
      writeFollowUpSet: true,
      completedAction,
      completedDate,
    };
  }

  // other_next_action — due date optional; supplied date becomes follow_up_date
  const followUpDate = trimOrNull(input.followUpDate);
  return {
    ok: true,
    nextActionText,
    followUpDate,
    writeFollowUpSet: Boolean(followUpDate),
    completedAction,
    completedDate,
  };
}

export function followUpCompletedTitle(completedDate: string | null, formatDate: (iso: string | null | undefined) => string): string {
  return completedDate
    ? `Follow-up completed — ${formatDate(completedDate)}`
    : "Follow-up completed";
}
