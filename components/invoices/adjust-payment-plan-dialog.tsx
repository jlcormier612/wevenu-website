"use client";

/**
 * Adjust remaining installment amounts/dates on an issued invoice's plan.
 * Collected receipts stay immutable. Preview must reconcile to balance due
 * before save; optional send of revised arrangement afterward.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  previewRevisedInvoiceAndPaymentPlanAction,
  sendRevisedInvoiceAndPaymentPlanAction,
  type InvoiceAndPaymentPlanPreview,
} from "@/app/(app)/invoices/actions";
import {
  adjustRemainingPaymentPlanAction,
  previewRemainingPaymentPlanAdjustmentAction,
} from "@/app/(app)/payments/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/invoices/constants";
import {
  type AdjustableDraftLine,
  buildRedistributedRemaining,
} from "@/lib/payments/adjust-remaining-plan";
import { OBLIGATION_KIND_OPTIONS } from "@/lib/payments/constants";
import type { PaymentObligationKind } from "@/lib/payments/types";

type ScheduleLineForAdjust = {
  id?: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
  obligationKind?: PaymentObligationKind | null;
  paidAmount?: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  scheduleId: string;
  invoiceTotal: number;
  balanceDue: number;
  scheduleLines: ScheduleLineForAdjust[];
};

export function AdjustPaymentPlanDialog({
  open,
  onOpenChange,
  invoiceId,
  scheduleId,
  invoiceTotal,
  balanceDue,
  scheduleLines,
}: Props) {
  const router = useRouter();
  const [lines, setLines] = React.useState<AdjustableDraftLine[]>([]);
  const [pending, startPending] = React.useTransition();
  const [previewNote, setPreviewNote] = React.useState<string | null>(null);
  const [discrepancy, setDiscrepancy] = React.useState(0);
  const [closedShortfall, setClosedShortfall] = React.useState(0);
  const [sendPreview, setSendPreview] = React.useState<InvoiceAndPaymentPlanPreview | null>(null);
  const [step, setStep] = React.useState<"edit" | "send">("edit");

  React.useEffect(() => {
    if (!open) return;
    setStep("edit");
    setSendPreview(null);
    const unresolved = scheduleLines
      .filter((l) => l.status === "pending" || l.status === "overdue")
      .map((l) => ({
        id: l.id,
        label: l.label,
        amount: l.amount,
        dueDate: l.dueDate,
        obligationKind: l.obligationKind ?? null,
      }));
    const seed = unresolved.length > 0
      ? unresolved
      : [{
          label: "Remaining balance",
          amount: balanceDue,
          dueDate: null,
          obligationKind: "installment" as PaymentObligationKind,
        }];
    const redistributed = buildRedistributedRemaining({
      balanceDue,
      template: seed,
      mode: "proportional",
    });
    setLines(redistributed);
    refreshPreview(redistributed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed when dialog opens
  }, [open, scheduleId, balanceDue]);

  function refreshPreview(next: AdjustableDraftLine[]) {
    startPending(async () => {
      const result = await previewRemainingPaymentPlanAdjustmentAction(scheduleId, next);
      if (result.ok) {
        setPreviewNote(null);
        setDiscrepancy(result.preview.discrepancy);
        setClosedShortfall(result.preview.closedPartialShortfall);
      } else {
        setPreviewNote(result.message ?? "Could not preview.");
        setDiscrepancy(result.preview?.discrepancy ?? 0);
        setClosedShortfall(result.preview?.closedPartialShortfall ?? 0);
      }
    });
  }

  function updateLine(index: number, patch: Partial<AdjustableDraftLine>) {
    setLines((prev) => {
      const next = prev.map((l, i) => (i === index ? { ...l, ...patch } : l));
      refreshPreview(next);
      return next;
    });
  }

  function redistribute(mode: "equal" | "proportional") {
    const next = buildRedistributedRemaining({ balanceDue, template: lines, mode });
    setLines(next);
    refreshPreview(next);
  }

  function addLine() {
    setLines((prev) => {
      const next = [
        ...prev,
        {
          label: "Installment",
          amount: 0,
          dueDate: null,
          obligationKind: "installment" as PaymentObligationKind,
        },
      ];
      refreshPreview(next);
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      refreshPreview(next);
      return next;
    });
  }

  function save() {
    startPending(async () => {
      const result = await adjustRemainingPaymentPlanAction(scheduleId, lines, invoiceId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save the revised plan.");
        return;
      }
      toast.success("Remaining payment plan updated. Recorded payments are unchanged.");
      router.refresh();
      setStep("send");
      const preview = await previewRevisedInvoiceAndPaymentPlanAction(invoiceId);
      if (preview.ok && "preview" in preview) setSendPreview(preview.preview);
    });
  }

  function sendRevised() {
    startPending(async () => {
      const result = await sendRevisedInvoiceAndPaymentPlanAction(invoiceId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not send the revised plan.");
        return;
      }
      toast.success("Revised invoice and payment plan sent.");
      onOpenChange(false);
      router.refresh();
    });
  }

  const collected = scheduleLines.filter((l) =>
    l.status === "paid" || l.status === "partially_paid" || l.status === "partially_refunded" || l.status === "refunded",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-testid="adjust-payment-plan-dialog">
        <DialogHeader>
          <DialogTitle>
            {step === "edit" ? "Adjust invoice / payment plan" : "Send revised arrangement"}
          </DialogTitle>
          <DialogDescription>
            {step === "edit"
              ? "Revise remaining installments only. Amounts already received stay on the record. This does not change a signed contract."
              : "Preview matches what the client will receive. Sending does not invent payments or rewrite the contract."}
          </DialogDescription>
        </DialogHeader>

        {step === "edit" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Invoice total</p>
                <p className="font-semibold">{formatCurrency(invoiceTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-semibold">{formatCurrency(balanceDue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining lines</p>
                <p className="font-semibold">{formatCurrency(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0))}</p>
              </div>
            </div>

            {collected.length > 0 && (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collected (unchanged)</p>
                {collected.map((l) => (
                  <p key={l.id} className="text-sm text-foreground">
                    {l.label}: {formatCurrency(Number(l.paidAmount ?? l.amount))} received
                    {l.status === "partially_paid" ? (
                      <span className="text-muted-foreground">
                        {" "}· shortfall will move into remaining installments
                      </span>
                    ) : null}
                  </p>
                ))}
                {closedShortfall > 0.009 && (
                  <p className="text-xs text-muted-foreground" data-testid="closed-partial-shortfall">
                    About {formatCurrency(closedShortfall)} of partial-installment shortfall will be redistributed.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => redistribute("equal")} disabled={pending}>
                Split equally
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => redistribute("proportional")} disabled={pending}>
                Keep proportions
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={addLine} disabled={pending}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add installment
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_6rem_8rem_7rem_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={line.label}
                      onChange={(e) => updateLine(index, { label: e.target.value })}
                      data-testid={`adjust-line-label-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      value={String(line.amount)}
                      onChange={(e) => updateLine(index, { amount: Number(e.target.value.replace(/[$,]/g, "")) || 0 })}
                      data-testid={`adjust-line-amount-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due date</Label>
                    <Input
                      type="date"
                      value={line.dueDate ?? ""}
                      onChange={(e) => updateLine(index, { dueDate: e.target.value || null })}
                      data-testid={`adjust-line-due-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kind</Label>
                    <Select
                      value={line.obligationKind ?? "installment"}
                      onValueChange={(v) => updateLine(index, { obligationKind: (v ?? "installment") as PaymentObligationKind })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OBLIGATION_KIND_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(index)} disabled={lines.length <= 1 || pending} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {previewNote && (
              <p className="text-sm text-destructive" data-testid="adjust-plan-discrepancy">{previewNote}</p>
            )}
            {!previewNote && Math.abs(discrepancy) <= 0.009 && (
              <p className="text-sm text-success" data-testid="adjust-plan-reconciled">
                Remaining installments reconcile to the outstanding balance.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm" data-testid="revised-send-preview">
            {sendPreview ? (
              <>
                <p><span className="text-muted-foreground">To:</span> {sendPreview.recipient}</p>
                <p>
                  <span className="text-muted-foreground">Subject:</span>{" "}
                  {sendPreview.subject.startsWith("Updated:")
                    ? sendPreview.subject
                    : `Updated: ${sendPreview.subject}`}
                </p>
                <p><span className="text-muted-foreground">Total:</span> {sendPreview.totalContracted}</p>
                <p><span className="text-muted-foreground">Paid to date:</span> {sendPreview.paidToDate}</p>
                <p><span className="text-muted-foreground">Outstanding:</span> {sendPreview.remainingBalance}</p>
                {sendPreview.amountDueNow && (
                  <p><span className="text-muted-foreground">Due now:</span> {sendPreview.amountDueNow}</p>
                )}
                {sendPreview.scheduleLines.length > 0 && (
                  <div className="rounded-md border border-border p-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Payment schedule (as client will see)
                    </p>
                    {sendPreview.scheduleLines.map((l, i) => (
                      <p key={`${l.label}-${i}`} className="text-sm">
                        {l.label}: {formatCurrency(l.amount)}
                        {l.dueDate ? ` · due ${l.dueDate}` : ""}
                        {l.status !== "pending" && l.status !== "overdue"
                          ? ` · ${l.status.replace(/_/g, " ")}`
                          : ""}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  This updates the collection arrangement only. A signed contract is not changed.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Preparing preview…</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "edit" ? (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
              <Button
                type="button"
                onClick={save}
                disabled={pending || Boolean(previewNote)}
                data-testid="adjust-plan-save"
              >
                {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Save revised plan
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Close without sending</Button>
              <Button type="button" onClick={sendRevised} disabled={pending || !sendPreview} data-testid="send-revised-plan">
                {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Send revised to client
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
