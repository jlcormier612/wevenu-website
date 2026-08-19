"use client";

import * as React from "react";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

type NotificationStats = {
  pendingReminders: number;
  sentLast24h: number;
  failedLast24h: number;
  lastProcessedAt: string | null;
};

function StatCard({ label, count, tone }: { label: string; count: number; tone: "neutral" | "success" | "failed" }) {
  const colors = {
    neutral: "text-foreground bg-muted/40 border-border",
    success: "text-green-700 bg-green-50 border-green-200",
    failed:  "text-red-700 bg-red-50 border-red-200",
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 ${colors[tone]}`}>
      <span className="text-lg font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

/**
 * Sprint 4 — Notification Experience UX Polish. The backend (scheduled
 * messages, processed by a background worker) is unchanged; this is a
 * terminology/framing pass only. Every label here answers one of the four
 * questions a venue actually has — did it send, when will it send, is
 * anything failing, is email working — never how the queue works.
 */
export function NotificationsSection({
  initialStats, emailConfigured,
}: {
  initialStats: NotificationStats;
  /** Whether an email provider is actually connected — answers "is email working?" directly. */
  emailConfigured: boolean;
}) {
  // See lib/hooks/use-synced-state.ts — sibling sections on this same flat
  // Settings page (VenueSpacesSection, TourSettingsSection) call
  // router.refresh() on save, which would otherwise leave these counts
  // stale without a full reload.
  const [stats, setStats] = useSyncedState(initialStats);
  const [sending, setSending] = React.useState(false);

  const isHealthy = emailConfigured && stats.failedLast24h === 0;

  async function handleSendNow() {
    setSending(true);
    try {
      const secret = process.env.NEXT_PUBLIC_NOTIFICATIONS_SECRET;
      const res = await fetch("/api/notifications/process", {
        method: "POST",
        headers: secret ? { "x-notifications-secret": secret } : {},
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't check for reminders right now."); return; }
      setStats((p) => ({
        ...p,
        pendingReminders: Math.max(0, p.pendingReminders - data.sent - data.skipped),
        sentLast24h: p.sentLast24h + data.sent,
        failedLast24h: p.failedLast24h + data.failed,
        lastProcessedAt: new Date().toISOString(),
      }));
      if (data.sent > 0) toast.success(`${data.sent} reminder${data.sent !== 1 ? "s" : ""} sent.`);
      else toast.success("Nothing was due to send.");
      if (data.failed > 0) toast.error(`${data.failed} reminder${data.failed !== 1 ? "s" : ""} failed to send.`);
    } catch { toast.error("Couldn't check for reminders right now."); }
    finally { setSending(false); }
  }

  return (
    <div className="space-y-5">
      {/* Delivery health — the one thing a venue needs to know at a glance */}
      {!emailConfigured ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Email isn&apos;t connected</p>
            <p className="text-xs text-red-700 mt-0.5">Reminders can&apos;t send until an email provider is connected.</p>
          </div>
        </div>
      ) : isHealthy ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">Email delivery is active</p>
            <p className="text-xs text-green-700 mt-0.5">Notifications are sending automatically.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Some notifications failed to send</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {stats.failedLast24h} failed delivery{stats.failedLast24h !== 1 ? "ies" : ""} in the last 24 hours. Hello to Cheers will keep retrying automatically.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="scheduled" count={stats.pendingReminders} tone="neutral" />
        <StatCard label="sent today" count={stats.sentLast24h} tone="success" />
        {stats.failedLast24h > 0 && <StatCard label="failed" count={stats.failedLast24h} tone="failed" />}
      </div>

      {stats.lastProcessedAt && (
        <p className="text-xs text-muted-foreground">
          Last successful delivery: {new Date(stats.lastProcessedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}

      {/* Manual send */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Send reminders now</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reminders normally send automatically. Use this if you don&apos;t want to wait.
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleSendNow} disabled={sending}>
          {sending
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
            : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Send Now</>}
        </Button>
      </div>
    </div>
  );
}
