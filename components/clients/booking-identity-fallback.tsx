import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BookingIdentityStatusActions } from "@/components/clients/booking-identity-status-actions";
import { ClientEventSwitcher } from "@/components/clients/client-event-switcher";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/clients/constants";
import type { ClientWithDetails } from "@/lib/clients/types";
import type { EventWithDetails } from "@/lib/events/types";
import { listEventsForClient } from "@/lib/events/service";

type Props = {
  client: ClientWithDetails;
  event: EventWithDetails;
  eventId: string;
  clientEvents: Awaited<ReturnType<typeof listEventsForClient>>;
  deferredMessage?: string;
  deferredTestId?: string;
};

/**
 * Wave 7A Suspense fallback — real booking identity/status/actions only.
 * No financial totals, invoice counts, or placeholder $0 values.
 * Cancel / Return reuse EventDetail eligibility + the same server actions.
 */
export function BookingIdentityFallback({
  client,
  event,
  eventId,
  clientEvents,
  deferredMessage = "Loading planning workspace…",
  deferredTestId = "booking-workspace-deferred-pending",
}: Props) {
  const workspaceName = clientDisplayName(
    client.firstName,
    client.lastName,
    client.partnerFirstName,
    client.partnerLastName,
  );
  const title = event.name?.trim() || workspaceName;

  return (
    <div className="space-y-5" data-testid="booking-identity-fallback">
      <ClientEventSwitcher clientId={client.id} events={clientEvents} currentEventId={eventId} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href="/clients" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Bookings
          </Button>
          <h1 className="htc-hospitality-heading font-heading text-2xl font-medium text-heading">
            {title}
          </h1>
        </div>
        <BookingIdentityStatusActions
          eventId={event.id}
          eventStatus={event.status}
          bookedAt={event.bookedAt}
          clientId={event.clientId}
          eventDate={event.eventDate}
        />
      </div>
      <div
        data-testid="event-booking-summary"
        className="htc-surface-working px-3 py-3 text-sm text-muted-foreground"
      >
        <p>
          <span className="font-medium text-heading">Event date: </span>
          {event.eventDate}
          {event.eventEndDate && event.eventEndDate !== event.eventDate
            ? ` → ${event.eventEndDate}`
            : ""}
        </p>
        <p className="mt-2" data-testid={deferredTestId}>
          {deferredMessage}
        </p>
      </div>
    </div>
  );
}
