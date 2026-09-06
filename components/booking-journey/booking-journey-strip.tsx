"use client";

import * as React from "react";

import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingJourneyModel } from "@/lib/booking-journey/model";
import { cn } from "@/lib/utils";

export function BookingJourneyStrip({
  journey,
  onPrimaryAction,
  onSecondaryAction,
  className,
}: {
  journey: BookingJourneyModel;
  onPrimaryAction?: (action: string) => void;
  onSecondaryAction?: (action: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-4 sm:px-5", className)}>
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Booking Journey
      </p>
      <ol className="mb-4 flex flex-wrap items-center gap-1 sm:gap-2">
        {journey.stages.map((stage, i) => (
          <li key={stage.key} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && <span className="text-border px-0.5">→</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                stage.state === "complete" && "bg-primary/10 text-primary",
                stage.state === "current" && "bg-heading text-background",
                stage.state === "upcoming" && "bg-muted text-muted-foreground",
              )}
            >
              {stage.state === "complete" && <Check className="h-3 w-3" aria-hidden />}
              {stage.label}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-sm text-heading leading-relaxed">{journey.direction}</p>

      {(journey.packageSummary || journey.isCommerciallyBooked) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {journey.packageSummary}
          {journey.depositSummary && journey.remainingSummary && (
            <> · Deposit {journey.depositSummary} · Remaining {journey.remainingSummary}</>
          )}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {journey.primaryAction && onPrimaryAction ? (
          <Button type="button" size="sm" onClick={() => onPrimaryAction(journey.primaryAction!)}>
            {journey.primaryLabel}
          </Button>
        ) : journey.primaryHref ? (
          <Button type="button" size="sm" render={<Link href={journey.primaryHref} />}>
            {journey.primaryLabel}
          </Button>
        ) : null}

        {journey.secondaryAction && onSecondaryAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onSecondaryAction(journey.secondaryAction!)}
          >
            {journey.secondaryLabel}
          </Button>
        ) : journey.secondaryHref && journey.secondaryLabel ? (
          <Button type="button" size="sm" variant="outline" render={<Link href={journey.secondaryHref} />}>
            {journey.secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
