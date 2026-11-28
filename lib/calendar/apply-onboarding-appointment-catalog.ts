/**
 * One-time carry-through: onboarding appointment preferences → operational
 * venue_schedule_item_types catalog. Never re-applies after the stamp is set.
 * Does not rewrite calendar_blocks or public booking.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { mergeAppointmentBlocksPatch } from "@/lib/calendar/appointment-blocks-invariant";
import {
  ONBOARDING_ORDINARY_BUILTIN_KEYS,
  planOnboardingAppointmentCatalog,
} from "@/lib/calendar/onboarding-appointment-catalog-plan";
import {
  generateCustomKey,
  validateCustomScheduleItemTypeLabel,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
  insertCustomScheduleItemTypeRow,
  listVenueScheduleItemTypes,
  seedVenueScheduleItemTypes,
  updateBuiltinScheduleItemTypeRow,
} from "@/lib/calendar/schedule-item-catalog-repository";

export {
  INTAKE_KEY_TO_BUILTIN,
  ONBOARDING_ORDINARY_BUILTIN_KEYS,
  catalogHasEnabledOrdinaryAppointments,
  classifyBuiltinForOnboardingDefaults,
  planOnboardingAppointmentCatalog,
  summarizeCatalogAppointmentsForOperator,
  type OnboardingCatalogApplyPlan,
  type OnboardingOrdinaryBuiltinKey,
} from "@/lib/calendar/onboarding-appointment-catalog-plan";

function nextCustomSortOrder(catalog: VenueScheduleItemType[]): number {
  const inGroup = catalog.filter((r) => r.source === "custom" && r.groupKey === "meetings");
  const max = inGroup.reduce((m, r) => Math.max(m, r.sortOrder), 100);
  return max + 10;
}

function uniqueCustomKey(base: string, catalog: VenueScheduleItemType[]): string {
  const taken = new Set(
    catalog
      .filter((r) => r.source === "custom" && !r.archivedAt && r.customKey)
      .map((r) => r.customKey as string),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 40)}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

/**
 * Apply intake → catalog once for a venue. Idempotent via
 * venue_onboarding_intake.appointment_catalog_applied_at.
 * Does not change personal_appointment / blocked_time enablement or existing blocks.
 */
export async function applyOnboardingAppointmentCatalogOnce(input: {
  venueId: string;
  offersAppointmentsOtherThanTours: boolean | null | undefined;
  appointmentTypeKeys?: readonly string[] | null;
  appointmentTypesOther?: string | null;
}): Promise<{ ok: true; applied: boolean; skippedReason?: string } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: intakeRow, error: intakeErr } = await admin
    .from("venue_onboarding_intake")
    .select("id, appointment_catalog_applied_at")
    .eq("venue_id", input.venueId)
    .maybeSingle<{ id: string; appointment_catalog_applied_at: string | null }>();
  if (intakeErr) return { ok: false, error: intakeErr.message };
  if (!intakeRow?.id) {
    return { ok: true, applied: false, skippedReason: "no_intake_row" };
  }
  if (intakeRow.appointment_catalog_applied_at) {
    return { ok: true, applied: false, skippedReason: "already_applied" };
  }

  if (
    input.offersAppointmentsOtherThanTours !== true
    && input.offersAppointmentsOtherThanTours !== false
  ) {
    return { ok: true, applied: false, skippedReason: "unanswered" };
  }

  await seedVenueScheduleItemTypes(admin, input.venueId);
  let catalog = await listVenueScheduleItemTypes(admin, input.venueId);

  const plan = planOnboardingAppointmentCatalog({
    offersAppointmentsOtherThanTours: input.offersAppointmentsOtherThanTours,
    appointmentTypeKeys: input.appointmentTypeKeys,
    appointmentTypesOther: input.appointmentTypesOther,
    catalog,
  });
  if (!plan) {
    return { ok: true, applied: false, skippedReason: "unanswered" };
  }

  for (const key of ONBOARDING_ORDINARY_BUILTIN_KEYS) {
    const current = catalog.find((r) => r.source === "builtin" && r.builtinKey === key);
    if (!current) continue;
    const enabled = plan.builtinEnabled[key];
    const next = mergeAppointmentBlocksPatch(
      { enabled: current.enabled, blocksAvailability: current.blocksAvailability },
      { enabled },
    );
    if (next.enabled === current.enabled && next.blocksAvailability === current.blocksAvailability) {
      continue;
    }
    await updateBuiltinScheduleItemTypeRow(admin, input.venueId, key, {
      enabled: next.enabled,
      blocksAvailability: next.blocksAvailability,
    });
  }

  if (plan.customLabel) {
    catalog = await listVenueScheduleItemTypes(admin, input.venueId);
    const named = validateCustomScheduleItemTypeLabel({
      label: plan.customLabel,
      catalog,
    });
    if (named.ok) {
      const created = mergeAppointmentBlocksPatch(
        { enabled: true, blocksAvailability: false },
        { enabled: true, blocksAvailability: false },
      );
      await insertCustomScheduleItemTypeRow(admin, input.venueId, {
        customKey: uniqueCustomKey(generateCustomKey(named.label), catalog),
        label: named.label,
        enabled: created.enabled,
        blocksAvailability: created.blocksAvailability,
        groupKey: "meetings",
        sortOrder: nextCustomSortOrder(catalog),
      });
    }
  }

  const now = new Date().toISOString();
  const { error: stampErr } = await admin
    .from("venue_onboarding_intake")
    .update({ appointment_catalog_applied_at: now })
    .eq("venue_id", input.venueId)
    .is("appointment_catalog_applied_at", null);
  if (stampErr) return { ok: false, error: stampErr.message };

  return { ok: true, applied: true };
}
