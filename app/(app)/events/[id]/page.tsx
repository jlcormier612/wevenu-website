import { notFound, redirect } from "next/navigation";

import { getEvent } from "@/lib/events/service";

type Props = { params: Promise<{ id: string }> };

/**
 * The Event workspace moved under its Booking (/clients/[id]) — this route
 * now only resolves which Booking an old Event link belongs to and forwards
 * there. Any #hash (e.g. #vendors) on the original URL is preserved by the
 * browser automatically, since the redirect target doesn't specify its own
 * fragment.
 */
export default async function EventDetailRedirectPage({ params }: Props) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();
  redirect(`/clients/${event.clientId}`);
}
