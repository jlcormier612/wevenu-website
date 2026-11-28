/**
 * Onboarding → operational appointment catalog carry-through.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  INTAKE_KEY_TO_BUILTIN,
  catalogHasEnabledOrdinaryAppointments,
  planOnboardingAppointmentCatalog,
  summarizeCatalogAppointmentsForOperator,
} from "@/lib/calendar/onboarding-appointment-catalog-plan";
import type { VenueScheduleItemType } from "@/lib/calendar/schedule-item-catalog";

function row(
  partial: Partial<VenueScheduleItemType> & { id: string },
): VenueScheduleItemType {
  return {
    venueId: "v",
    source: "builtin",
    builtinKey: "consultation",
    customKey: null,
    label: "Consultation",
    enabled: true,
    blocksAvailability: false,
    groupKey: "meetings",
    sortOrder: 10,
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("planOnboardingAppointmentCatalog", () => {
  it("returns null when unanswered", () => {
    assert.equal(
      planOnboardingAppointmentCatalog({ offersAppointmentsOtherThanTours: null }),
      null,
    );
  });

  it("disables all ordinary builtins when offers is No", () => {
    const plan = planOnboardingAppointmentCatalog({
      offersAppointmentsOtherThanTours: false,
    });
    assert.ok(plan);
    assert.equal(plan!.builtinEnabled.consultation, false);
    assert.equal(plan!.builtinEnabled.client_meeting, false);
    assert.equal(plan!.builtinEnabled.tasting, false);
    assert.equal(plan!.customLabel, null);
  });

  it("maps intake keys to builtins and leaves vendor_meeting off", () => {
    const plan = planOnboardingAppointmentCatalog({
      offersAppointmentsOtherThanTours: true,
      appointmentTypeKeys: ["planning_meetings", "final_walkthroughs"],
    });
    assert.ok(plan);
    assert.equal(plan!.builtinEnabled.client_meeting, true);
    assert.equal(plan!.builtinEnabled.walkthrough, true);
    assert.equal(plan!.builtinEnabled.consultation, false);
    assert.equal(plan!.builtinEnabled.tasting, false);
    assert.equal(plan!.builtinEnabled.vendor_meeting, false);
    assert.equal(INTAKE_KEY_TO_BUILTIN.consultations, "consultation");
  });

  it("creates a validated custom label from other text", () => {
    const plan = planOnboardingAppointmentCatalog({
      offersAppointmentsOtherThanTours: true,
      appointmentTypeKeys: ["other"],
      appointmentTypesOther: "  Inventory selection  ",
      catalog: [],
    });
    assert.ok(plan);
    assert.equal(plan!.customLabel, "Inventory selection");
    assert.equal(plan!.customSkippedReason, "none");
  });

  it("skips malformed or duplicate custom names", () => {
    const empty = planOnboardingAppointmentCatalog({
      offersAppointmentsOtherThanTours: true,
      appointmentTypeKeys: ["other"],
      appointmentTypesOther: "   ",
    });
    assert.equal(empty!.customLabel, null);
    assert.equal(empty!.customSkippedReason, "empty");

    const dup = planOnboardingAppointmentCatalog({
      offersAppointmentsOtherThanTours: true,
      appointmentTypeKeys: ["other"],
      appointmentTypesOther: "Consultation",
      catalog: [row({ id: "1", label: "Consultation", builtinKey: "consultation" })],
    });
    assert.equal(dup!.customLabel, null);
    assert.equal(dup!.customSkippedReason, "invalid_or_duplicate");
  });
});

describe("catalog ordinary enablement helpers", () => {
  it("detects enabled ordinary builtins and custom meetings", () => {
    assert.equal(
      catalogHasEnabledOrdinaryAppointments([
        row({ id: "1", builtinKey: "consultation", enabled: false }),
      ]),
      false,
    );
    assert.equal(
      catalogHasEnabledOrdinaryAppointments([
        row({ id: "1", builtinKey: "client_meeting", enabled: true }),
      ]),
      true,
    );
    assert.equal(
      catalogHasEnabledOrdinaryAppointments([
        row({
          id: "c1",
          source: "custom",
          builtinKey: null,
          customKey: "inventory_selection",
          label: "Inventory selection",
          enabled: true,
          groupKey: "meetings",
        }),
      ]),
      true,
    );
  });

  it("summarizes enabled ordinary types for operators", () => {
    const summary = summarizeCatalogAppointmentsForOperator([
      row({ id: "1", builtinKey: "client_meeting", label: "Client Meeting", enabled: true }),
      row({ id: "2", builtinKey: "consultation", label: "Consultation", enabled: false }),
    ]);
    assert.match(summary, /Client Meeting/);
    assert.doesNotMatch(summary, /Consultation/);
  });
});

describe("availability page + intake wiring contracts", () => {
  it("removes duplicate editable appointment config from Availability", () => {
    const page = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
    assert.doesNotMatch(page, /Appointments other than tours/);
    assert.doesNotMatch(page, /AppointmentsOfferedControl/);
    assert.match(page, /ScheduledAppointmentTypesSection/);
  });

  it("intake submit applies catalog once; settings mirror action removed", () => {
    const intake = readFileSync(resolve("lib/onboarding/intake-service.ts"), "utf8");
    assert.match(intake, /applyOnboardingAppointmentCatalogOnce/);
    assert.doesNotMatch(intake, /updateVenueAppointmentOfferSignal/);
    assert.equal(
      existsSync(resolve("components/settings/appointments-offered-control.tsx")),
      false,
    );
  });

  it("new seed defaults ordinary appointments non-blocking; Blocked Time blocks", () => {
    const mig = readFileSync(
      resolve(
        "supabase/migrations/20270330120000_appointment_catalog_onboarding_carrythrough.sql",
      ),
      "utf8",
    );
    assert.match(mig, /appointment_catalog_applied_at/);
    assert.match(
      mig,
      /'consultation',\s+'Consultation',\s+true,\s+false/,
    );
    assert.match(
      mig,
      /'personal_appointment',\s+'Personal Appointment',\s+true,\s+false/,
    );
    assert.match(
      mig,
      /'blocked_time',\s+'Blocked Time',\s+true,\s+true/,
    );
    assert.doesNotMatch(mig, /update public\.venue_schedule_item_types/);
  });

  it("does not introduce public appointment booking routes or enablement", () => {
    const apply = readFileSync(
      resolve("lib/calendar/apply-onboarding-appointment-catalog.ts"),
      "utf8",
    );
    assert.doesNotMatch(apply, /\/api\/public\/.*book|enablePublicBooking|public_appointment_booking/i);
    assert.match(apply, /Does not rewrite calendar_blocks/);
  });
});
