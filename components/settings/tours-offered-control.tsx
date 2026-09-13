"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateTourSettingsAction } from "@/app/(app)/settings/tour-actions";

/**
 * Tours offered / Not offered — lives on Availability & Capacity so Setup
 * Calendar & Availability can decide this without opening Lead Capture.
 * Reuses venues.tour_scheduling_enabled (no parallel setting).
 */
export function ToursOfferedControl({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  function onChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await updateTourSettingsAction({ tourSchedulingEnabled: next });
      if (result.ok) {
        toast.success(next ? "Tours are offered for online booking." : "Tours marked as Not offered.");
        router.refresh();
      } else {
        setEnabled(!next);
        toast.error("Could not update tour offering.");
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">Offer online tours</Label>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Couples can book tours online against Tour Availability below."
            : "Not offered — a complete answer. Tour Availability hours below only matter if you turn this on later."}
        </p>
      </div>
      <Switch checked={enabled} disabled={pending} onCheckedChange={onChange} aria-label="Offer online tours" />
    </div>
  );
}
