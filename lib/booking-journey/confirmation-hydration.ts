import type { EventSpaceAssignmentInput } from "@/lib/venue-spaces/assignments";

/**
 * When the Mark as Booked dialog may copy a booking draft into its form.
 *
 * The dialog can receive several drafts while it is open: the page's own draft first,
 * then the fresh one loaded in the background. Once the venue has typed into the form,
 * a later draft for the same record must not replace what they entered.
 */
export type DraftHydrationState = {
  seeded: boolean;
  recordKey: string | null;
  edited: boolean;
};

export const CLOSED_DRAFT_HYDRATION: DraftHydrationState = {
  seeded: false,
  recordKey: null,
  edited: false,
};

export function draftRecordKey(draft: { leadId: string | null }): string {
  return draft.leadId ?? "";
}

/**
 * apply: copy the draft's date, spaces, and times into the form.
 * firstForRecord: this is the first draft for this record since the dialog opened,
 * so validation and availability state start fresh too.
 */
export function planDraftHydration(
  state: DraftHydrationState,
  recordKey: string,
): { apply: boolean; firstForRecord: boolean; next: DraftHydrationState } {
  const sameRecord = state.seeded && state.recordKey === recordKey;
  if (sameRecord && state.edited) {
    return { apply: false, firstForRecord: false, next: state };
  }
  return {
    apply: true,
    firstForRecord: !sameRecord,
    next: { seeded: true, recordKey, edited: false },
  };
}

export function markDraftEdited(state: DraftHydrationState): DraftHydrationState {
  return state.edited ? state : { ...state, edited: true };
}

/**
 * The space editor fills blank component dates from the event date on its own.
 * That fill is not something the venue typed, so it must not count as an edit.
 */
export function isScheduledDateFillOnly(
  previous: EventSpaceAssignmentInput[],
  next: EventSpaceAssignmentInput[],
): boolean {
  if (previous.length !== next.length) return false;
  let filled = false;
  for (let i = 0; i < next.length; i++) {
    const before = previous[i];
    const after = next[i];
    if (
      before.useKey !== after.useKey
      || before.useLabel !== after.useLabel
      || before.spaceId !== after.spaceId
      || (before.startTime ?? null) !== (after.startTime ?? null)
      || (before.endTime ?? null) !== (after.endTime ?? null)
    ) {
      return false;
    }
    const beforeDate = before.scheduledDate?.trim() ?? "";
    const afterDate = after.scheduledDate?.trim() ?? "";
    if (beforeDate === afterDate) continue;
    if (beforeDate !== "" || afterDate === "") return false;
    filled = true;
  }
  return filled;
}
