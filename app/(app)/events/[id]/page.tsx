import { notFound } from "next/navigation";

import { EventToBookingRedirect } from "@/components/events/event-to-booking-redirect";
import { searchParamsToQueryString } from "@/lib/events/event-booking-redirect";
import { getEvent } from "@/lib/events/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The Event workspace moved under its Booking (/clients/[id]) — this route
 * resolves which Booking an old Event link belongs to and forwards there.
 *
 * Query params (e.g. ?conversation= for vendor-thread deep links) are
 * forwarded from the server. #hash (e.g. #documents) is preserved via a
 * client-side replace — HTTP redirects cannot carry URL fragments.
 */
export default async function EventDetailRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  return (
    <EventToBookingRedirect
      clientId={event.clientId}
      search={searchParamsToQueryString(sp)}
    />
  );
}
