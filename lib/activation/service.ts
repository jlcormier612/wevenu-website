/**
 * Activation service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  ActivationScore,
  EngagementEventInput,
  VenueMilestone,
  MilestoneId,
} from "@/lib/activation/types";

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function getActivationScore(venueId: string): Promise<ActivationScore | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  // Check cache
  const { data: cached } = await supabase
    .from("venue_activation_scores")
    .select("*")
    .eq("venue_id", venueId)
    .maybeSingle<Record<string, unknown>>();

  if (cached && new Date(cached.computed_at as string).getTime() > Date.now() - ONE_HOUR_MS) {
    return mapScore(cached);
  }

  // Recompute
  const { data, error } = await supabase.rpc("compute_venue_activation_score", {
    p_venue_id: venueId,
  });
  if (error || !data) return null;
  return mapScore(data as Record<string, unknown>);
}

function mapScore(r: Record<string, unknown>): ActivationScore {
  return {
    score:            r.score as number,
    previousScore:    (r.previous_score ?? null) as number | null,
    phase:            r.phase as ActivationScore["phase"],
    phaseLabel:       r.phase_label as string,
    dimensionScores:  (r.dimension_scores ?? {}) as Record<string, number>,
    gaps:             (r.gaps ?? []) as ActivationScore["gaps"],
    computedAt:       r.computed_at as string,
  };
}

export async function recordEngagementEvent(input: EngagementEventInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  await supabase.rpc("record_engagement_event", {
    p_venue_id:   input.venueId,
    p_event_type: input.eventType,
    p_actor_type: input.actorType,
    p_actor_id:   input.actorId ?? null,
    p_entity_type: input.entityType ?? null,
    p_entity_id:  input.entityId ?? null,
    p_metadata:   input.metadata ?? null,
  });
  await supabase.rpc("check_relationship_milestones", { p_venue_id: input.venueId });
}

export async function getNextPendingMilestone(venueId: string): Promise<VenueMilestone | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_milestones")
    .select("*")
    .eq("venue_id", venueId)
    .is("shown_at", null)
    .order("fired_at")
    .limit(1)
    .maybeSingle<Record<string, unknown>>();
  if (!data) return null;
  return {
    venueId:     data.venue_id as string,
    milestoneId: data.milestone_id as MilestoneId,
    firedAt:     data.fired_at as string,
    shownAt:     (data.shown_at ?? null) as string | null,
    metadata:    (data.metadata ?? null) as Record<string, unknown> | null,
  };
}

export async function markMilestoneShown(venueId: string, milestoneId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("venue_milestones") as any)
    .update({ shown_at: new Date().toISOString() })
    .eq("venue_id", venueId)
    .eq("milestone_id", milestoneId);
}

/**
 * Throttled staff activity tracking (5-min gap).
 * If this is the member's first login, fires team.member_first_login event.
 */
export async function recordStaffActivity(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("venue_staff")
    .select("id, venue_id, last_active_at")
    .eq("user_id", userId)
    .eq("is_owner", false)
    .eq("is_active", true)
    .maybeSingle<{ id: string; venue_id: string; last_active_at: string | null }>();

  if (!staff) return;

  const lastActive = staff.last_active_at ? new Date(staff.last_active_at) : null;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (lastActive && lastActive > fiveMinAgo) return; // throttle

  const isFirstLogin = !lastActive;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("venue_staff") as any)
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", staff.id);

  if (isFirstLogin) {
    await recordEngagementEvent({
      venueId:   staff.venue_id,
      eventType: "team.member_first_login",
      actorType: "team_member",
      actorId:   userId,
    });
  }
}
