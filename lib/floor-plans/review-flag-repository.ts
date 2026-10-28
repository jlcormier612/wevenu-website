/**
 * Floor Plans Phase 5 — review flag persistence.
 */
import type {
  ReviewFlagRow,
  ReviewFlagStatus,
  ReviewFlagTargetKind,
  ReviewFlagTriggerCode,
} from "@/lib/floor-plans/review-flags";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

type FlagDbRow = {
  id: string;
  venue_id: string;
  event_id: string;
  target_kind: ReviewFlagTargetKind;
  floor_plan_id: string | null;
  flip_id: string | null;
  trigger_code: ReviewFlagTriggerCode;
  status: ReviewFlagStatus;
  reason_code: string;
  reason_summary: string;
  context_json: Record<string, unknown> | null;
  fingerprint: string;
  created_at: string;
  updated_at: string;
  cleared_at: string | null;
  cleared_by: string | null;
};

export function mapReviewFlagRow(r: FlagDbRow): ReviewFlagRow {
  return {
    id: r.id,
    venueId: r.venue_id,
    eventId: r.event_id,
    targetKind: r.target_kind,
    floorPlanId: r.floor_plan_id,
    flipId: r.flip_id,
    triggerCode: r.trigger_code,
    status: r.status,
    reasonCode: r.reason_code,
    reasonSummary: r.reason_summary,
    contextJson: (r.context_json ?? {}) as Record<string, unknown>,
    fingerprint: r.fingerprint,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    clearedAt: r.cleared_at,
    clearedBy: r.cleared_by,
  };
}

export async function listReviewFlagsForEvent(
  client: DbClient,
  venueId: string,
  eventId: string,
  status?: ReviewFlagStatus,
): Promise<ReviewFlagRow[]> {
  let q = client
    .from("event_floor_plan_review_flags")
    .select("*")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as FlagDbRow[]).map(mapReviewFlagRow);
}

export async function getOpenFlag(
  client: DbClient,
  venueId: string,
  eventId: string,
  input: {
    targetKind: ReviewFlagTargetKind;
    floorPlanId?: string | null;
    flipId?: string | null;
    triggerCode: ReviewFlagTriggerCode;
  },
): Promise<ReviewFlagRow | null> {
  let q = client
    .from("event_floor_plan_review_flags")
    .select("*")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("target_kind", input.targetKind)
    .eq("trigger_code", input.triggerCode)
    .eq("status", "open");
  if (input.targetKind === "layout") {
    q = q.eq("floor_plan_id", input.floorPlanId!);
  } else {
    q = q.eq("flip_id", input.flipId!);
  }
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? mapReviewFlagRow(data as FlagDbRow) : null;
}

export async function getLatestClearedWithFingerprint(
  client: DbClient,
  venueId: string,
  eventId: string,
  fingerprint: string,
): Promise<ReviewFlagRow | null> {
  const { data, error } = await client
    .from("event_floor_plan_review_flags")
    .select("*")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("fingerprint", fingerprint)
    .eq("status", "cleared")
    .order("cleared_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapReviewFlagRow(data as FlagDbRow) : null;
}

export async function insertOpenFlag(
  client: DbClient,
  input: {
    venueId: string;
    eventId: string;
    targetKind: ReviewFlagTargetKind;
    floorPlanId: string | null;
    flipId: string | null;
    triggerCode: ReviewFlagTriggerCode;
    reasonCode: string;
    reasonSummary: string;
    contextJson: Record<string, unknown>;
    fingerprint: string;
  },
): Promise<ReviewFlagRow> {
  const { data, error } = await client
    .from("event_floor_plan_review_flags")
    .insert({
      venue_id: input.venueId,
      event_id: input.eventId,
      target_kind: input.targetKind,
      floor_plan_id: input.floorPlanId,
      flip_id: input.flipId,
      trigger_code: input.triggerCode,
      status: "open",
      reason_code: input.reasonCode,
      reason_summary: input.reasonSummary,
      context_json: input.contextJson,
      fingerprint: input.fingerprint,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapReviewFlagRow(data as FlagDbRow);
}

export async function refreshOpenFlag(
  client: DbClient,
  venueId: string,
  flagId: string,
  input: {
    reasonCode: string;
    reasonSummary: string;
    contextJson: Record<string, unknown>;
    fingerprint: string;
  },
): Promise<ReviewFlagRow> {
  const { data, error } = await client
    .from("event_floor_plan_review_flags")
    .update({
      reason_code: input.reasonCode,
      reason_summary: input.reasonSummary,
      context_json: input.contextJson,
      fingerprint: input.fingerprint,
    })
    .eq("id", flagId)
    .eq("venue_id", venueId)
    .eq("status", "open")
    .select("*")
    .single();
  if (error) throw error;
  return mapReviewFlagRow(data as FlagDbRow);
}

export async function clearReviewFlag(
  client: DbClient,
  venueId: string,
  flagId: string,
  clearedBy: string | null,
): Promise<ReviewFlagRow> {
  const { data, error } = await client
    .from("event_floor_plan_review_flags")
    .update({
      status: "cleared",
      cleared_at: new Date().toISOString(),
      cleared_by: clearedBy,
    })
    .eq("id", flagId)
    .eq("venue_id", venueId)
    .eq("status", "open")
    .select("*")
    .single();
  if (error) throw error;
  return mapReviewFlagRow(data as FlagDbRow);
}

export async function updateFloorPlanSpaceId(
  client: DbClient,
  venueId: string,
  floorPlanId: string,
  spaceId: string | null,
): Promise<void> {
  const { error } = await client
    .from("floor_plans")
    .update({ space_id: spaceId })
    .eq("id", floorPlanId)
    .eq("venue_id", venueId);
  if (error) throw error;
}
