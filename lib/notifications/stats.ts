import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type NotificationStats = {
  pendingReminders: number;
  sentLast24h: number;
  failedLast24h: number;
  lastProcessedAt: string | null;
};

export async function getNotificationStats(): Promise<NotificationStats> {
  const defaultStats: NotificationStats = { pendingReminders: 0, sentLast24h: 0, failedLast24h: 0, lastProcessedAt: null };
  if (!isSupabaseConfigured) return defaultStats;
  const venue = await getCurrentVenue();
  if (!venue) return defaultStats;
  const supabase = await createClient();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [pendingResult, sentResult, failedResult, lastResult] = await Promise.all([
    supabase.from("task_reminders").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "pending"),
    supabase.from("notification_log").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "sent").gte("sent_at", since24h),
    supabase.from("notification_log").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "failed").gte("sent_at", since24h),
    supabase.from("notification_log").select("sent_at")
      .eq("venue_id", venue.id).order("sent_at", { ascending: false }).limit(1).maybeSingle<{ sent_at: string }>(),
  ]);

  return {
    pendingReminders: pendingResult.count ?? 0,
    sentLast24h:      sentResult.count ?? 0,
    failedLast24h:    failedResult.count ?? 0,
    lastProcessedAt:  lastResult.data?.sent_at ?? null,
  };
}
