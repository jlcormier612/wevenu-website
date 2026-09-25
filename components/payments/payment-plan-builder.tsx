"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/invoices/constants";
import {
  OBLIGATION_KIND_OPTIONS,
  SCHEDULE_PRESETS,
  type PaymentTiming,
} from "@/lib/payments/constants";
import {
  createLineId,
  defaultEqualLines,
  linesFromPreset,
  resolveBuilderLineDueDate,
  syncAmountsFromPercentages,
  syncPercentagesFromAmounts,
  toCommitLines,
  validatePlanBuilderLines,
  type CommitBuilderLine,
  type PlanBuilderLineDraft,
  type PlanBuilderStructure,
} from "@/lib/payments/plan-builder";
import {
  formatPreviewDueDate,
  formatTimingLabel,
  type PaymentTimingContext,
} from "@/lib/payments/starters";
import type { PaymentObligationKind } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type Step = "structure" | "build" | "preview";

type TimingUiMode =
  | "due_today"
  | "after_execution"
  | "before_event"
  | "on_event"
  | "fixed"
  | "at_booking"
  | "after_booking";

function TimingFields({
  line,
  onChange,
}: {
  line: PlanBuilderLineDraft;
  onChange: (timing: PaymentTiming, dueDate: string) => void;
}) {
  const mode: TimingUiMode = line.dueDate.trim()
    ? "fixed"
    : line.timing.type === "due_today"
      ? "due_today"
      : line.timing.type === "after_execution"
        ? "after_execution"
        : line.timing.type === "on_event"
          ? "on_event"
          : line.timing.type === "at_booking"
            ? "at_booking"
            : line.timing.type === "after_booking"
              ? "after_booking"
              : line.timing.type === "before_event" && line.timing.days === 0
                ? "on_event"
                : "before_event";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Due date rule</label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={mode}
          onChange={(e) => {
            const v = e.target.value as TimingUiMode;
            if (v === "fixed") {
              onChange(line.timing, line.dueDate || new Date().toISOString().slice(0, 10));
              return;
            }
            if (v === "due_today") {
              onChange({ type: "due_today" }, "");
              return;
            }
            if (v === "after_execution") {
              onChange({ type: "after_execution", days: 0 }, "");
              return;
            }
            if (v === "on_event") {
              onChange({ type: "on_event" }, "");
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
          <option value="due_today">Due today</option>
          <option value="after_execution">Days after contract is fully executed</option>
          <option value="before_event">Days before event</option>
          <option value="on_event">On event date</option>
          <option value="fixed">Specific date</option>
          {(mode === "at_booking" || mode === "after_booking") && (
            <>
              <option value="at_booking">At booking (legacy)</option>
              <option value="after_booking">Days after booking (legacy)</option>
            </>
          )}
        </select>
      </div>
      {mode === "before_event" || mode === "after_execution" || mode === "after_booking" ? (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Days</label>
          <Input
            type="number"
            min={0}
            value={
              line.timing.type === "before_event"
                || line.timing.type === "after_execution"
                || line.timing.type === "after_booking"
                ? line.timing.days
                : 0
            }
            onChange={(e) => {
              const days = Math.max(0, Number(e.target.value) || 0);
              if (mode === "after_execution") {
                onChange({ type: "after_execution", days }, "");
              } else if (mode === "after_booking") {
                onChange({ type: "after_booking", days }, "");
              } else {
                onChange({ type: "before_event", days }, "");
              }
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
        <div className="flex items-end pb-2 text-xs text-muted-foreground">
          {mode === "due_today"
            ? "Uses today’s date"
            : mode === "on_event"
              ? "Uses the event date"
              : mode === "at_booking"
                ? "Uses the Event booking date (legacy)"
                : null}
        </div>
      )}
    </div>
  );
}

const FAST_PRESETS = SCHEDULE_PRESETS.filter((p) => p.items.length > 0);

export function PaymentPlanBuilder({
  invoiceTotal,
  timingCtx,
  initialPresetId = null,
  initialLines,
  defaultDeposit = 0,
  startAt = "structure",
  commitLabel = "Create payment plan",
  pending = false,
  onCommit,
  onCancel,
}: {
  invoiceTotal: number;
  timingCtx: PaymentTimingContext;
  initialPresetId?: string | null;
  initialLines?: PlanBuilderLineDraft[];
  defaultDeposit?: number;
  startAt?: Step;
  commitLabel?: string;
  pending?: boolean;
  onCommit: (lines: CommitBuilderLine[]) => void;
  onCancel?: () => void;
}) {
  const seededFromPreset =
    initialPresetId && initialPresetId !== "custom" && FAST_PRESETS.some((p) => p.id === initialPresetId);

  const [step, setStep] = React.useState<Step>(startAt);
  const [structure, setStructure] = React.useState<PlanBuilderStructure>(
    initialLines || initialPresetId === "custom" ? "custom" : seededFromPreset ? "percentage" : "custom",
  );
  const [equalCount, setEqualCount] = React.useState(4);
  const [lines, setLines] = React.useState<PlanBuilderLineDraft[]>(() => {
    if (initialLines && initialLines.length > 0) return initialLines;
    if (seededFromPreset) return linesFromPreset(initialPresetId!, invoiceTotal);
    return defaultEqualLines(4, invoiceTotal);
  });

  const validation = validatePlanBuilderLines(lines, invoiceTotal, timingCtx);

  function applyPreset(id: string) {
    setStructure("percentage");
    setLines(linesFromPreset(id, invoiceTotal));
    setStep("build");
  }

  function applyCustom() {
    setStructure("custom");
    setLines((prev) => (prev.length > 0 ? prev : defaultEqualLines(4, invoiceTotal)));
    setStep("build");
  }

  function updateLine(id: string, patch: Partial<PlanBuilderLineDraft>) {
    if (patch.amount != null) setStructure("custom");
    setLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      if (patch.amount == null && (structure === "percentage" || structure === "equal")) {
        return syncAmountsFromPercentages(next, invoiceTotal);
      }
      return syncPercentagesFromAmounts(next, invoiceTotal);
    });
  }

  function addLine() {
    const isFirst = lines.length === 0;
    setLines((prev) => [
      ...prev,
      {
        id: createLineId(),
        label: `Payment ${prev.length + 1}`,
        pctOfTotal: 0,
        amount: 0,
        timing: isFirst ? { type: "due_today" } : { type: "before_event", days: 30 },
        dueDate: "",
        obligationKind: (isFirst ? "deposit" : "installment") as PaymentObligationKind,
      },
    ]);
  }

  function handleCommit() {
    const v = validatePlanBuilderLines(lines, invoiceTotal, timingCtx);
    if (!v.ok) return;
    onCommit(toCommitLines(lines, timingCtx));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["structure", "build", "preview"] as Step[]).map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              if (s === "preview" && !validation.ok) return;
              setStep(s);
            }}
            className={cn(
              "rounded-full border px-3 py-1 capitalize",
              step === s
                ? "border-primary bg-primary/10 text-heading"
                : "border-border text-muted-foreground",
            )}
          >
            {i + 1}. {s === "structure" ? "Choose structure" : s === "build" ? "Build schedule" : "Preview"}
          </button>
        ))}
      </div>

      {step === "structure" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-heading">Fast preset payment plans</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Starting structures you can keep as-is or customize for this client.
            </p>
            <div className="mt-2 grid gap-2">
              {FAST_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                const deposit = Math.min(Math.max(0, defaultDeposit), invoiceTotal) || invoiceTotal;
                const remaining = Math.round((invoiceTotal - deposit) * 100) / 100;
                const next: PlanBuilderLineDraft[] = [{
                  id: createLineId(),
                  label: remaining > 0 ? "Deposit" : "Full payment",
                  pctOfTotal: invoiceTotal > 0 ? Math.round((deposit / invoiceTotal) * 10000) / 100 : 100,
                  amount: deposit,
                  timing: { type: "due_today" },
                  dueDate: "",
                  obligationKind: "deposit",
                }];
                if (remaining > 0) {
                  next.push({
                    id: createLineId(),
                    label: "Remaining balance",
                    pctOfTotal: invoiceTotal > 0 ? Math.round((remaining / invoiceTotal) * 10000) / 100 : 0,
                    amount: remaining,
                    timing: { type: "on_event" },
                    dueDate: "",
                    obligationKind: "final",
                  });
                }
                setStructure("custom");
                setLines(next);
                setStep("build");
              }}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-muted/40"
            >
              <p className="text-sm font-medium text-foreground">Deposit + final balance</p>
              <p className="text-xs text-muted-foreground mt-0.5">Deposit due today; remaining on the event date.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setStructure("custom");
                setLines([{
                  id: createLineId(),
                  label: "Full payment",
                  pctOfTotal: 100,
                  amount: invoiceTotal,
                  timing: { type: "due_today" },
                  dueDate: "",
                  obligationKind: "deposit",
                }]);
                setStep("build");
              }}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/40 hover:bg-muted/40"
            >
              <p className="text-sm font-medium text-foreground">Full payment now</p>
              <p className="text-xs text-muted-foreground mt-0.5">One installment for the full commitment, due today.</p>
            </button>
          </div>
          <button
            type="button"
            onClick={applyCustom}
            data-testid="custom-payment-plan"
            className="w-full rounded-lg border border-primary/40 bg-primary/5 p-3 text-left hover:border-primary"
          >
            <p className="text-sm font-medium text-heading">Custom payment plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Open the full builder for this client — any number of installments, agreement-relative or event-relative dates.
            </p>
          </button>
        </div>
      )}

      {step === "build" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-heading">Build schedule</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(invoiceTotal)} commitment. Customize amounts and due-date rules for this client, then preview.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setStep("structure")}>
              Change structure
            </Button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment {index + 1}
                  </p>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
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
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.amount}
                      onChange={(e) => updateLine(line.id, { amount: Number(e.target.value) || 0 })}
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
                  {formatCurrency(line.amount)} ·{" "}
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

          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add installment
          </Button>

          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              validation.ok ? "border-border bg-muted/20" : "border-amber-500/40 bg-amber-500/5",
            )}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span>Scheduled total</span>
              <span className="font-medium">{formatCurrency(validation.scheduledTotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>Commitment</span>
              <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
            </div>
            {validation.errors.map((e) => (
              <p key={e} className="mt-1 text-xs text-destructive">{e}</p>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("structure")}>
              Back
            </Button>
            <Button type="button" disabled={!validation.ok} onClick={() => setStep("preview")}>
              Preview payment plan
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-heading">Preview payment plan</p>
            <p className="text-xs text-muted-foreground">
              Review the complete schedule. You can edit again without losing this work. Creating the plan does not send or request payment.
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Total commitment</span>
              <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>Total scheduled</span>
              <span className="font-medium">{formatCurrency(validation.scheduledTotal)}</span>
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
                        {due ? formatPreviewDueDate(due) : formatTimingLabel(line.timing)}
                      </p>
                    </div>
                    <p className="font-semibold text-heading">{formatCurrency(line.amount)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("build")} disabled={pending}>
              Edit
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
                Cancel
              </Button>
            )}
            <Button type="button" onClick={handleCommit} disabled={pending || !validation.ok}>
              {pending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                commitLabel
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
