import { notFound } from "next/navigation";

import { ClientPortalPreview } from "@/components/events/client-portal-preview";
import { loadClientPortalPreview } from "@/lib/client-portal-preview/load-preview";
import { getClient } from "@/lib/clients/service";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ event?: string }>;
};

/**
 * Staff read-only preview of the couple's event-specific portal experience.
 * Does not use a portal invite token, does not release/invite/mutate.
 */
export default async function ClientPortalPreviewPage({ params, searchParams }: Props) {
  const { id: clientId } = await params;
  const sp = await searchParams;
  const client = await getClient(clientId);
  if (!client) notFound();

  let eventId = sp.event?.trim() || client.linkedEventId || null;
  if (!eventId) {
    const venue = await getCurrentVenue();
    if (!venue) notFound();
    const supabase = await createClient();
    const { data: eventRow } = await supabase
      .from("events")
      .select("id")
      .eq("client_id", clientId)
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();
    eventId = eventRow?.id ?? null;
  }
  if (!eventId) notFound();

  const data = await loadClientPortalPreview(clientId, eventId);
  if (!data) notFound();

  return <ClientPortalPreview data={data} />;
}
