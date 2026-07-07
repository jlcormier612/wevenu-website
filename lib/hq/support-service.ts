/**
 * Wevenu HQ — Support/Ops triage. Server-only, HQ-admin-only.
 *
 * Scope note: this surfaces what's genuinely instrumented today — stuck
 * invitations (vendor + team) and notification/digest delivery failures,
 * both backed by real tables. A general application error log and a
 * failed-import log do not exist yet (the CSV import wizard runs
 * synchronously from the client, with no background job or failure record
 * to read) — those stay as documented future hooks rather than being faked
 * with an empty state that looks built but isn't.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

const STUCK_INVITE_DAYS = 5;

export type StuckVendorInvite = {
  id: string;
  venueName: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

export type StuckTeamInvite = {
  id: string;
  venueName: string;
  name: string;
  email: string | null;
  invitedAt: string;
};

export type NotificationFailure = {
  id: string;
  venueName: string;
  channel: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
};

export type SupportOpsData = {
  stuckVendorInvites: StuckVendorInvite[];
  stuckTeamInvites: StuckTeamInvite[];
  notificationFailures: NotificationFailure[];
  notificationFailureCount7d: number;
  reminderBacklogCount: number;
  digestEligibleCount: number;
  digestSentTodayCount: number;
};

export async function getSupportOpsData(): Promise<SupportOpsData | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const staleCutoff = new Date(Date.now() - STUCK_INVITE_DAYS * 86_400_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [vendorInvitesRes, teamInvitesRes, notifFailuresRes, notifFailureCountRes, reminderBacklogRes, digestPrefsRes] =
    await Promise.all([
      supabase
        .from("vendor_invitations")
        .select("id, email, created_at, expires_at, venues(name)")
        .eq("status", "pending")
        .lt("created_at", staleCutoff)
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("venue_staff")
        .select("id, full_name, email, invited_at, venues(name)")
        .is("accepted_at", null)
        .not("invited_at", "is", null)
        .lt("invited_at", staleCutoff)
        .order("invited_at", { ascending: true })
        .limit(20),
      supabase
        .from("notification_log")
        .select("id, channel, status, error_message, sent_at, venues(name)")
        .in("status", ["failed", "bounced"])
        .gte("sent_at", since7d)
        .order("sent_at", { ascending: false })
        .limit(20),
      supabase
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .in("status", ["failed", "bounced"])
        .gte("sent_at", since7d),
      supabase
        .from("task_reminders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("scheduled_for", new Date(Date.now() - 3_600_000).toISOString()),
      supabase
        .from("venue_notification_preferences")
        .select("venue_id, daily_digest_enabled, last_digest_sent_at"),
    ]);

  type VendorInviteRow = { id: string; email: string; created_at: string; expires_at: string; venues: { name: string } | { name: string }[] | null };
  type TeamInviteRow = { id: string; full_name: string; email: string | null; invited_at: string; venues: { name: string } | { name: string }[] | null };
  type NotifRow = { id: string; channel: string; status: string; error_message: string | null; sent_at: string; venues: { name: string } | { name: string }[] | null };
  const venueName = (v: { name: string } | { name: string }[] | null): string =>
    (Array.isArray(v) ? v[0]?.name : v?.name) ?? "Unknown venue";

  const stuckVendorInvites: StuckVendorInvite[] = ((vendorInvitesRes.data ?? []) as VendorInviteRow[]).map((r) => ({
    id: r.id,
    venueName: venueName(r.venues),
    email: r.email,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));

  const stuckTeamInvites: StuckTeamInvite[] = ((teamInvitesRes.data ?? []) as TeamInviteRow[]).map((r) => ({
    id: r.id,
    venueName: venueName(r.venues),
    name: r.full_name,
    email: r.email,
    invitedAt: r.invited_at,
  }));

  const notificationFailures: NotificationFailure[] = ((notifFailuresRes.data ?? []) as NotifRow[]).map((r) => ({
    id: r.id,
    venueName: venueName(r.venues),
    channel: r.channel,
    status: r.status,
    errorMessage: r.error_message,
    sentAt: r.sent_at,
  }));

  // Note: a venue with no venue_notification_preferences row at all also
  // defaults to digest-enabled (see get_digest_eligible_venues()) — this
  // undercounts "eligible" slightly since it only sees venues that have a
  // preferences row. Good enough for a health signal, not exact.
  const digestPrefs = (digestPrefsRes.data ?? []) as { venue_id: string; daily_digest_enabled: boolean; last_digest_sent_at: string | null }[];
  const digestEligible = digestPrefs.filter((p) => p.daily_digest_enabled);
  const digestSentToday = digestEligible.filter((p) => p.last_digest_sent_at && new Date(p.last_digest_sent_at) >= todayStart);

  return {
    stuckVendorInvites,
    stuckTeamInvites,
    notificationFailures,
    notificationFailureCount7d: notifFailureCountRes.count ?? 0,
    reminderBacklogCount: reminderBacklogRes.count ?? 0,
    digestEligibleCount: digestEligible.length,
    digestSentTodayCount: digestSentToday.length,
  };
}
