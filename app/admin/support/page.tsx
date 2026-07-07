import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSupportOpsData } from "@/lib/hq/support-service";

export const metadata: Metadata = { title: "Support — Wevenu HQ" };

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function SupportPage() {
  const data = await getSupportOpsData();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-2xl">🛟</p>
        <p className="text-sm font-medium text-heading">No data yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Stuck invitations and delivery failures that need a human.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Stuck Vendor Invitations</h2>
          <p className="text-xs text-muted-foreground">Pending 5+ days with no response.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.stuckVendorInvites.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">None — nice.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.stuckVendorInvites.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-xs">
                  <span className="text-heading">{i.email} <span className="text-muted-foreground">· {i.venueName}</span></span>
                  <span className="text-muted-foreground">{daysAgo(i.createdAt)}d ago</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Stuck Team Invitations</h2>
          <p className="text-xs text-muted-foreground">Invited 5+ days ago, never accepted.</p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.stuckTeamInvites.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">None — nice.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.stuckTeamInvites.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-xs">
                  <span className="text-heading">{i.name} <span className="text-muted-foreground">· {i.venueName}</span></span>
                  <span className="text-muted-foreground">{daysAgo(i.invitedAt)}d ago</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold text-heading">Notification & Digest Health</h2>
            <span className="text-xs text-muted-foreground">{data.notificationFailureCount7d} failures / 7d</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Digest: {data.digestSentTodayCount} of {data.digestEligibleCount} eligible venues sent today.
            {data.reminderBacklogCount > 0 && ` · ${data.reminderBacklogCount} reminders overdue by 1h+ — check the /api/notifications/process cron.`}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {data.notificationFailures.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">No delivery failures in the last 7 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.notificationFailures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-heading">
                    {f.venueName} <span className="text-muted-foreground capitalize">· {f.channel} · {f.status}</span>
                    {f.errorMessage && <span className="text-destructive"> — {f.errorMessage}</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{fmt(f.sentAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-4 text-xs text-muted-foreground">
          <span className="font-semibold text-heading">Not instrumented yet:</span> a general application error log and
          failed-CSV-import tracking. The <Link href="/admin/analytics" className="underline underline-offset-2">import wizard</Link> runs
          synchronously from the client today with no background job or failure record — worth building if imports start
          failing silently during beta.
        </CardContent>
      </Card>
    </div>
  );
}
