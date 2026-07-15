"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { FloorPlanSectionReconciliation } from "@/lib/floor-plans/types";

/**
 * Phase 4 — the same calm, non-alarming register as the Event Order drift
 * banner (components/invoices/event-order-drift-banner.tsx). A Floor Plan
 * disagreeing with its linked Section's committed quantities is normal, not
 * an error — placement is never blocked here, and nothing in this component
 * writes to either side. Purely a live, fact-based comparison (matched only
 * by shared inventory_item_id, never guessed from labels/descriptions),
 * recomputed fresh every time this page loads. "Dismiss for now" only hides
 * it for this viewing — there's no stored drift record to persist a
 * dismissal against, unlike the Invoice case, since this is never anything
 * but a live comparison. See
 * docs/booking-financial-architecture-phase4-floor-plan-design.md §4-5.
 */
export function FloorPlanReconciliationBanner({
  reconciliation,
}: {
  reconciliation: FloorPlanSectionReconciliation[];
}) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed || reconciliation.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-4">
      {reconciliation.map((section) => {
        const missing = section.items.filter((i) => i.placed === 0);
        const extra = section.items.filter((i) => i.committed === 0);
        const changed = section.items.filter((i) => i.placed > 0 && i.committed > 0);
        return (
          <div key={section.sectionId} className="space-y-2">
            <p className="text-sm font-medium text-heading">
              &ldquo;{section.sectionName}&rdquo; and this floor plan don&apos;t agree on everything.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {missing.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing from this floor plan</p>
                  {missing.map((i) => (
                    <div key={i.inventoryItemId} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <p className="text-foreground">{i.itemName}</p>
                      <p className="text-xs text-muted-foreground">Event Order commits {i.committed}, none placed</p>
                    </div>
                  ))}
                </div>
              )}
              {extra.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extra on this floor plan</p>
                  {extra.map((i) => (
                    <div key={i.inventoryItemId} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <p className="text-foreground">{i.itemName}</p>
                      <p className="text-xs text-muted-foreground">{i.placed} placed, not committed on this Section</p>
                    </div>
                  ))}
                </div>
              )}
              {changed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changed</p>
                  {changed.map((i) => (
                    <div key={i.inventoryItemId} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <p className="text-foreground">{i.itemName}</p>
                      <p className="text-xs text-muted-foreground">Committed {i.committed} → Placed {i.placed}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Placement isn&apos;t affected either way. Update whichever side is out of date when you&apos;re ready — this just makes the difference visible.
      </p>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>Dismiss for now</Button>
      </div>
    </div>
  );
}
