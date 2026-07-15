"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  addReviewInstallmentAction, collectRemainingBalanceManuallyAction,
  keepExistingScheduleAction, regeneratePaymentScheduleAction,
} from "@/app/(app)/payments/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, SCHEDULE_PRESETS } from "@/lib/payments/constants";

type Mode = null | "regenerate" | "add_installment";

/**
 * Booking Financial Architecture Phase 3c — "Payment Plans should NEVER
 * update automatically... surface a clear Needs Review state... let the
 * coordinator explicitly choose." Same calm, non-alarming register as the
 * Event Order drift banner — this isn't an error, it's a schedule that no
 * longer matches its invoice's current total, made visible instead of
 * silently drifting.
 */
export function ScheduleReviewBanner({
  scheduleId, scheduleTotal, invoiceTotal,
}: { scheduleId: string; scheduleTotal: number; invoiceTotal: number }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(null);
  const [presetId, setPresetId] = React.useState("fifty_fifty");
  const [label, setLabel] = React.useState("");
  const [amount, setAmount] = React.useState(String(Math.max(0, invoiceTotal - scheduleTotal)));
  const [dueDate, setDueDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function reset() { setMode(null); setLabel(""); setDueDate(""); setAmount(String(Math.max(0, invoiceTotal - scheduleTotal))); }

  function handleKeep() {
    startTransition(async () => {
      const result = await keepExistingScheduleAction(scheduleId);
      if (!result.ok) toast.error(result.message ?? "Could not update.");
      else { toast.success("Kept as-is."); router.refresh(); }
    });
  }

  function handleCollectManually() {
    startTransition(async () => {
      const result = await collectRemainingBalanceManuallyAction(scheduleId);
      if (!result.ok) toast.error(result.message ?? "Could not update.");
      else { toast.success("Noted — collecting the difference outside this schedule."); router.refresh(); }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regeneratePaymentScheduleAction(scheduleId, presetId);
      if (!result.ok) toast.error(result.message ?? "Could not regenerate.");
      else { toast.success("Schedule regenerated."); reset(); router.refresh(); }
    });
  }

  function handleAddInstallment() {
    startTransition(async () => {
      const result = await addReviewInstallmentAction(scheduleId, { label, amount, dueDate });
      if (!result.ok) toast.error(result.message ?? "Could not add installment.");
      else { toast.success("Installment added."); reset(); router.refresh(); }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-heading">This payment plan no longer matches the invoice.</p>
        <p className="text-xs text-muted-foreground">
          Schedule total {formatMoney(scheduleTotal)} · Invoice total {formatMoney(invoiceTotal)}. The schedule hasn&apos;t changed — this is just letting you know they no longer agree.
        </p>
      </div>

      {mode === null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleKeep}>Keep Existing Schedule</Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setMode("regenerate")}>Regenerate Schedule</Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setMode("add_installment")}>Add Additional Installment</Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleCollectManually}>Collect Remaining Balance Manually</Button>
        </div>
      )}

      {mode === "regenerate" && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            Already-collected installments are never touched. Everything still pending will be replaced with new installments covering the remaining balance.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCHEDULE_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setPresetId(preset.id)}
                className={`rounded-lg border p-2.5 text-left transition-colors ${presetId === preset.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <p className="text-sm font-medium text-foreground">{preset.label}</p>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>Cancel</Button>
            <Button type="button" size="sm" disabled={pending} onClick={handleRegenerate}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerate"}
            </Button>
          </div>
        </div>
      )}

      {mode === "add_installment" && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Additional charges" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={pending}>Cancel</Button>
            <Button type="button" size="sm" disabled={!label.trim() || !amount.trim() || pending} onClick={handleAddInstallment}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add Installment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
