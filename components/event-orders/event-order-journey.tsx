"use client";

/**
 * Stage 0 — Booking Details–style Event Order journey (one primary progress UI).
 * Domain actions remain on ClientChoicesPanel / EventOrderPanel.
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
        Client selections → Event Order → Invoice & payments. Same progression pattern as
        Package/Proposal → Contract → Invoice. Inventory stays on its own card and tab.
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
                {row.primaryLabel ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={row.isCurrent ? "default" : "outline"}
                    data-testid={
                      row.isCurrent
                        ? `event-order-journey-primary-${row.key}`
                        : `event-order-journey-goto-${row.key}`
                    }
                    onClick={() => onNavigate(row.nav)}
                  >
                    {row.primaryLabel}
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
