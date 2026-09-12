/**
 * Venue-facing possible-duplicate review records + notifications.
 * Detection only — never merges Relationships or re-parents Leads.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  findPossibleDuplicateMatches,
  signalLabel,
  type DuplicateCandidate,
  type DuplicateSignal,
  type InquiryIdentity,
} from "@/lib/leads/duplicate-detection";
import { leadDisplayName, statusLabel } from "@/lib/leads/constants";

type Db = Awaited<ReturnType<typeof createClient>>;

export type DuplicateReviewStatus = "needs_review" | "kept_separate";

export type DuplicateReview = {
  id: string;
  leadId: string;
  status: DuplicateReviewStatus;
  matchedLeadId: string | null;
  matchedClientId: string | null;
  matchedRelationshipId: string | null;
  matchedDisplayName: string;
  matchedEmail: string | null;
  matchedPhone: string | null;
  matchedSalesStage: string | null;
  signals: DuplicateSignal[];
  createdAt: string;
  resolvedAt: string | null;
};

function mapReview(row: {
  id: string;
  lead_id: string;
  status: string;
  matched_lead_id: string | null;
  matched_client_id: string | null;
  matched_relationship_id: string | null;
  matched_display_name: string;
  matched_email: string | null;
  matched_phone: string | null;
  matched_sales_stage: string | null;
  signals: string[] | null;
  created_at: string;
  resolved_at: string | null;
}): DuplicateReview {
  return {
    id: row.id,
    leadId: row.lead_id,
    status: row.status as DuplicateReviewStatus,
    matchedLeadId: row.matched_lead_id,
    matchedClientId: row.matched_client_id,
    matchedRelationshipId: row.matched_relationship_id,
    matchedDisplayName: row.matched_display_name,
    matchedEmail: row.matched_email,
    matchedPhone: row.matched_phone,
    matchedSalesStage: row.matched_sales_stage,
    signals: (row.signals ?? []) as DuplicateSignal[],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export async function previewPossibleDuplicates(
  identity: InquiryIdentity,
): Promise<{ ok: true; matches: DuplicateCandidate[] } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const matches = await findPossibleDuplicateMatches(supabase, venue.id, identity);
  return { ok: true, matches };
}

/**
 * After an externally submitted Lead is created, privately record a review
 * when strong evidence points at a different customer graph. Never called in
 * a way that changes what the prospect sees.
 */
export async function maybeCreateDuplicateReviewForNewLead(opts: {
  venueId: string;
  leadId: string;
  relationshipId: string | null;
  identity: InquiryIdentity;
  /** Use service role for public/webhook paths. */
  admin?: boolean;
}): Promise<DuplicateReview | null> {
  const supabase = (opts.admin ? createAdminClient() : await createClient()) as Db;
  const matches = await findPossibleDuplicateMatches(supabase, opts.venueId, opts.identity, {
    excludeLeadId: opts.leadId,
    excludeRelationshipId: opts.relationshipId,
  });
  const best = matches[0];
  if (!best) return null;

  // Prefer a Lead id for consolidation guidance.
  let matchedLeadId = best.leadId;
  if (!matchedLeadId && best.relationshipId) {
    const { data: sibling } = await supabase
      .from("leads")
      .select("id")
      .eq("venue_id", opts.venueId)
      .eq("relationship_id", best.relationshipId)
      .neq("id", opts.leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    matchedLeadId = sibling?.id ?? null;
  }

  const signalText = best.signals.map(signalLabel).join(", ");
  const stageText = best.salesStage ? statusLabel(best.salesStage) : null;
  const bodyParts = [
    `Possible match: ${best.displayName}`,
    best.email ? best.email : null,
    stageText ? `Status: ${stageText}` : null,
    `Matched by: ${signalText}`,
  ].filter(Boolean);

  await supabase.rpc("create_venue_notification", {
    p_venue_id: opts.venueId,
    p_event_id: null,
    p_type: "possible_duplicate_inquiry",
    p_title: "Possible duplicate inquiry",
    p_body: bodyParts.join(" · "),
    p_link: `/leads/${opts.leadId}`,
    p_emoji: "⚠️",
  });

  const { data: notif } = await supabase
    .from("venue_notifications")
    .select("id")
    .eq("venue_id", opts.venueId)
    .eq("type", "possible_duplicate_inquiry")
    .eq("link", `/leads/${opts.leadId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const { data, error } = await supabase
    .from("lead_duplicate_reviews")
    .upsert(
      {
        venue_id: opts.venueId,
        lead_id: opts.leadId,
        matched_lead_id: matchedLeadId,
        matched_client_id: best.clientId,
        matched_relationship_id: best.relationshipId,
        matched_display_name: best.displayName,
        matched_email: best.email,
        matched_phone: best.phone,
        matched_sales_stage: best.salesStage,
        signals: best.signals,
        status: "needs_review",
        notification_id: notif?.id ?? null,
        resolved_at: null,
      },
      { onConflict: "lead_id" },
    )
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("lead_duplicate_reviews upsert failed:", error?.message);
    return null;
  }
  return mapReview(data as Parameters<typeof mapReview>[0]);
}

export async function getDuplicateReviewForLead(leadId: string): Promise<DuplicateReview | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_duplicate_reviews")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (!data) return null;
  return mapReview(data as Parameters<typeof mapReview>[0]);
}

export async function keepDuplicateSeparate(
  leadId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("lead_duplicate_reviews")
    .select("id, notification_id")
    .eq("venue_id", venue.id)
    .eq("lead_id", leadId)
    .maybeSingle<{ id: string; notification_id: string | null }>();
  if (!review) return { ok: false, message: "No possible-duplicate review found." };

  const { error } = await supabase
    .from("lead_duplicate_reviews")
    .update({ status: "kept_separate", resolved_at: new Date().toISOString() })
    .eq("id", review.id)
    .eq("venue_id", venue.id);
  if (error) return { ok: false, message: error.message };

  if (review.notification_id) {
    await supabase
      .from("venue_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", review.notification_id)
      .eq("venue_id", venue.id);
  }

  return { ok: true };
}

export function newLeadSummary(identity: InquiryIdentity & { firstName: string; lastName: string }) {
  return {
    displayName: leadDisplayName(
      identity.firstName,
      identity.lastName,
      identity.partnerFirstName,
      identity.partnerLastName,
    ),
    email: identity.email?.trim() || null,
    phone: identity.phone?.trim() || null,
  };
}
