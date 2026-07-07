"use client";

import * as React from "react";
import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { VendorDashboardVenue } from "@/lib/vendors/types";

const STATUS_LABELS: Record<string, string> = {
  active:    "Active",
  preferred: "Preferred",
  invited:   "Invited",
};

const STATUS_VARIANTS: Record<string, "default" | "outline" | "secondary"> = {
  active:    "default",
  preferred: "default",
  invited:   "outline",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function VendorVenuesList({ venues }: { venues: VendorDashboardVenue[] }) {
  if (venues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No venues yet</p>
        <p className="text-xs mt-1 text-muted-foreground">
          Venues will appear here once they add you to their vendor directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {venues.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
        >
          {/* Initials avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground border border-border">
            {v.venueName.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{v.venueName}</p>
            <p className="text-xs text-muted-foreground">
              Added {formatDate(v.addedAt)}
            </p>
          </div>

          <Badge
            variant={STATUS_VARIANTS[v.status] ?? "outline"}
            className="shrink-0 text-xs"
          >
            {STATUS_LABELS[v.status] ?? v.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
