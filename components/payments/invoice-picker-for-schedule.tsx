"use client";

import * as React from "react";

import Link from "next/link";
import { Search } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/invoices/constants";
import type { Invoice } from "@/lib/invoices/types";

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule always needs an
 * invoice to link to. This is what a coordinator sees at /payments/new
 * without an invoiceId already in hand — pick an existing one, or go create
 * one first. There is no path to a schedule with no invoice anymore.
 */
export function InvoicePickerForSchedule({ invoices }: { invoices: Invoice[] }) {
  const [query, setQuery] = React.useState("");
  const eligible = invoices.filter((inv) => inv.status !== "void" && inv.total > 0);
  const filtered = eligible.filter((inv) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [inv.invoiceNumber, inv.clientName].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by client or invoice number…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No invoices to link yet.{" "}
          <Link href="/invoices/new" className="text-primary hover:underline">Create one first →</Link>
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => (
            <Link key={inv.id} href={`/payments/new?invoiceId=${inv.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-heading">{inv.invoiceNumber}</p>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                {inv.clientName && <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>}
              </div>
              <p className="text-sm font-semibold text-heading shrink-0">{formatCurrency(inv.total)}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border/60">
        <Button variant="outline" size="sm" render={<Link href="/invoices/new" />}>+ New Invoice</Button>
      </div>
    </div>
  );
}
