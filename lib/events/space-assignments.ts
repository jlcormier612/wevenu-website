/**
 * Event space assignments — use → physical space (multi-space venues).
 * Same SoT as contracts merge (event_space_assignments). Also syncs
 * events.space_id to the primary assignment for availability/legacy.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  normalizeAssignmentInputs,
  primarySpaceIdFromAssignments,
  type EventSpaceAssignment,
  type EventSpaceAssignmentInput,
} from "@/lib/venue-spaces/assignments";
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
    .select("id")
    .eq("id", eventId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ id: string }>();
  if (eventErr || !event) return { ok: false, message: "Event not found." };

  const normalized = normalizeAssignmentInputs(assignments);
  const primarySpaceId = primarySpaceIdFromAssignments(normalized);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr } = await (supabase.from("event_space_assignments") as any)
    .delete()
    .eq("venue_id", venue.id)
    .eq("event_id", eventId);
  if (delErr) return { ok: false, message: delErr.message };

  if (normalized.length > 0) {
    const rows = normalized.map((a, i) => ({
      venue_id: venue.id,
      event_id: eventId,
      use_key: a.useKey,
      use_label: a.useLabel,
      space_id: a.spaceId,
      sort_order: i,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (supabase.from("event_space_assignments") as any).insert(rows);
    if (insErr) return { ok: false, message: insErr.message };
  }

  // Keep legacy single FK aligned for availability / overview chip.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from("events") as any)
    .update({ space_id: primarySpaceId })
    .eq("id", eventId)
    .eq("venue_id", venue.id);
  if (updErr) return { ok: false, message: updErr.message };

  return { ok: true };
}
