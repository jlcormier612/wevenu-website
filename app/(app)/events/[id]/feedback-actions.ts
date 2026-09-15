"use server";

import { createClient } from "@/integrations/supabase/server";
import { isFeedbackPubliclyEligible } from "@/lib/feedback/couple-venue-feedback";

type FeedbackRecord = {
  id: string;
  overallRating: number;
  lovedMost: string | null;
  couldImprove: string | null;
  wouldRecommend: boolean;
  publicPermission: string;
  venueStatus: string;
  venueResponse: string | null;
  approvedForPublicAt: string | null;
  submittedAt: string;
  isPubliclyEligible?: boolean;
};

type ReferralRecord = {
  id: string;
  referralName: string;
  referralEmail: string | null;
  referralPhone: string | null;
  note: string | null;
  status: string;
  createdAt: string;
};

type MemoryRecord = {
  id: string;
  storageUrl: string;
  caption: string | null;
  visibility: string;
  approvedAt: string | null;
  createdAt: string;
};

export type EventPostWeddingData = {
  feedback: FeedbackRecord | null;
  referrals: ReferralRecord[];
  memories: MemoryRecord[];
  publicReviewUrl: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length ? s : null;
}

function mapFeedback(raw: unknown): FeedbackRecord | null {
  const r = asRecord(raw);
  if (!r || r.id == null) return null;
  const overallRating = Number(r.overallRating ?? r.overall_rating ?? 0);
  const publicPermission = String(r.publicPermission ?? r.public_permission ?? "none");
  const approvedForPublicAt = str(r.approvedForPublicAt ?? r.approved_for_public_at);
  return {
    id: String(r.id),
    overallRating: Number.isFinite(overallRating) ? overallRating : 0,
    lovedMost: str(r.lovedMost ?? r.loved_most),
    couldImprove: str(r.couldImprove ?? r.could_improve),
    wouldRecommend: Boolean(r.wouldRecommend ?? r.would_recommend),
    publicPermission,
    venueStatus: String(r.venueStatus ?? r.venue_status ?? "pending"),
    venueResponse: str(r.venueResponse ?? r.venue_response),
    approvedForPublicAt,
    submittedAt: String(r.submittedAt ?? r.submitted_at ?? new Date().toISOString()),
    isPubliclyEligible:
      typeof r.isPubliclyEligible === "boolean"
        ? r.isPubliclyEligible
        : isFeedbackPubliclyEligible({ publicPermission, approvedForPublicAt }),
  };
}

function mapReferral(raw: unknown): ReferralRecord | null {
  const r = asRecord(raw);
  if (!r || r.id == null) return null;
  return {
    id: String(r.id),
    referralName: String(r.referralName ?? r.referral_name ?? ""),
    referralEmail: str(r.referralEmail ?? r.referral_email),
    referralPhone: str(r.referralPhone ?? r.referral_phone),
    note: str(r.note),
    status: String(r.status ?? "new"),
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
  };
}

function mapMemory(raw: unknown): MemoryRecord | null {
  const r = asRecord(raw);
  if (!r || r.id == null) return null;
  return {
    id: String(r.id),
    storageUrl: String(r.storageUrl ?? r.storage_url ?? ""),
    caption: str(r.caption),
    visibility: String(r.visibility ?? "venue"),
    approvedAt: str(r.approvedAt ?? r.approved_at),
    createdAt: String(r.createdAt ?? r.created_at ?? ""),
  };
}

export async function getEventPostWeddingDataAction(
  eventId: string,
): Promise<EventPostWeddingData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_post_wedding_data", {
    p_event_id: eventId,
  });
  if (error) return null;

  const result = asRecord(data);
  if (!result || result.error) return null;

  const referralsRaw = Array.isArray(result.referrals) ? result.referrals : [];
  const memoriesRaw = Array.isArray(result.memories) ? result.memories : [];

  return {
    feedback: mapFeedback(result.feedback),
    referrals: referralsRaw.map(mapReferral).filter((x): x is ReferralRecord => x != null),
    memories: memoriesRaw.map(mapMemory).filter((x): x is MemoryRecord => x != null),
    publicReviewUrl: str(result.publicReviewUrl ?? result.public_review_url),
  };
}

export async function resolveFeedbackAction(
  feedbackId: string,
  status: "reviewed" | "resolved",
  response: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_feedback", {
    p_feedback_id: feedbackId,
    p_status:      status,
    p_response:    response,
  });
  if (error) return { ok: false };
  const result = data as { ok: boolean } | null;
  return { ok: result?.ok ?? false };
}

export async function approveFeedbackPublicAction(
  feedbackId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_feedback_public", {
    p_feedback_id: feedbackId,
  });
  if (error) return { ok: false };
  const result = data as { ok: boolean } | null;
  return { ok: result?.ok ?? false };
}

export async function updateReferralStatusAction(
  referralId: string,
  status: "new" | "contacted" | "booked",
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_referral_status", {
    p_referral_id: referralId,
    p_status:      status,
  });
  if (error) return { ok: false };
  const result = data as { ok: boolean } | null;
  return { ok: result?.ok ?? false };
}

export async function approveMemoryAction(
  memoryId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_couple_memory", {
    p_memory_id: memoryId,
  });
  if (error) return { ok: false };
  const result = data as { ok: boolean } | null;
  return { ok: result?.ok ?? false };
}
