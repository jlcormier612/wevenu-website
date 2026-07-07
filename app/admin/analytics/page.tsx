import type { Metadata } from "next";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getHqAnalytics } from "@/lib/hq/analytics-service";

export const metadata: Metadata = { title: "Analytics — Wevenu HQ" };

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold font-heading text-heading">{value}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const data = await getHqAnalytics();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-2xl">📈</p>
        <p className="text-sm font-medium text-heading">No data yet</p>
      </div>
    );
  }

  const maxCount = Math.max(1, ...data.phaseDistribution.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Cohort-wide adoption and activity, derived from the same data as the Beta Command Center.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Venues" value={String(data.totalVenues)} />
        <StatCard label="Active Today" value={String(data.activeToday)} />
        <StatCard label="Active This Week" value={String(data.activeThisWeek)} />
        <StatCard label="Portal Adoption" value={`${data.portalAdoptionPct}%`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Activation Distribution</h2>
          <p className="text-xs text-muted-foreground">How many beta venues are in each phase.</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {data.phaseDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">No venues yet.</p>
          ) : (
            data.phaseDistribution.map((d) => (
              <div key={d.phaseLabel} className="flex items-center gap-3 text-xs">
                <span className="w-40 shrink-0 text-muted-foreground">{d.phaseLabel}</span>
                <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right font-semibold text-heading">{d.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <h2 className="font-heading text-sm font-semibold text-heading">Feature Adoption</h2>
          <p className="text-xs text-muted-foreground">Percent of beta venues who have used each feature at least once.</p>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-3 gap-3">
          <StatCard label="Team Invited" value={`${data.teamAdoptionPct}%`} />
          <StatCard label="Vendor Invited" value={`${data.vendorAdoptionPct}%`} />
          <StatCard label="Data Imported" value={`${data.importAdoptionPct}%`} />
        </CardContent>
      </Card>
    </div>
  );
}
