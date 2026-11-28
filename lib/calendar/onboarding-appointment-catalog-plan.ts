/**
 * Pure onboarding → operational appointment catalog planning helpers.
 * No DB / admin imports — safe for unit tests and WG gate derivation.
 */
import {
  APPOINTMENT_CATALOG_BUILTIN_KEYS,
  normalizeCatalogLabel,
  validateCustomScheduleItemTypeLabel,
  type AppointmentCatalogBuiltinKey,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import type { AppointmentTypeKey } from "@/lib/onboarding/types";

/** Ordinary staff appointment builtins controlled by onboarding (not personal/blocked). */
export const ONBOARDING_ORDINARY_BUILTIN_KEYS = [
  "consultation",
  "client_meeting",
  "walkthrough",
  "vendor_meeting",
  "tasting",
  "other",
] as const satisfies readonly AppointmentCatalogBuiltinKey[];

export type OnboardingOrdinaryBuiltinKey = (typeof ONBOARDING_ORDINARY_BUILTIN_KEYS)[number];

/** Intake key → catalog builtin. vendor_meeting has no intake key (stays off unless later enabled). */
export const INTAKE_KEY_TO_BUILTIN: Record<
  Exclude<AppointmentTypeKey, "other">,
  OnboardingOrdinaryBuiltinKey
> = {
  consultations: "consultation",
  planning_meetings: "client_meeting",
  final_walkthroughs: "walkthrough",
  menu_tastings: "tasting",
};

export type OnboardingCatalogApplyPlan = {
  builtinEnabled: Record<OnboardingOrdinaryBuiltinKey, boolean>;
  customLabel: string | null;
  customSkippedReason: "none" | "other_not_selected" | "empty" | "invalid_or_duplicate";
};

export function planOnboardingAppointmentCatalog(input: {
  offersAppointmentsOtherThanTours: boolean | null | undefined;
  appointmentTypeKeys?: readonly string[] | null;
  appointmentTypesOther?: string | null;
  catalog?: VenueScheduleItemType[];
}): OnboardingCatalogApplyPlan | null {
  if (input.offersAppointmentsOtherThanTours !== true && input.offersAppointmentsOtherThanTours !== false) {
    return null;
  }

  const builtinEnabled: Record<OnboardingOrdinaryBuiltinKey, boolean> = {
    consultation: false,
    client_meeting: false,
    walkthrough: false,
    vendor_meeting: false,
    tasting: false,
    other: false,
  };

  if (input.offersAppointmentsOtherThanTours === false) {
    return {
      builtinEnabled,
      customLabel: null,
      customSkippedReason: "none",
    };
  }

  const keys = new Set(input.appointmentTypeKeys ?? []);
  for (const [intakeKey, builtin] of Object.entries(INTAKE_KEY_TO_BUILTIN) as [
    Exclude<AppointmentTypeKey, "other">,
    OnboardingOrdinaryBuiltinKey,
  ][]) {
    if (keys.has(intakeKey)) builtinEnabled[builtin] = true;
  }

  if (!keys.has("other")) {
    return {
      builtinEnabled,
      customLabel: null,
      customSkippedReason: "other_not_selected",
    };
  }

  const raw = normalizeCatalogLabel(input.appointmentTypesOther ?? "");
  if (!raw) {
    return {
      builtinEnabled,
      customLabel: null,
      customSkippedReason: "empty",
    };
  }

  const catalog = input.catalog ?? [];
  const named = validateCustomScheduleItemTypeLabel({ label: raw, catalog });
  if (!named.ok) {
    return {
      builtinEnabled,
      customLabel: null,
      customSkippedReason: "invalid_or_duplicate",
    };
  }

  return {
    builtinEnabled,
    customLabel: named.label,
    customSkippedReason: "none",
  };
}

export function catalogHasEnabledOrdinaryAppointments(
  catalog: readonly VenueScheduleItemType[],
): boolean {
  return catalog.some(
    (row) =>
      row.source === "builtin"
      && row.builtinKey
      && (ONBOARDING_ORDINARY_BUILTIN_KEYS as readonly string[]).includes(row.builtinKey)
      && row.enabled
      && !row.archivedAt,
  ) || catalog.some(
    (row) =>
      row.source === "custom"
      && row.groupKey === "meetings"
      && row.enabled
      && !row.archivedAt,
  );
}

export function summarizeCatalogAppointmentsForOperator(
  catalog: readonly VenueScheduleItemType[],
): string {
  const labels = catalog
    .filter(
      (row) =>
        row.enabled
        && !row.archivedAt
        && (
          (row.source === "builtin"
            && row.builtinKey
            && (ONBOARDING_ORDINARY_BUILTIN_KEYS as readonly string[]).includes(row.builtinKey))
          || (row.source === "custom" && row.groupKey === "meetings")
        ),
    )
    .map((row) => row.label)
    .sort((a, b) => a.localeCompare(b));
  if (labels.length === 0) return "No ordinary appointment types enabled";
  return `Enabled appointment types: ${labels.join(", ")}`;
}

export function classifyBuiltinForOnboardingDefaults(
  key: AppointmentCatalogBuiltinKey,
): "ordinary" | "personal" | "blocked_time" {
  if (key === "blocked_time") return "blocked_time";
  if (key === "personal_appointment") return "personal";
  if ((ONBOARDING_ORDINARY_BUILTIN_KEYS as readonly string[]).includes(key)) return "ordinary";
  if ((APPOINTMENT_CATALOG_BUILTIN_KEYS as readonly string[]).includes(key)) {
    return "ordinary";
  }
  return "ordinary";
}
