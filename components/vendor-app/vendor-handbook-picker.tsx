"use client";

import * as React from "react";
import { Building2 } from "lucide-react";

import { VendorHandbookView } from "@/components/vendor-app/vendor-handbook-view";
import type { VendorHandbook } from "@/lib/vendor-handbook/service";

/** Most vendors work with one venue and skip straight to its handbook; a multi-venue vendor picks. */
export function VendorHandbookPicker({ handbooks }: { handbooks: VendorHandbook[] }) {
  const [selected, setSelected] = React.useState<string | null>(handbooks.length === 1 ? handbooks[0].venue.id : null);

  if (handbooks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No venue information yet</p>
        <p className="text-xs text-muted-foreground mt-1">Once you&apos;re booked for an event, that venue&apos;s details will appear here.</p>
      </div>
    );
  }

  const active = handbooks.find((h) => h.venue.id === selected) ?? null;

  return (
    <div className="space-y-4">
      {handbooks.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {handbooks.map((h) => (
            <button
              key={h.venue.id}
              type="button"
              onClick={() => setSelected(h.venue.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                selected === h.venue.id
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {h.venue.name}
            </button>
          ))}
        </div>
      )}
      {active ? <VendorHandbookView handbook={active} /> : (
        <p className="text-sm text-muted-foreground py-8 text-center">Choose a venue above.</p>
      )}
    </div>
  );
}
