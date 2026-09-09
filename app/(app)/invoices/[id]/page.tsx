import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { isEmailConfigured } from "@/lib/email/send";
import { resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
import { getEventOrderDrift, getInvoice } from "@/lib/invoices/service";
import { getPackages } from "@/lib/packages/service";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { safePaymentScheduleReturnPath } from "@/lib/payments/starters";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) return { title: "Invoice not found" };
  return { title: `${inv.invoiceNumber} · ${inv.clientName ?? "Invoice"}` };
}

export default async function InvoiceDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo: returnToRaw } = await searchParams;
  const [invoice, packages, scheduleSummaries] = await Promise.all([
    getInvoice(id),
    getPackages(true),
    getPaymentSchedules(),
  ]);
  if (!invoice) notFound();
  const returnTo = safePaymentScheduleReturnPath(returnToRaw);
  const linkedSummary = scheduleSummaries.find((s) => s.invoiceId === invoice.id) ?? null;
  const linked = linkedSummary ? await getPaymentSchedule(linkedSummary.id) : null;
  const amountDueNow = resolveAmountDueNow({
    balanceDue: invoice.balanceDue,
    scheduleLines: linked
      ? linked.lineItems.map((i) => ({
          amount: i.amount,
          dueDate: i.dueDate,
          status: i.status,
          label: i.label,
          obligationKind: i.obligationKind,
          sortOrder: i.sortOrder,
        }))
      : null,
  });
  // Booking Financial Architecture Phase 3b — null for any invoice that
  // isn't sent+Event-Order-linked, or that has no undismissed drift.
  const eventOrderDrift = await getEventOrderDrift(id);
  return (
    <InvoiceDetail
      invoice={invoice}
      packages={packages}
      eventOrderDrift={eventOrderDrift}
      emailConfigured={isEmailConfigured()}
      returnToPaymentSchedule={returnTo}
      amountDueNow={amountDueNow}
    />
  );
}
