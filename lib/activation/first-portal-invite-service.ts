/**
 * Server loader for first_portal_invite.
 * Derives completion from booked clients ∩ client_invitations (pending|accepted).
 * Write-once stamps venue_activation_state.first_portal_invite_sent_at as
 * derived telemetry — invitation rows remain the source of truth.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isFirstPortalInviteComplete } from "@/lib/activation/first-portal-invite";

export type VenueFirstPortalInviteMilestone = {
  complete: boolean;
  qualifyingInvitationCount: number;
};

export async function getVenueFirstPortalInviteMilestone(
  venueId: string,
): Promise<VenueFirstPortalInviteMilestone> {
  const empty: VenueFirstPortalInviteMilestone = {
    complete: false,
    qualifyingInvitationCount: 0,
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

  const { data: invites, error: inviteError } = await supabase
    .from("client_invitations")
    .select("id, client_id, venue_id, status, created_at")
    .eq("venue_id", venueId)
    .in("client_id", [...bookedClientIds])
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: true });
  if (inviteError) throw inviteError;

  const invitations = ((invites ?? []) as {
    client_id: string;
    venue_id: string;
    status: string;
    created_at: string;
  }[]).map((row) => ({
    clientId: row.client_id,
    venueId: row.venue_id,
    status: row.status,
  }));

  const complete = isFirstPortalInviteComplete({
    venueId,
    bookedClientIds,
    invitations,
  });

  if (complete) {
    const earliest = (invites ?? []) as { created_at: string }[];
    await stampFirstPortalInviteSent(venueId, earliest[0]?.created_at ?? null);
  }

  return {
    complete,
    qualifyingInvitationCount: invitations.length,
  };
}

/** Write-once derived telemetry — never clears or overwrites an existing value. */
async function stampFirstPortalInviteSent(
  venueId: string,
  sentAt: string | null,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("venue_activation_state").upsert(
    { venue_id: venueId },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await supabase
    .from("venue_activation_state")
    .update({
      first_portal_invite_sent_at: sentAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", venueId)
    .is("first_portal_invite_sent_at", null);
}
