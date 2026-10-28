/**
 * Floor Plans Phase 5 — booking-change review flag predicates (pure).
 * Explicit relationships only — no name/label inference.
 */

export type ReviewFlagTargetKind = "layout" | "flip";

export type ReviewFlagTriggerCode =
  | "t1_booking_room"
  | "t1_layout_room"
  | "t3_flip_snapshot";

export type ReviewFlagStatus = "open" | "cleared";

export type ReviewFlagRow = {
  id: string;
  venueId: string;
  eventId: string;
  targetKind: ReviewFlagTargetKind;
  floorPlanId: string | null;
  flipId: string | null;
  triggerCode: ReviewFlagTriggerCode;
  status: ReviewFlagStatus;
  reasonCode: string;
  reasonSummary: string;
  contextJson: Record<string, unknown>;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  clearedAt: string | null;
  clearedBy: string | null;
};

/** Booking room set: assignment rows win; else primary events.space_id; else empty. */
export function bookingRoomSetFromSources(input: {
  assignmentSpaceIds: Array<string | null | undefined>;
  primarySpaceId: string | null | undefined;
}): string[] {
  const fromAssignments = [
    ...new Set(
      input.assignmentSpaceIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean),
    ),
  ];
  if (fromAssignments.length > 0) return fromAssignments.sort();
  const primary = input.primarySpaceId?.trim();
  if (primary) return [primary];
  return [];
}

/** Layout with non-null space is consistent iff that space is in the booking set. Empty set ⇒ no mismatch. */
export function layoutRoomInconsistentWithBooking(
  layoutSpaceId: string | null | undefined,
  bookingRoomSet: readonly string[],
): boolean {
  const spaceId = layoutSpaceId?.trim() || null;
  if (!spaceId) return false;
  if (bookingRoomSet.length === 0) return false;
  return !bookingRoomSet.includes(spaceId);
}

export function t1BookingFingerprint(
  floorPlanId: string,
  layoutSpaceId: string,
  bookingRoomSet: readonly string[],
): string {
  return `t1_booking:${floorPlanId}:${layoutSpaceId}:${[...bookingRoomSet].sort().join(",")}`;
}

export function t1LayoutFingerprint(
  floorPlanId: string,
  layoutSpaceId: string,
  bookingRoomSet: readonly string[],
): string {
  return `t1_layout:${floorPlanId}:${layoutSpaceId}:${[...bookingRoomSet].sort().join(",")}`;
}

export function sameSpaceId(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = a?.trim() || null;
  const right = b?.trim() || null;
  return left === right;
}

/** T3 only when a snapshot was deliberately captured. */
export function flipSnapshotMismatch(input: {
  roomSnapshotCapturedAt: string | null | undefined;
  recordedBeforeSpaceId: string | null | undefined;
  recordedAfterSpaceId: string | null | undefined;
  currentBeforeSpaceId: string | null | undefined;
  currentAfterSpaceId: string | null | undefined;
}): boolean {
  if (!input.roomSnapshotCapturedAt) return false;
  return (
    !sameSpaceId(input.recordedBeforeSpaceId, input.currentBeforeSpaceId)
    || !sameSpaceId(input.recordedAfterSpaceId, input.currentAfterSpaceId)
  );
}

export function t3Fingerprint(
  flipId: string,
  recordedBefore: string | null,
  recordedAfter: string | null,
  currentBefore: string | null,
  currentAfter: string | null,
): string {
  const n = (v: string | null) => v ?? "null";
  return `t3:${flipId}:${n(recordedBefore)}:${n(recordedAfter)}→${n(currentBefore)}:${n(currentAfter)}`;
}

export function setsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

export const DEFAULT_REVIEW_BANNER_COPY =
  "The booked rooms for this wedding changed. Some layouts may no longer match. Review the flagged layouts and update the room or layout if needed.";
