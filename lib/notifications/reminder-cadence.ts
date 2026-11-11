/**
 * Pure reminder-cadence types and helpers — safe for Client Components.
 * Server-only obligation scheduling lives in obligations.ts.
 */

export type AfterDueCadenceLabel = "weekly" | "every_3_days" | "daily" | "none";

/**
 * Allowed before-due offsets as days relative to the due/expiration date.
 * Negative = before; 0 = on the due/expiration date.
 */
export const BEFORE_DUE_OFFSET_OPTIONS = [-21, -14, -7, 0] as const;
export type BeforeDueOffsetDays = (typeof BEFORE_DUE_OFFSET_OPTIONS)[number];

/**
 * Legacy named presets — kept only for migration mapping / tests.
 * Live storage is explicit offset arrays.
 */
export type BeforeDueCadenceLabel =
  | "weekly"          // 21, 14, 7 days before
  | "once_week"       // 7 days before
  | "once_two_weeks"  // 14 days before
  | "on_due"          // morning of the due date
  | "none";

/** @deprecated Prefer AfterDueCadenceLabel. Kept for call sites. */
export type CadenceLabel = AfterDueCadenceLabel;

export type ReminderCadence = {
  paymentBeforeDueOffsets: number[];
  paymentAfterDueCadence: AfterDueCadenceLabel;
  contractBeforeDueOffsets: number[];
  taskAfterDueCadence: AfterDueCadenceLabel;
};

export const CADENCE_DEFAULTS: ReminderCadence = {
  paymentBeforeDueOffsets: [-21, -14, -7],
  paymentAfterDueCadence: "daily",
  contractBeforeDueOffsets: [-21, -14, -7],
  taskAfterDueCadence: "every_3_days",
};

const ALLOWED_BEFORE_DUE = new Set<number>(BEFORE_DUE_OFFSET_OPTIONS);

/**
 * Normalize a before-due selection: only allowed offsets, unique, sorted ascending.
 * Empty input → empty (don't send).
 */
export function normalizeBeforeDueOffsets(offsets: readonly number[]): number[] {
  const unique = new Set<number>();
  for (const d of offsets) {
    if (ALLOWED_BEFORE_DUE.has(d)) unique.add(d);
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * Map a legacy named preset to its equivalent offset selection.
 * Used by migration tests — do not invent new preset behavior.
 */
export function presetToBeforeDueOffsets(label: BeforeDueCadenceLabel): number[] {
  switch (label) {
    case "weekly": return [-21, -14, -7];
    case "once_two_weeks": return [-14];
    case "once_week": return [-7];
    case "on_due": return [0];
    case "none": return [];
  }
}

/** @deprecated Prefer normalizeBeforeDueOffsets / presetToBeforeDueOffsets. */
export function beforeDueOffsets(label: BeforeDueCadenceLabel): number[] {
  return presetToBeforeDueOffsets(label);
}

/** Interval in days for a recurring ("after due") cadence label. null = don't recur. */
export function cadenceIntervalDays(label: AfterDueCadenceLabel): number | null {
  switch (label) {
    case "daily": return 1;
    case "every_3_days": return 3;
    case "weekly": return 7;
    case "none": return null;
  }
}

export function coerceOffsetArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((n) => typeof n === "number" && Number.isInteger(n))) return null;
  return normalizeBeforeDueOffsets(value as number[]);
}
