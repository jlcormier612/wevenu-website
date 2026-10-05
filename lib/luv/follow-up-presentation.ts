/**
 * Server presentation for Lead Luv tab: shared FollowUpTourState + draft CTA gate.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  evaluateCompletedTour,
  type ThreadMessage,
} from "@/lib/luv/completed-tour-intelligence";
import { normalizeInquiryMessageOrigin } from "@/lib/luv/draft-context-boundary";
import { resolveFollowUpDraftEligibility } from "@/lib/luv/follow-up-draft-eligibility";
import { loadFollowUpTourState } from "@/lib/luv/follow-up-tour-loader";
import {
  classifyFollowUpTourState,
  type FollowUpTourState,
} from "@/lib/luv/follow-up-workflow-context";
import type { Lead } from "@/lib/leads/types";
import type { TourAppointment } from "@/lib/tours/types";
import { getCurrentVenue } from "@/lib/venue/service";

export type LeadFollowUpPresentation = {
  tour: FollowUpTourState;
  draftEligible: boolean;
  /** Authoritative commercial_proposals.status=sent AND offered_at — never sales_stage. */
  proposalSent: boolean;
};

/** Map workspace TourAppointment rows into FollowUpTourState (no second classifier). */
export function followUpTourStateFromAppointments(
  appointments: TourAppointment[],
): FollowUpTourState {
  return classifyFollowUpTourState(
    appointments.map((a) => ({
      scheduled_at: a.scheduledAt ?? a.actualOccurredAt ?? a.completedAt ?? "",
      status: a.status,
      completed_at: a.completedAt,
    })),
  );
}

async function loadProposalSentFact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("commercial_proposals")
    .select("status, offered_at")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .not("offered_at", "is", null)
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string; offered_at: string }>();
  return data?.status === "sent" && Boolean(data?.offered_at);
}

async function loadLeadThreadMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  relationshipId: string | null | undefined,
): Promise<ThreadMessage[]> {
  if (!relationshipId) return [];
  const { data: convs } = await supabase.from("conversations")
    .select("id")
    .eq("venue_id", venueId)
    .eq("relationship_id", relationshipId);
  const convIds = (convs ?? []).map((c: { id: string }) => c.id);
  if (convIds.length === 0) return [];
  const { data: msgs } = await supabase.from("conversation_messages")
    .select("sent_at, sender_type, channel, body")
    .eq("venue_id", venueId)
    .in("conversation_id", convIds);
  return ((msgs ?? []) as {
    sent_at: string; sender_type: string; channel: string | null; body: string | null;
  }[]).map((m) => ({
    sentAt: m.sent_at,
    senderType: m.sender_type,
    channel: m.channel,
    body: m.body,
  }));
}

/**
 * Authoritative tour state + draft CTA eligibility for the Lead Luv tab.
 * Same gates as generateFollowUpDraft (evaluateCompletedTour + workflow intent).
 */
export async function loadLeadFollowUpPresentation(
  lead: Lead,
): Promise<LeadFollowUpPresentation> {
  if (!isSupabaseConfigured) {
    return { tour: { kind: "none" }, draftEligible: false, proposalSent: false };
  }
  const venue = await getCurrentVenue();
  if (!venue) {
    return { tour: { kind: "none" }, draftEligible: false, proposalSent: false };
  }
  const supabase = await createClient();
  const [proposalSent, tourState, messages] = await Promise.all([
    loadProposalSentFact(supabase, venue.id, lead.id),
    loadFollowUpTourState(supabase, venue.id, lead.id),
    loadLeadThreadMessages(supabase, venue.id, lead.relationshipId),
  ]);
  const tour = tourState.tour;
  const inquiryOrigin = normalizeInquiryMessageOrigin(lead.inquiryMessageOrigin);

  let completedDecision = null;
  if (tour.kind === "completed") {
    completedDecision = evaluateCompletedTour({
      tourId: "presentation",
      leadId: lead.id,
      contactName: [lead.firstName, lead.partnerFirstName].filter(Boolean).join(" and ") || null,
      occurredAt: tourState.occurredAt ?? tour.completedAt ?? tour.scheduledAt,
      followUpSentAt: tourState.followUpSentAt,
      proposalSent,
      messages,
      inquiryMessage: lead.inquiryMessage,
      inquiryOrigin,
    });
  }

  const gate = resolveFollowUpDraftEligibility({
    tour,
    nextActionText: lead.nextActionText,
    completedDecision,
  });

  return { tour, draftEligible: gate.eligible, proposalSent };
}
