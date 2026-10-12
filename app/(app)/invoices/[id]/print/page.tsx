import { notFound } from "next/navigation";

import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { PrintButton } from "@/components/events/day-sheet/print-button";
import { resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
import { getInvoice } from "@/lib/invoices/service";
import {
  computeCancelledPlanAmount,
  computeInvoiceBalanceDue,
  computeNetPaid,
} from "@/lib/payments/invoice-balance";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

// No sidebar — use the root layout override
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const [invoice, venue, scheduleSummaries] = await Promise.all([
    getInvoice(id),
    getCurrentVenue(),
    getPaymentSchedules(),
  ]);
  if (!invoice || !venue) notFound();

  const linkedSummary = scheduleSummaries.find((s) => s.invoiceId === invoice.id) ?? null;
  const linked = linkedSummary ? await getPaymentSchedule(linkedSummary.id) : null;
  const balanceDue = linked
    ? computeInvoiceBalanceDue(invoice.total, linked.lineItems)
    : invoice.balanceDue;
  const invoiceView = { ...invoice, balanceDue };
  const scheduleLines = linked
    ? linked.lineItems.map((i) => ({
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.status,
        label: i.label,
        obligationKind: i.obligationKind,
        sortOrder: i.sortOrder,
      }))
    : null;
  const amountDueNow = resolveAmountDueNow({
    balanceDue,
    scheduleLines,
    today: venueToday(venue.timezone),
  });
  const nextOpen =
    amountDueNow.kind === "next_installment"
      ? linked?.lineItems.find(
          (i) =>
            i.amount === amountDueNow.amount
            && i.label === (amountDueNow.label ?? i.label)
            && (i.status === "pending" || i.status === "overdue" || i.status === "processing" || i.status === "partially_paid"),
        ) ?? null
      : null;
  const paidToDateOverride = linked ? computeNetPaid(linked.lineItems) : null;
  const cancelledPlanAmount = linked ? computeCancelledPlanAmount(linked.lineItems) : 0;

  return (
    <>
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <PrintButton />
      </div>
      <InvoicePrintDocument
        invoice={invoiceView}
        venue={venue}
        milestone={nextOpen ? { label: nextOpen.label, obligationKind: nextOpen.obligationKind ?? null } : null}
        amountDueNow={amountDueNow}
        paidToDateOverride={paidToDateOverride}
        cancelledPlanAmount={cancelledPlanAmount}
        scheduleLines={scheduleLines}
        paymentInstructions={linked?.notes ?? invoiceView.notes}
        venuePaymentInstructions={
          venue.commercialBookingPrefs?.clientPaymentInstructions ?? null
        }
      />
    </>
  );
}
