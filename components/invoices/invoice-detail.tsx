"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";

import { sendInvoiceEmailAction, updateInvoiceStatusAction } from "@/app/(app)/invoices/actions";
import { EventOrderDriftBanner } from "@/components/invoices/event-order-drift-banner";
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, invoiceStatusLabel } from "@/lib/invoices/constants";
import type { EventOrderDrift, InvoiceStatus, InvoiceWithLineItems } from "@/lib/invoices/types";
import type { Package } from "@/lib/packages/types";

const STATUS_TRANSITIONS: Record<InvoiceStatus, { next: InvoiceStatus; label: string } | null> = {
  draft: { next: "sent",  label: "Mark as Sent" },
  sent:  { next: "paid",  label: "Mark as Paid" },
  paid:  null,
  void:  null,
};

export function InvoiceDetail({
  invoice, packages, eventOrderDrift = null,
}: { invoice: InvoiceWithLineItems; packages: Package[]; eventOrderDrift?: EventOrderDrift | null }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<InvoiceStatus>(invoice.status);
  const [pending, startTransition] = React.useTransition();
  const [emailPending, startEmail] = React.useTransition();
  const transition = STATUS_TRANSITIONS[status];

  function handleStatusChange(next: InvoiceStatus) {
    startTransition(async () => {
      const result = await updateInvoiceStatusAction(invoice.id, next);
      if (result.ok) { setStatus(next); toast.success(`Invoice marked as ${invoiceStatusLabel(next)}.`); router.refresh(); }
      else toast.error(result.message ?? "Could not update status.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Invoices
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-heading font-semibold text-heading">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={status} />
          </div>
          {invoice.clientName && (
            <p className="text-sm text-muted-foreground">
              {invoice.clientName}
              {invoice.eventDate && ` · ${new Date(invoice.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
            </p>
          )}
          {invoice.eventOrderRevisionAtFreeze != null && (
            <p className="text-xs text-muted-foreground">Generated from Event Order v{invoice.eventOrderRevisionAtFreeze}</p>
          )}
          {invoice.amendsInvoiceId && (
            <p className="text-xs text-muted-foreground">
              Amends <Link href={`/invoices/${invoice.amendsInvoiceId}`} className="text-primary hover:underline">an earlier invoice</Link>
            </p>
          )}
          {invoice.amendedByInvoiceId && (
            <p className="text-xs text-muted-foreground">
              An amended invoice exists: <Link href={`/invoices/${invoice.amendedByInvoiceId}`} className="text-primary hover:underline">{invoice.amendedByInvoiceNumber} →</Link>
              {" "}This invoice remains the active financial record until that one is sent.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" render={<Link href={`/invoices/${invoice.id}/print`} target="_blank" />}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print
          </Button>
          {invoice.clientId && status !== "void" && (
            <Button type="button" variant="outline" size="sm" disabled={emailPending}
              onClick={() => startEmail(async () => {
                const result = await sendInvoiceEmailAction(invoice.id);
                if (!result.ok) { toast.error(result.message ?? "Could not send."); return; }
                if ("method" in result && result.method === "mailto" && result.mailtoUrl) {
                  window.open(result.mailtoUrl, "_blank");
                  toast.success("Opening your email client…");
                } else {
                  toast.success("Invoice emailed successfully.");
                }
              })}>
              {emailPending ? <><span className="mr-1">⋯</span>Sending…</> : <><Mail className="mr-1 h-3.5 w-3.5" /> Email</>}
            </Button>
          )}
          {status !== "void" && status !== "paid" && (
            <Button type="button" variant="outline" size="sm"
              onClick={() => { if (confirm("Void this invoice?")) handleStatusChange("void"); }}
              disabled={pending} className="text-muted-foreground">
              Void
            </Button>
          )}
          {transition && (
            <Button type="button" size="sm" onClick={() => handleStatusChange(transition.next)} disabled={pending}>
              {pending ? "Updating…" : transition.label}
            </Button>
          )}
        </div>
      </div>

      {eventOrderDrift && (
        <EventOrderDriftBanner
          invoiceId={invoice.id} drift={eventOrderDrift}
          canRevertToDraft={invoice.balanceDue >= invoice.total}
          hasExistingAmendment={!!invoice.amendedByInvoiceId}
        />
      )}

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-muted-foreground" /> Line Items
          </CardTitle>
          <CardDescription>
            {status === "draft" && invoice.eventOrderId
              ? "Lines tagged “Event Order” update automatically from this event's Event Order. Add packages or custom line items for anything else."
              : status === "draft"
                ? "Add packages from your catalog or enter custom line items."
                : "Invoice is locked — edit is only available in Draft status."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceLineItemsEditor
            invoiceId={invoice.id}
            initialItems={invoice.lineItems}
            packages={packages}
            invoiceStatus={status}
          />
        </CardContent>
      </Card>

      {/* Totals summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <dl className="space-y-2 text-sm min-w-64">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatCurrency(invoice.subtotal)}</dd>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discounts / Deposits</dt>
                  <dd className="font-medium text-success">−{formatCurrency(invoice.discountAmount)}</dd>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-medium">{formatCurrency(invoice.taxAmount)}</dd>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-semibold text-heading">
                <dt>Total</dt>
                <dd>{formatCurrency(invoice.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Balance Due</dt>
                <dd className={`font-semibold ${invoice.balanceDue > 0 ? "text-destructive" : "text-success"}`}>
                  {formatCurrency(invoice.balanceDue)}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p></CardContent>
        </Card>
      )}

      {/* Create payment plan CTA */}
      {invoice.total > 0 && status !== "void" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-heading">Create a payment plan from this invoice</p>
                <p className="text-xs text-muted-foreground">
                  Invoice total {formatCurrency(invoice.total)} will pre-fill the payment schedule.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm"
                render={<Link href={`/payments/new?invoiceId=${invoice.id}`} />}>
                Create Payment Plan →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
