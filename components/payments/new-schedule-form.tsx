"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createScheduleAction } from "@/app/(app)/payments/actions";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/invoices/constants";
import type { Invoice } from "@/lib/invoices/types";
import type { PaymentErrors, ScheduleInput } from "@/lib/payments/types";
import {
  getAdditionalSchedulePresets,
  getPaymentPlanStarters,
} from "@/lib/payments/starters";

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule always belongs
 * to exactly one Invoice, and its total is that invoice's total — never a
 * client dropdown, never a free-typed amount. The page that renders this
 * form guarantees `linkedInvoice` is always present.
 */
export function NewScheduleForm({ linkedInvoice }: { linkedInvoice: Invoice }) {
  const router = useRouter();
  const starters = getPaymentPlanStarters();
  const additional = getAdditionalSchedulePresets();
  const [input, setInput] = React.useState<ScheduleInput>({
    title: linkedInvoice.clientName ? `Payment Plan — ${linkedInvoice.clientName}` : `Payment Plan — ${linkedInvoice.invoiceNumber}`,
    invoiceId: linkedInvoice.id,
    notes: "",
  });
  const [presetId, setPresetId] = React.useState(starters[0]?.id ?? "thirds");
  const [showAdditional, setShowAdditional] = React.useState(false);
  const [errors, setErrors] = React.useState<PaymentErrors>({});
  const [pending, startTransition] = React.useTransition();

  function handleSubmit() {
    startTransition(async () => {
      const result = await createScheduleAction(input, presetId, linkedInvoice.eventDate ?? null);
      if (result.ok) { toast.success("Payment plan created."); router.push(`/payments/${result.scheduleId}`); return; }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Invoice linked</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
          <span className="font-medium text-heading">{linkedInvoice.invoiceNumber}</span>
          <span className="text-muted-foreground">Total: <span className="font-medium text-foreground">{formatCurrency(linkedInvoice.total)}</span></span>
          <span className="text-muted-foreground">Balance due: <span className="font-medium text-foreground">{formatCurrency(linkedInvoice.balanceDue)}</span></span>
        </div>
        <p className="text-xs text-muted-foreground">
          This payment plan always tracks the invoice&apos;s total — {formatCurrency(linkedInvoice.total)} isn&apos;t editable here. Change the invoice&apos;s line items to change it.
        </p>
      </div>

      <Field label="Plan title *" htmlFor="ps-title" error={errors.title}>
        <Input id="ps-title" value={input.title}
          onChange={(e) => { setInput((p) => ({ ...p, title: e.target.value })); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
          placeholder="Payment Plan — Client Name" aria-invalid={errors.title ? true : undefined} />
      </Field>

      <Separator />
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Starting schedule</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose a starting schedule, then adjust it to match the way your venue collects payments.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {starters.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setPresetId(preset.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${presetId === preset.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
            >
              <p className="text-sm font-medium text-foreground">{preset.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
              {preset.items.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {preset.items.map((item) => (
                    <li key={item.label}>• {item.label}</li>
                  ))}
                </ul>
              )}
            </button>
          ))}
        </div>
        {additional.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setShowAdditional((v) => !v)}
            >
              {showAdditional ? "Hide additional splits" : "Show additional certified splits"}
            </button>
            {showAdditional && (
              <div className="grid gap-2 sm:grid-cols-2">
                {additional.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${presetId === preset.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                  >
                    <p className="text-sm font-medium text-foreground">{preset.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Amounts are calculated from the invoice total. Dates use the event date when known. You can rename, add, remove, and adjust everything after creation.
        </p>
      </div>

      <Field label="Internal notes" htmlFor="ps-notes" hint="Optional — visible only to your team.">
        <Textarea id="ps-notes" value={input.notes}
          onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Any notes about this payment arrangement…" rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</> : "Create Payment Plan"}
        </Button>
      </div>
    </div>
  );
}
