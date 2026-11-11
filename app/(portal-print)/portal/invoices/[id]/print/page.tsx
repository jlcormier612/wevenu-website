import { notFound } from "next/navigation";

import { PrintButton } from "@/components/events/day-sheet/print-button";
import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { loadCoupleInvoicePrint } from "@/lib/portal/load-couple-invoice-print";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ token?: string | string[] }>;
};

export default async function PortalInvoicePrintPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const raw = query.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token) notFound();

  const model = await loadCoupleInvoicePrint(token, id);
  if (!model) notFound();

  return (
    <>
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <PrintButton />
      </div>
      <InvoicePrintDocument
        invoice={model.invoice}
        venue={model.venue}
        milestone={model.milestone}
        amountDueNow={model.amountDueNow}
        paidToDateOverride={model.paidToDateOverride}
        cancelledPlanAmount={model.cancelledPlanAmount}
        scheduleLines={model.scheduleLines}
        paymentInstructions={model.paymentInstructions}
        venuePaymentInstructions={model.venuePaymentInstructions}
      />
    </>
  );
}
