import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/components/clients/client-detail";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { getDocuments } from "@/lib/documents/service";
import { getInvoicesForClient } from "@/lib/invoices/service";
import { getThreadsForEntity } from "@/lib/messaging/service";
import { getClientDrafts } from "@/lib/luv/client-drafts";
import { computeEventReadiness } from "@/lib/luv/event-readiness";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Client not found" };
  return { title: clientDisplayName(client.firstName, client.lastName) };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const [client, invoices, documents, threads, luvDrafts] = await Promise.all([
    getClient(id), getInvoicesForClient(id), getDocuments("client", id),
    getThreadsForEntity("client", id), getClientDrafts(id),
  ]);
  if (!client) notFound();

  // Compute event readiness (Planning Progress)
  const venue = await getCurrentVenue();
  const supabase = await createClient();
  const readiness = venue
    ? await computeEventReadiness(supabase, venue.id, id).catch(() => null)
    : null;

  // Fetch questionnaire for the client's linked event (for Messages shortcut)
  const questionnaire = client.linkedEventId
    ? await getQuestionnaire(client.linkedEventId).catch(() => null)
    : null;

  return <ClientDetail client={client} invoices={invoices} documents={documents} threads={threads} luvDrafts={luvDrafts} readiness={readiness} questionnaire={questionnaire} />;
}
