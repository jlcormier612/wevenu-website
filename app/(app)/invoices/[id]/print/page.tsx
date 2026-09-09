import { notFound } from "next/navigation";

import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { PrintButton } from "@/components/events/day-sheet/print-button";
import { resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
import { getInvoice } from "@/lib/invoices/service";
import {
  computeCancelledPlanAmount,
  computeNetPaid,
} from "@/lib/payments/invoice-balance";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getCurrentVenue } from "@/lib/venue/service";

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
    balanceDue: invoice.balanceDue,
    scheduleLines,
  });
  const nextOpen =
    amountDueNow.kind === "next_installment"
      ? linked?.lineItems.find(
          (i) =>
            i.amount === amountDueNow.amount
            && i.label === (amountDueNow.label ?? i.label)
            && (i.status === "pending" || i.status === "overdue" || i.status === "processing"),
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
        invoice={invoice}
        venue={venue}
        milestone={nextOpen ? { label: nextOpen.label, obligationKind: nextOpen.obligationKind ?? null } : null}
        amountDueNow={amountDueNow}
        paidToDateOverride={paidToDateOverride}
        cancelledPlanAmount={cancelledPlanAmount}
      />
    </>
  );
}
