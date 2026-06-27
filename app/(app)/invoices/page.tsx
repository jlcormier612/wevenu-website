import type { Metadata } from "next";

import Link from "next/link";
import { Plus } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { formatCurrency } from "@/lib/invoices/constants";
import { getInvoices } from "@/lib/invoices/service";

export const metadata: Metadata = { title: "Invoices" };

const INVOICE_SORT_OPTIONS = [
  { value: "newest",    label: "Most Recent" },
  { value: "oldest",    label: "Oldest" },
  { value: "total_high",label: "Total (Highest)" },
  { value: "total_low", label: "Total (Lowest)" },
  { value: "due_soon",  label: "Due Date (Soonest)" },
];

type Props = { searchParams: Promise<{ q?: string; sort?: string }> };

export default async function InvoicesPage({ searchParams }: Props) {
  const { q, sort } = await searchParams;
  const invoices = await getInvoices({ q });
  // Sort client-side (small list)
  const sorted = [...invoices].sort((a, b) => {
    switch (sort) {
      case "oldest":     return a.createdAt < b.createdAt ? -1 : 1;
      case "total_high": return b.total - a.total;
      case "total_low":  return a.total - b.total;
      case "due_soon":   return (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1;
      default:           return b.createdAt < a.createdAt ? -1 : 1;
    }
  });
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Invoices" description="Track amounts owed across all clients and events." />
        <Button type="button" render={<Link href="/invoices/new" />} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> New Invoice
        </Button>
      </div>
      <FilterBar placeholder="Search by invoice number…" statusOptions={INVOICE_SORT_OPTIONS} statusParam="sort" />

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-heading">No invoices yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first invoice to track amounts owed.</p>
          <Button type="button" size="sm" className="mt-4" render={<Link href="/invoices/new" />}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New Invoice
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((inv) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="block rounded-xl border border-border bg-card p-5 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-heading">{inv.invoiceNumber}</p>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  {inv.clientName && <p className="text-xs text-muted-foreground">{inv.clientName}</p>}
                  {inv.dueDate && <p className="text-xs text-muted-foreground">Due {new Date(inv.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-heading">{formatCurrency(inv.total)}</p>
                  {inv.balanceDue > 0 && inv.status !== "paid" && (
                    <p className="text-xs text-destructive">{formatCurrency(inv.balanceDue)} due</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
