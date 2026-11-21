import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ClientEventSwitcher } from "@/components/clients/client-event-switcher";
import { Button } from "@/components/ui/button";
import { clientDisplayName } from "@/lib/clients/constants";
import type { ClientWithDetails } from "@/lib/clients/types";
import { listEventsForClient } from "@/lib/events/service";

type Props = {
  client: ClientWithDetails;
  eventId: string;
  clientEvents: Awaited<ReturnType<typeof listEventsForClient>>;
};

/**
 * Thinner booked first paint — couple name + event switcher only.
 * No Cancel / Return / status actions until event identity has loaded
 * (those stay on BookingIdentityFallback after getEvent).
 */
export function BookingClientNameFallback({ client, eventId, clientEvents }: Props) {
  const workspaceName = clientDisplayName(
    client.firstName,
    client.lastName,
    client.partnerFirstName,
    client.partnerLastName,
  );

  return (
    <div
      className="space-y-5"
      data-testid="booking-client-name-fallback"
      data-booking-identity="name-only"
    >
      <ClientEventSwitcher clientId={client.id} events={clientEvents} currentEventId={eventId} />
      <div className="space-y-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          render={<Link href="/clients" />}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Bookings
        </Button>
        <h1 className="htc-hospitality-heading font-heading text-2xl font-medium text-heading">
          {workspaceName}
        </h1>
      </div>
      <div className="htc-surface-working px-3 py-3 text-sm text-muted-foreground">
        <p data-testid="booking-workspace-name-pending">Loading booking…</p>
      </div>
    </div>
  );
}
