/**
 * Post-event thank-you Automation (SEQ-04) — Settings toggle bridge.
 * The venue-facing product is Automations; this Settings control only
 * pauses/resumes the starter Automation so existing Settings IA stays useful.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { ensureStarterAutomationsForCurrentVenue } from "@/lib/message-sequences/provision";
import { getCurrentVenue } from "@/lib/venue/service";

export type PostEventThankYouAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  offsetDays: number;
};

type SeqRow = {
  id: string;
  name: string;
  status: "active" | "paused";
};

export async function getPostEventThankYouAutomation(): Promise<PostEventThankYouAutomation | null> {
  if (!isSupabaseConfigured) return null;
  await ensureStarterAutomationsForCurrentVenue();
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("message_sequences").select("id, name, status")
    .eq("venue_id", venue.id)
    .eq("source_master_key", "SEQ-04")
    .maybeSingle<SeqRow>();
  if (error) throw error;
  if (!data) return null;

  const { data: steps } = await supabase.from("sequence_steps")
    .select("offset_days")
    .eq("sequence_id", data.id)
    .order("sort_order")
    .limit(1)
    .maybeSingle<{ offset_days: number }>();

  return {
    id: data.id,
    name: data.name,
    enabled: data.status === "active",
    offsetDays: steps?.offset_days ?? 3,
  };
}

/** @deprecated Use getPostEventThankYouAutomation — kept name for Settings call sites. */
export async function getEventCompletedNudgeRule(): Promise<PostEventThankYouAutomation | null> {
  return getPostEventThankYouAutomation();
}

export async function setEventCompletedNudgeEnabled(enabled: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  await ensureStarterAutomationsForCurrentVenue();
  const supabase = await createClient();
  const { data } = await supabase.from("message_sequences").select("id")
    .eq("venue_id", venue.id)
    .eq("source_master_key", "SEQ-04")
    .maybeSingle<{ id: string }>();
  if (!data) return { ok: false, message: "Post-Event Thank You automation is not available yet." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("message_sequences") as any)
    .update({ status: enabled ? "active" : "paused" })
    .eq("id", data.id)
    .eq("venue_id", venue.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
