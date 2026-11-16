"use client";

import * as React from "react";
import { toast } from "sonner";

const subscribeNever = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

export function ReviewExperienceResources({
  action,
  alreadyReviewed,
  disabled,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  alreadyReviewed: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(alreadyReviewed);
  const reviewed = alreadyReviewed || saved;
  const hydrated = React.useSyncExternalStore(subscribeNever, clientTrue, serverFalse);

  function persist() {
    if (reviewed || pending || disabled) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(true);
        toast.success("Saved.");
      } else {
        toast.error(result.error ?? "Could not save that yet. Please try again.");
      }
    });
  }

  return (
    <div
      className="space-y-1"
      data-testid="phase-b1-resources-review"
      data-hydrated={hydrated ? "true" : "false"}
    >
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 rounded border border-input accent-[var(--heritage-sage)]"
          checked={reviewed}
          disabled={reviewed || pending || disabled}
          onChange={(event) => {
            if (event.target.checked) persist();
          }}
          data-testid="phase-b1-resources-review-checkbox"
        />
        <span>
          I&apos;ve looked over the resources for this experience.
          <span className="mt-1 block text-sm text-muted-foreground">
            You don&apos;t need to change anything unless you&apos;d like to.
          </span>
        </span>
      </label>
    </div>
  );
}
