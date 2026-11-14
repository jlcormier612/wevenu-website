"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setFloorPlanFinalizedAction } from "@/app/(app)/events/[id]/floor-plan-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Mark Ready / Make Changes for the physical arrangement.
 * Ready locks staff and couple furniture edits. Seating stays independent.
 * Make Changes reopens physical editing and preserves approved revision history.
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
      toast.success(
        isFinalized
          ? "Make Changes — physical editing reopened. Last approved arrangement is preserved."
          : "Marked Ready — physical editing is locked for staff and couple. Seating stays separate.",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {isFinalized && <Badge variant="accent">Ready</Badge>}
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleToggle}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isFinalized ? "Make Changes" : "Mark as Ready"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground max-w-sm">
        {isFinalized
          ? "Physical layout is locked. Guest seating stays available when enabled."
          : "Marks this arrangement ready for event execution and locks furniture edits until you Make Changes."}
      </p>
    </div>
  );
}
