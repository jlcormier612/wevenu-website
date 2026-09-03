import type { Metadata } from "next";

import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";

export const metadata: Metadata = { title: "New Client" };

export default async function NewClientPage() {
  const [spaces, capacityRules] = await Promise.all([getSpaces(), getCapacityRules()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Client"
        description="Record a booked client directly."
      />
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>
            Everything is editable later from the client record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientForm spaces={spaces} maxSimultaneousEvents={effectiveMaxSimultaneousEvents(capacityRules)} />
        </CardContent>
      </Card>
    </div>
  );
}
