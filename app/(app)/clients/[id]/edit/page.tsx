import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClientEditForm } from "@/components/clients/client-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Client not found" };
  return { title: `Edit · ${clientDisplayName(client.firstName, client.lastName)}` };
}

export default async function EditClientPage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit · ${clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName)}`}
        description="Update couple information and event details."
      />
      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>Changes are logged to the activity timeline.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientEditForm client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
