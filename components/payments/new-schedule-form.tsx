"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  OBLIGATION_KIND_OPTIONS,
  type PaymentTiming,
} from "@/lib/payments/constants";
import {
  PLAN_BUILDER_QUICK_PRESETS,
  PLAN_BUILDER_STRUCTURES,
  createLineId,
  defaultEqualLines,
  linesFromPreset,
  resolveBuilderLineDueDate,
  syncAmountsFromPercentages,
  syncPercentagesFromAmounts,
  toCommitLines,
  validatePlanBuilderLines,
  type PlanBuilderLineDraft,
  type PlanBuilderQuickPresetId,
  type PlanBuilderStructure,
} from "@/lib/payments/plan-builder";
import {
  formatPreviewDueDate,
  formatTimingLabel,
} from "@/lib/payments/starters";
import type { PaymentErrors, PaymentObligationKind, ScheduleInput } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type Step = "structure" | "build" | "review";

function TimingFields({
  line,
  onChange,
}: {
  line: PlanBuilderLineDraft;
  onChange: (timing: PaymentTiming, dueDate: string) => void;
}) {
  const mode =
    line.dueDate.trim()
      ? "fixed"
      : line.timing.type === "at_booking"
        ? "at_booking"
        : line.timing.type === "after_booking"
          ? "after_booking"
          : "before_event";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Due date rule</label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={mode}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "fixed") {
              onChange(line.timing, line.dueDate || new Date().toISOString().slice(0, 10));
              return;
            }
            if (v === "at_booking") {
              onChange({ type: "at_booking" }, "");
              return;
            }
            if (v === "after_booking") {
              onChange({ type: "after_booking", days: 7 }, "");
              return;
            }
            onChange({ type: "before_event", days: 30 }, "");
          }}
        >
          <option value="at_booking">At booking</option>
          <option value="before_event">Days before event</option>
          <option value="after_booking">Days after booking</option>
          <option value="fixed">Specific date</option>
        </select>
      </div>
      {mode === "before_event" || mode === "after_booking" ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Days</label>
          <Input
            type="number"
            min={0}
            value={
              line.timing.type === "before_event" || line.timing.type === "after_booking"
                ? line.timing.days
                : 0
            }
            onChange={(e) => {
              const days = Math.max(0, Number(e.target.value) || 0);
              onChange(
                mode === "after_booking"
                  ? { type: "after_booking", days }
                  : { type: "before_event", days },
                "",
              );
            }}
          />
        </div>
      ) : mode === "fixed" ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input
            type="date"
            value={line.dueDate}
            onChange={(e) => onChange(line.timing, e.target.value)}
          />
        </div>
      ) : (
        <div className="flex items-end text-xs text-muted-foreground pb-2">
          Uses the Event booking date
        </div>
      )}
    </div>
  );
}

/**
 * Payment Plan Builder — builds the invoice-tied payment schedule.
 * Presets are builder options only (not Library assets).
 */
export function NewScheduleForm({
  linkedInvoice,
  initialPresetId,
}: {
  linkedInvoice: Invoice;
  initialPresetId?: string | null;
}) {
  const router = useRouter();
  const invoiceTotal = linkedInvoice.total;
  const timingCtx = {
    eventDate: linkedInvoice.eventDate,
    bookingDate: linkedInvoice.bookedAt,
  };

  const initialQuick =
    initialPresetId === "thirds" ||
    initialPresetId === "fifty_fifty" ||
    initialPresetId === "wedding_four"
      ? (initialPresetId as PlanBuilderQuickPresetId)
      : "thirds";

  const [step, setStep] = React.useState<Step>("structure");
  const [structure, setStructure] = React.useState<PlanBuilderStructure>(
    initialPresetId === "custom" ? "custom" : "percentage",
  );
  const [equalCount, setEqualCount] = React.useState(3);
  const [lines, setLines] = React.useState<PlanBuilderLineDraft[]>(() =>
    linesFromPreset(initialQuick, invoiceTotal),
  );
  const [input, setInput] = React.useState<ScheduleInput>({
    title: linkedInvoice.clientName
      ? `Payment schedule — ${linkedInvoice.clientName}`
      : `Payment schedule — ${linkedInvoice.invoiceNumber}`,
    invoiceId: linkedInvoice.id,
    notes: "",
  });
  const [errors, setErrors] = React.useState<PaymentErrors>({});
  const [pending, startTransition] = React.useTransition();

  const validation = validatePlanBuilderLines(lines, invoiceTotal, timingCtx);
  const setBookingHref = linkedInvoice.eventId
    ? `/events/${linkedInvoice.eventId}/edit`
    : null;

  function applyQuickPreset(id: PlanBuilderQuickPresetId) {
    setStructure("percentage");
    setLines(linesFromPreset(id, invoiceTotal));
    setStep("build");
  }

  function applyStructure(next: PlanBuilderStructure) {
    setStructure(next);
    if (next === "equal") {
      setLines(defaultEqualLines(equalCount, invoiceTotal));
    } else if (next === "custom" && lines.length === 0) {
      setLines(defaultEqualLines(1, invoiceTotal));
    } else if (next === "percentage") {
      setLines(syncAmountsFromPercentages(lines.length ? lines : defaultEqualLines(3, invoiceTotal), invoiceTotal));
    } else if (next === "dollar") {
      setLines(syncPercentagesFromAmounts(lines.length ? lines : defaultEqualLines(3, invoiceTotal), invoiceTotal));
    }
    setStep("build");
  }

  function updateLine(id: string, patch: Partial<PlanBuilderLineDraft>) {
    setLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      if (structure === "percentage" || structure === "equal") {
        return syncAmountsFromPercentages(next, invoiceTotal);
      }
      if (structure === "dollar" || structure === "custom") {
        return syncPercentagesFromAmounts(next, invoiceTotal);
      }
      return next;
    });
  }

  function addLine() {
    const isFirst = lines.length === 0;
    const newLine: PlanBuilderLineDraft = {
      id: createLineId(),
      label: `Payment ${lines.length + 1}`,
      pctOfTotal: 0,
      amount: 0,
      timing: isFirst ? { type: "at_booking" } : { type: "before_event", days: 30 },
      dueDate: "",
      obligationKind: isFirst ? "deposit" : "installment",
    };
    setLines((prev) => [...prev, newLine]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleCommit() {
    const v = validatePlanBuilderLines(lines, invoiceTotal, timingCtx);
    if (!v.ok) {
      toast.error(v.errors[0] ?? "Fix the schedule before saving.");
      return;
    }
    const commitLines = toCommitLines(lines, timingCtx);
    startTransition(async () => {
      const result = await createScheduleAction(input, "custom", commitLines);
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
          Payment Plan Builder
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm">
          <span className="font-medium text-heading">{linkedInvoice.invoiceNumber}</span>
          {linkedInvoice.clientName && (
            <span className="text-muted-foreground">{linkedInvoice.clientName}</span>
          )}
          <span className="text-muted-foreground">
            Invoice total:{" "}
            <span className="font-medium text-foreground">{formatCurrency(invoiceTotal)}</span>
          </span>
          {linkedInvoice.eventDate && (
            <span className="text-muted-foreground">
              Event: <span className="font-medium text-foreground">{linkedInvoice.eventDate}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Choose how {formatCurrency(invoiceTotal)} should be collected. The schedule you save becomes this booking&apos;s payment commitment.
        </p>
      </div>

      <Field label="Schedule name *" htmlFor="ps-title" error={errors.title} hint="Shown to your team on this booking.">
        <Input
          id="ps-title"
          value={input.title}
          onChange={(e) => {
            setInput((p) => ({ ...p, title: e.target.value }));
            setErrors((p) => {
              const n = { ...p };
              delete n.title;
              return n;
            });
          }}
          placeholder="Payment schedule — Client Name"
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["structure", "build", "review"] as Step[]).map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              if (s === "review" && !validation.ok) return;
              if (s === "build" || s === "structure" || validation.ok) setStep(s);
            }}
            className={cn(
              "rounded-full border px-3 py-1 capitalize",
              step === s
                ? "border-primary bg-primary/10 text-heading"
                : "border-border text-muted-foreground",
            )}
          >
            {i + 1}. {s === "structure" ? "Choose structure" : s === "build" ? "Build schedule" : "Review"}
          </button>
        ))}
      </div>

      {step === "structure" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-heading">Quick-start presets</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Starting structures you can customize — not Library templates.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {PLAN_BUILDER_QUICK_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyQuickPreset(p.id)}
                  className="rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-heading">Or choose a structure</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PLAN_BUILDER_STRUCTURES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStructure(s.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    structure === s.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </button>
              ))}
            </div>
            {structure === "equal" && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Number of payments</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    className="w-24"
                    value={equalCount}
                    onChange={(e) => setEqualCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  />
                </div>
                <Button type="button" size="sm" onClick={() => applyStructure("equal")}>
                  Build equal schedule
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "build" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-heading">Build schedule</p>
              <p className="text-xs text-muted-foreground">
                Structure: {PLAN_BUILDER_STRUCTURES.find((s) => s.id === structure)?.label}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setStep("structure")}>
              Change structure
            </Button>
          </div>

          {structure === "equal" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Number of payments</label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  className="w-24"
                  value={equalCount}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(12, Number(e.target.value) || 1));
                    setEqualCount(n);
                    setLines(defaultEqualLines(n, invoiceTotal));
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment {index + 1}
                  </p>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLine(line.id)}
                      aria-label="Remove payment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input
                      value={line.label}
                      onChange={(e) => updateLine(line.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Type</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={line.obligationKind}
                      onChange={(e) =>
                        updateLine(line.id, {
                          obligationKind: e.target.value as PaymentObligationKind,
                        })
                      }
                    >
                      {OBLIGATION_KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {(structure === "percentage" || structure === "equal") && (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Percent</label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.pctOfTotal}
                        disabled={structure === "equal"}
                        onChange={(e) =>
                          updateLine(line.id, { pctOfTotal: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount}
                      disabled={structure === "percentage" || structure === "equal"}
                      onChange={(e) =>
                        updateLine(line.id, { amount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
                <TimingFields
                  line={line}
                  onChange={(timing, dueDate) => updateLine(line.id, { timing, dueDate })}
                />
                {validation.lineErrors[line.id] && (
                  <p className="text-xs text-destructive">{validation.lineErrors[line.id]}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {line.pctOfTotal}% · {formatCurrency(line.amount)} ·{" "}
                  {line.dueDate.trim()
                    ? formatPreviewDueDate(line.dueDate)
                    : formatTimingLabel(line.timing)}
                  {(() => {
                    const due = resolveBuilderLineDueDate(line, timingCtx);
                    return due && !line.dueDate.trim()
                      ? ` — ${formatPreviewDueDate(due)}`
                      : null;
                  })()}
                </p>
              </div>
            ))}
          </div>

          {(structure === "custom" || structure === "dollar" || structure === "percentage") && (
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add payment
            </Button>
          )}

          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              validation.ok
                ? "border-border bg-muted/20"
                : "border-amber-500/40 bg-amber-500/5",
            )}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span>Scheduled total</span>
              <span className="font-medium">{formatCurrency(validation.scheduledTotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>Invoice total</span>
              <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
            </div>
            {validation.remaining > 0 && (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Remaining to allocate: {formatCurrency(validation.remaining)}
              </p>
            )}
            {validation.overAllocated > 0 && (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Over-allocated by: {formatCurrency(validation.overAllocated)}
              </p>
            )}
            {validation.errors.map((e) => (
              <p key={e} className="mt-1 text-xs text-destructive">{e}</p>
            ))}
          </div>

          {!linkedInvoice.bookedAt &&
            lines.some(
              (l) =>
                !l.dueDate.trim() &&
                (l.timing.type === "at_booking" || l.timing.type === "after_booking"),
            ) && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-heading">Booking date needed</p>
                <p className="text-xs text-muted-foreground">
                  One or more payments use booking timing. Add the booking date, or set a specific due date on those lines.
                </p>
                {setBookingHref ? (
                  <Button size="sm" variant="outline" render={<Link href={setBookingHref} />}>
                    Set booking date
                  </Button>
                ) : null}
              </div>
            )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("structure")}>
              Back
            </Button>
            <Button
              type="button"
              disabled={!validation.ok}
              onClick={() => setStep("review")}
            >
              Review schedule
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-heading">Review before saving</p>
            <p className="text-xs text-muted-foreground">
              Saving creates this booking&apos;s payment schedule. Later preset changes will not alter it.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Invoice total</span>
              <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Total scheduled</span>
              <span className="font-medium">{formatCurrency(validation.scheduledTotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Balance after schedule</span>
              <span className="font-medium">{formatCurrency(0)}</span>
            </div>
            <Separator />
            <ul className="space-y-2">
              {lines.map((line, i) => {
                const due = resolveBuilderLineDueDate(line, timingCtx);
                return (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        Payment {i + 1}: {line.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {line.pctOfTotal}%
                        {" · "}
                        {due
                          ? formatPreviewDueDate(due)
                          : formatTimingLabel(line.timing)}
                      </p>
                    </div>
                    <p className="font-semibold text-heading">{formatCurrency(line.amount)}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          <Field label="Internal notes" htmlFor="ps-notes" hint="Optional — visible only to your team.">
            <Textarea
              id="ps-notes"
              value={input.notes}
              onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any notes about this payment arrangement…"
              rows={2}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("build")} disabled={pending}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCommit} disabled={pending || !validation.ok}>
              {pending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Save payment schedule"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
