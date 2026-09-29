"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { TimingFields } from "@/components/payments/timing-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/invoices/constants";
import {
  OBLIGATION_KIND_OPTIONS,
  SCHEDULE_PRESETS,
} from "@/lib/payments/constants";
import type { CustomScheduleTemplate } from "@/lib/payments/custom-default-schedule";
import {
  draftsFromCustomTemplate,
  resolveConfiguredPlanSeed,
} from "@/lib/payments/configured-plan-seed";
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

const FAST_PRESETS = SCHEDULE_PRESETS.filter((p) => p.items.length > 0);

export function PaymentPlanBuilder({
  invoiceTotal,
  timingCtx,
  initialPresetId = null,
  initialLines,
  defaultDeposit = 0,
  startAt,
  remainingBalanceMode = null,
  customSchedule = null,
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
  remainingBalanceMode?: "final" | "plan" | "varies" | null;
  customSchedule?: CustomScheduleTemplate | null;
  commitLabel?: string;
  pending?: boolean;
  onCommit: (lines: CommitBuilderLine[]) => void;
  onCancel?: () => void;
}) {
  const configured = resolveConfiguredPlanSeed({
    remainingBalanceMode,
    defaultSchedulePresetId: initialPresetId,
    customSchedule,
    invoiceTotal,
    defaultDeposit,
  });
  const [step, setStep] = React.useState<Step>(
    initialLines && initialLines.length > 0 ? (startAt ?? "build") : (startAt ?? configured.startAt),
  );
  const [structure, setStructure] = React.useState<PlanBuilderStructure>(
    initialLines ? "custom" : configured.structure,
  );
  const [selectedKey, setSelectedKey] = React.useState(configured.selectedKey);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string | null>(
    configured.selectedKey === "preset" ? configured.initialPresetId : null,
  );
  const [lines, setLines] = React.useState<PlanBuilderLineDraft[]>(() => {
    if (initialLines && initialLines.length > 0) return initialLines;
    return configured.lines;
  });

  const validation = validatePlanBuilderLines(lines, invoiceTotal, timingCtx);

  function applyPreset(id: string) {
    setStructure("percentage");
    setSelectedKey("preset");
    setSelectedPresetId(id);
    setLines(linesFromPreset(id, invoiceTotal));
    setStep("build");
  }

  function applyCustom() {
    const fromSaved = customSchedule
      ? draftsFromCustomTemplate(customSchedule, invoiceTotal)
      : null;
    setStructure("custom");
    setSelectedKey("custom");
    setSelectedPresetId(null);
    setLines((prev) => (fromSaved && fromSaved.length > 0
      ? fromSaved
      : (prev.length > 0 ? prev : defaultEqualLines(4, invoiceTotal))));
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
                  data-selected={selectedKey === "preset" && selectedPresetId === p.id ? "true" : "false"}
                  className={cn(
                    "rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-muted/40",
                    selectedKey === "preset" && selectedPresetId === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
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
                setSelectedKey("deposit_remaining");
                setLines(next);
                setStep("build");
              }}
              className={cn(
                "rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-muted/40",
                selectedKey === "deposit_remaining" ? "border-primary bg-primary/10" : "border-border",
              )}
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
            data-selected={selectedKey === "custom" ? "true" : "false"}
            className={cn(
              "w-full rounded-lg border p-3 text-left hover:border-primary",
              selectedKey === "custom"
                ? "border-primary bg-primary/10"
                : "border-primary/40 bg-primary/5",
            )}
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
              {selectedKey === "preset" && selectedPresetId && (
                <p className="text-xs text-heading mt-1" data-testid="configured-preset-label">
                  {FAST_PRESETS.find((p) => p.id === selectedPresetId)?.label ?? selectedPresetId}
                </p>
              )}
              {selectedKey === "custom" && (
                <p className="text-xs text-heading mt-1" data-testid="configured-preset-label">Custom payment plan</p>
              )}
              {selectedKey === "deposit_remaining" && (
                <p className="text-xs text-heading mt-1" data-testid="configured-preset-label">Deposit + final balance</p>
              )}
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
                  today={timingCtx.today}
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
              Review schedule
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-heading">Review schedule</p>
            <p className="text-xs text-muted-foreground">
              Review the complete schedule. You can edit again without losing this work. Saving does not send.
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
