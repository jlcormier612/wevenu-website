import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientEditForm } from "@/components/clients/client-edit-form";
import { RelationshipPhotoEditor } from "@/components/relationship-photos/relationship-photo-editor";
import { PageHeader } from "@/components/shell/module-placeholder";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName)}`}
        description={client.linkedEventId
          ? "Update this client's contact information. Event details are edited on the event."
          : "Update client information and event details."}
      />
      <Card>
        <CardHeader>
          <CardTitle>{client.linkedEventId ? "Contact information" : "Client details"}</CardTitle>
          <CardDescription>
            {client.linkedEventId
              ? "Names, email, phone, and partner. Original inquiry and source stay as they were."
              : "Changes are logged to the activity timeline."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {client.relationshipId && venue ? (
            <>
              <RelationshipPhotoEditor
                relationshipId={client.relationshipId}
                venueId={venue.id}
                initial={photo!}
                clientId={client.id}
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
