import type { Metadata } from "next";

import { NewScheduleForm } from "@/components/payments/new-schedule-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/clients/service";

export const metadata: Metadata = { title: "New Payment Schedule" };

export default async function NewPaymentPage() {
  const clients = await getClients();
  return (
    <div className="space-y-6">
      <PageHeader title="New Payment Schedule" description="Set up the payment arrangement for a client." />
      <Card>
        <CardHeader>
          <CardTitle>Schedule details</CardTitle>
          <CardDescription>Choose a preset to generate line items automatically, or start custom.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
