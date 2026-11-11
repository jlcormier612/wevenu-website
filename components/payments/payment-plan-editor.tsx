"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { replacePendingScheduleLinesAction } from "@/app/(app)/payments/[id]/actions";
import { PaymentPlanBuilder } from "@/components/payments/payment-plan-builder";
import { Button } from "@/components/ui/button";
import { draftsFromStoredLines, type CommitBuilderLine } from "@/lib/payments/plan-builder";
import { commitmentMismatchCopy } from "@/lib/payments/reconcile-commitment";
import type { PaymentObligationKind } from "@/lib/payments/types";
import type { PaymentTimingContext } from "@/lib/payments/starters";

export function PaymentPlanEditor({
  scheduleId,
  invoiceId,
  invoiceTotal,
  lines,
  timingCtx,
  commitLabel = "Save payment plan",
  onSaved,
}: {
  scheduleId: string;
  invoiceId?: string;
  invoiceTotal: number;
  lines: {
    label: string;
    amount: number;
    dueDate: string | null;
    obligationKind?: PaymentObligationKind | null;
  }[];
  timingCtx: PaymentTimingContext;
  commitLabel?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function save(next: CommitBuilderLine[]) {
    startTransition(async () => {
      const result = await replacePendingScheduleLinesAction(scheduleId, next, invoiceId);
      if (!result.ok) {
        toast.error(result.message ?? "Could not save the payment plan.");
        return;
      }
      toast.success("Payment plan saved. Requesting the initial payment is a separate step.");
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <PaymentPlanBuilder
      invoiceTotal={invoiceTotal}
      timingCtx={timingCtx}
      initialLines={draftsFromStoredLines(lines, timingCtx)}
      startAt="build"
      commitLabel={commitLabel}
      pending={pending}
      onCommit={save}
    />
  );
}

export function PaymentPlanNeedsReview({
  previousTotal,
  nextTotal,
  canEdit,
  onEdit,
}: {
  previousTotal: number;
  nextTotal: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const copy = commitmentMismatchCopy(previousTotal, nextTotal);
  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-3"
      data-testid="payment-plan-needs-review"
    >
      <div>
        <p className="text-sm font-medium text-heading">{copy.title}</p>
        <p className="text-xs text-muted-foreground mt-1">{copy.body}</p>
      </div>
      {canEdit ? (
        <Button type="button" size="sm" onClick={onEdit}>
          Edit payment plan
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Payments have already been requested or collected. Historical installments were not changed. Open the payment plan to use the financial-change workflow.
        </p>
      )}
    </div>
  );
}
