import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSystemHealthData } from "@/lib/hq/system-health-service";

export const metadata: Metadata = { title: "System Health — Wevenu HQ" };

function fmtRelative(iso: string | null): string {
  if (!iso) return "Never";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "Less than an hour ago";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isStale(lastSeen: string | null, staleAfterHours: number): boolean {
  const hours = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / 3_600_000 : Infinity;
  return hours > staleAfterHours;
}

function HeartbeatPill({ label, lastSeen, staleAfterHours }: { label: string; lastSeen: string | null; staleAfterHours: number }) {
  const stale = isStale(lastSeen, staleAfterHours);
  return (
    <div className={`rounded-xl border p-3 ${stale ? "border-destructive/30 bg-destructive/5" : "border-success/25 bg-success/5"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${stale ? "text-destructive" : "text-success"}`}>
        {stale ? "⚠ " : "✓ "}{fmtRelative(lastSeen)}
      </p>
    </div>
  );
}

export default async function SystemHealthPage() {
  const data = await getSystemHealthData();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-2xl">🩺</p>
        <p className="text-sm font-medium text-heading">No data yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">System Health</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cron heartbeats inferred from delivery side effects — there&apos;s no separate cron-run log yet, so &quot;last seen&quot; means
          the most recent thing that cron actually sent.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HeartbeatPill label="Daily Digest Cron (/api/digest)" lastSeen={data.lastDigestSentAt} staleAfterHours={26} />
        <HeartbeatPill label="Notification Cron (/api/notifications/process)" lastSeen={data.lastReminderSentAt} staleAfterHours={2} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Delivery by Channel (7d)</h2>
        </CardHeader>
        <CardContent className="pt-0">
          {data.channelStats.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">No deliveries in the last 7 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3">Channel</th>
                    <th className="py-1.5 pr-3">Sent</th>
                    <th className="py-1.5 pr-3">Delivered</th>
                    <th className="py-1.5 pr-3 text-destructive">Failed</th>
                    <th className="py-1.5 text-destructive">Bounced</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channelStats.map((c) => (
                    <tr key={c.channel} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium capitalize text-heading">{c.channel}</td>
                      <td className="py-1.5 pr-3">{c.sent}</td>
                      <td className="py-1.5 pr-3">{c.delivered}</td>
                      <td className="py-1.5 pr-3 text-destructive">{c.failed}</td>
                      <td className="py-1.5 text-destructive">{c.bounced}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Recent Delivery Log</h2>
        </CardHeader>
        <CardContent className="pt-0">
          {data.recentLog.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-96 overflow-y-auto">
              {data.recentLog.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-heading">
                    {r.venueName} <span className="text-muted-foreground capitalize">· {r.channel} · {r.sourceType} · {r.status}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{fmtRelative(r.sentAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
