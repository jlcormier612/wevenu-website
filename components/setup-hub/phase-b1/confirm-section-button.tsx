"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ConfirmSectionButton({
  action,
  label,
  disabled,
  disabledReason,
  testId,
  variant = "default",
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        disabled={disabled || pending}
        data-testid={testId}
        onClick={() => {
          startTransition(async () => {
            const result = await action();
            if (result.ok) toast.success("Saved.");
            else toast.error(result.error ?? "Could not save that yet. Please try again.");
          });
        }}
      >
        {label}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
