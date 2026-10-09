"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
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
import { computeAgreedFinancialTerms } from "@/lib/invoices/financial-terms";
import { formatCurrency } from "@/lib/invoices/constants";

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
  const [discountMode, setDiscountMode] = React.useState<"none" | "fixed" | "percent">(
    selection.discountType ?? "none",
  );
  const [discountValue, setDiscountValue] = React.useState(
    selection.discountValue != null ? String(selection.discountValue) : "",
  );
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
    setDiscountMode(selection.discountType ?? "none");
    setDiscountValue(selection.discountValue != null ? String(selection.discountValue) : "");
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

  const preview = React.useMemo(() => {
    const pkg = parseFloat(packageAmount.replace(/[$,]/g, "")) || 0;
    return computeAgreedFinancialTerms({
      packagePrice: pkg,
      discountMode: discountMode === "none" ? null : discountMode,
      discountValue: discountMode === "none" ? null : parseFloat(discountValue) || 0,
      applyTax: applyTax && useTaxes,
      taxRatePercent: applyTax ? parseFloat(taxRate) || 0 : null,
    });
  }, [packageAmount, discountMode, discountValue, applyTax, taxRate, useTaxes]);

  const depositNum = parseFloat(deposit.replace(/[$,]/g, "")) || 0;

  function handleSave() {
    startTransition(async () => {
      const result = await updateSelectionFinancialTermsAction({
        selectionId: selection.id,
        packageAmount: preview.packagePrice,
        discountType: discountMode === "none" ? null : discountMode,
        discountValue: discountMode === "none" ? null : parseFloat(discountValue) || 0,
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
      toast.success("Financial terms saved for this Selected Package.");
      onOpenChange(false);
      router.refresh();
    });
  }

  const canEdit = selection.status === "draft" && !selection.invoiceId && !selection.contractId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>Financial terms</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Set package price, optional discount, and optional exclusive tax before the contract.
            These terms carry into the contract, invoice, and payment plan. A configured rate is a
            calculation input — not legal tax advice.
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
              <div className="space-y-2">
                <Label>Discount</Label>
                <div className="flex gap-1">
                  {([["none", "None"], ["fixed", "$"], ["percent", "%"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDiscountMode(val)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                        discountMode === val
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {discountMode !== "none" && (
                  <Input
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountMode === "percent" ? "10" : "500"}
                    inputMode="decimal"
                  />
                )}
                {discountMode === "percent" && (
                  <p className="text-xs text-muted-foreground">
                    Dollar amount freezes when saved ({formatCurrency(preview.discountAmount)}).
                  </p>
                )}
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
                      Exclusive tax on the discounted package amount. Not applied unless checked.
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
                      placeholder="7"
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
              {preview.discountAmount > 0 && (
                <p className="text-success">Discount −{formatCurrency(preview.discountAmount)}</p>
              )}
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
