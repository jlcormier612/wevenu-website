"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadFunnel } from "@/lib/analytics/types";

const STAGE_COLORS = ["#5D6F5D", "#7A8F7A", "#97A897", "#B4C1B4"];

function FunnelBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-heading">{label}</span>
        <span className="tabular-nums text-muted-foreground">{count} <span className="text-muted-foreground/50">({pct}%)</span></span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function LeadFunnelCard({ data }: { data: LeadFunnel | null }) {
  if (!data) return (
    <Card>
      <CardHeader><CardTitle className="text-base">Lead Funnel</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No data yet.</p></CardContent>
    </Card>
  );

  const stages = [
    { label: "Inquiries",  count: data.total },
    { label: "Contacted",  count: data.contacted },
    { label: "Toured",     count: data.toured },
    { label: "Proposal",   count: data.proposal },
    { label: "Booked",     count: data.booked },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Lead Funnel</CardTitle>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "#5D6F5D20", color: "#3D5040" }}>
            {data.conversionRate}% close rate
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((s, i) => (
          <FunnelBar key={s.label} label={s.label} count={s.count} total={data.total} color={STAGE_COLORS[Math.min(i, STAGE_COLORS.length - 1)]} />
        ))}

        {data.total > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{data.lost} lost</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        {data.bySource.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">By Source</p>
            {data.bySource.slice(0, 5).map(s => (
              <div key={s.source} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 capitalize truncate text-muted-foreground">
                  {s.source.replace(/_/g, " ")}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${s.total > 0 ? Math.round(s.total / data.total * 100) : 0}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-muted-foreground/70">{s.total}</span>
                <span className="w-10 text-right tabular-nums text-[10px] font-medium" style={{ color: "#5D6F5D" }}>{s.rate}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
