/**
 * Event space assignments — use → physical space (multi-space venues).
 * Same SoT as contracts merge (event_space_assignments). Also syncs
 * events.space_id to the primary assignment for availability/legacy.
 */

import { createClient } from "@/integrations/supabase/server";
import { occupancyFailureFromUnknown } from "@/lib/availability/event-occupancy";
import { isSupabaseConfigured } from "@/lib/env";
import {
  normalizeAssignmentInputs,
  primarySpaceIdFromAssignments,
  type EventSpaceAssignment,
  type EventSpaceAssignmentInput,
} from "@/lib/venue-spaces/assignments";
import { resolveExperienceProfile } from "@/lib/event-experience";
import { getCurrentVenue } from "@/lib/venue/service";

export type SpaceAssignmentsResult =
  | { ok: true }
  | { ok: false; message: string };

type AssignmentRow = {
  id: string;
  use_key: string;
  use_label: string;
  space_id: string;
  sort_order: number;
  venue_spaces?: { name: string } | null;
};

export async function getEventSpaceAssignments(
  eventId: string,
): Promise<EventSpaceAssignment[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("event_space_assignments") as any)
    .select("id, use_key, use_label, space_id, sort_order, venue_spaces(name)")
    .eq("venue_id", venue.id)
    .eq("event_id", eventId)
    .order("sort_order");
  if (error) {
    console.error("[getEventSpaceAssignments]", error.message);
    return [];
  }
  return ((data ?? []) as AssignmentRow[]).map((r) => ({
    id: r.id,
    useKey: r.use_key,
    useLabel: r.use_label,
    spaceId: r.space_id,
    sortOrder: r.sort_order,
    spaceName: r.venue_spaces?.name ?? null,
  }));
}

/**
 * Replace all use→space rows for an event. Empty list clears assignments
 * and clears events.space_id.
 *
 * Writes go through the service role after venue/session checks so a full
 * replace (delete + insert) cannot leave stale backfill rows under RLS.
 */
export async function replaceEventSpaceAssignments(
  eventId: string,
  assignments: EventSpaceAssignmentInput[],
): Promise<SpaceAssignmentsResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  if (venue.spaceOperatingMode !== "multi") {
    return { ok: false, message: "Multi-space mode is not enabled for this venue." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, event_type")
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ id: string; event_type: string | null }>();
  if (eventErr || !event) return { ok: false, message: "Event not found." };

  const normalized = normalizeAssignmentInputs(assignments);
  const primarySpaceId = primarySpaceIdFromAssignments(normalized, {
    weddingFamily: resolveExperienceProfile(event.event_type).isWeddingSpecific,
  });

  // One transaction: replace the assignment set, then re-run booked occupancy
  // even when the primary space_id does not change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("replace_event_space_assignments", {
    p_venue_id: venue.id,
    p_event_id: eventId,
    p_primary_space_id: primarySpaceId,
    p_assignments: normalized.map((a, i) => ({
      useKey: a.useKey,
      useLabel: a.useLabel,
      spaceId: a.spaceId,
      sortOrder: i,
    })),
  });
  if (error) {
    const fail = occupancyFailureFromUnknown(error);
    return { ok: false, message: fail?.message ?? error.message };
  }

  return { ok: true };
}
