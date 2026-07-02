"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventsMetrics } from "@/lib/analytics/types";

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-heading tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function EventsCard({ data }: { data: EventsMetrics | null }) {
  if (!data) return (
    <Card>
      <CardHeader><CardTitle className="text-base">Events</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No data yet.</p></CardContent>
    </Card>
  );

  const maxCount = data.byMonth.length > 0 ? Math.max(...data.byMonth.map(m => m.count), 1) : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Upcoming" value={data.upcoming} />
          <StatBox label="Avg Guests" value={data.avgGuestCount > 0 ? data.avgGuestCount : "—"} />
          <StatBox label="This Month" value={data.thisMonth} />
          <StatBox label="Next Month" value={data.nextMonth} />
        </div>

        {data.byMonth.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">Next 12 months</p>
            <div className="flex items-end gap-1.5 h-16">
              {data.byMonth.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${Math.round((m.count / maxCount) * 100)}%`,
                      minHeight: "4px",
                      backgroundColor: "#5D6F5D",
                      opacity: 0.6 + (m.count / maxCount) * 0.4,
                    }}
                    title={`${m.label}: ${m.count} event${m.count !== 1 ? "s" : ""}`}
                  />
                  <p className="text-[8px] text-muted-foreground/50 leading-none">
                    {m.label.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
