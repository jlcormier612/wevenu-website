import type { Metadata } from "next";

import { NewContractForm } from "@/components/contracts/new-contract-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/clients/service";
import { getSelectedPackage } from "@/lib/commercial-selections/service";
import { getClientContacts } from "@/lib/contacts/service";
import { getTemplates } from "@/lib/contracts/service";
import { DEFAULT_TEMPLATE_CONTENT, DEFAULT_TEMPLATE_NAME, DEFAULT_TEMPLATE_DESCRIPTION } from "@/lib/contracts/constants";
import type { ClientContact } from "@/lib/contacts/types";

export const metadata: Metadata = { title: "New Contract" };

type Props = {
  searchParams: Promise<{
    templateId?: string;
    selectionId?: string;
    clientId?: string;
    eventId?: string;
  }>;
};

export default async function NewContractPage({ searchParams }: Props) {
  const [{ templateId, selectionId, clientId, eventId }, templates, clients] = await Promise.all([
    searchParams,
    getTemplates(),
    getClients(),
  ]);

  const selection = selectionId ? await getSelectedPackage(selectionId) : null;

  const contactsByClientId: Record<string, ClientContact[]> = {};
  await Promise.all(clients.map(async (c) => {
    contactsByClientId[c.id] = await getClientContacts(c.id);
  }));

  const displayTemplates = templates.length > 0
    ? templates
    : [{ id: "__default__", venueId: "", name: DEFAULT_TEMPLATE_NAME, description: DEFAULT_TEMPLATE_DESCRIPTION,
         content: DEFAULT_TEMPLATE_CONTENT, isDefault: true, isArchived: false, sourceMasterKey: null, createdAt: "", updatedAt: "" }];

  const resolvedClientId = clientId || selection?.clientId || undefined;
  const resolvedEventId = eventId || selection?.eventId || undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Contract"
        description={
          selection
            ? `Create a contract from ${selection.name}. Package details will be filled in automatically.`
            : "Generate a contract from a template and send it for signing."
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Contract setup</CardTitle>
          <CardDescription>
            Select a template and client, then apply merge fields to auto-fill the details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewContractForm
            templates={displayTemplates}
            clients={clients}
            initialTemplateId={templateId}
            contactsByClientId={contactsByClientId}
            initialClientId={resolvedClientId}
            initialEventId={resolvedEventId}
            selectionId={selection?.id}
            selectionSummary={
              selection
                ? {
                    name: selection.name,
                    totalAmount: selection.totalAmount,
                    depositAmount: selection.depositAmount,
                  }
                : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
