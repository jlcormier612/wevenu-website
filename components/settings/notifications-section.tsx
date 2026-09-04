"use client";

import * as React from "react";

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSyncedState } from "@/lib/hooks/use-synced-state";
import type { NotificationStats } from "@/lib/notifications/stats";

function StatCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "neutral" | "success" | "failed" | "attention";
}) {
  const colors = {
    neutral: "text-foreground bg-muted/40 border-border",
    success: "text-green-700 bg-green-50 border-green-200",
    failed: "text-red-700 bg-red-50 border-red-200",
    attention: "text-amber-800 bg-amber-50 border-amber-200",
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 ${colors[tone]}`}>
      <span className="text-lg font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function formatNextReminder(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Automatic reminder queue health. task_reminders rows with status=pending
 * split into waiting (scheduled_for > now) vs due now (scheduled_for <= now).
 * A large waiting count is healthy — it is not "109 reminders supposed to be
 * sending right now."
 */
export function NotificationsSection({
  initialStats,
  emailConfigured,
}: {
  initialStats: NotificationStats;
  emailConfigured: boolean;
}) {
  const [stats, setStats] = useSyncedState(initialStats);
  const [sending, setSending] = React.useState(false);

  const isHealthy = emailConfigured && stats.failedLast24h === 0 && stats.dueNow === 0;
  const nextLabel = formatNextReminder(stats.nextScheduledFor);

  async function handleSendNow() {
    setSending(true);
    try {
      const secret = process.env.NEXT_PUBLIC_NOTIFICATIONS_SECRET;
      const res = await fetch("/api/notifications/process", {
        method: "POST",
        headers: secret ? { "x-notifications-secret": secret } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't check for reminders right now.");
        return;
      }
      // Refresh authoritative counts from the server after process.
      const refresh = await fetch("/api/notifications/stats").catch(() => null);
      if (refresh?.ok) {
        const next = (await refresh.json()) as NotificationStats;
        setStats(next);
      } else {
        setStats((p) => ({
          ...p,
          dueNow: Math.max(0, p.dueNow - (data.sent ?? 0) - (data.skipped ?? 0)),
          pendingReminders: Math.max(0, p.pendingReminders - (data.sent ?? 0) - (data.skipped ?? 0)),
          sentLast24h: p.sentLast24h + (data.sent ?? 0),
          failedLast24h: p.failedLast24h + (data.failed ?? 0),
          lastProcessedAt: new Date().toISOString(),
        }));
      }
      if (data.sent > 0) toast.success(`${data.sent} reminder${data.sent !== 1 ? "s" : ""} sent.`);
      else toast.success("Nothing was due to send.");
      if (data.failed > 0) {
        toast.error(`${data.failed} reminder${data.failed !== 1 ? "s" : ""} failed to send.`);
      }
    } catch {
      toast.error("Couldn't check for reminders right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      {!emailConfigured ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Email isn&apos;t connected</p>
            <p className="text-xs text-red-700 mt-0.5">
              Reminders can&apos;t send until an email provider is connected.
            </p>
          </div>
        </div>
      ) : isHealthy ? (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">Email delivery is active</p>
            <p className="text-xs text-green-700 mt-0.5">
              Nothing is due right now. Future reminders wait until their send time.
            </p>
          </div>
        </div>
      ) : stats.dueNow > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">
              {stats.dueNow} reminder{stats.dueNow !== 1 ? "s" : ""} due now
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These should send on the next automatic run, or use Send Now below.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Some notifications failed to send</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {stats.failedLast24h} failed deliver
              {stats.failedLast24h !== 1 ? "ies" : "y"} in the last 24 hours. Hello to Cheers will keep
              retrying automatically.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <StatCard label="waiting to send" count={stats.waitingFuture} tone="neutral" />
          <StatCard
            label="due now"
            count={stats.dueNow}
            tone={stats.dueNow > 0 ? "attention" : "neutral"}
          />
          <StatCard label="sent in last 24 hours" count={stats.sentLast24h} tone="success" />
          {stats.failedLast24h > 0 && (
            <StatCard label="failed" count={stats.failedLast24h} tone="failed" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {stats.waitingFuture === 0 && stats.dueNow === 0
            ? "No reminders are waiting. New ones appear when tasks or client obligations need a follow-up."
            : nextLabel
              ? `Next reminder: ${nextLabel}. Waiting reminders are scheduled for the future — they are not overdue sends.`
              : stats.dueNow > 0
                ? `${stats.dueNow} reminder${stats.dueNow !== 1 ? "s are" : " is"} past their send time and ready to process.`
                : `${stats.waitingFuture} reminder${stats.waitingFuture !== 1 ? "s" : ""} scheduled for later.`}
        </p>
      </div>

      {stats.lastProcessedAt && (
        <p className="text-xs text-muted-foreground">
          Last successful delivery:{" "}
          {new Date(stats.lastProcessedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Send reminders now</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Processes reminders that are due now (not future ones). Reminders normally send
            automatically every 30 minutes.
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleSendNow} disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Send Now
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
