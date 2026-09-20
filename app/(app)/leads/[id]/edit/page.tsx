import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { RelationshipPhotoEditor } from "@/components/relationship-photos/relationship-photo-editor";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";
import { resolveVenueFacingPhoto } from "@/lib/relationship-photos/model";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return { title: "Lead not found" };
  return {
    title: `Edit · ${leadDisplayName(lead.firstName, lead.lastName)}`,
  };
}

export default async function EditLeadPage({ params }: Props) {
  const { id } = await params;
  const [lead, venue] = await Promise.all([getLead(id), getCurrentVenue()]);
  if (!lead) notFound();

  const photo = lead.relationshipId
    ? await getRelationshipPhotoForVenue(lead.relationshipId)
    : resolveVenueFacingPhoto({
        venuePhotoUrl: null,
        clientPhotoUrl: null,
        clientPhotoShared: false,
        venueDisplaySource: "none",
      });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}`}
        description="Update the contact information and event details for this lead."
      />
      <Card>
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
          <CardDescription>
            Changes are saved immediately and logged to the activity timeline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {lead.relationshipId && venue ? (
            <>
              <RelationshipPhotoEditor
                relationshipId={lead.relationshipId}
                venueId={venue.id}
                initial={photo!}
                leadId={lead.id}
              />
              <Separator />
            </>
          ) : null}
          <LeadEditForm lead={lead} />
        </CardContent>
      </Card>
    </div>
  );
}
