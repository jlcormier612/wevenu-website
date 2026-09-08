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
 * forwarded from the server. #hash (e.g. #documents) cannot travel through
 * HTTP redirects, so we replace in the browser (inline script + client
 * fallback) and append location.hash.
 */
export default async function EventDetailRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  const search = searchParamsToQueryString(sp);
  const targetBase = `/clients/${event.clientId}${search}`;
  // Inline script runs before React hydration so /events/{id}#documents
  // never strand on the intermediate route.
  const inline = `location.replace(${JSON.stringify(targetBase)}+location.hash);`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: inline }} />
      <EventToBookingRedirect clientId={event.clientId} search={search} />
    </>
  );
}
