import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  tastingAppointmentSignalLabel,
  whiteGloveCalendarCanBeFinished,
} from "@/lib/onboarding/tasting-signal";
import { sanitizeAppointmentTypeKeys } from "@/lib/onboarding/types";
import type { VenueScheduleItemType } from "@/lib/calendar/schedule-item-catalog";

const form = readFileSync(resolve("components/onboarding/onboarding-intake-form.tsx"), "utf8");
const availabilityPage = readFileSync(
  resolve("app/(app)/settings/availability/page.tsx"),
  "utf8",
);
const types = readFileSync(resolve("lib/onboarding/types.ts"), "utf8");
const welcome = readFileSync(resolve("app/onboarding/white-glove/[token]/page.tsx"), "utf8");
const intake = readFileSync(resolve("lib/onboarding/intake-service.ts"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261412700000_tasting_appointment_optional_signal.sql"),
  "utf8",
);
const typesMigration = readFileSync(
  resolve("supabase/migrations/20261426100000_appointment_types_intake.sql"),
  "utf8",
);

function catalogRow(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "id" | "builtinKey" | "enabled">,
): VenueScheduleItemType {
  return {
    venueId: "v",
    source: "builtin",
    customKey: null,
    label: partial.label ?? partial.builtinKey ?? "X",
    blocksAvailability: false,
    groupKey: "meetings",
    sortOrder: 10,
    archivedAt: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("appointments other than tours signal", () => {
  it("keeps the approved question on onboarding only — not Availability settings", () => {
    assert.equal(tastingAppointmentSignalLabel(null), "Not answered");
    assert.match(form, /Do you offer appointments other than tours\?/);
    assert.match(form, /What types of appointments do you offer\?/);
    assert.match(form, /APPOINTMENT_TYPE_OPTIONS\.map/);
    assert.match(form, /Name of your other appointment type/);
    assert.match(types, /label: "Consultations"/);
    assert.match(types, /label: "Planning meetings"/);
    assert.doesNotMatch(availabilityPage, /Appointments other than tours/);
    assert.doesNotMatch(availabilityPage, /AppointmentsOfferedControl/);
    assert.match(availabilityPage, /Scheduled appointment types/);
  });

  it("shows approved White Glove welcome copy without checkout/Stripe internals", () => {
    const box = welcome.slice(
      welcome.indexOf('data-testid="wg-welcome-box"'),
      welcome.indexOf("<WhiteGloveIntakeClient"),
    );
    assert.match(box, /Welcome to White Glove Setup/);
    assert.match(
      box,
      /We&apos;re excited to get Hello to Cheers ready for your venue/,
    );
    assert.match(
      box,
      /You&apos;ll receive access to sign in once we&apos;ve completed setup and activated/,
    );
    assert.doesNotMatch(box, /from checkout/);
  });

  it("persists Yes as a boolean plus type keys and applies catalog once on intake submit", () => {
    assert.equal(tastingAppointmentSignalLabel(true), "Yes");
    assert.match(intake, /offers_tastings_or_appointments: intake\.offersTastingsOrAppointments/);
    assert.match(intake, /appointment_type_keys/);
    assert.match(intake, /applyOnboardingAppointmentCatalogOnce/);
    assert.doesNotMatch(intake, /updateVenueAppointmentOfferSignal/);
    assert.match(migration, /offers_tastings_or_appointments boolean/);
    assert.match(typesMigration, /appointment_type_keys text\[\]/);
    assert.deepEqual(
      sanitizeAppointmentTypeKeys(["consultations", "bogus", "menu_tastings", "consultations"]),
      ["consultations", "menu_tastings"],
    );
  });

  it("White Glove calendar gate uses catalog when present; intake fallback otherwise", () => {
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: false,
      offersTastingsOrAppointments: false,
    }), true);
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: false,
      offersTastingsOrAppointments: true,
    }), false);
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: false,
      offersTastingsOrAppointments: null,
    }), false);
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: true,
      offersTastingsOrAppointments: false,
    }), false);

    const emptyOrdinary = [
      catalogRow({ id: "1", builtinKey: "consultation", enabled: false }),
      catalogRow({ id: "2", builtinKey: "blocked_time", enabled: true, groupKey: "availability" }),
    ];
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: false,
      offersTastingsOrAppointments: true,
      catalog: emptyOrdinary,
    }), true);

    const withMeeting = [
      catalogRow({ id: "1", builtinKey: "client_meeting", enabled: true }),
    ];
    assert.equal(whiteGloveCalendarCanBeFinished({
      offersTours: false,
      offersTastingsOrAppointments: false,
      catalog: withMeeting,
    }), false);

    assert.match(form, /does not turn on\s+public online booking/);
  });
});
