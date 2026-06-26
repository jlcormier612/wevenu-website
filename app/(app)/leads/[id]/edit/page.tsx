import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";

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
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${leadDisplayName(lead.firstName, lead.lastName, lead.partnerFirstName, lead.partnerLastName)}`}
        description="Update the contact information and event details for this inquiry."
      />
      <Card>
        <CardHeader>
          <CardTitle>Inquiry details</CardTitle>
          <CardDescription>
            Changes are saved immediately and logged to the activity timeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadEditForm lead={lead} />
        </CardContent>
      </Card>
    </div>
  );
}
