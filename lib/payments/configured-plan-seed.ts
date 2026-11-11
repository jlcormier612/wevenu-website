/**
 * Map venue commercial-booking defaults onto PaymentPlanBuilder seed state.
 * Does not invent a second schedule model. Never silently becomes generic
 * four-equal payments for an unrecognized mapping.
 */
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import {
  applyCustomScheduleToTotal,
  type CustomScheduleTemplate,
} from "@/lib/payments/custom-default-schedule";
import {
  createLineId,
  defaultEqualLines,
  linesFromPreset,
  type PlanBuilderLineDraft,
  type PlanBuilderStructure,
} from "@/lib/payments/plan-builder";
import type { RemainingBalanceMode } from "@/lib/booking-journey/venue-prefs";

const FAST_PRESET_IDS = new Set(
  SCHEDULE_PRESETS.filter((p) => p.items.length > 0).map((p) => p.id),
);

export type ConfiguredPlanSeed = {
  initialPresetId: string | null;
  startAt: "structure" | "build";
  structure: PlanBuilderStructure;
  lines: PlanBuilderLineDraft[];
  /** Highlight key on the structure step. */
  selectedKey: "preset" | "deposit_remaining" | "custom" | null;
};

function depositRemainingLines(invoiceTotal: number, defaultDeposit: number): PlanBuilderLineDraft[] {
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
  return next;
}

export function draftsFromCustomTemplate(
  template: CustomScheduleTemplate,
  invoiceTotal: number,
): PlanBuilderLineDraft[] | null {
  const applied = applyCustomScheduleToTotal({
    template,
    total: invoiceTotal,
    today: "2000-01-01",
    eventDate: "2000-12-31",
  });
  if (!applied.ok) return null;
  return template.items.map((item, i) => ({
    id: createLineId(),
    label: item.label,
    pctOfTotal: item.pctOfTotal,
    amount: applied.lines[i]?.amount ?? 0,
    timing: item.timing,
    dueDate: "",
    obligationKind: item.obligationKind,
  }));
}

export function resolveConfiguredPlanSeed(input: {
  remainingBalanceMode?: RemainingBalanceMode | null;
  defaultSchedulePresetId?: string | null;
  customSchedule?: CustomScheduleTemplate | null;
  invoiceTotal: number;
  defaultDeposit?: number;
}): ConfiguredPlanSeed {
  const mode = input.remainingBalanceMode === "varies" ? "final" : input.remainingBalanceMode;
  const preset = input.defaultSchedulePresetId?.trim() || null;
  const deposit = input.defaultDeposit ?? 0;

  if (mode === "plan" && preset === "custom") {
    const lines = input.customSchedule
      ? draftsFromCustomTemplate(input.customSchedule, input.invoiceTotal)
      : null;
    if (lines && lines.length > 0) {
      return {
        initialPresetId: "custom",
        startAt: "build",
        structure: "custom",
        lines,
        selectedKey: "custom",
      };
    }
    return {
      initialPresetId: "custom",
      startAt: "structure",
      structure: "custom",
      lines: defaultEqualLines(4, input.invoiceTotal),
      selectedKey: "custom",
    };
  }

  if (mode === "plan" && preset && FAST_PRESET_IDS.has(preset)) {
    return {
      initialPresetId: preset,
      startAt: "build",
      structure: "percentage",
      lines: linesFromPreset(preset, input.invoiceTotal),
      selectedKey: "preset",
    };
  }

  // remainingBalanceMode "final", or plan with no valid FAST_PRESET id
  // (including the settings sentinel "deposit_remaining").
  if (mode === "final" || preset === "deposit_remaining" || !preset || !FAST_PRESET_IDS.has(preset)) {
    return {
      initialPresetId: "deposit_remaining",
      startAt: "build",
      structure: "custom",
      lines: depositRemainingLines(input.invoiceTotal, deposit),
      selectedKey: "deposit_remaining",
    };
  }

  return {
    initialPresetId: preset,
    startAt: "build",
    structure: "percentage",
    lines: linesFromPreset(preset, input.invoiceTotal),
    selectedKey: "preset",
  };
}
