import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { getInvoice } from "@/lib/invoices/service";
import { getPackages } from "@/lib/packages/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) return { title: "Invoice not found" };
  return { title: `${inv.invoiceNumber} · ${inv.clientName ?? "Invoice"}` };
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const [invoice, packages] = await Promise.all([getInvoice(id), getPackages(true)]);
  if (!invoice) notFound();
  return <InvoiceDetail invoice={invoice} packages={packages} />;
}
