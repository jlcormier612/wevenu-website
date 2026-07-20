/**
 * Event Readiness — Phase 1: Platform Integration.
 *
 * Seating (guest_seat_assignments) is deliberately Client-Owned with zero
 * RLS policies for any session other than the couple's own portal token
 * (Seating Experience — Phase 1 migration, 20260828000000) — a venue
 * session cannot select it directly, by design. Rather than adding a new
 * venue-scoped RLS policy or RPC (which would need a real product decision,
 * not just an engineering one — see docs/floor-plan-seating-architecture.md
 * and docs/wedding-workspace-architecture.md §17), this reuses the couple's
 * own get_seating_data(p_token) RPC server-side, via the same portal
 * session token the Booking Workspace already resolves for its "View
 * Client Portal" links. It invents no new seating logic — it just reads
 * the same stats block the couple's own Seating tab already computes.
 */
import { createClient } from "@/integrations/supabase/server";
import { getPortalSessions } from "@/lib/portal/service";
import type { SeatingData, SeatingFloorPlanSummary } from "@/lib/portal/types";

export type SeatingReadinessSummary = {
  floorPlanShared: boolean;
  totalAttending: number;
  totalAssigned: number;
  needsReassignmentCount: number;
};

export async function getSeatingReadinessSummary(portalToken: string | null): Promise<SeatingReadinessSummary | null> {
  if (!portalToken) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seating_data", { p_token: portalToken });
  if (error || !data || data.error) return null;

  return {
    floorPlanShared: !!data.floorPlan,
    totalAttending: data.stats?.totalAttending ?? 0,
    totalAssigned: data.stats?.totalAssigned ?? 0,
    needsReassignmentCount: (data.needsReassignment ?? []).length,
  };
}

/**
 * Commitment Alignment Sprint — Seating Delegation & Submission
 * (docs/commitment-lifecycle-architecture.md §9). The plan picker: reuses
 * the couple's own get_seating_floor_plans(p_token) server-side, through
 * whichever of the client's portal sessions is pinned to this event,
 * preferring a full-access tier so staff never see a degraded
 * 'financial'-tier response the couple's own session might be limited to.
 */
export async function getSeatingFloorPlansForVenue(eventId: string, clientId: string): Promise<SeatingFloorPlanSummary[]> {
  const sessions = await getPortalSessions(clientId);
  const forThisEvent = sessions.filter((s) => s.eventId === eventId);
  const pool = forThisEvent.length > 0 ? forThisEvent : sessions;
  const session = pool.find((s) => s.accessLevel !== "financial") ?? pool[0] ?? null;
  if (!session) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_seating_floor_plans", { p_token: session.accessToken });
  if (error || !data) return [];
  return data as SeatingFloorPlanSummary[];
}

/**
 * The venue's operational read for one floor plan — genuinely
 * venue-authenticated (current_user_venue_id(), no borrowed token).
 * Private Until Committed: returns the couple's last Submitted snapshot by
 * default, live data only when the couple has explicitly delegated this
 * specific plan (docs/client-workspace-product-architecture.md §11/§12).
 */
export async function getOperationalSeatingPlan(eventId: string, floorPlanId: string): Promise<(SeatingData & {
  isDelegated: boolean; notYetSubmitted?: boolean; submittedAt?: string; submittedBy?: "couple" | "venue"; delegatedAt?: string; delegatedNote?: string | null;
}) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_operational_seating_plan", {
    p_event_id: eventId, p_floor_plan_id: floorPlanId,
  });
  if (error || !data || data.error) return null;
  return data;
}
