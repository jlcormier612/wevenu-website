"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { updateSelectionFinancialTermsAction } from "@/app/(app)/booking-journey/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import {
  computeAgreedFinancialTermsMulti,
  type FinancialAdjustmentInput,
  type FinancialAdjustmentKind,
} from "@/lib/invoices/financial-adjustments";
import { formatCurrency } from "@/lib/invoices/constants";

type DraftAdj = {
  key: string;
  kind: FinancialAdjustmentKind;
  description: string;
  mode: "fixed" | "percent";
  value: string;
};

function draftsFromSelection(selection: CommercialSelection): DraftAdj[] {
  if (selection.financialAdjustments?.length) {
    return selection.financialAdjustments.map((a) => ({
      key: a.id,
      kind: a.kind,
      description: a.description,
      mode: a.mode,
      value: String(a.value),
    }));
  }
  if (selection.discountType && selection.discountValue != null && selection.discountAmount > 0) {
    return [{
      key: "legacy-discount",
      kind: "discount",
      description: "Discount",
      mode: selection.discountType,
      value: String(selection.discountValue),
    }];
  }
  return [];
}

export function SelectionFinancialTermsSheet({
  open,
  onOpenChange,
  selection,
  useTaxes,
  useDiscounts,
  defaultTaxPercent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  useTaxes: boolean;
  useDiscounts: boolean;
  defaultTaxPercent: number | null;
}) {
  const router = useRouter();
  const [packageAmount, setPackageAmount] = React.useState(String(selection.packageAmount));
  const [adjustments, setAdjustments] = React.useState<DraftAdj[]>(() => draftsFromSelection(selection));
  const [applyTax, setApplyTax] = React.useState(selection.taxApplied);
  const [taxRate, setTaxRate] = React.useState(
    selection.taxRatePercent != null
      ? String(selection.taxRatePercent)
      : defaultTaxPercent != null
        ? String(defaultTaxPercent)
        : "",
  );
  const [deposit, setDeposit] = React.useState(String(selection.depositAmount));
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setPackageAmount(String(selection.packageAmount));
    setAdjustments(draftsFromSelection(selection));
    setApplyTax(selection.taxApplied);
    setTaxRate(
      selection.taxRatePercent != null
        ? String(selection.taxRatePercent)
        : defaultTaxPercent != null
          ? String(defaultTaxPercent)
          : "",
    );
    setDeposit(String(selection.depositAmount));
    setError("");
  }, [open, selection, defaultTaxPercent]);

  const adjustmentInputs: FinancialAdjustmentInput[] = React.useMemo(() => {
    if (!useDiscounts) return [];
    return adjustments
      .filter((a) => a.description.trim() && a.value.trim())
      .map((a) => ({
        kind: a.kind,
        description: a.description.trim(),
        mode: a.mode,
        value: parseFloat(a.value) || 0,
      }));
  }, [adjustments, useDiscounts]);

  const preview = React.useMemo(() => {
    const pkg = parseFloat(packageAmount.replace(/[$,]/g, "")) || 0;
    return computeAgreedFinancialTermsMulti({
      packagePrice: pkg,
      adjustments: adjustmentInputs,
      applyTax: applyTax && useTaxes,
      taxRatePercent: applyTax ? parseFloat(taxRate) || 0 : null,
    });
  }, [packageAmount, adjustmentInputs, applyTax, taxRate, useTaxes]);

  const depositNum = parseFloat(deposit.replace(/[$,]/g, "")) || 0;

  function handleSave() {
    startTransition(async () => {
      const result = await updateSelectionFinancialTermsAction({
        selectionId: selection.id,
        packageAmount: preview.packagePrice,
        adjustments: adjustmentInputs,
        discountType: preview.discountMode,
        discountValue: preview.discountValue,
        applyTax: applyTax && useTaxes,
        taxRatePercent: applyTax ? parseFloat(taxRate) || null : null,
        depositAmount: depositNum,
        leadId: selection.leadId,
        clientId: selection.clientId,
        eventId: selection.eventId,
      });
      if (!result.ok) {
        setError(result.message ?? result.errors?.depositAmount ?? "Could not save terms.");
        toast.error(result.message ?? "Could not save terms.");
        return;
      }
      toast.success("Invoice adjustments saved for this Selected Package.");
      onOpenChange(false);
      router.refresh();
    });
  }

  const canEdit = selection.status === "draft" && !selection.invoiceId && !selection.contractId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>Invoice adjustments</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Apply package price, optional discounts/credits/charges, and optional exclusive tax on this
            Selected Package before the contract. Settings only enable these options — they do not apply
            tax or discount until you set them here. Deposits are payment allocations, not discounts.
          </p>
        </SheetHeader>

        {!canEdit ? (
          <p className="text-sm text-muted-foreground">
            Terms are locked after a contract is linked or an invoice exists. Use amendment or a new
            Selected Package version for changes.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-amount">Package price</Label>
              <Input
                id="pkg-amount"
                value={packageAmount}
                onChange={(e) => setPackageAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>

            {useDiscounts && (
              <div className="space-y-3" data-testid="financial-adjustments-list">
                <div className="flex items-center justify-between">
                  <Label>Adjustments</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdjustments((prev) => [
                      ...prev,
                      {
                        key: `new-${Date.now()}`,
                        kind: "discount",
                        description: "",
                        mode: "fixed",
                        value: "",
                      },
                    ])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Each reduction needs a description (e.g. Referral credit). Charges/fees increase the total.
                </p>
                {adjustments.map((adj, idx) => (
                  <div key={adj.key} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        value={adj.kind}
                        onChange={(e) => {
                          const kind = e.target.value as FinancialAdjustmentKind;
                          setAdjustments((prev) => prev.map((row, i) => (
                            i === idx ? { ...row, kind } : row
                          )));
                        }}
                      >
                        <option value="discount">Discount</option>
                        <option value="credit">Credit</option>
                        <option value="charge">Charge</option>
                        <option value="fee">Fee</option>
                      </select>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove adjustment"
                        onClick={() => setAdjustments((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input
                      value={adj.description}
                      onChange={(e) => setAdjustments((prev) => prev.map((row, i) => (
                        i === idx ? { ...row, description: e.target.value } : row
                      )))}
                      placeholder="Description (required)"
                    />
                    <div className="flex gap-1">
                      {([["fixed", "$"], ["percent", "%"]] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdjustments((prev) => prev.map((row, i) => (
                            i === idx ? { ...row, mode: val } : row
                          )))}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                            adj.mode === val
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Input
                      value={adj.value}
                      onChange={(e) => setAdjustments((prev) => prev.map((row, i) => (
                        i === idx ? { ...row, value: e.target.value } : row
                      )))}
                      placeholder={adj.mode === "percent" ? "10" : "500"}
                      inputMode="decimal"
                    />
                  </div>
                ))}
              </div>
            )}

            {useTaxes && (
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={applyTax}
                    onChange={(e) => setApplyTax(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium text-heading">Apply tax</span>
                    <span className="block text-muted-foreground">
                      Exclusive tax on the adjusted taxable base. Not applied unless checked.
                    </span>
                  </span>
                </label>
                {applyTax && (
                  <div className="space-y-1.5">
                    <Label htmlFor="tax-rate">Tax rate (%)</Label>
                    <Input
                      id="tax-rate"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      inputMode="decimal"
                      placeholder={defaultTaxPercent != null ? String(defaultTaxPercent) : "6.25"}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="dep-amount">Deposit (payment allocation)</Label>
              <Input
                id="dep-amount"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                Does not reduce the agreed total or taxable amount. Remaining after deposit{" "}
                {formatCurrency(remainingAmount(preview.finalTotal, Math.min(depositNum, preview.finalTotal)))}.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
              <p>Package {formatCurrency(preview.packagePrice)}</p>
              {preview.adjustments.map((a) => (
                <p key={a.id} className={a.kind === "discount" || a.kind === "credit" ? "text-success" : undefined}>
                  {a.description}: {a.kind === "discount" || a.kind === "credit" ? "−" : "+"}
                  {formatCurrency(a.amount)}
                </p>
              ))}
              {preview.taxApplied && (
                <p>
                  Tax {preview.taxRatePercent}% {formatCurrency(preview.taxAmount)}
                </p>
              )}
              <p className="font-semibold text-heading">
                Agreed total {formatCurrency(preview.finalTotal)}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="button" className="w-full" disabled={pending} onClick={handleSave}>
              {pending ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save financial terms"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
