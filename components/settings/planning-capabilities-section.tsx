"use client";

/**
 * Venue-level planning capability toggles — which optional planning surfaces
 * this venue actually offers. Distinct from Planning Templates / event tasks.
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

  function setKey(key: keyof VenuePlanningCapabilities, value: boolean) {
    setCaps((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startSave(async () => {
      const result = await savePlanningCapabilitiesAction(caps);
      if (result.ok) {
        toast.success("Planning capabilities saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Turn off surfaces your venue doesn&apos;t use. Disabled capabilities won&apos;t appear in
        Event Readiness, won&apos;t show in the couple&apos;s portal, and won&apos;t create required
        tasks when you apply a Planning Template.
      </p>
      <div className="space-y-3">
        {PLANNING_CAPABILITY_OPTIONS.map((opt) => (
          <div key={opt.id} className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium text-heading">{opt.label}</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
            </div>
            <Switch
              checked={caps[opt.key]}
              disabled={pending}
              onCheckedChange={(v) => setKey(opt.key, v)}
              aria-label={`${opt.label} enabled`}
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
            "Save planning capabilities"
          )}
        </button>
      </div>
    </div>
  );
}
