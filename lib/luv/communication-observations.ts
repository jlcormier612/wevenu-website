/**
 * Luv — Communication observations. Communication Trust Experience, Phase 8.
 *
 * Aggregate 24h delivery rollups previously shown on the Dashboard Luv card
 * were removed when Communication Health deferred delivery tiles and failure
 * lists. Per-message status remains on Inbox conversations. This module keeps
 * only observations that point at a concrete, still-actionable destination.
 */
import type { LuvObservation } from "@/lib/luv/types";

type DbClient = Awaited<ReturnType<typeof import("@/integrations/supabase/server").createClient>>;

const STALE_UNOPENED_DAYS = 5;

export async function getCommunicationObservations(
  supabase: DbClient,
  venueId: string,
): Promise<LuvObservation[]> {
  const observations: LuvObservation[] = [];

  const staleThreshold = new Date(
    Date.now() - STALE_UNOPENED_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // "One couple hasn't opened your proposal in five days." — a delivered-
  // but-unopened email, sitting long enough that it's worth a nudge rather
  // than a normal "give it time" wait. Links to the lead when known.
  const { data: staleUnopened } = await supabase.from("messages")
    .select("id, subject, updated_at, thread_id")
    .eq("venue_id", venueId).eq("direction", "outbound").eq("status", "delivered")
    .lt("updated_at", staleThreshold)
    .order("updated_at")
    .limit(1);

  type StaleRow = { id: string; subject: string | null; updated_at: string; thread_id: string };
  const stale = ((staleUnopened ?? []) as StaleRow[])[0];
  if (stale) {
    const { data: thread } = await supabase.from("message_threads")
      .select("lead_id").eq("id", stale.thread_id).maybeSingle<{ lead_id: string | null }>();
    let name = "One lead";
    if (thread?.lead_id) {
      const { data: lead } = await supabase.from("leads")
        .select("first_name, partner_first_name").eq("id", thread.lead_id)
        .maybeSingle<{ first_name: string; partner_first_name: string | null }>();
      if (lead) name = [lead.first_name, lead.partner_first_name ? `& ${lead.partner_first_name}` : null].filter(Boolean).join(" ");
    }
    const days = Math.floor((Date.now() - new Date(stale.updated_at).getTime()) / (24 * 60 * 60 * 1000));
    observations.push({
      id: `comm-stale-unopened-${stale.id}`,
      kind: "waiting",
      priority: days >= 10 ? "medium" : "low",
      message: `${name} hasn't opened "${stale.subject ?? "your message"}" in ${days} day${days === 1 ? "" : "s"}.`,
      link: thread?.lead_id ? `/leads/${thread.lead_id}` : "/messaging",
      actionLabel: "View →",
      recommendation: thread?.lead_id
        ? { label: "Send a follow-up", link: `/leads/${thread.lead_id}?luv=follow_up_email`, type: "draft" }
        : undefined,
    });
  }

  return observations;
}
