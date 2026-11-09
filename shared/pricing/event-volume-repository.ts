/**
 * Data-access for event-volume evaluation.
 * Separated from the pure evaluator so Phase 3 can schedule upgrades without
 * re-embedding SQL in counting logic.
 */

import { createCrmAdminClient, crmSupabaseConfigured } from "../relationships/pg-client";
import {
  evaluateEventVolume,
  type EventVolumeEvaluation,
  type EventVolumeInputEvent,
} from "./event-volume";

export type EventVolumeRow = {
  id: string;
  status: string;
  event_date: string;
  booked_at: string | null;
};

export function mapEventRowsToVolumeInputs(
  rows: EventVolumeRow[],
): EventVolumeInputEvent[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    eventDate: row.event_date,
    bookedAt: row.booked_at,
  }));
}

/**
 * Load events for a venue and evaluate peak booked volume.
 * Returns null when Supabase is not configured (local unit tests use the pure evaluator).
 */
export async function evaluateVenueEventVolume(input: {
  venueId: string;
  asOfDate?: string;
}): Promise<EventVolumeEvaluation | null> {
  if (!crmSupabaseConfigured()) return null;

  const admin = createCrmAdminClient();
  const { data, error } = await admin
    .from("events")
    .select("id, status, event_date, booked_at")
    .eq("venue_id", input.venueId);

  if (error) {
    throw new Error(`event-volume load failed: ${error.message}`);
  }

  const events = mapEventRowsToVolumeInputs((data ?? []) as EventVolumeRow[]);
  return evaluateEventVolume({ events, asOfDate: input.asOfDate });
}
