import { notFound } from "next/navigation";

import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { PrintButton } from "@/components/events/day-sheet/print-button";
import { getInvoice } from "@/lib/invoices/service";
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
  const nextOpen = linked?.lineItems
    .filter((i) => i.status === "pending" || i.status === "overdue" || i.status === "processing")
    .sort((a, b) => String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999")))[0] ?? null;

  return (
    <>
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <PrintButton />
      </div>
      <InvoicePrintDocument
        invoice={invoice}
        venue={venue}
        milestone={nextOpen ? { label: nextOpen.label, obligationKind: nextOpen.obligationKind ?? null } : null}
      />
    </>
  );
}
