import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { BookedWorkspaceDetail } from "@/app/(app)/clients/[id]/booked-workspace-detail";
import { BookingIdentityFallback } from "@/components/clients/booking-identity-fallback";
import { DeleteClientRecordButton } from "@/components/clients/delete-client-record-button";
import { bookingCelebrationPending } from "@/lib/booking-journey/booking-celebration";
import { clientDisplayName } from "@/lib/clients/constants";
import type { ClientWithDetails } from "@/lib/clients/types";
import { getEvent, listEventsForClient } from "@/lib/events/service";
import {
  bookingFbExtra,
  bookingFbTime,
} from "@/lib/shell/booking-first-byte-timing";

type Props = {
  client: ClientWithDetails;
  eventId: string;
  clientEvents: Awaited<ReturnType<typeof listEventsForClient>>;
  setupPayments?: string;
};

/**
 * After client + events are known: celebration redirect and event identity,
 * then Wave 7A deferred workspace. Runs inside Suspense so the parent can
 * first-paint the couple name without waiting on getEvent.
 *
 * Celebration still runs before workspace reads (redirect unchanged).
 * getEvent runs in parallel with the celebration check; result is discarded
 * on redirect.
 */
export async function BookedIdentityGate({
  client,
  eventId,
  clientEvents,
  setupPayments,
}: Props) {
  const [celebrationPending, event] = await bookingFbTime(
    "identity_celebration_and_event",
    () =>
      Promise.all([bookingCelebrationPending(eventId), getEvent(eventId)]),
  );

  if (celebrationPending) {
    redirect(`/clients/${client.id}/booked?eventId=${eventId}`);
  }
  if (!event) notFound();

  bookingFbExtra("path", "booked");
  bookingFbExtra("deferred_boundary", "booked_workspace_detail");

  const workspaceName = clientDisplayName(
    client.firstName,
    client.lastName,
    client.partnerFirstName,
    client.partnerLastName,
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DeleteClientRecordButton clientId={client.id} fallbackName={workspaceName} />
      </div>
      <Suspense
        fallback={
          <BookingIdentityFallback
            client={client}
            event={event}
            eventId={eventId}
            clientEvents={clientEvents}
          />
        }
      >
        <BookedWorkspaceDetail
          client={client}
          event={event}
          eventId={eventId}
          clientEvents={clientEvents}
          setupPayments={setupPayments}
        />
      </Suspense>
    </div>
  );
}
