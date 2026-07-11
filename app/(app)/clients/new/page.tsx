import type { Metadata } from "next";

import { ClientForm } from "@/components/clients/client-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Client" };

export default function NewClientPage() {
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
          <ClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
