"use client";

/**
 * Venue-wide planning configuration — which planning experiences this venue
 * uses with couples and events. Lives in Settings (not Planning Templates).
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { savePlanningCapabilitiesAction } from "@/app/(app)/settings/planning-capabilities-actions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PLANNING_CAPABILITY_OPTIONS,
  type VenuePlanningCapabilities,
} from "@/lib/playbooks/capabilities";

export function PlanningCapabilitiesSection({
  initial,
}: {
  initial: VenuePlanningCapabilities;
}) {
  const router = useRouter();
  const [caps, setCaps] = React.useState(initial);
  const [pending, startSave] = React.useTransition();

  React.useEffect(() => {
    setCaps(initial);
  }, [initial]);

  function setKey(key: keyof VenuePlanningCapabilities, value: boolean) {
    setCaps((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startSave(async () => {
      const result = await savePlanningCapabilitiesAction(caps);
      if (result.ok) {
        toast.success("Planning settings saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Choose the planning tools your venue uses with couples and events.
        These settings control which planning experiences appear for your
        clients and which planning work Hello to Cheers includes for your
        events. They affect what couples see in their portal, what shows in
        Event Readiness for Timeline, Floor Plan, and Seating, and which
        related work Planning Templates can create when applied.
      </p>
      <div className="space-y-5">
        {PLANNING_CAPABILITY_OPTIONS.map((opt) => (
          <div key={opt.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <Label className="text-sm font-medium text-heading">{opt.label}</Label>
              <p className="text-sm text-muted-foreground leading-relaxed">{opt.description}</p>
            </div>
            <Switch
              checked={caps[opt.key]}
              disabled={pending}
              onCheckedChange={(v) => setKey(opt.key, v)}
              aria-label={`${opt.label} enabled`}
              className="mt-0.5 shrink-0"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save planning settings"
          )}
        </button>
      </div>
    </div>
  );
}
