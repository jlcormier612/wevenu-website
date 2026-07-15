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
 * Booking Financial Architecture Phase 3a — the one new entry point onto
 * the trust migration: an Event Order needs an Invoice to project into
 * while Draft. Prefers linking an existing, unlinked Draft invoice over
 * creating a second one (Decision 5: one Invoice per Event, growing over
 * time) — most real bookings will already have Phase 1's retainer invoice
 * by the time a coordinator starts building an Event Order.
 */
export function EventOrderInvoiceLink({
  eventOrderId, eventId, clientId, invoices,
}: {
  eventOrderId: string; eventId: string; clientId: string; invoices: Invoice[];
}) {
  const [pending, startTransition] = React.useTransition();

  const linked = invoices.find((inv) => inv.eventOrderId === eventOrderId);
  if (linked) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Linked invoice:</span>
        <Link href={`/invoices/${linked.id}`} className="font-medium text-primary hover:underline">{linked.invoiceNumber}</Link>
        <InvoiceStatusBadge status={linked.status} />
      </div>
    );
  }

  const linkableDraft = invoices.find((inv) => inv.status === "draft" && !inv.eventOrderId);
  const hasUnlinkable = invoices.length > 0 && !linkableDraft;

  if (hasUnlinkable) {
    return (
      <p className="text-xs text-muted-foreground">
        An invoice already exists for this event and can&apos;t be linked retroactively — it&apos;s already been sent.
      </p>
    );
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await createInvoiceFromEventOrderAction(eventOrderId, eventId, clientId);
      if (!result.ok) toast.error(result.message ?? "Could not create invoice.");
      else toast.success("Invoice created — it will track this Event Order live while in Draft.");
    });
  }

  function handleLink(invoiceId: string) {
    startTransition(async () => {
      const result = await linkEventOrderToInvoiceAction(eventOrderId, eventId, invoiceId);
      if (!result.ok) toast.error(result.message ?? "Could not link invoice.");
      else toast.success("Invoice linked — it will track this Event Order live while in Draft.");
    });
  }

  return (
    <div className="flex items-center gap-2">
      {linkableDraft ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleLink(linkableDraft.id)}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Link to Invoice ${linkableDraft.invoiceNumber}`}
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleCreate}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Invoice from Event Order"}
        </Button>
      )}
    </div>
  );
}
