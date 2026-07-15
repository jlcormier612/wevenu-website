import type { Metadata } from "next";

import { NewContractForm } from "@/components/contracts/new-contract-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/clients/service";
import { getTemplates } from "@/lib/contracts/service";
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_DESCRIPTION } from "@/lib/contracts/constants";

export const metadata: Metadata = { title: "New Contract" };

export default async function NewContractPage() {
  const [templates, clients] = await Promise.all([getTemplates(), getClients()]);

  // If venue has no templates yet, seed the default for them
  const displayTemplates = templates.length > 0
    ? templates
    : [{ id: "__default__", venueId: "", name: DEFAULT_TEMPLATE_NAME, description: DEFAULT_TEMPLATE_DESCRIPTION,
         content: DEFAULT_TEMPLATE_CONTENT, isDefault: true, isArchived: false, createdAt: "", updatedAt: "" }];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contract"
        description="Generate a contract from a template and send it for signing."
      />
      <Card>
        <CardHeader>
          <CardTitle>Contract setup</CardTitle>
          <CardDescription>
            Select a template and client, then apply merge fields to auto-fill the details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewContractForm templates={displayTemplates} clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
