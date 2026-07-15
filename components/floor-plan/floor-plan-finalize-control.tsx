"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setFloorPlanFinalizedAction } from "@/app/(app)/events/[id]/floor-plan-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Phase 4's print-ready checkpoint — mirrors the Event Order panel's own
 * Finalize/Reopen control exactly (components/event-orders/event-order-panel.tsx).
 * Reversible, and never gates placement editing before, during, or after —
 * this is a coordinator's own checkpoint, not a lock.
 */
export function FloorPlanFinalizeControl({
  planId, eventId, finalizedAt,
}: {
  planId: string; eventId: string; finalizedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isFinalized = finalizedAt !== null;

  function handleToggle() {
    startTransition(async () => {
      const result = await setFloorPlanFinalizedAction(planId, eventId, !isFinalized);
      if (!result.ok) { toast.error(result.message ?? "Could not update this floor plan."); return; }
      toast.success(isFinalized ? "Reopened." : "Marked final.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isFinalized && <Badge variant="accent">Final</Badge>}
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleToggle}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFinalized ? "Reopen" : "Mark Final"}
      </Button>
    </div>
  );
}
