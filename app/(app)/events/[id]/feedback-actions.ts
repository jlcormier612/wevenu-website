"use server";

import { createClient } from "@/integrations/supabase/server";

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
};

export async function getEventPostWeddingDataAction(
  eventId: string,
): Promise<EventPostWeddingData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_event_post_wedding_data", {
    p_event_id: eventId,
  });
  if (error) return null;

  const result = data as {
    feedback?:  FeedbackRecord | null;
    referrals?: ReferralRecord[];
    memories?:  MemoryRecord[];
    error?:     string;
  } | null;

  if (!result || result.error) return null;

  return {
    feedback:  result.feedback  ?? null,
    referrals: result.referrals ?? [],
    memories:  result.memories  ?? [],
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
