"use client";

import * as React from "react";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createInvoiceFromEventOrderAction, linkEventOrderToInvoiceAction,
} from "@/app/(app)/events/[id]/event-order-actions";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import type { Invoice } from "@/lib/invoices/types";

/**
 * Financial boundary: Invoice owns what they owe.
 * When the Event Order has priced content, Create Invoice is a primary path —
 * not buried under Advanced. Payment Plan follows from the invoice (never EO-native).
 */
export function EventOrderInvoiceLink({
  eventOrderId, eventId, clientId, invoices, bookingCommitmentInvoiceIds = [],
  hasPricedContent = false,
  linkedScheduleId = null,
}: {
  eventOrderId: string;
  eventId: string;
  clientId: string;
  invoices: Invoice[];
  /** Package booking-commitment invoices. Never treated as this Event Order's amount due. */
  bookingCommitmentInvoiceIds?: string[];
  /** True when Event Order lines carry a commercial amount (priced total > 0). */
  hasPricedContent?: boolean;
  /** Existing payment schedule for the EO-linked invoice, if any. */
  linkedScheduleId?: string | null;
}) {
  const [pending, startTransition] = React.useTransition();
  const commitment = new Set(bookingCommitmentInvoiceIds);

  const linked = invoices.find((inv) => inv.eventOrderId === eventOrderId && inv.status === "draft")
    ?? invoices.find((inv) => inv.eventOrderId === eventOrderId && inv.status !== "void");

  if (linked) {
    // Draft EO invoices store total=0; live amount is projected from the Event Order on read.
    // hasPricedContent keeps Create Payment Plan visible when the EO commercial amount > 0.
    const showCreatePlan = (linked.total > 0 || hasPricedContent) && !linkedScheduleId;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Amount due lives on</span>
          <Link href={`/invoices/${linked.id}`} className="font-medium text-primary hover:underline">
            {linked.displayName?.trim() || "Invoice"} {linked.invoiceNumber}
          </Link>
          <InvoiceStatusBadge status={linked.status} />
          <Button type="button" variant="outline" size="sm" render={<Link href={`/invoices/${linked.id}`} />}>
            Open Invoice
          </Button>
          {showCreatePlan ? (
            <Button
              type="button"
              size="sm"
              render={<Link href={`/payments/new?invoiceId=${linked.id}`} />}
              data-testid="eo-create-payment-plan"
            >
              Create Payment Plan
            </Button>
          ) : linkedScheduleId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link href={`/payments/${linkedScheduleId}`} />}
            >
              Open Payment Plan
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Event Order is not an invoice. The payment plan total always follows this invoice.
        </p>
      </div>
    );
  }

  const linkableDraft = invoices.find((inv) =>
    inv.status === "draft" && !inv.eventOrderId && !commitment.has(inv.id),
  );

  function handleCreate() {
    startTransition(async () => {
      const result = await createInvoiceFromEventOrderAction(eventOrderId, eventId, clientId);
      if (!result.ok) toast.error(result.message ?? "Could not create invoice.");
      else toast.success("Draft invoice created. It is the source of truth for what they owe.");
    });
  }

  function handleLink(invoiceId: string) {
    startTransition(async () => {
      const result = await linkEventOrderToInvoiceAction(eventOrderId, eventId, invoiceId);
      if (!result.ok) toast.error(result.message ?? "Could not link invoice.");
      else toast.success("Invoice linked. Draft invoices may project Event Order lines until sent.");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Event Order is not an invoice. Create an Invoice when you are ready to collect what they owe — a payment plan attaches to that invoice, not to the Event Order.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hasPricedContent ? (
          linkableDraft ? (
            <Button type="button" size="sm" disabled={pending} onClick={() => handleLink(linkableDraft.id)} data-testid="eo-link-draft-invoice">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Link draft ${linkableDraft.invoiceNumber}`}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={pending} onClick={handleCreate} data-testid="eo-create-draft-invoice">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Invoice"}
            </Button>
          )
        ) : (
          linkableDraft ? (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleLink(linkableDraft.id)}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Link draft ${linkableDraft.invoiceNumber}`}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleCreate}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create draft Invoice"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
