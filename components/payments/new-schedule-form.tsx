"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
  allocatePresetAmounts,
  formatPresetPercent,
  formatPreviewDueDate,
  formatTimingLabel,
  getAdditionalSchedulePresets,
  getPaymentPlanStarters,
  resolvePresetItemDueDate,
} from "@/lib/payments/starters";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule always belongs
 * to exactly one Invoice, and its total is that invoice's total — never a
 * client dropdown, never a free-typed amount. The page that renders this
 * form guarantees `linkedInvoice` is always present.
 */
export function NewScheduleForm({
  linkedInvoice,
  initialPresetId,
}: {
  linkedInvoice: Invoice;
  initialPresetId?: string | null;
}) {
  const router = useRouter();
  const starters = getPaymentPlanStarters();
  const additional = getAdditionalSchedulePresets();
  const knownIds = new Set([...starters, ...additional].map((p) => p.id));
  const startPreset =
    initialPresetId && knownIds.has(initialPresetId)
      ? initialPresetId
      : (starters[0]?.id ?? "thirds");
  const [input, setInput] = React.useState<ScheduleInput>({
    title: linkedInvoice.clientName
      ? `Payment schedule — ${linkedInvoice.clientName}`
      : `Payment schedule — ${linkedInvoice.invoiceNumber}`,
    invoiceId: linkedInvoice.id,
    notes: "",
  });
  const [presetId, setPresetId] = React.useState(startPreset);
  const [showAdditional, setShowAdditional] = React.useState(
    Boolean(initialPresetId && additional.some((p) => p.id === initialPresetId)),
  );
  const [errors, setErrors] = React.useState<PaymentErrors>({});
  const [pending, startTransition] = React.useTransition();

  const selectedPreset = SCHEDULE_PRESETS.find((p) => p.id === presetId) ?? null;
  const previewAmounts = selectedPreset && selectedPreset.items.length > 0
    ? allocatePresetAmounts(linkedInvoice.total, selectedPreset.items)
    : [];
  const needsBookingDate = Boolean(
    selectedPreset?.items.some(
      (i) => i.timing.type === "at_booking" || i.timing.type === "after_booking",
    ),
  );
  const missingBookingDate = needsBookingDate && !linkedInvoice.bookedAt;
  const timingCtx = {
    eventDate: linkedInvoice.eventDate,
    bookingDate: linkedInvoice.bookedAt,
  };
  const setBookingHref = linkedInvoice.eventId
    ? `/events/${linkedInvoice.eventId}/edit`
    : null;

  function handleSubmit() {
    startTransition(async () => {
      const result = await createScheduleAction(input, presetId);
      if (result.ok) {
        toast.success("Payment schedule created for this booking.");
        router.push(`/payments/${result.scheduleId}`);
        return;
      }
      if (result.errors) setErrors(result.errors);
      toast.error(result.message ?? "Please fix the highlighted fields.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">
          Creating a schedule for this invoice
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
          <span className="font-medium text-heading">{linkedInvoice.invoiceNumber}</span>
          {linkedInvoice.clientName && (
            <span className="text-muted-foreground">{linkedInvoice.clientName}</span>
          )}
          <span className="text-muted-foreground">
            Total: <span className="font-medium text-foreground">{formatCurrency(linkedInvoice.total)}</span>
          </span>
          {linkedInvoice.eventDate && (
            <span className="text-muted-foreground">
              Event: <span className="font-medium text-foreground">{linkedInvoice.eventDate}</span>
            </span>
          )}
          {linkedInvoice.bookedAt && (
            <span className="text-muted-foreground">
              Booked: <span className="font-medium text-foreground">{formatPreviewDueDate(linkedInvoice.bookedAt)}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Installment amounts always add up to this invoice total ({formatCurrency(linkedInvoice.total)}).
          Change the invoice&apos;s line items if you need a different total — not here.
        </p>
      </div>

      <Field label="Schedule name *" htmlFor="ps-title" error={errors.title} hint="Shown to your team on this booking.">
        <Input id="ps-title" value={input.title}
          onChange={(e) => { setInput((p) => ({ ...p, title: e.target.value })); setErrors((p) => { const n = {...p}; delete n.title; return n; }); }}
          placeholder="Payment schedule — Client Name" aria-invalid={errors.title ? true : undefined} />
      </Field>

      <Separator />
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Starting plan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pick a starter. You can customize every line on the schedule after it&apos;s created for this booking.
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
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {preset.items.map((item) => (
                    <li key={item.label}>
                      {item.label} · {formatPresetPercent(item.pctOfTotal)} · {formatTimingLabel(item.timing)}
                    </li>
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
              {showAdditional ? "Hide more starting splits" : "Show more starting splits"}
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
                    <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      {preset.items.map((item) => (
                        <li key={item.label}>
                          {item.label} · {formatPresetPercent(item.pctOfTotal)} · {formatTimingLabel(item.timing)}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {missingBookingDate && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-heading">Booking date needed</p>
            <p className="text-xs text-muted-foreground">
              This payment plan includes a payment due at booking. Add the booking date to continue —
              Hello to Cheers will not assume today is the booking date.
            </p>
            <p className="text-xs text-muted-foreground">
              Booking date is normally set automatically when a lead becomes a booking, or when you Direct Add a couple with a live event date.
            </p>
            {setBookingHref ? (
              <Button size="sm" variant="outline" render={<Link href={setBookingHref} />}>
                Set booking date
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Link this invoice to an Event, then set the booking date on that Event.
              </p>
            )}
          </div>
        )}

        {selectedPreset && selectedPreset.items.length > 0 && !missingBookingDate && (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Preview for this booking
            </p>
            <ul className="space-y-2 text-sm">
              {selectedPreset.items.map((item, i) => {
                const amount = previewAmounts[i] ?? 0;
                const dueIso = resolvePresetItemDueDate(item, timingCtx);
                const needsEvent = item.timing.type === "before_event" && !linkedInvoice.eventDate;
                return (
                  <li key={item.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPresetPercent(item.pctOfTotal)}
                        {" · "}
                        {formatTimingLabel(item.timing)}
                        {dueIso
                          ? ` — ${formatPreviewDueDate(dueIso)}`
                          : null}
                        {needsEvent
                          ? " (calendar date set once this invoice has an Event date)"
                          : null}
                      </p>
                    </div>
                    <p className="font-semibold text-heading">{formatCurrency(amount)}</p>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              These dates and amounts become editable on the schedule after you create it. The couple sees the
              schedule once you share payments with them through the portal.
            </p>
          </div>
        )}

        {selectedPreset?.id === "custom" && (
          <p className="text-xs text-muted-foreground">
            Custom starts empty — after you create the schedule, add each payment line with the amount and due date you want.
          </p>
        )}
      </div>

      <Field label="Internal notes" htmlFor="ps-notes" hint="Optional — visible only to your team.">
        <Textarea id="ps-notes" value={input.notes}
          onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Any notes about this payment arrangement…" rows={2} />
      </Field>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={handleSubmit} disabled={pending || missingBookingDate}>
          {pending
            ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</>
            : "Create schedule for this booking"}
        </Button>
      </div>
    </div>
  );
}
