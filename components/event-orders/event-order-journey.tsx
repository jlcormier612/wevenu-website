"use client";

/**
 * Event Order rows — same layout as the lead card's Booking Details:
 * Event Order → Couple approval → New charges invoice → Payment plan.
 * Each row: status, one action, Preview where the couple sees something.
 * Action labels are always meaningful workflow verbs — never generic "View".
 */
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  describeEventOrderJourney,
  type EventOrderJourneyAction,
  type EventOrderJourneyInput,
} from "@/lib/event-orders/event-order-journey";

export function EventOrderJourney({
  input,
  pendingAction = null,
  onAction,
  onPreview,
}: {
  input: EventOrderJourneyInput;
  pendingAction?: EventOrderJourneyAction | null;
  onAction: (action: EventOrderJourneyAction) => void;
  onPreview: () => void;
}) {
  const { rows, current } = describeEventOrderJourney(input);

  return (
    <section
      className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5"
      data-testid="event-order-journey"
      data-current-row={current.key}
    >
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Event Order
      </h2>
      <p className="mt-2 text-sm text-heading" data-testid="event-order-journey-current-state">
        Next step: {current.title} — {current.state}
      </p>

      <ul className="mt-4 divide-y divide-border" data-testid="event-order-journey-rows">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-2 py-3"
            data-testid={`event-order-journey-row-${row.key}`}
            data-current={row.isCurrent ? "true" : "false"}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-heading">{row.title}</p>
                <p className="text-sm text-heading" data-testid={`event-order-journey-state-${row.key}`}>{row.state}</p>
                {row.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[min(100%,20rem)] sm:justify-end">
                {row.preview ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`event-order-journey-preview-${row.key}`}
                    onClick={onPreview}
                  >
                    Preview
                  </Button>
                ) : null}
                {row.action && row.primaryLabel ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={row.isCurrent ? "default" : "outline"}
                    disabled={pendingAction === row.action}
                    data-testid={`event-order-journey-action-${row.key}`}
                    onClick={() => onAction(row.action!)}
                  >
                    {pendingAction === row.action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : row.primaryLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
