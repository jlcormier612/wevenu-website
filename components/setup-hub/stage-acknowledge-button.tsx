"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Shared "yes, this is how I want to leave it" button for every Setup Hub
 * stage that has a deliberate, self-declared path alongside its "do the
 * thing" path (Your Venue/Calendar & Availability/Your Offerings/Client
 * Experience/Financials' review acknowledgment; Bring Your Business's
 * manual choice; Your People's solo choice) — one small component instead
 * of six near-identical inline handlers.
 */
export function StageAcknowledgeButton({
  action,
  label,
}: {
  action: () => Promise<{ ok: boolean }>;
  label: string;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          const result = await action();
          if (!result.ok) toast.error("Something went wrong saving that. Please try again.");
        });
      }}
    >
      {label}
    </Button>
  );
}
