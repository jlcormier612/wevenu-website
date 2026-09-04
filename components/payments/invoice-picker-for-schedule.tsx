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
 * invoice to link to. Eligible: not void, total > 0. A brand-new $0 draft is
 * shown under “Not ready yet” so the venue never wonders where it went.
 */
export function InvoicePickerForSchedule({
  invoices,
  presetId,
}: {
  invoices: Invoice[];
  /** Optional starter preset to carry into /payments/new?invoiceId=…&preset=… */
  presetId?: string;
}) {
  const [query, setQuery] = React.useState("");
  const eligible = invoices.filter((inv) => inv.status !== "void" && inv.total > 0);
  const ineligibleZero = invoices.filter((inv) => inv.status !== "void" && inv.total <= 0);
  const filtered = eligible.filter((inv) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return [inv.invoiceNumber, inv.clientName].some((v) => v?.toLowerCase().includes(q));
  });

  function scheduleHref(invoiceId: string) {
    const base = `/payments/new?invoiceId=${invoiceId}`;
    return presetId ? `${base}&preset=${encodeURIComponent(presetId)}` : base;
  }

  /** After they add line items, bring them back to this exact schedule flow. */
  function invoiceHandoffHref(invoiceId: string) {
    const back = encodeURIComponent(scheduleHref(invoiceId));
    return `/invoices/${invoiceId}?returnTo=${back}`;
  }

  function newInvoiceHref() {
    const back = encodeURIComponent(
      presetId ? `/payments/new?preset=${encodeURIComponent(presetId)}` : "/payments/new",
    );
    return `/invoices/new?returnTo=${back}`;
  }

  return (
    <div className="space-y-4">
      {presetId ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          You chose a <span className="font-medium text-foreground">starter plan</span>. Pick the couple&apos;s
          invoice next — Hello to Cheers will calculate dollar amounts from that invoice and due dates from
          their Event date.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          A payment schedule belongs to one invoice so the installment total always matches what you&apos;re
          charging. Choose an invoice with a total greater than $0.
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by client or invoice number…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No invoices are ready yet (they need a total greater than $0).{" "}
          <Link href={newInvoiceHref()} className="text-primary hover:underline">Create an invoice →</Link>
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready for a schedule</p>
          {filtered.map((inv) => (
            <Link key={inv.id} href={scheduleHref(inv.id)}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-heading">{inv.invoiceNumber}</p>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                {inv.clientName && <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>}
                {inv.eventDate && (
                  <p className="text-[11px] text-muted-foreground">
                    Event {inv.eventDate}
                    {inv.bookedAt ? ` · Booked ${inv.bookedAt}` : ""}
                    {" — timing rules become calendar dates from these"}
                  </p>
                )}
              </div>
              <p className="text-sm font-semibold text-heading shrink-0">{formatCurrency(inv.total)}</p>
            </Link>
          ))}
        </div>
      )}

      {ineligibleZero.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Not ready yet — still $0 ({ineligibleZero.length})
          </p>
          <p className="text-xs text-muted-foreground">
            These invoices exist, but they have no amount yet. Open one, add line items or a package, then
            continue — we&apos;ll bring you back here.
          </p>
          {ineligibleZero.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-muted/10 px-4 py-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-heading">{inv.invoiceNumber}</p>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
                {inv.clientName && <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>}
                <p className="text-[11px] text-muted-foreground">
                  Your invoice is here — it just needs an amount before a payment schedule can be created.
                </p>
              </div>
              <Button size="sm" variant="outline" render={<Link href={invoiceHandoffHref(inv.id)} />}>
                Open invoice &amp; add amount
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border/60">
        <Button variant="outline" size="sm" render={<Link href={newInvoiceHref()} />}>+ New Invoice</Button>
      </div>
    </div>
  );
}
