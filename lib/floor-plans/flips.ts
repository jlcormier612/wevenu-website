/**
 * Floor Plans Phase 4 — linked before/after room flip helpers.
 * A flip is an explicit relationship between two real floor_plan IDs.
 * FP-SR / dual-zone starters are never a link by themselves.
 */

export type EventFloorPlanFlip = {
  id: string;
  venueId: string;
  eventId: string;
  beforeFloorPlanId: string;
  afterFloorPlanId: string;
  transitionNotes: string | null;
  beforeName?: string;
  afterName?: string;
  beforeSpaceId?: string | null;
  afterSpaceId?: string | null;
};

export type FlipRow = {
  id: string;
  venue_id: string;
  event_id: string;
  before_floor_plan_id: string;
  after_floor_plan_id: string;
  transition_notes: string | null;
  /** Phase 5 snapshot — only meaningful when room_snapshot_captured_at is set. */
  recorded_before_space_id?: string | null;
  recorded_after_space_id?: string | null;
  room_snapshot_captured_at?: string | null;
};

export function mapFlipRow(row: FlipRow): EventFloorPlanFlip {
  return {
    id: row.id,
    venueId: row.venue_id,
    eventId: row.event_id,
    beforeFloorPlanId: row.before_floor_plan_id,
    afterFloorPlanId: row.after_floor_plan_id,
    transitionNotes: row.transition_notes,
  };
}

/** Room mismatch is advisory only — does not block linking. */
export function spaceIdsMismatch(
  beforeSpaceId: string | null | undefined,
  afterSpaceId: string | null | undefined,
): boolean {
  if (!beforeSpaceId || !afterSpaceId) return false;
  return beforeSpaceId !== afterSpaceId;
}

export function sanitizeTransitionNotes(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Cap length for staff notes; not a schedule/duration field.
  return trimmed.slice(0, 2000);
}

/**
 * Couple/portal payloads must never include transition notes or flip private fields.
 * Used by regression tests scanning portal surfaces.
 */
export const COUPLE_FORBIDDEN_FLIP_KEYS = [
  "transition_notes",
  "transitionNotes",
  "flipNotes",
  "flip_transition_notes",
] as const;

/** Phase 5 — couple/portal must never see review-flag fields. */
export const COUPLE_FORBIDDEN_REVIEW_FLAG_KEYS = [
  "review_flags",
  "reviewFlags",
  "event_floor_plan_review_flags",
  "reason_summary",
  "reasonSummary",
  "trigger_code",
  "triggerCode",
  "Clear review",
] as const;
