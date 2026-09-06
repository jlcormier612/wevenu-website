"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { createSelectedPackageAction } from "@/app/(app)/booking-journey/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { remainingAmount, suggestDepositAmount } from "@/lib/commercial-selections/constants";
import { formatCurrency } from "@/lib/invoices/constants";
import type { PackageWithItems } from "@/lib/packages/types";

export function SelectPackageSheet({
  open,
  onOpenChange,
  packages,
  leadId,
  clientId,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: PackageWithItems[];
  leadId?: string;
  clientId?: string;
  eventId?: string;
}) {
  const router = useRouter();
  const [packageId, setPackageId] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");

  const selected = packages.find((p) => p.id === packageId) ?? null;
  const total = selected?.basePrice != null ? Number(selected.basePrice) : null;

  React.useEffect(() => {
    if (!selected || total == null || !(total > 0)) {
      setDeposit("");
      return;
    }
    setDeposit(String(suggestDepositAmount(total)));
  }, [selected, total]);

  function reset() {
    setPackageId("");
    setDeposit("");
    setError("");
  }

  function handleSave() {
    if (!selected || total == null) {
      setError("Choose a package with a price.");
      return;
    }
    const depositAmount = parseFloat(deposit.replace(/[$,]/g, ""));
    if (!(depositAmount >= 0) || Number.isNaN(depositAmount)) {
      setError("Enter a valid deposit amount.");
      return;
    }
    startTransition(async () => {
      const result = await createSelectedPackageAction({
        packageId: selected.id,
        leadId,
        clientId,
        eventId,
        depositAmount,
      });
      if (!result.ok) {
        setError(result.message ?? result.errors?.depositAmount ?? "Could not save selected package.");
        toast.error(result.message ?? "Could not save selected package.");
        return;
      }
      toast.success("Selected package saved.");
      onOpenChange(false);
      reset();
      router.refresh();
    });
  }

  const priced = packages.filter((p) => p.isActive && p.basePrice != null && p.basePrice > 0);
  const unpriced = packages.filter((p) => p.isActive && (p.basePrice == null || !(p.basePrice > 0)));

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>Select package</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Choose what this couple bought. This creates their Selected Package — a frozen
            copy for this booking. Changing the Library package later will not change it.
          </p>
        </SheetHeader>

        <div className="space-y-3">
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No priced packages yet. Add a price in Library → Packages first.
            </p>
          ) : (
            priced.map((pkg) => {
              const active = pkg.id === packageId;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setPackageId(pkg.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    active ? "border-heading bg-muted/40" : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-heading">{pkg.name}</p>
                      {pkg.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-heading">
                      {formatCurrency(Number(pkg.basePrice))}
                    </p>
                  </div>
                </button>
              );
            })
          )}
          {unpriced.length > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              {unpriced.length} Library package{unpriced.length === 1 ? "" : "s"} still need a price
              before they can be selected.
            </p>
          )}
        </div>

        {selected && total != null && total > 0 && (
          <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">This couple&apos;s Selected Package</p>
              <p className="mt-1 text-sm font-medium text-heading">{selected.name}</p>
              <p className="text-sm text-heading">{formatCurrency(total)}</p>
            </div>
            {selected.items.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {selected.items.map((item) => (
                  <li key={item.id}>
                    • {item.description}
                    {item.quantity ? ` × ${item.quantity}` : ""}
                    {item.unit ? ` ${item.unit}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Deposit</Label>
              <Input
                id="deposit-amount"
                value={deposit}
                onChange={(e) => {
                  setDeposit(e.target.value);
                  setError("");
                }}
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                Remaining{" "}
                {formatCurrency(
                  remainingAmount(total, parseFloat(deposit.replace(/[$,]/g, "")) || 0),
                )}
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending || !selected}>
            {pending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save selected package"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
