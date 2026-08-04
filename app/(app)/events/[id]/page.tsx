import { notFound, redirect } from "next/navigation";

import { getEvent } from "@/lib/events/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The Event workspace moved under its Booking (/clients/[id]) — this route
 * now only resolves which Booking an old Event link belongs to and forwards
 * there. Query params (e.g. ?conversation= for vendor-thread deep links) are
 * forwarded; #hash (e.g. #vendors) is preserved by the browser on redirect.
 */
export default async function EventDetailRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const event = await getEvent(id);
  if (!event || !event.clientId) notFound();

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  redirect(`/clients/${event.clientId}${suffix}`);
}
