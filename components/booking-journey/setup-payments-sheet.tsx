"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setupPaymentsAction } from "@/app/(app)/booking-journey/payments-actions";
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
import { formatCurrency } from "@/lib/invoices/constants";

export function SetupPaymentsSheet({
  open,
  onOpenChange,
  selection,
  clientId,
  eventId,
  leadId,
  spaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  leadId?: string;
  spaceId?: string;
}) {
  // Remount body when opening so step/deposit reset without an effect.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SetupPaymentsSheetBody
          key={`${selection.id}:${selection.depositAmount}`}
          onOpenChange={onOpenChange}
          selection={selection}
          clientId={clientId}
          eventId={eventId}
          leadId={leadId}
          spaceId={spaceId}
        />
      ) : null}
    </Sheet>
  );
}

function SetupPaymentsSheetBody({
  onOpenChange,
  selection,
  clientId,
  eventId,
  leadId,
  spaceId,
}: {
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  leadId?: string;
  spaceId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [deposit, setDeposit] = React.useState(String(selection.depositAmount));
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");

  const depositAmount = parseFloat(deposit.replace(/[$,]/g, "")) || 0;
  const remaining = remainingAmount(selection.totalAmount, depositAmount);

  function create(requestDeposit: boolean) {
    if (!(depositAmount >= 0) || depositAmount > selection.totalAmount) {
      setError("Enter a valid deposit amount.");
      return;
    }
    startTransition(async () => {
      const result = await setupPaymentsAction({
        selectionId: selection.id,
        clientId,
        eventId,
        leadId,
        spaceId,
        depositAmount,
        requestDeposit,
      });
      if (!result.ok) {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(
        requestDeposit
          ? result.emailSent
            ? "Payments set up — deposit request emailed."
            : "Payments set up — deposit marked ready. Send the invoice if email wasn't delivered."
          : "Payments set up.",
      );
      onOpenChange(false);
      router.push(`/invoices/${result.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader className="mb-6">
        <SheetTitle>Set up payments</SheetTitle>
        <p className="text-sm text-muted-foreground">
          Step {step} of 3 — create the {formatCurrency(selection.totalAmount)} commitment and
          collect the deposit.
        </p>
      </SheetHeader>

      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Commitment</p>
            <p className="mt-1 text-base font-medium text-heading">{selection.name}</p>
            <p className="text-lg font-semibold text-heading">{formatCurrency(selection.totalAmount)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Invoice line preview</p>
            <p className="text-sm text-heading">
              1 × {selection.name} — {formatCurrency(selection.totalAmount)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Couples usually pay the deposit now. The rest stays on the payment plan.
          </p>
          <div className="space-y-2">
            <Label htmlFor="setup-deposit">Deposit</Label>
            <Input
              id="setup-deposit"
              value={deposit}
              onChange={(e) => {
                setDeposit(e.target.value);
                setError("");
              }}
              inputMode="decimal"
            />
          </div>
          <div className="rounded-lg border border-border px-4 py-3 text-sm">
            <p>Deposit: <strong>{formatCurrency(depositAmount)}</strong></p>
            <p className="mt-1">Remaining balance: <strong>{formatCurrency(remaining)}</strong></p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm space-y-2">
            <p><strong>{selection.name}</strong> — {formatCurrency(selection.totalAmount)}</p>
            <p>Deposit {formatCurrency(depositAmount)} · Remaining {formatCurrency(remaining)}</p>
            <p className="text-xs text-muted-foreground">
              Creates one invoice and one payment schedule. Existing Library package prices are not changed.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => create(true)} disabled={pending}>
              {pending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creating…</> : "Create & request deposit"}
            </Button>
            <Button type="button" variant="outline" onClick={() => create(false)} disabled={pending}>
              Create only
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={pending}>
              Back
            </Button>
          </div>
        </div>
      )}
    </SheetContent>
  );
}
