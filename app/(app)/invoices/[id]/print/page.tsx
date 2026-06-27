import { notFound } from "next/navigation";

import { InvoicePrintDocument } from "@/components/invoices/invoice-print-document";
import { PrintButton } from "@/components/events/day-sheet/print-button";
import { getInvoice } from "@/lib/invoices/service";
import { getCurrentVenue } from "@/lib/venue/service";

// No sidebar — use the root layout override
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const [invoice, venue] = await Promise.all([getInvoice(id), getCurrentVenue()]);
  if (!invoice || !venue) notFound();
  return (
    <>
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <PrintButton />
      </div>
      <InvoicePrintDocument invoice={invoice} venue={venue} />
    </>
  );
}
