"use client";

/**
 * Stage 0 — Booking Details–style Event Order journey (one primary progress UI).
 * Domain actions remain on ClientChoicesPanel / EventOrderPanel.
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

  return (
    <section
      className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5"
      data-testid="event-order-journey"
      data-current-step={currentStep}
    >
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Event Order
      </h2>
      <p className="mt-2 text-sm font-medium text-heading">Commercial journey for this booked event</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        Build selectable packets and fixed lines, open the request in the couple&apos;s portal, apply
        their response to the Event Order, share the final document, then invoice. Inventory stays on
        its own card and tab — not part of this billable path.
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
                <p className="text-sm text-heading">{row.state}</p>
                {row.detail ? (
                  <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{row.detail}</p>
                ) : null}
                {row.isCurrent ? (
                  <p className="mt-1 text-xs font-medium text-heading" data-testid="event-order-journey-current-hint">
                    Current step
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-[min(100%,20rem)] sm:justify-end">
                {row.isCurrent && row.primaryLabel ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid={`event-order-journey-primary-${row.key}`}
                    onClick={() => onNavigate(row.nav)}
                  >
                    {row.primaryLabel}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`event-order-journey-goto-${row.key}`}
                    onClick={() => onNavigate(row.nav)}
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
