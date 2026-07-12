/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * Guests is Client-Owned (couple_guests — see docs/wedding-workspace-
 * architecture.md §6), and this reads only aggregate counts, never
 * individual guest rows or names, matching the one existing precedent for
 * venue-side guest visibility (events.guest_count). RLS already permits a
 * venue session to select couple_guests (Sprint 107's
 * venue_id = current_user_venue_id() policy) — this is a new query, not new
 * RLS, new grants, or a new table.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type GuestReadinessSummary = {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  /** Invitation has gone out — not still in draft/ready (Guest Experience — Phase 2's own vocabulary). */
  invitationsSent: number;
  /** The guest has actually submitted an RSVP (invitation_status = 'responded'). */
  invitationsResponded: number;
  /** Sent/delivered/opened but no reply yet — the same set get_invitation_progress calls "outstanding." */
  invitationsOutstanding: number;
};

const EMPTY: GuestReadinessSummary = {
  total: 0, attending: 0, declined: 0, pending: 0,
  invitationsSent: 0, invitationsResponded: 0, invitationsOutstanding: 0,
};

export async function getGuestReadinessSummary(clientId: string): Promise<GuestReadinessSummary> {
  if (!isSupabaseConfigured) return EMPTY;
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;

  const supabase = await createClient();
  const { data } = await supabase
    .from("couple_guests")
    .select("rsvp_status, invitation_status")
    .eq("venue_id", venue.id)
    .eq("client_id", clientId);

  const rows = data ?? [];
  const outstandingStatuses = new Set(["sent", "delivered", "opened"]);

  return {
    total: rows.length,
    attending: rows.filter((r) => r.rsvp_status === "attending").length,
    declined: rows.filter((r) => r.rsvp_status === "declined").length,
    pending: rows.filter((r) => r.rsvp_status === "pending" || r.rsvp_status === "maybe").length,
    invitationsSent: rows.filter((r) => r.invitation_status !== "draft" && r.invitation_status !== "ready").length,
    invitationsResponded: rows.filter((r) => r.invitation_status === "responded").length,
    invitationsOutstanding: rows.filter((r) => outstandingStatuses.has(r.invitation_status)).length,
  };
}
