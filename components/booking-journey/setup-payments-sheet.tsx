"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setupPaymentsAction } from "@/app/(app)/booking-journey/payments-actions";
import { PaymentPlanBuilder } from "@/components/payments/payment-plan-builder";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/invoices/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";
import type { CustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";
import type { CommitBuilderLine } from "@/lib/payments/plan-builder";
import type { PaymentObligationKind } from "@/lib/payments/types";

export function SetupPaymentsSheet({
  open,
  onOpenChange,
  selection,
  clientId,
  eventId,
  eventDate,
  leadId,
  spaceId,
  defaultScheduleStructure = "deposit_remaining",
  paymentCollection = "either",
  customSchedule = null,
  executedAt = null,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  eventDate?: string | null;
  leadId?: string;
  spaceId?: string;
  defaultScheduleStructure?: string;
  paymentCollection?: "online" | "external" | "either";
  customSchedule?: CustomScheduleTemplate | null;
  executedAt?: string | null;
  today?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SetupPaymentsSheetBody
          key={`${selection.id}:${selection.totalAmount}:${eventDate ?? ""}:${defaultScheduleStructure}`}
          onOpenChange={onOpenChange}
          selection={selection}
          clientId={clientId}
          eventId={eventId}
          eventDate={eventDate}
          leadId={leadId}
          spaceId={spaceId}
          defaultScheduleStructure={defaultScheduleStructure}
          paymentCollection={paymentCollection}
          customSchedule={customSchedule}
          executedAt={executedAt}
          today={today ?? new Date().toISOString().slice(0, 10)}
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
  eventDate,
  leadId,
  spaceId,
  defaultScheduleStructure,
  executedAt,
  today,
}: {
  onOpenChange: (open: boolean) => void;
  selection: CommercialSelection;
  clientId?: string;
  eventId?: string;
  eventDate?: string | null;
  leadId?: string;
  spaceId?: string;
  defaultScheduleStructure: string;
  paymentCollection: "online" | "external" | "either";
  customSchedule: CustomScheduleTemplate | null;
  executedAt: string | null;
  today: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [pending, startTransition] = React.useTransition();

  function create(lines: CommitBuilderLine[]) {
    startTransition(async () => {
      const builderLines = lines.map((l) => ({
        label: l.label,
        amount: parseFloat(l.amount),
        dueDate: l.dueDate,
        obligationKind: l.obligationKind as PaymentObligationKind,
      }));
      const result = await setupPaymentsAction({
        selectionId: selection.id,
        clientId,
        eventId,
        eventDate: eventDate ?? undefined,
        leadId,
        spaceId,
        requestDeposit: false,
        scheduleStructure: "custom",
        builderLines,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Payment plan created. Preview it, then request the initial payment when ready.");
      onOpenChange(false);
      router.push(`/invoices/${result.invoiceId}`);
      router.refresh();
    });
  }

  return (
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader className="mb-6">
        <SheetTitle>Set up payments</SheetTitle>
        <p className="text-sm text-muted-foreground">
          Create the {formatCurrency(selection.totalAmount)} commitment and payment plan.
          Requesting the initial payment is a separate step after you preview.
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
        <PaymentPlanBuilder
          invoiceTotal={selection.totalAmount}
          defaultDeposit={selection.depositAmount}
          initialPresetId={defaultScheduleStructure}
          startAt="structure"
          timingCtx={{
            eventDate: eventDate ?? null,
            bookingDate: null,
            executedAt: executedAt?.slice(0, 10) ?? null,
            today,
          }}
          pending={pending}
          commitLabel="Create payment plan"
          onCancel={() => setStep(1)}
          onCommit={create}
        />
      )}
    </SheetContent>
  );
}
