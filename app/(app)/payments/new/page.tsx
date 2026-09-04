import type { Metadata } from "next";

import { InvoicePickerForSchedule } from "@/components/payments/invoice-picker-for-schedule";
import { NewScheduleForm } from "@/components/payments/new-schedule-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/invoices/constants";
import { getInvoice, getInvoices } from "@/lib/invoices/service";

export const metadata: Metadata = { title: "New payment schedule" };

type Props = { searchParams: Promise<{ invoiceId?: string; preset?: string }> };

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule always links
 * to an invoice. Without an invoiceId, show the invoice picker.
 */
export default async function NewPaymentPage({ searchParams }: Props) {
  const { invoiceId, preset } = await searchParams;
  const invoice = invoiceId ? await getInvoice(invoiceId) : null;

  if (!invoice) {
    const invoices = await getInvoices({});
    return (
      <div className="space-y-6">
        <PageHeader
          title="New payment schedule"
          description="A payment schedule is the real installment plan for one couple’s invoice — pick which invoice it belongs to."
        />
        <Card>
          <CardHeader>
            <CardTitle>Which invoice is this for?</CardTitle>
            <CardDescription>
              Choose an invoice with a total greater than $0. If you just created a draft at $0, open it, add line
              items, then continue — we keep your place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoicePickerForSchedule invoices={invoices} presetId={preset} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.total <= 0) {
    const invoices = await getInvoices({});
    return (
      <div className="space-y-6">
        <PageHeader
          title="New payment schedule"
          description="This invoice still has a $0 total — add line items first, then create the schedule."
        />
        <Card>
          <CardHeader>
            <CardTitle>Invoice needs an amount first</CardTitle>
            <CardDescription>
              {invoice.invoiceNumber} is here, but a payment schedule needs a real total. Add line items on the
              invoice, then return.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoicePickerForSchedule invoices={invoices} presetId={preset} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New payment schedule"
        description="Review the starter, see the calculated dates for this booking, then create the schedule."
      />
      <Card>
        <CardHeader>
          <CardTitle>Review &amp; create</CardTitle>
          <CardDescription>
            Invoice {invoice.invoiceNumber} · {formatCurrency(invoice.total)}
            {invoice.eventDate
              ? ` · Event ${invoice.eventDate}`
              : " · Add an Event date on the booking so event-relative due dates can become calendar dates"}
            {invoice.bookedAt
              ? ` · Booked ${invoice.bookedAt}`
              : " · Starters with At booking need a booking date on the Event first"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm linkedInvoice={invoice} initialPresetId={preset} />
        </CardContent>
      </Card>
    </div>
  );
}
