import type { Metadata } from "next";

import { NewScheduleForm } from "@/components/payments/new-schedule-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getClients } from "@/lib/clients/service";
import { getInvoice } from "@/lib/invoices/service";

export const metadata: Metadata = { title: "New Payment Schedule" };

type Props = { searchParams: Promise<{ invoiceId?: string; clientId?: string; amount?: string }> };

export default async function NewPaymentPage({ searchParams }: Props) {
  const { invoiceId, clientId, amount } = await searchParams;
  const [clients, invoice] = await Promise.all([
    getClients(),
    invoiceId ? getInvoice(invoiceId) : Promise.resolve(null),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="New Payment Schedule" description="Set up the payment arrangement for a client." />
      <Card>
        <CardHeader>
          <CardTitle>Schedule details</CardTitle>
          <CardDescription>
            {invoice
              ? `Creating payment plan from invoice ${invoice.invoiceNumber} — total ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(invoice.total)}.`
              : "Choose a preset to generate line items automatically, or start custom."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm
            clients={clients}
            linkedInvoice={invoice}
            prefillClientId={clientId}
            prefillAmount={amount}
          />
        </CardContent>
      </Card>
    </div>
  );
}
