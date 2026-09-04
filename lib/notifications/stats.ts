import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type NotificationStats = {
  /** Pending reminders scheduled in the future (not yet due). */
  waitingFuture: number;
  /** Pending reminders whose scheduled_for is now or past (worker should send). */
  dueNow: number;
  /** Convenience: waitingFuture + dueNow. */
  pendingReminders: number;
  sentLast24h: number;
  failedLast24h: number;
  lastProcessedAt: string | null;
  /** Next future pending reminder, if any. */
  nextScheduledFor: string | null;
};

export const EMPTY_NOTIFICATION_STATS: NotificationStats = {
  waitingFuture: 0,
  dueNow: 0,
  pendingReminders: 0,
  sentLast24h: 0,
  failedLast24h: 0,
  lastProcessedAt: null,
  nextScheduledFor: null,
};

/** Pure helper for tests — classify a pending scheduled_for vs now. */
export function classifyPendingReminder(
  scheduledForIso: string,
  nowMs: number = Date.now(),
): "waiting_future" | "due_now" {
  return new Date(scheduledForIso).getTime() > nowMs ? "waiting_future" : "due_now";
}

export async function getNotificationStats(): Promise<NotificationStats> {
  if (!isSupabaseConfigured) return { ...EMPTY_NOTIFICATION_STATS };
  const venue = await getCurrentVenue();
  if (!venue) return { ...EMPTY_NOTIFICATION_STATS };
  const supabase = await createClient();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const nowIso = new Date().toISOString();

  const [
    futureResult,
    dueResult,
    sentResult,
    failedResult,
    lastResult,
    nextResult,
  ] = await Promise.all([
    supabase.from("task_reminders").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "pending").gt("scheduled_for", nowIso),
    supabase.from("task_reminders").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "pending").lte("scheduled_for", nowIso),
    supabase.from("notification_log").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "sent").gte("sent_at", since24h),
    supabase.from("notification_log").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id).eq("status", "failed").gte("sent_at", since24h),
    supabase.from("notification_log").select("sent_at")
      .eq("venue_id", venue.id).eq("status", "sent")
      .order("sent_at", { ascending: false }).limit(1).maybeSingle<{ sent_at: string }>(),
    supabase.from("task_reminders").select("scheduled_for")
      .eq("venue_id", venue.id).eq("status", "pending").gt("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true }).limit(1)
      .maybeSingle<{ scheduled_for: string }>(),
  ]);

  const waitingFuture = futureResult.count ?? 0;
  const dueNow = dueResult.count ?? 0;

  return {
    waitingFuture,
    dueNow,
    pendingReminders: waitingFuture + dueNow,
    sentLast24h: sentResult.count ?? 0,
    failedLast24h: failedResult.count ?? 0,
    lastProcessedAt: lastResult.data?.sent_at ?? null,
    nextScheduledFor: nextResult.data?.scheduled_for ?? null,
  };
}
