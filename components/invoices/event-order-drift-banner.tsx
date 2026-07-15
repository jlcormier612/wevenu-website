"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  createAmendedInvoiceAction, dismissEventOrderDriftAction, revertInvoiceToDraftAction,
} from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/invoices/constants";
import type { EventOrderDrift } from "@/lib/invoices/types";

/**
 * Booking Financial Architecture Phase 3b/3c — the full trust experience.
 * An Event Order changing after an invoice was sent is a normal
 * operational occurrence, not an error — this deliberately reads more like
 * a GitHub "branch is behind" notice than a warning. Review Changes and
 * Dismiss for now shipped first, on their own (3b), specifically so a
 * coordinator's first encounter with this system was recognition, not a
 * decision menu. The two mutating actions below are 3c's genuinely
 * additive follow-up.
 */
export function EventOrderDriftBanner({
  invoiceId, drift, canRevertToDraft, hasExistingAmendment,
}: {
  invoiceId: string; drift: EventOrderDrift; canRevertToDraft: boolean; hasExistingAmendment: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [revertPending, startRevert] = React.useTransition();
  const [amendPending, startAmend] = React.useTransition();

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissEventOrderDriftAction(invoiceId);
      if (!result.ok) toast.error(result.message ?? "Could not dismiss.");
      else { toast.success("Dismissed for now."); router.refresh(); }
    });
  }

  function handleRevertToDraft() {
    if (!confirm("This invoice will return to Draft for you to review and resend — its current content will be replaced by what Event Order says right now.")) return;
    startRevert(async () => {
      const result = await revertInvoiceToDraftAction(invoiceId);
      if (!result.ok) toast.error(result.message ?? "Could not update this invoice.");
      else { toast.success("Reopened as Draft."); router.refresh(); }
    });
  }

  function handleCreateAmended() {
    startAmend(async () => {
      const result = await createAmendedInvoiceAction(invoiceId);
      if (!result.ok) { toast.error(result.message ?? "Could not create an amended invoice."); return; }
      toast.success("Amended invoice created as a Draft — this invoice remains active until it's sent.");
      router.push(`/invoices/${result.invoiceId}`);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-heading">Your Event Order has changed since this invoice was created.</p>
          <p className="text-xs text-muted-foreground">{drift.summary}</p>
          <p className="text-xs text-muted-foreground">The invoice still reflects what was originally sent. Review the changes before deciding whether to send an updated invoice.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button type="button" variant="outline" size="sm" />}>
              Review Changes
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader className="mb-6">
                <SheetTitle>What changed</SheetTitle>
                <p className="text-sm text-muted-foreground">{drift.summary}</p>
              </SheetHeader>
              <div className="space-y-6">
                {drift.added.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</p>
                    {drift.added.map((l, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <p className="text-foreground">{l.description}</p>
                        <p className="text-xs text-muted-foreground">{l.quantity} × {formatCurrency(l.unitPrice)} = {formatCurrency(l.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {drift.removed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Removed</p>
                    {drift.removed.map((l, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <p className="text-foreground">{l.description}</p>
                        <p className="text-xs text-muted-foreground">{l.quantity} × {formatCurrency(l.unitPrice)} = {formatCurrency(l.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {drift.changed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changed</p>
                    {drift.changed.map((l, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm space-y-0.5">
                        <p className="text-foreground">{l.toDescription}</p>
                        {l.fromDescription !== l.toDescription && (
                          <p className="text-xs text-muted-foreground">Description: {l.fromDescription} → {l.toDescription}</p>
                        )}
                        {l.fromQuantity !== l.toQuantity && (
                          <p className="text-xs text-muted-foreground">Quantity: {l.fromQuantity} → {l.toQuantity}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {drift.priceChanged.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price Changes</p>
                    {drift.priceChanged.map((l, i) => (
                      <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <p className="text-foreground">{l.description}</p>
                        <p className="text-xs text-muted-foreground">Price: {formatCurrency(l.fromUnitPrice)} → {formatCurrency(l.toUnitPrice)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
              </div>
            </SheetContent>
          </Sheet>
          {canRevertToDraft && (
            <Button type="button" variant="outline" size="sm" disabled={revertPending} onClick={handleRevertToDraft}>
              {revertPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update Draft Invoice"}
            </Button>
          )}
          {!hasExistingAmendment && (
            <Button type="button" variant="outline" size="sm" disabled={amendPending} onClick={handleCreateAmended}>
              {amendPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Amended Invoice"}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDismiss}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Dismiss for now"}
          </Button>
        </div>
      </div>
      {!canRevertToDraft && (
        <p className="mt-2 text-xs text-muted-foreground">
          A payment has already been recorded against this invoice, so it can no longer be reopened as a draft — create an amended invoice instead.
        </p>
      )}
    </div>
  );
}
