/**
 * Server loader for first_portal_open.
 * Completion = booked client ∩ session with last_accessed_at.
 * Gap eligibility also requires invitation evidence (see first-portal-open.ts).
 * Write-once stamps venue_activation_state.first_portal_open_at as telemetry.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isFirstPortalOpenComplete } from "@/lib/activation/first-portal-open";
import { loadBookedMembershipSets } from "@/lib/booking-journey/booked-membership";

export type VenueFirstPortalOpenMilestone = {
  complete: boolean;
  openedClientIds: string[];
};

export async function getVenueFirstPortalOpenMilestone(
  venueId: string,
): Promise<VenueFirstPortalOpenMilestone> {
  const empty: VenueFirstPortalOpenMilestone = {
    complete: false,
    openedClientIds: [],
  };
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const bookedClientIds = (await loadBookedMembershipSets({ venueId })).currentClientIds;
  if (bookedClientIds.size === 0) return empty;

  const { data: sessions, error: sessionError } = await supabase
    .from("client_portal_sessions")
    .select("client_id, last_accessed_at")
    .eq("venue_id", venueId)
    .in("client_id", [...bookedClientIds])
    .not("last_accessed_at", "is", null);
  if (sessionError) throw sessionError;

  const lastAccessedByClientId = new Map<string, string>();
  for (const row of (sessions ?? []) as { client_id: string; last_accessed_at: string }[]) {
    const prev = lastAccessedByClientId.get(row.client_id);
    if (!prev || row.last_accessed_at > prev) {
      lastAccessedByClientId.set(row.client_id, row.last_accessed_at);
    }
  }

  const complete = isFirstPortalOpenComplete({
    bookedClientIds,
    lastAccessedByClientId,
  });
  const openedClientIds = [...lastAccessedByClientId.keys()].filter((id) =>
    bookedClientIds.has(id),
  );

  if (complete) {
    await stampFirstPortalOpen(venueId);
  }

  return { complete, openedClientIds };
}

async function stampFirstPortalOpen(venueId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("venue_activation_state").upsert(
    { venue_id: venueId },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await supabase
    .from("venue_activation_state")
    .update({
      first_portal_open_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .is("first_portal_open_at", null);
}
