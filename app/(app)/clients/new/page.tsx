import type { Metadata } from "next";

import { ClientForm } from "@/components/clients/client-form";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";

export const metadata: Metadata = { title: "New Client" };

export default async function NewClientPage() {
  const [spaces, capacityRules] = await Promise.all([getSpaces(), getCapacityRules()]);
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="client-new">
      <CollectionBackLink href="/clients" label="Clients" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="New Client"
          description="Record a booked client directly."
        />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Client details</CardTitle>
          <CardDescription>
            Everything is editable later from the client record.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <ClientForm spaces={spaces} maxSimultaneousEvents={effectiveMaxSimultaneousEvents(capacityRules)} />
        </CardContent>
      </Card>
    </div>
  );
}
