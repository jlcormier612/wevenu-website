"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { applyPostPaymentCreditAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/invoices/constants";

export function ApplyPostPaymentCreditDialog({
  invoiceId,
  balanceDue,
  open,
  onOpenChange,
}: {
  invoiceId: string;
  balanceDue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("Post-payment credit");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setDescription("Post-payment credit");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/[$,]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a credit amount greater than zero.");
      return;
    }
    if (!description.trim()) {
      toast.error("Credit description is required.");
      return;
    }
    startTransition(async () => {
      const result = await applyPostPaymentCreditAction(invoiceId, {
        amount: parsed,
        description: description.trim(),
      });
      if (!result.ok) {
        toast.error(result.message ?? "Could not apply credit.");
        return;
      }
      toast.success("Credit applied. Review the payment plan if totals no longer match.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-post-payment-credit-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4"
      >
        <div className="space-y-1">
          <h2 id="apply-post-payment-credit-title" className="text-base font-semibold text-heading">
            Apply credit
          </h2>
          <p className="text-xs text-muted-foreground">
            Reduces the invoice commitment. Already-recorded payments stay unchanged — regenerate the
            payment plan to redistribute unpaid installments. Remaining balance{" "}
            <span className="font-medium text-foreground">{formatCurrency(balanceDue)}</span>.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="credit-description">Description *</Label>
          <Input
            id="credit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            data-testid="post-payment-credit-description"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="credit-amount">Amount *</Label>
          <Input
            id="credit-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            disabled={pending}
            data-testid="post-payment-credit-amount"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} data-testid="post-payment-credit-submit">
            {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Applying…</> : "Apply credit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
