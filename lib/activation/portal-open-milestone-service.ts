/**
 * Server loader for the 3-couples portal-open milestone.
 * Derives completion from booked clients ∩ sessions with last_accessed_at.
 * Write-once stamps venue_activation_state.third_couple_portal_active_at when met.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  THREE_COUPLES_PORTAL_TARGET,
  countUniqueBookedPortalOpens,
  isThreeCouplesPortalMilestoneComplete,
} from "@/lib/activation/portal-open-milestone";

export type VenuePortalOpenMilestone = {
  uniqueOpenedCount: number;
  target: number;
  complete: boolean;
  /** Booked client ids that have opened at least once. */
  openedClientIds: string[];
};

export async function getVenuePortalOpenMilestone(
  venueId: string,
): Promise<VenuePortalOpenMilestone> {
  const empty: VenuePortalOpenMilestone = {
    uniqueOpenedCount: 0,
    target: THREE_COUPLES_PORTAL_TARGET,
    complete: false,
    openedClientIds: [],
  };
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const { data: bookedRows, error: bookedError } = await supabase
    .from("events")
    .select("client_id")
    .eq("venue_id", venueId)
    .not("booked_at", "is", null)
    .neq("status", "cancelled");
  if (bookedError) throw bookedError;

  const bookedClientIds = new Set<string>();
  for (const row of (bookedRows ?? []) as { client_id: string | null }[]) {
    if (row.client_id) bookedClientIds.add(row.client_id);
  }
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

  const uniqueOpenedCount = countUniqueBookedPortalOpens({
    bookedClientIds,
    lastAccessedByClientId,
  });
  const complete = isThreeCouplesPortalMilestoneComplete(uniqueOpenedCount);
  const openedClientIds = [...lastAccessedByClientId.keys()].filter((id) => bookedClientIds.has(id));

  if (complete) {
    await stampThirdCouplePortalActive(venueId);
  }

  return {
    uniqueOpenedCount,
    target: THREE_COUPLES_PORTAL_TARGET,
    complete,
    openedClientIds,
  };
}

/** Write-once milestone stamp — never clears or overwrites an existing value. */
async function stampThirdCouplePortalActive(venueId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("venue_activation_state").upsert(
    { venue_id: venueId },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await supabase
    .from("venue_activation_state")
    .update({
      third_couple_portal_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .is("third_couple_portal_active_at", null);
}

/** Portal state rows for the Clients portal-activation handoff. */
export async function getBookedClientPortalActivationRows(
  venueId: string,
  bookedClientIds: ReadonlySet<string>,
): Promise<Map<string, {
  lastAccessedAt: string | null;
  invitationStatus: "pending" | "accepted" | "revoked" | null;
  invitationId: string | null;
}>> {
  const out = new Map<string, {
    lastAccessedAt: string | null;
    invitationStatus: "pending" | "accepted" | "revoked" | null;
    invitationId: string | null;
  }>();
  if (!isSupabaseConfigured || bookedClientIds.size === 0) return out;

  const ids = [...bookedClientIds];
  for (const id of ids) {
    out.set(id, { lastAccessedAt: null, invitationStatus: null, invitationId: null });
  }

  const supabase = await createClient();
  const [{ data: sessions }, { data: invites }] = await Promise.all([
    supabase
      .from("client_portal_sessions")
      .select("client_id, last_accessed_at")
      .eq("venue_id", venueId)
      .in("client_id", ids),
    supabase
      .from("client_invitations")
      .select("id, client_id, status, created_at")
      .eq("venue_id", venueId)
      .in("client_id", ids)
      .order("created_at", { ascending: false }),
  ]);

  for (const row of (sessions ?? []) as { client_id: string; last_accessed_at: string | null }[]) {
    const cur = out.get(row.client_id);
    if (!cur) continue;
    if (row.last_accessed_at && (!cur.lastAccessedAt || row.last_accessed_at > cur.lastAccessedAt)) {
      cur.lastAccessedAt = row.last_accessed_at;
    }
  }

  for (const row of (invites ?? []) as {
    id: string;
    client_id: string;
    status: "pending" | "accepted" | "revoked";
  }[]) {
    const cur = out.get(row.client_id);
    if (!cur || cur.invitationStatus) continue; // newest first from order
    cur.invitationStatus = row.status;
    cur.invitationId = row.id;
  }

  return out;
}
