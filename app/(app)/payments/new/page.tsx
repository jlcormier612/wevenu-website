import type { Metadata } from "next";

import { InvoicePickerForSchedule } from "@/components/payments/invoice-picker-for-schedule";
import { NewScheduleForm } from "@/components/payments/new-schedule-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/invoices/constants";
import { getInvoice, getInvoices } from "@/lib/invoices/service";

export const metadata: Metadata = { title: "New Payment Schedule" };

type Props = { searchParams: Promise<{ invoiceId?: string }> };

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule always links
 * to an invoice (docs/booking-financial-architecture-roadmap.md). Without
 * an invoiceId, there's nothing to build a schedule from — this page shows
 * an invoice picker instead of the old free-total, client-picker form.
 */
export default async function NewPaymentPage({ searchParams }: Props) {
  const { invoiceId } = await searchParams;
  const invoice = invoiceId ? await getInvoice(invoiceId) : null;

  if (!invoice) {
    const invoices = await getInvoices({});
    return (
      <div className="space-y-6">
        <PageHeader title="New Payment Schedule" description="A payment plan always tracks a specific invoice — choose which one." />
        <Card>
          <CardHeader>
            <CardTitle>Choose an invoice</CardTitle>
            <CardDescription>Every payment plan is linked to an invoice so its total always stays accurate. Pick one, or create a new invoice first.</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoicePickerForSchedule invoices={invoices} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Payment Schedule" description="Set up the payment arrangement for this invoice." />
      <Card>
        <CardHeader>
          <CardTitle>Schedule details</CardTitle>
          <CardDescription>
            Creating a payment plan from invoice {invoice.invoiceNumber} — total {formatCurrency(invoice.total)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm linkedInvoice={invoice} />
        </CardContent>
      </Card>
    </div>
  );
}
