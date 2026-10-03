/**
 * Shared tour_appointments loader for Luv follow-up drafting + Thoughts.
 * Classification stays in follow-up-workflow-context.ts — no second classifier.
 */

import type { createClient } from "@/integrations/supabase/server";
import {
  classifyFollowUpTourState,
  type FollowUpTourState,
} from "@/lib/luv/follow-up-workflow-context";

export type FollowUpTourLoadResult = {
  tour: FollowUpTourState;
  followUpSentAt: string | null;
  occurredAt: string | null;
};

/** Thin tour_appointments read — same canonical source as the lead workspace. */
export async function loadFollowUpTourState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
): Promise<FollowUpTourLoadResult> {
  const { data } = await supabase
    .from("tour_appointments")
    .select("scheduled_at, status, completed_at, follow_up_sent_at, actual_occurred_at")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .order("scheduled_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as {
    scheduled_at: string | null;
    status: string;
    completed_at: string | null;
    follow_up_sent_at: string | null;
    actual_occurred_at: string | null;
  }[];
  const classifyRows = rows.map((r) => ({
    scheduled_at: r.scheduled_at ?? r.actual_occurred_at ?? r.completed_at ?? "",
    status: r.status,
    completed_at: r.completed_at,
  }));
  return {
    tour: classifyFollowUpTourState(classifyRows),
    followUpSentAt: rows.find((r) => r.status === "completed")?.follow_up_sent_at ?? null,
    occurredAt:
      rows.find((r) => r.status === "completed")?.actual_occurred_at
      ?? rows.find((r) => r.status === "completed")?.completed_at
      ?? rows.find((r) => r.status === "completed")?.scheduled_at
      ?? null,
  };
}
