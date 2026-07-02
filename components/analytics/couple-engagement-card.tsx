"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CoupleEngagement } from "@/lib/analytics/types";

function Ring({ pct, size = 64, stroke = 7, color = "#5D6F5D" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (Math.min(pct, 100) / 100) * circ}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.7s ease" }} />
    </svg>
  );
}

function RingStat({ label, pct, sub, color }: { label: string; pct: number; sub: string; color?: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Ring pct={pct} color={color} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold tabular-nums">{pct}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

export function CoupleEngagementCard({ data }: { data: CoupleEngagement | null }) {
  if (!data) return (
    <Card>
      <CardHeader><CardTitle className="text-base">Couple Engagement</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No data yet.</p></CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Couple Engagement</CardTitle>
          <span className="text-xs text-muted-foreground">{data.totalActiveClients} active clients</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <RingStat
          label="Portal Adoption"
          pct={data.portalAdoption}
          sub="of upcoming couples have portal access"
        />
        <RingStat
          label="RSVP Completion"
          pct={data.rsvpCompletionAvg}
          sub="average guest response rate"
          color="#7A8F7A"
        />

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <span className="text-2xl font-bold tabular-nums text-heading">{data.activeThisWeek}</span>
          <div>
            <p className="text-xs font-medium text-heading">Active this week</p>
            <p className="text-[11px] text-muted-foreground">couples with portal activity in last 7 days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
