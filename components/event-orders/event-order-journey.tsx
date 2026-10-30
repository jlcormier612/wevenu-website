"use client";

/**
 * Event Order header — current step, one sentence, one primary action
 * (Booking Details pattern). Domain actions remain on ClientChoicesPanel / EventOrderPanel.
 * Action labels are always meaningful workflow verbs — never generic "View".
 */
import { Button } from "@/components/ui/button";
import type { CommercialNavTarget } from "@/lib/event-orders/commercial-status";
import {
  describeEventOrderJourney,
  type EventOrderJourneyInput,
} from "@/lib/event-orders/event-order-journey";

export function EventOrderJourney({
  input,
  onNavigate,
}: {
  input: EventOrderJourneyInput;
  onNavigate: (target: CommercialNavTarget) => void;
}) {
  const { rows, currentStep } = describeEventOrderJourney(input);
  const current = rows.find((r) => r.isCurrent) ?? rows[0]!;

  return (
    <section
      className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5"
      data-testid="event-order-journey"
      data-current-step={currentStep}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Event Order
          </h2>
          <p className="mt-1 text-sm font-medium text-heading" data-testid="event-order-journey-current-state">
            {current.title}: {current.state}
          </p>
          {current.detail ? (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="event-order-journey-current-hint">
              {current.detail}
            </p>
          ) : null}
        </div>
        {current.primaryLabel ? (
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            data-testid={`event-order-journey-primary-${current.key}`}
            onClick={() => onNavigate(current.nav)}
          >
            {current.primaryLabel}
          </Button>
        ) : null}
      </div>

      <ol className="mt-3 flex flex-wrap gap-2" data-testid="event-order-journey-rows">
        {rows.map((row, index) => (
          <li
            key={row.key}
            data-testid={`event-order-journey-row-${row.key}`}
            data-current={row.isCurrent ? "true" : "false"}
          >
            <button
              type="button"
              className={
                row.isCurrent
                  ? "rounded-full border border-heading bg-muted/40 px-3 py-1 text-xs font-medium text-heading"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
              data-testid={row.isCurrent ? undefined : `event-order-journey-goto-${row.key}`}
              aria-current={row.isCurrent ? "step" : undefined}
              onClick={() => onNavigate(row.nav)}
            >
              {index + 1}. {row.title} · {row.state}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
