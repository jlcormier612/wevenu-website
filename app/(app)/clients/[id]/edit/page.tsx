import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientEditForm } from "@/components/clients/client-edit-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { RelationshipPhotoEditor } from "@/components/relationship-photos/relationship-photo-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { resolveVenueFacingPhoto } from "@/lib/relationship-photos/model";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Client not found" };
  return { title: `Edit · ${clientDisplayName(client.firstName, client.lastName)}` };
}

export default async function EditClientPage({ params }: Props) {
  const { id } = await params;
  const [client, venue] = await Promise.all([getClient(id), getCurrentVenue()]);
  if (!client) notFound();

  const photo = client.relationshipId
    ? await getRelationshipPhotoForVenue(client.relationshipId)
    : resolveVenueFacingPhoto({
        venuePhotoUrl: null,
        clientPhotoUrl: null,
        clientPhotoShared: false,
        venueDisplaySource: "none",
      });

  const displayName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-5" data-htc-phase12="client-edit">
      <CollectionBackLink href={`/clients/${client.id}`} label={displayName} />
      <div className="min-w-0 space-y-1" data-testid="client-edit-heading">
        <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
          Edit contact
        </h1>
        <p className="text-sm text-muted-foreground">
          {client.linkedEventId
            ? "Update names, email, and phone. Event details stay on the booking."
            : "Update client information and event details."}
        </p>
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="space-y-1 py-3">
          <CardTitle className="text-base">
            {client.linkedEventId ? "Contact information" : "Client details"}
          </CardTitle>
          <CardDescription className="text-sm">
            {client.linkedEventId
              ? "Person 1 / Person 2 fields below. Original inquiry and source stay as they were."
              : "Changes are logged to the activity timeline."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-4">
          {client.relationshipId && venue ? (
            <>
              <RelationshipPhotoEditor
                relationshipId={client.relationshipId}
                venueId={venue.id}
                initial={photo!}
                clientId={client.id}
                compact
              />
              <Separator />
            </>
          ) : null}
          <ClientEditForm client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
