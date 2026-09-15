"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";

/**
 * Restrained Dashboard Luv card — interpretation only, not a second task list.
 * Optional dismiss: recommendation dismiss persists; other entries hide for the session.
 */
export function DashboardLuvEntryCard({ entry }: { entry: LuvDashboardEntry }) {
  const [hidden, setHidden] = React.useState(false);
  if (hidden) return null;

  async function dismiss() {
    setHidden(true);
    if (entry.dismissRecommendationId) {
      await fetch(`/api/recommendations/${entry.dismissRecommendationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      }).catch(() => undefined);
    }
  }

  return (
    <section>
      <Card className="border-rose-200/40" style={{ background: "color-mix(in oklch, var(--destructive) 2%, var(--card))" }}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span aria-hidden>💗</span> Luv
            </CardTitle>
            <button
              type="button"
              onClick={() => void dismiss()}
              aria-label="Dismiss Luv note"
              className="rounded-md p-1 text-muted-foreground transition-opacity hover:opacity-70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <p className="text-sm text-foreground">{entry.message}</p>
          {entry.suggestion && (
            <p className="text-sm text-muted-foreground">{entry.suggestion}</p>
          )}
          <Link
            href={entry.actionHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {entry.actionLabel}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
