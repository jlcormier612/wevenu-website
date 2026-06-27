import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewInvoiceForm } from "@/components/invoices/new-invoice-form";
import { getClients } from "@/lib/clients/service";

export const metadata: Metadata = { title: "New Invoice" };

type Props = { searchParams: Promise<{ clientId?: string; eventId?: string }> };

export default async function NewInvoicePage({ searchParams }: Props) {
  const { clientId, eventId } = await searchParams;
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create an invoice for a client. Add line items after creation." />
      <Card>
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
          <CardDescription>You can add line items and packages after the invoice is created.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewInvoiceForm clients={clients} prefillClientId={clientId} prefillEventId={eventId} />
        </CardContent>
      </Card>
    </div>
  );
}
