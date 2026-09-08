/**
 * Availability reference data and display helpers (Sprint 20).
 */
import type { BlockReason, HoldStatus, ManualScheduleType } from "@/lib/availability/types";

export const BLOCK_REASONS: { value: BlockReason; label: string }[] = [
  { value: "maintenance",    label: "Maintenance / Renovation" },
  { value: "private_event",  label: "Private Event" },
  { value: "holiday",        label: "Holiday / Closure" },
  { value: "staff_training", label: "Staff Training" },
  { value: "other",          label: "Other" },
];

export function blockReasonLabel(reason: BlockReason): string {
  return BLOCK_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/**
 * Schedule Item types offered when the venue catalog is unavailable (fallback).
 * Calendar 2A.2.2: the live picker prefers enabled catalog rows; Tasting is
 * catalog-gated (default OFF) and is not listed here. Tour is never creatable
 * here — book via tour_appointments. Legacy DB values remain readable via
 * LEGACY_MANUAL_SCHEDULE_TYPE_LABELS / catalog labels.
 */
export const MANUAL_SCHEDULE_TYPE_OPTIONS: { value: ManualScheduleType; label: string }[] = [
  { value: "consultation",          label: "Consultation" },
  { value: "client_meeting",        label: "Client Meeting" },
  { value: "walkthrough",           label: "Walkthrough" },
  { value: "vendor_meeting",        label: "Vendor Meeting" },
  { value: "wedding_event_booking", label: "Wedding / Event Booking" },
  { value: "private_event",         label: "Private Event" },
  { value: "personal_appointment",  label: "Personal Appointment" },
  { value: "blocked_time",          label: "Blocked Time" },
  { value: "other",                 label: "Other" },
];

/** Labels for legacy calendar_blocks.type values that are no longer creatable as new items without catalog enablement. */
export const LEGACY_MANUAL_SCHEDULE_TYPE_LABELS: Partial<Record<ManualScheduleType, string>> = {
  tour: "Manual tour (not a booked tour)",
  tasting: "Tasting",
};

/**
 * Hardcoded creatable fallback (no catalog). Does not include Tour or Tasting —
 * Tasting creatability is catalog-authoritative in createBlock.
 */
export function isCreatableManualScheduleType(type: ManualScheduleType): boolean {
  return MANUAL_SCHEDULE_TYPE_OPTIONS.some((t) => t.value === type);
}

export function manualScheduleTypeLabel(type: ManualScheduleType): string {
  return MANUAL_SCHEDULE_TYPE_OPTIONS.find((t) => t.value === type)?.label
    ?? LEGACY_MANUAL_SCHEDULE_TYPE_LABELS[type]
    ?? type;
}

export const HOLD_STATUS_LABEL: Record<HoldStatus, string> = {
  active:    "Active",
  converted: "Converted to Booking",
  released:  "Released",
  expired:   "Expired",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function daysUntil(iso: string): number {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
