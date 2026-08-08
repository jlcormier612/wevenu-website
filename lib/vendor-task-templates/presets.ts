/**
 * Relative due presets for vendor task template items.
 * Convention matches venue playbooks: negative = before, 0 = day of, positive = after.
 * Storage is always the integer offset string ("" = none) — never display labels.
 */
import { MAX_ABS_DAYS_OFFSET, clampDaysOffset } from "@/lib/playbooks/due-dates";

export { MAX_ABS_DAYS_OFFSET, clampDaysOffset };

/** Sentinel for the Custom… option in relative-due selects. */
export const CUSTOM_DAYS_OFFSET = "__custom__";

export const VENDOR_TASK_DAYS_OFFSET_PRESETS: { value: string; label: string }[] = [
  { value: "",     label: "No due date" },
  { value: "0",    label: "Day of event" },
  { value: "-1",   label: "1 day before" },
  { value: "-3",   label: "3 days before" },
  { value: "-7",   label: "7 days before" },
  { value: "-14",  label: "14 days before" },
  { value: "-21",  label: "21 days before" },
  { value: "-30",  label: "30 days before" },
  { value: "-45",  label: "45 days before" },
  { value: "-60",  label: "60 days before" },
  { value: "1",    label: "1 day after" },
  { value: "3",    label: "3 days after" },
  { value: "7",    label: "7 days after" },
  { value: "14",   label: "14 days after" },
];

export function isPresetDaysOffset(value: string): boolean {
  return VENDOR_TASK_DAYS_OFFSET_PRESETS.some((p) => p.value === value);
}

/** Parse a draft offset string → clamped integer, or null when blank/invalid. */
export function parseDaysOffsetInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return clampDaysOffset(n);
}

/** Label for template due offsets in editors (null → "No due date"). */
export function daysOffsetPresetLabel(offset: number | null | undefined): string {
  if (offset == null) return "No due date";
  const match = VENDOR_TASK_DAYS_OFFSET_PRESETS.find((p) => p.value === String(offset));
  if (match) return match.label;
  if (offset === 0) return "Day of event";
  const n = Math.abs(offset);
  const unit = n === 1 ? "day" : "days";
  return offset < 0 ? `${n} ${unit} before` : `${n} ${unit} after`;
}

/** Label for apply/select UIs when a relative due may be absent. */
export function applyDueLabel(offset: number | null | undefined): string {
  if (offset == null) return "No relative due";
  return daysOffsetPresetLabel(offset);
}
