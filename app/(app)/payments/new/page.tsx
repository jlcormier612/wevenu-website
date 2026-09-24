import type { Metadata } from "next";

import { InvoicePickerForSchedule } from "@/components/payments/invoice-picker-for-schedule";
import { NewScheduleForm } from "@/components/payments/new-schedule-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";
import { createClient } from "@/integrations/supabase/server";
import { formatCurrency } from "@/lib/invoices/constants";
import { getInvoice, getInvoices } from "@/lib/invoices/service";

export const metadata: Metadata = { title: "New payment schedule" };

type Props = { searchParams: Promise<{ invoiceId?: string; preset?: string }> };

/** Latest Fully Executed contract date for this client (YYYY-MM-DD), if any. */
async function latestExecutedContractDate(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("signed_at")
    .eq("venue_id", venue.id)
    .eq("client_id", clientId)
    .eq("status", "signed")
    .not("signed_at", "is", null)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ signed_at: string }>();
  return data?.signed_at ? data.signed_at.slice(0, 10) : null;
}

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

  const venue = await getCurrentVenue();
  const today = venue
    ? venueToday(venue.timezone)
    : new Date().toISOString().slice(0, 10);
  const executedAt = await latestExecutedContractDate(invoice.clientId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Plan Builder"
        description="Choose how this invoice total should be collected — equal, percentage, dollar, or custom — then preview and create the schedule. Requesting payment is a separate step."
      />
      <Card>
        <CardHeader>
          <CardTitle>Build payment schedule</CardTitle>
          <CardDescription>
            Invoice {invoice.invoiceNumber} · {formatCurrency(invoice.total)}
            {invoice.eventDate
              ? ` · Event ${invoice.eventDate}`
              : " · Add an Event date on the booking so event-relative due dates can become calendar dates"}
            {executedAt
              ? ` · Contract fully executed ${executedAt}`
              : " · Agreement-relative timing needs a fully executed contract"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewScheduleForm
            linkedInvoice={invoice}
            initialPresetId={preset}
            executedAt={executedAt}
            today={today}
          />
        </CardContent>
      </Card>
    </div>
  );
}
