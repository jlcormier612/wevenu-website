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
 * Primary action is Open Invoice when one exists.
 * Creating/linking from EO is secondary/advanced only.
 */
export function EventOrderInvoiceLink({
  eventOrderId, eventId, clientId, invoices,
}: {
  eventOrderId: string; eventId: string; clientId: string; invoices: Invoice[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const linked = invoices.find((inv) => inv.eventOrderId === eventOrderId);
  const anyInvoice = invoices.find((inv) => inv.status !== "void") ?? invoices[0];

  if (linked || anyInvoice) {
    const inv = linked ?? anyInvoice!;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Amount due lives on</span>
        <Link href={`/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
          Invoice {inv.invoiceNumber}
        </Link>
        <InvoiceStatusBadge status={inv.status} />
        <Button type="button" variant="outline" size="sm" render={<Link href={`/invoices/${inv.id}`} />}>
          Open Invoice
        </Button>
      </div>
    );
  }

  const linkableDraft = invoices.find((inv) => inv.status === "draft" && !inv.eventOrderId);

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
        Event Order is not an invoice. Create or open an Invoice when you are ready to collect what they owe.
      </p>
      {!showAdvanced ? (
        <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs" onClick={() => setShowAdvanced(true)}>
          Advanced: link or create a draft Invoice…
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {linkableDraft ? (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => handleLink(linkableDraft.id)}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Link draft ${linkableDraft.invoiceNumber}`}
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleCreate}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create draft Invoice"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
