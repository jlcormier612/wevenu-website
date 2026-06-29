/**
 * Post-Tour Automation Engine
 *
 * Fires when a tour status transitions to completed | no_show | cancelled.
 * All operations are fire-and-forget — the status update always succeeds.
 *
 * Completed:
 *   → Log lead_activity: "Tour completed"
 *   → Create follow-up lead_tasks (thank-you today, proposal +2 days, check-in +7 days)
 *   → Log signal event: tour_completed (feeds commitment score)
 *   → Signal Luv observation data (surfaces in dashboard)
 *
 * No-show:
 *   → Log lead_activity: "Tour no-show"
 *   → Log signal event: tour_no_show
 *
 * Cancelled:
 *   → Log lead_activity: "Tour cancelled"
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type PostTourContext = {
  supabase: SupabaseClient;
  appointmentId: string;
  venueId: string;
  leadId: string | null;
  contactName: string | null;
  scheduledAt: string;
};

export async function runPostTourAutomation(
  ctx: PostTourContext,
  newStatus: string,
): Promise<void> {
  const { supabase, venueId, leadId, contactName, scheduledAt } = ctx;
  const name = contactName ?? "the couple";

  if (newStatus === "completed") {
    await handleCompleted(supabase, venueId, leadId, name, scheduledAt);
  } else if (newStatus === "no_show") {
    await handleNoShow(supabase, venueId, leadId, name);
  } else if (newStatus === "cancelled") {
    await handleCancelled(supabase, venueId, leadId, name);
  }
}

async function handleCompleted(
  supabase: SupabaseClient,
  venueId: string,
  leadId: string | null,
  name: string,
  scheduledAt: string,
) {
  if (!leadId) return;

  // 1. Log activity
  await supabase.from("lead_activities").insert({
    venue_id: venueId,
    lead_id: leadId,
    type: "tour_completed",
    title: "Tour completed",
    description: `Venue tour completed for ${name}.`,
  });

  // 2. Create follow-up tasks
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const offset = (n: number) => {
    const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d);
  };

  await supabase.from("lead_tasks").insert([
    { venue_id: venueId, lead_id: leadId, title: `Send thank-you to ${name}`, due_date: fmt(today) },
    { venue_id: venueId, lead_id: leadId, title: `Follow up with proposal or pricing — ${name}`, due_date: offset(2) },
    { venue_id: venueId, lead_id: leadId, title: `Check in if no response — ${name}`, due_date: offset(7) },
  ]);

  // 3. Log signal event (feeds commitment score)
  await supabase.from("lead_signal_events").insert({
    venue_id: venueId,
    lead_id: leadId,
    event_type: "tour_completed",
    event_data: { scheduled_at: scheduledAt },
  });

  // 4. Refresh commitment score
  try {
    const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle<{ id: string }>();
    if (lead) {
      const { refreshLeadScore } = await import("@/lib/leads/scores");
      await refreshLeadScore(leadId);
    }
  } catch { /* non-blocking */ }
}

async function handleNoShow(
  supabase: SupabaseClient,
  venueId: string,
  leadId: string | null,
  name: string,
) {
  if (!leadId) return;

  await supabase.from("lead_activities").insert({
    venue_id: venueId,
    lead_id: leadId,
    type: "tour_no_show",
    title: "Tour no-show",
    description: `${name} did not attend their scheduled tour.`,
  });

  await supabase.from("lead_signal_events").insert({
    venue_id: venueId,
    lead_id: leadId,
    event_type: "tour_no_show",
    event_data: {},
  });
}

async function handleCancelled(
  supabase: SupabaseClient,
  venueId: string,
  leadId: string | null,
  name: string,
) {
  if (!leadId) return;

  await supabase.from("lead_activities").insert({
    venue_id: venueId,
    lead_id: leadId,
    type: "tour_cancelled",
    title: "Tour cancelled",
    description: `${name} cancelled their tour.`,
  });
}
