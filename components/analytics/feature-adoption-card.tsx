"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { FeatureAdoption } from "@/lib/analytics/types";

type AdoptionRow = {
  label: string;
  key: keyof Omit<FeatureAdoption, "totalActiveEvents">;
  note?: string;
  color?: string;
};

const ROWS: AdoptionRow[] = [
  { label: "Wedding Website published", key: "websitePublished", note: "% with public site live",        color: "#5D6F5D" },
  { label: "Wedding Website started",   key: "websiteStarted",   note: "% who opened website builder",  color: "#7A8F7A" },
  { label: "Guest list started",        key: "guestsAdded",      note: "% with at least 1 guest",       color: "#5D6F5D" },
  { label: "Budget configured",         key: "budgetConfigured", note: "% with a total budget set",     color: "#7A8F7A" },
  { label: "Seating chart started",     key: "seatingStarted",   note: "% with a seating arrangement",  color: "#5D6F5D" },
  { label: "Vendors linked",            key: "vendorsLinked",    note: "% with ≥1 vendor assignment",   color: "#7A8F7A" },
  { label: "Documents uploaded",        key: "documentsUploaded",note: "% with files in Documents tab", color: "#5D6F5D" },
  { label: "Planning Playbook active",  key: "playbooksActive",  note: "% with tasks from a playbook",  color: "#7A8F7A" },
];

export function FeatureAdoptionCard({ data }: { data: FeatureAdoption | null }) {
  if (!data) return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feature Adoption</CardTitle>
        <CardDescription>Which platform capabilities active clients are using.</CardDescription>
      </CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No data yet.</p></CardContent>
    </Card>
  );

  const n = data.totalActiveEvents;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Feature Adoption</CardTitle>
            <CardDescription className="mt-0.5">Which capabilities active clients are using — the signals that predict long-term value.</CardDescription>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{n} active event{n !== 1 ? "s" : ""}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {ROWS.map(row => {
            const count = (data[row.key] as number) ?? 0;
            const pct   = n > 0 ? Math.round((count / n) * 100) : 0;
            return (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-heading">{row.label}</span>
                  <span className="tabular-nums font-semibold" style={{ color: row.color }}>
                    {count} <span className="font-normal text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: row.color ?? "#5D6F5D" }}
                  />
                </div>
                {row.note && <p className="text-[10px] text-muted-foreground/60">{row.note}</p>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
