"use client";

import * as React from "react";

import { Bell, CheckCircle2, Loader2, Mail, MessageSquare, Smartphone, } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSyncedState } from "@/lib/hooks/use-synced-state";

type NotificationStats = {
  pendingReminders: number;
  sentLast24h: number;
  failedLast24h: number;
  lastProcessedAt: string | null;
};

const CHANNEL_ICONS = {
  email: Mail, sms: Smartphone, in_app: Bell, push: MessageSquare,
};

function StatusChip({ label, count, variant }: { label: string; count: number; variant: "pending" | "sent" | "failed" }) {
  const colors = {
    pending: "text-amber-700 bg-amber-50 border-amber-200",
    sent:    "text-green-700 bg-green-50 border-green-200",
    failed:  "text-red-700 bg-red-50 border-red-200",
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 ${colors[variant]}`}>
      <span className="text-lg font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

export function NotificationsSection({ initialStats }: { initialStats: NotificationStats }) {
  // See lib/hooks/use-synced-state.ts — sibling sections on this same flat
  // Settings page (VenueSpacesSection, TourSettingsSection) call
  // router.refresh() on save, which would otherwise leave these counts
  // stale without a full reload.
  const [stats, setStats] = useSyncedState(initialStats);
  const [processing, setProcessing] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{ processed: number; sent: number; failed: number } | null>(null);

  async function handleProcess() {
    setProcessing(true);
    setLastResult(null);
    try {
      const secret = process.env.NEXT_PUBLIC_NOTIFICATIONS_SECRET;
      const res = await fetch("/api/notifications/process", {
        method: "POST",
        headers: secret ? { "x-notifications-secret": secret } : {},
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to process notifications."); return; }
      setLastResult({ processed: data.processed, sent: data.sent, failed: data.failed });
      setStats((p) => ({
        ...p,
        pendingReminders: Math.max(0, p.pendingReminders - data.sent - data.skipped),
        sentLast24h: p.sentLast24h + data.sent,
        failedLast24h: p.failedLast24h + data.failed,
        lastProcessedAt: new Date().toISOString(),
      }));
      if (data.sent > 0) toast.success(`${data.sent} notification${data.sent !== 1 ? "s" : ""} sent.`);
      else toast.success("No pending notifications at this time.");
      if (data.failed > 0) toast.error(`${data.failed} notification${data.failed !== 1 ? "s" : ""} failed to send.`);
    } catch { toast.error("Could not reach the notification engine."); }
    finally { setProcessing(false); }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatusChip label="pending" count={stats.pendingReminders} variant="pending" />
        <StatusChip label="sent (24h)" count={stats.sentLast24h} variant="sent" />
        {stats.failedLast24h > 0 && <StatusChip label="failed (24h)" count={stats.failedLast24h} variant="failed" />}
      </div>

      {stats.lastProcessedAt && (
        <p className="text-xs text-muted-foreground">
          Last processed: {new Date(stats.lastProcessedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}

      {/* Manual trigger */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Manual Processing</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Process all pending reminders now. In production, this runs automatically on a schedule.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={handleProcess} disabled={processing}>
            {processing
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Processing…</>
              : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Process Now</>}
          </Button>
          {lastResult && (
            <p className="text-xs text-muted-foreground">
              {lastResult.processed} processed · {lastResult.sent} sent
              {lastResult.failed > 0 ? ` · ${lastResult.failed} failed` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Channel overview */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Channels</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["email", "sms", "in_app", "push"] as const).map((ch) => {
            const Icon = CHANNEL_ICONS[ch];
            const isActive = ch === "email";
            return (
              <div key={ch} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${isActive ? "border-border bg-card" : "border-border/40 bg-muted/20 opacity-50"}`}>
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-medium text-heading capitalize">{ch.replace("_", "-")}</p>
                  <p className="text-[10px] text-muted-foreground">{isActive ? "Active" : "Future"}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Email is active in Sprint 44. SMS, in-app, and push notifications are architected and will be activated in future sprints based on recipient role and urgency.
        </p>
      </div>
    </div>
  );
}
