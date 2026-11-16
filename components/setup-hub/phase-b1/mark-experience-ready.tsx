"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function MarkExperienceReady({
  action,
  canConfirm,
  disabledReason,
  alreadyReady,
  resourcesReviewed,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  canConfirm: boolean;
  disabledReason?: string;
  alreadyReady: boolean;
  resourcesReviewed: boolean;
}) {
  const [checked, setChecked] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const enabled = canConfirm && resourcesReviewed && checked && !alreadyReady && !pending;

  return (
    <div className="space-y-3" data-testid="phase-b1-mark-experience-ready">
      <label className="flex items-start gap-3 text-sm text-foreground">
        <Checkbox
          checked={alreadyReady || checked}
          disabled={alreadyReady || pending || !canConfirm || !resourcesReviewed}
          onCheckedChange={(value) => setChecked(value === true)}
          data-testid="phase-b1-experience-ready-checkbox"
        />
        <span>
          I&apos;ve reviewed this experience and I&apos;m comfortable using it as the starting point
          for new events.
        </span>
      </label>
      <Button
        type="button"
        disabled={!enabled}
        data-testid="phase-b1-mark-experience-ready-button"
        onClick={() => {
          startTransition(async () => {
            const result = await action();
            if (result.ok) toast.success("Saved.");
            else toast.error(result.error ?? "Could not save that yet. Please try again.");
          });
        }}
      >
        Mark experience ready
      </Button>
      {!canConfirm && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      {canConfirm && !resourcesReviewed && !alreadyReady ? (
        <p className="text-xs text-muted-foreground">
          Look over the resources for this experience before marking it ready.
        </p>
      ) : null}
      {alreadyReady ? (
        <p className="text-xs text-muted-foreground">This experience is marked ready.</p>
      ) : null}
    </div>
  );
}
