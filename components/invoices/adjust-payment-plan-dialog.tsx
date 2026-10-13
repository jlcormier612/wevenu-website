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
import { adjustRemainingPaymentPlanAction } from "@/app/(app)/payments/[id]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/invoices/constants";
import {
  type AdjustableDraftLine,
  buildRedistributedRemaining,
  formatAdjustAmountInput,
  parseAdjustAmountInput,
  previewAdjustRemainingPlan,
  remainingAmountGap,
} from "@/lib/payments/adjust-remaining-plan";
import { OBLIGATION_KIND_OPTIONS } from "@/lib/payments/constants";
import type { PaymentLineItem, PaymentObligationKind } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type ScheduleLineForAdjust = {
  id?: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
  obligationKind?: PaymentObligationKind | null;
  paidAmount?: number | null;
};

type DraftRow = AdjustableDraftLine & { key: string };

type OpeningSnapshot = {
  rows: DraftRow[];
  amountInputs: Record<string, string>;
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

function newRowKey(): string {
  return `adj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function toDraftRows(lines: AdjustableDraftLine[]): DraftRow[] {
  return lines.map((l) => ({
    ...l,
    key: (l.id && String(l.id)) || newRowKey(),
  }));
}

function amountInputsFromRows(rows: DraftRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) out[row.key] = formatAdjustAmountInput(row.amount);
  return out;
}

function cloneSnapshot(rows: DraftRow[]): OpeningSnapshot {
  const cloned = rows.map((row) => ({ ...row }));
  return { rows: cloned, amountInputs: amountInputsFromRows(cloned) };
}

function toPayload(rows: DraftRow[]): AdjustableDraftLine[] {
  return rows.map(({ key: _key, ...rest }) => rest);
}

/** Narrow schedule props into the shape previewAdjustRemainingPlan reads. */
function toPreviewSourceLines(
  scheduleId: string,
  lines: ScheduleLineForAdjust[],
): PaymentLineItem[] {
  return lines.map((l, index) => ({
    id: l.id ?? `adjust-src-${index}`,
    venueId: "",
    scheduleId,
    label: l.label,
    amount: Number(l.amount) || 0,
    dueDate: l.dueDate,
    status: l.status as PaymentLineItem["status"],
    paidAmount: l.paidAmount ?? null,
    paidAt: null,
    paymentMethod: null,
    referenceNumber: null,
    notes: null,
    sortOrder: index,
    obligationKind: l.obligationKind ?? null,
    refundedAmount: 0,
    refundedAt: null,
    refundReason: null,
    quickbooksSyncStatus: "not_synced" as const,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    stripePaymentMethodType: null,
    createdAt: "",
    updatedAt: "",
  }));
}

const kindSelectClassName = cn(
  "flex h-9 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-2 py-1 text-sm text-foreground outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
);

/** Always show cents on the live remaining indicator ($0.00 / $906.25 / -$93.75). */
function formatRemainingAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

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
  const [rows, setRows] = React.useState<DraftRow[]>([]);
  const [amountInputs, setAmountInputs] = React.useState<Record<string, string>>({});
  const [pending, startPending] = React.useTransition();
  const [previewNote, setPreviewNote] = React.useState<string | null>(null);
  const [discrepancy, setDiscrepancy] = React.useState(0);
  const [closedShortfall, setClosedShortfall] = React.useState(0);
  const [sendPreview, setSendPreview] = React.useState<InvoiceAndPaymentPlanPreview | null>(null);
  const [step, setStep] = React.useState<"edit" | "send">("edit");
  const seededOpenSession = React.useRef(false);
  const openingSnapshot = React.useRef<OpeningSnapshot | null>(null);

  const applyRows = React.useCallback((next: DraftRow[]) => {
    setRows(next);
    setAmountInputs(amountInputsFromRows(next));
  }, []);

  // Client-side preview only — calling a Server Action on every keystroke soft-refreshes
  // the invoice RSC tree, remounts this dialog, and wipes in-progress edits.
  const refreshPreview = React.useCallback((nextRows: DraftRow[]) => {
    const preview = previewAdjustRemainingPlan({
      invoiceTotal,
      balanceDue,
      lines: toPreviewSourceLines(scheduleId, scheduleLines),
      proposedRemaining: toPayload(nextRows),
    });
    if (preview.ok) {
      setPreviewNote(null);
      setDiscrepancy(preview.discrepancy);
      setClosedShortfall(preview.closedPartialShortfall);
    } else {
      setPreviewNote(preview.message ?? "Could not preview.");
      setDiscrepancy(preview.discrepancy);
      setClosedShortfall(preview.closedPartialShortfall);
    }
  }, [invoiceTotal, balanceDue, scheduleId, scheduleLines]);

  React.useEffect(() => {
    if (!open) {
      seededOpenSession.current = false;
      openingSnapshot.current = null;
      return;
    }
    // Seed once per open session so parent RSC refreshes cannot reset draft rows mid-edit.
    if (seededOpenSession.current) return;
    seededOpenSession.current = true;
    setStep("edit");
    setSendPreview(null);
    const unresolved = scheduleLines
      .filter((l) => l.status === "pending" || l.status === "overdue")
      .map((l) => ({
        id: l.id,
        label: l.label,
        amount: Number(l.amount) || 0,
        dueDate: l.dueDate,
        obligationKind: l.obligationKind ?? null,
      }));
    // Opening draft is the stored remaining plan (not a forced equal split).
    const seed = unresolved.length > 0
      ? unresolved
      : [{
          label: "Remaining balance",
          amount: balanceDue,
          dueDate: null,
          obligationKind: "installment" as PaymentObligationKind,
        }];
    const next = toDraftRows(seed);
    openingSnapshot.current = cloneSnapshot(next);
    applyRows(next);
    refreshPreview(next);
  }, [open, scheduleId, balanceDue, scheduleLines, applyRows, refreshPreview]);

  function updateRow(key: string, patch: Partial<AdjustableDraftLine>) {
    setRows((prev) => {
      const next = prev.map((row) => (row.key === key ? { ...row, ...patch } : row));
      refreshPreview(next);
      return next;
    });
  }

  function onAmountInputChange(key: string, raw: string) {
    setAmountInputs((prev) => ({ ...prev, [key]: raw }));
    const parsed = parseAdjustAmountInput(raw);
    if (parsed.kind === "incomplete") {
      // Keep prior numeric amount + preview until the typed value is complete.
      return;
    }
    if (parsed.kind === "empty") {
      updateRow(key, { amount: 0 });
      return;
    }
    if (parsed.kind === "invalid") {
      updateRow(key, { amount: 0 });
      return;
    }
    updateRow(key, { amount: parsed.value });
  }

  function splitEqually() {
    const next = toDraftRows(
      buildRedistributedRemaining({
        balanceDue,
        template: toPayload(rows),
        mode: "equal",
      }).map((line, i) => ({
        ...line,
        // Preserve row keys / ids so focused fields do not jump.
        id: rows[i]?.id,
      })),
    ).map((row, i) => ({
      ...row,
      key: rows[i]?.key ?? row.key,
    }));
    applyRows(next);
    refreshPreview(next);
  }

  function resetToDefault() {
    const snap = openingSnapshot.current;
    if (!snap) return;
    const restored = snap.rows.map((row) => ({ ...row }));
    setRows(restored);
    setAmountInputs({ ...snap.amountInputs });
    refreshPreview(restored);
  }

  function addLine() {
    setRows((prev) => {
      const row: DraftRow = {
        key: newRowKey(),
        label: "Installment",
        amount: 0,
        dueDate: null,
        obligationKind: "installment",
      };
      const next = [...prev, row];
      setAmountInputs((inputs) => ({ ...inputs, [row.key]: "" }));
      refreshPreview(next);
      return next;
    });
  }

  function removeLine(key: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((row) => row.key !== key);
      setAmountInputs((inputs) => {
        const copy = { ...inputs };
        delete copy[key];
        return copy;
      });
      refreshPreview(next);
      return next;
    });
  }

  function save() {
    const payload = toPayload(rows);
    startPending(async () => {
      const result = await adjustRemainingPaymentPlanAction(scheduleId, payload, invoiceId);
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

  const remainingAmount = remainingAmountGap(
    balanceDue,
    rows.map((row) => Number(row.amount) || 0),
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
                <p className="text-xs text-muted-foreground">Remaining amount</p>
                <p
                  className={cn(
                    "font-semibold",
                    remainingAmount < -0.009
                      ? "text-destructive"
                      : remainingAmount > 0.009
                        ? "text-foreground"
                        : "text-success",
                  )}
                  data-testid="adjust-remaining-amount"
                >
                  {formatRemainingAmount(remainingAmount)}
                </p>
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
              <Button type="button" size="sm" variant="outline" onClick={splitEqually} disabled={pending}>
                Split equally
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={resetToDefault} disabled={pending} data-testid="adjust-plan-reset-default">
                Reset to default
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={addLine} disabled={pending}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add installment
              </Button>
            </div>

            <div className="space-y-3">
              {rows.map((line, index) => (
                <div key={line.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_6rem_8rem_7rem_auto]">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={line.label}
                      onChange={(e) => updateRow(line.key, { label: e.target.value })}
                      data-testid={`adjust-line-label-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      inputMode="decimal"
                      value={amountInputs[line.key] ?? formatAdjustAmountInput(line.amount)}
                      onChange={(e) => onAmountInputChange(line.key, e.target.value)}
                      data-testid={`adjust-line-amount-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due date</Label>
                    <Input
                      type="date"
                      value={line.dueDate ?? ""}
                      onChange={(e) => updateRow(line.key, { dueDate: e.target.value || null })}
                      data-testid={`adjust-line-due-${index}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`adjust-line-kind-${index}`}>Kind</Label>
                    {/*
                      Native select: Base UI Select portals at z-50 (below Dialog z-[250]) and
                      outside-press on the portal dismisses the dialog before a kind can be chosen.
                    */}
                    <select
                      id={`adjust-line-kind-${index}`}
                      className={kindSelectClassName}
                      value={line.obligationKind ?? "installment"}
                      disabled={pending}
                      onChange={(e) =>
                        updateRow(line.key, {
                          obligationKind: (e.target.value || "installment") as PaymentObligationKind,
                        })
                      }
                      data-testid={`adjust-line-kind-${index}`}
                      aria-label={`Kind for installment ${index + 1}`}
                    >
                      {OBLIGATION_KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(line.key)} disabled={rows.length <= 1 || pending} aria-label="Remove">
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
