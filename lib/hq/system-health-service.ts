/**
 * Wevenu HQ — System Health. Server-only, HQ-admin-only.
 *
 * "Cron job status" here means "when did we last see evidence this cron
 * ran" (most recent notification_log / digest send timestamp) — there is no
 * separate cron-run-log table, so this is inferred from delivery side
 * effects rather than a direct heartbeat. Good enough to notice "the digest
 * hasn't gone out in 2 days"; a real heartbeat table is a future hook if
 * that inference ever proves too indirect.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type ChannelStat = {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
};

export type RecentLogEntry = {
  id: string;
  venueName: string;
  channel: string;
  status: string;
  sourceType: string;
  sentAt: string;
};

export type SystemHealthData = {
  lastDigestSentAt: string | null;
  lastReminderSentAt: string | null;
  channelStats: ChannelStat[];
  recentLog: RecentLogEntry[];
};

export async function getSystemHealthData(): Promise<SystemHealthData | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [lastDigestRes, lastReminderRes, statsRes, recentRes] = await Promise.all([
    supabase.from("venue_notification_preferences").select("last_digest_sent_at").not("last_digest_sent_at", "is", null).order("last_digest_sent_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("task_reminders").select("sent_at").not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notification_log").select("channel, status").gte("sent_at", since7d).limit(2000),
    supabase.from("notification_log").select("id, channel, status, source_type, sent_at, venues(name)").order("sent_at", { ascending: false }).limit(25),
  ]);

  const statRows = (statsRes.data ?? []) as { channel: string; status: string }[];
  const byChannel = new Map<string, ChannelStat>();
  for (const r of statRows) {
    const entry = byChannel.get(r.channel) ?? { channel: r.channel, sent: 0, delivered: 0, failed: 0, bounced: 0 };
    if (r.status === "sent") entry.sent++;
    if (r.status === "delivered") entry.delivered++;
    if (r.status === "failed") entry.failed++;
    if (r.status === "bounced") entry.bounced++;
    byChannel.set(r.channel, entry);
  }

  type RecentRow = { id: string; channel: string; status: string; source_type: string; sent_at: string; venues: { name: string } | { name: string }[] | null };
  const venueName = (v: { name: string } | { name: string }[] | null): string => (Array.isArray(v) ? v[0]?.name : v?.name) ?? "Unknown venue";

  const recentLog: RecentLogEntry[] = ((recentRes.data ?? []) as RecentRow[]).map((r) => ({
    id: r.id,
    venueName: venueName(r.venues),
    channel: r.channel,
    status: r.status,
    sourceType: r.source_type,
    sentAt: r.sent_at,
  }));

  return {
    lastDigestSentAt: (lastDigestRes.data as { last_digest_sent_at: string | null } | null)?.last_digest_sent_at ?? null,
    lastReminderSentAt: (lastReminderRes.data as { sent_at: string | null } | null)?.sent_at ?? null,
    channelStats: Array.from(byChannel.values()),
    recentLog,
  };
}
