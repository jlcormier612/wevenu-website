"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentsMetrics } from "@/lib/analytics/types";

function dollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)    return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function PaymentsCard({ data }: { data: PaymentsMetrics | null }) {
  if (!data) return (
    <Card>
      <CardHeader><CardTitle className="text-base">Payments</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No data yet.</p></CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Payments</CardTitle>
          {data.overdueCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#DC6A6A15", color: "#DC6A6A" }}>
              <AlertTriangle className="h-3 w-3" />
              {data.overdueCount} overdue
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Collected</span>
            <span className="font-semibold tabular-nums">{data.completionRate}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${data.completionRate}%`, backgroundColor: "#5D6F5D" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{dollars(data.totalCollected)} collected</span>
            <span>{dollars(data.totalBilled)} total billed</span>
          </div>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Outstanding</p>
            <p className="text-xl font-bold text-heading tabular-nums">{dollars(data.totalOutstanding)}</p>
          </div>
          <div className="rounded-xl px-4 py-3"
            style={data.totalOverdue > 0
              ? { background: "#DC6A6A10", border: "1px solid #DC6A6A30" }
              : { background: "rgba(0,0,0,0.03)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Overdue</p>
            <p className="text-xl font-bold tabular-nums"
              style={{ color: data.totalOverdue > 0 ? "#DC6A6A" : "inherit" }}>
              {dollars(data.totalOverdue)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
