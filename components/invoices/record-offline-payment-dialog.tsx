"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  listInvoiceOfflineInstallmentsAction,
  recordOfflineInstallmentPaymentAction,
} from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { offlineRecordMethodOptions, paymentMethodLabel } from "@/lib/payments/constants";
import { formatCurrency } from "@/lib/invoices/constants";

type InstallmentOption = {
  id: string;
  label: string;
  status: string;
  amount: number;
  paidAmount: number | null;
  remaining: number;
  dueDate: string | null;
};

function money(n: number): string {
  return formatCurrency(n);
}

export function RecordOfflinePaymentDialog({
  invoiceId,
  open,
  onOpenChange,
  onRecorded,
  acceptedMethods,
}: {
  invoiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
  /** Venue-accepted offline methods (check/cash/ach/other). Falls back to all offline methods. */
  acceptedMethods?: string[] | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [scheduleId, setScheduleId] = React.useState<string | null>(null);
  const [installments, setInstallments] = React.useState<InstallmentOption[]>([]);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLoading(true);
      setInstallments([]);
    }
  }
  const [itemId, setItemId] = React.useState("");
  const [paidAmount, setPaidAmount] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [paidDate, setPaidDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [idempotencyKey, setIdempotencyKey] = React.useState(() => crypto.randomUUID());
  const submitLock = React.useRef(false);

  const methodOptions = React.useMemo(
    () => offlineRecordMethodOptions(acceptedMethods),
    [acceptedMethods],
  );

  const selected = installments.find((i) => i.id === itemId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setIdempotencyKey(crypto.randomUUID());
    submitLock.current = false;
    void listInvoiceOfflineInstallmentsAction(invoiceId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        toast.error(result.message ?? "Could not load installments.");
        onOpenChange(false);
        return;
      }
      setScheduleId(result.scheduleId);
      setInstallments(result.installments);
      const defaultId = result.defaultItemId ?? result.installments[0]?.id ?? "";
      setItemId(defaultId);
      const def = result.installments.find((i) => i.id === defaultId);
      setPaidAmount(def ? String(def.remaining) : "");
      setMethod(methodOptions[0]?.value ?? "");
      setPaidDate(new Date().toISOString().slice(0, 10));
      setReference("");
      setNotes("");
    });
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, onOpenChange, methodOptions]);

  React.useEffect(() => {
    if (!selected) return;
    setPaidAmount(String(selected.remaining));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  async function submit() {
    if (submitLock.current || submitting || !scheduleId || !selected) return;
    const amountNum = parseFloat(paidAmount.replace(/[$,]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    if (!method.trim()) {
      toast.error("Select how this payment was received.");
      return;
    }
    if (!paidDate) {
      toast.error("Enter the date this payment was received.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const result = await recordOfflineInstallmentPaymentAction({
        invoiceId,
        scheduleId,
        itemId: selected.id,
        paidAmount: String(amountNum),
        paymentMethod: method,
        referenceNumber: reference,
        paidDate,
        notes,
        idempotencyKey,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not record this payment.");
        submitLock.current = false;
        return;
      }
      const rec = result.offlineRecord;
      if (rec?.alreadyRecorded) {
        toast.message("This payment was already recorded.", {
          description: rec
            ? `${rec.itemLabel}: plan ${rec.planPaidInstallments} of ${rec.planTotalInstallments} paid · ${money(rec.planRemainingAmount)} remaining`
            : undefined,
        });
      } else if (rec) {
        toast.success("Payment recorded", {
          description: [
            `${money(rec.amountRecorded)} applied to ${rec.itemLabel}`,
            `Method: ${paymentMethodLabel(method)}`,
            rec.invoiceStatus
              ? `Invoice: ${rec.invoiceStatus.replace(/_/g, " ")} · balance ${money(rec.invoiceBalanceDue ?? 0)}`
              : null,
            `Payment plan: ${rec.planPaidInstallments} of ${rec.planTotalInstallments} paid · ${money(rec.planRemainingAmount)} remaining`,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } else {
        toast.success("Payment recorded.");
      }
      onOpenChange(false);
      onRecorded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="record-offline-payment-title">
      <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-lg">
        <div className="border-b border-border px-5 py-4">
          <h2 id="record-offline-payment-title" className="text-base font-semibold text-heading">
            Record payment received
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose the installment this money applies to. Recording does not mark other installments paid.
          </p>
        </div>
        <div className="space-y-4 px-5 py-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading installments…
            </p>
          ) : installments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There is no open installment left to record against on this invoice.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Apply payment to</Label>
                <Select value={itemId} onValueChange={setItemId} items={installments.map((i) => ({ value: i.id, label: i.label }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select installment" />
                  </SelectTrigger>
                  <SelectContent>
                    {installments.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.label} — {money(i.remaining)} remaining
                        {i.status === "partially_paid" ? " (partially paid)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Installment total {money(selected.amount)}
                  {selected.paidAmount != null && selected.paidAmount > 0
                    ? ` · ${money(selected.paidAmount)} already received`
                    : ""}
                  {" · "}
                  {money(selected.remaining)} still owed on this installment.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount *</Label>
                  <Input
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    inputMode="decimal"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date received *</Label>
                  <Input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment method *</Label>
                  <Select value={method} onValueChange={setMethod} items={methodOptions}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {methodOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference / note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Check #, ACH confirmation…"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Internal note <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={submitting}
                />
              </div>
              {selected && (
                <p className="text-xs text-muted-foreground">
                  Confirming records {money(parseFloat(paidAmount.replace(/[$,]/g, "")) || 0)} against{" "}
                  <span className="font-medium text-foreground">{selected.label}</span>
                  {parseFloat(paidAmount.replace(/[$,]/g, "")) >= selected.remaining - 0.009
                    ? " and marks that installment Paid."
                    : " as a partial payment — the installment stays open for the remainder."}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading || submitting || installments.length === 0 || !selected}
            onClick={() => void submit()}
          >
            {submitting ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Recording…</>
            ) : (
              `Record ${money(parseFloat(paidAmount.replace(/[$,]/g, "")) || 0)} payment`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
