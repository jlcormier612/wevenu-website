/**
 * Daily digest delivery engine.
 */
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  buildDigestHtml,
  buildDigestText,
  type DigestContext,
  type DigestItem,
} from "@/lib/email/daily-digest";
import * as crypto from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.wevenu.com";
const MAX_ITEMS = 5;

type DigestResult = { sent: number; skipped: number; failed: number };

type VenueDigestRow = {
  venue_id: string;
  venue_name: string;
  owner_email: string;
  owner_name: string | null;
  timezone: string | null;
  last_digest_hash: string | null;
  last_digest_sent_at: string | null;
};

// Service role — the digest engine runs as a system process on a cron
// schedule with no user session, and reads across every venue (bypassing RLS).
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for digest engine.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function sendDailyDigests(): Promise<DigestResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: 0, skipped: 0, failed: 0 };
  }
  const supabase = getServiceClient();

  const { data: venues } = await supabase.rpc("get_digest_eligible_venues");
  if (!venues || !(venues as VenueDigestRow[]).length) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0, skipped = 0, failed = 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  for (const venue of venues as VenueDigestRow[]) {
    try {
      const tz = venue.timezone ?? "America/New_York";
      const localHour = getLocalHour(tz);
      if (localHour < 7 || localHour >= 9) { skipped++; continue; }

      const ctx = await buildDigestContext(supabase, venue, todayIso);
      if (!ctx) { skipped++; continue; }

      const hash = hashContent(ctx.urgentItems, ctx.dueTodayItems);
      if (hash === venue.last_digest_hash) { skipped++; continue; }

      await sendEmail({
        to:      venue.owner_email,
        subject: ctx.subjectLine,
        html:    buildDigestHtml(ctx),
        text:    buildDigestText(ctx),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("venue_notification_preferences") as any)
        .update({ last_digest_hash: hash, last_digest_sent_at: new Date().toISOString() })
        .eq("venue_id", venue.venue_id);

      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, skipped, failed };
}

function getLocalHour(timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

async function buildDigestContext(
  supabase: Awaited<ReturnType<typeof import("@/integrations/supabase/server").createClient>>,
  venue: VenueDigestRow,
  todayIso: string,
): Promise<DigestContext | null> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const [overdueTasksRes, dueTodayRes, winsRes, unreadRes] = await Promise.all([
    supabase.from("event_tasks").select("id, title, event_id")
      .eq("venue_id", venue.venue_id).eq("status", "overdue").limit(3),
    supabase.from("event_tasks").select("id, title, event_id")
      .eq("venue_id", venue.venue_id).in("status", ["pending", "blocked"])
      .eq("due_date", todayIso).limit(3),
    supabase.from("event_tasks").select("id, title, completed_at")
      .eq("venue_id", venue.venue_id).eq("status", "complete")
      .gte("completed_at", since24h).limit(3),
    supabase.from("message_threads").select("id", { count: "exact", head: true })
      .eq("venue_id", venue.venue_id).eq("is_read", false)
      .lt("last_message_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);

  const urgentItems: DigestItem[] = [
    ...(overdueTasksRes.data ?? []).map(t => ({
      label: t.title,
      detail: "Overdue task",
      href: `${APP_URL}/tasks`,
    })),
    ...((unreadRes.count ?? 0) > 0 ? [{
      label: `${unreadRes.count} unanswered message${(unreadRes.count ?? 0) > 1 ? "s" : ""}`,
      detail: "Inquiries waiting more than 24 hours",
      href: `${APP_URL}/messages`,
    }] : []),
  ].slice(0, MAX_ITEMS);

  const dueTodayItems: DigestItem[] = (dueTodayRes.data ?? []).map(t => ({
    label: t.title,
    detail: "Due today",
    href: `${APP_URL}/tasks`,
  })).slice(0, MAX_ITEMS - urgentItems.length);

  if (urgentItems.length === 0 && dueTodayItems.length === 0) return null;

  const recentWins: DigestItem[] = (winsRes.data ?? []).map(t => ({
    label: t.title,
    detail: null,
    href: `${APP_URL}/tasks`,
  }));

  const total = urgentItems.length + dueTodayItems.length;
  let subjectLine: string;
  if (total === 1) {
    subjectLine = "One thing needs your attention today";
  } else {
    subjectLine = `${total} things need your attention today`;
  }

  const today = new Date();
  const todayFormatted = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return {
    venueName:      venue.venue_name,
    todayFormatted,
    subjectLine,
    urgentItems,
    dueTodayItems,
    recentWins,
    luvObservation: null,
    appUrl:         APP_URL,
    unsubscribeUrl: "/settings#notifications",
  };
}

function hashContent(urgentItems: DigestItem[], dueTodayItems: DigestItem[]): string {
  const content = JSON.stringify([...urgentItems, ...dueTodayItems].map(i => i.label).sort());
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}
