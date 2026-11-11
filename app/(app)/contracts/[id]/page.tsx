import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { captureContractBrandingSnapshot } from "@/lib/contracts/branding";
import { ContractDetail } from "@/components/contracts/contract-detail";
import { getContractDetail, getContractVersionFamily } from "@/lib/contracts/service";
import { isContractFinalized } from "@/lib/contracts/document-integration";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { getClient } from "@/lib/clients/service";
import { getClientContacts } from "@/lib/contacts/service";
import { getEvent } from "@/lib/events/service";
import type { Client } from "@/lib/clients/types";
import type { ClientContact } from "@/lib/contacts/types";
import { getContextualObservationsForRecord } from "@/lib/luv/contextual-record";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string; returnTo?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contract = await getContractDetail(id);
  return { title: contract?.title ?? "Contract" };
}

export default async function ContractDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { review, returnTo: returnToRaw } = await searchParams;
  const [contract, venue, versionFamily] = await Promise.all([
    getContractDetail(id),
    getCurrentVenue(),
    getContractVersionFamily(id),
  ]);
  if (!contract) notFound();
  const supabase = await createClient();
  const finalized = await isContractFinalized(supabase, id);

  let draftClients: Client[] = [];
  let contactsByClientId: Record<string, ClientContact[]> = {};
  if (contract.status === "draft" && contract.clientId) {
    const client = await getClient(contract.clientId);
    if (client) {
      draftClients = [client];
      contactsByClientId[client.id] = await getClientContacts(client.id);
    }
  }

  // Lead journey context: Fully Executed ≠ Booked. Prefer lead workspace until booked_at.
  let leadId: string | null = null;
  let relationshipBooked = false;
  if (contract.clientId) {
    const client = draftClients[0] ?? (await getClient(contract.clientId));
    leadId = client?.leadId ?? null;
  }
  if (contract.eventId) {
    const event = await getEvent(contract.eventId);
    relationshipBooked = Boolean(event?.bookedAt);
  }

  const contextualObservations = venue
    ? await getContextualObservationsForRecord(venue.id, venue.timezone, {
        contractId: contract.id,
        eventId: contract.eventId ?? undefined,
        clientId: contract.clientId ?? undefined,
      })
    : [];

  return (
    <ContractDetail
      contract={contract}
      finalized={finalized}
      venueName={venue?.name ?? "Your venue"}
      venueTimezone={venue?.timezone ?? null}
      venueBrand={venue ? captureContractBrandingSnapshot(venue) : null}
      versionFamily={versionFamily}
      initialReview={review === "1"}
      draftClients={draftClients}
      contactsByClientId={contactsByClientId}
      contextualObservations={contextualObservations}
      returnTo={returnToRaw ?? null}
      leadId={leadId}
      relationshipBooked={relationshipBooked}
    />
  );
}
