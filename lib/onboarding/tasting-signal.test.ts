import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  tastingAppointmentSignalLabel,
  whiteGloveCalendarCanBeFinished,
} from "@/lib/onboarding/tasting-signal";
import { sanitizeAppointmentTypeKeys } from "@/lib/onboarding/types";

const form = readFileSync(resolve("components/onboarding/onboarding-intake-form.tsx"), "utf8");
const settings = readFileSync(
  resolve("components/settings/appointments-offered-control.tsx"),
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

describe("appointments other than tours signal", () => {
  it("uses the approved question and conditional types in onboarding and Settings", () => {
    assert.equal(tastingAppointmentSignalLabel(null), "Not answered");
    assert.match(form, /Do you offer appointments other than tours\?/);
    assert.match(
      form,
      /For example, consultations, planning meetings, menu tastings, or final walkthroughs\./,
    );
    assert.match(form, /What types of appointments do you offer\?/);
    assert.match(form, /APPOINTMENT_TYPE_OPTIONS\.map/);
    assert.match(types, /label: "Consultations"/);
    assert.match(types, /label: "Planning meetings"/);
    assert.match(types, /label: "Final walkthroughs"/);
    assert.match(types, /label: "Menu or food tastings"/);
    assert.match(types, /label: "Other appointments"/);
    assert.doesNotMatch(form, /Do you offer tastings or other appointments\?/);
    assert.match(settings, /Do you offer appointments other than tours\?/);
    assert.match(settings, /What types of appointments do you offer\?/);
    assert.match(settings, /APPOINTMENT_TYPE_OPTIONS\.map/);
  });

  it("shows approved White Glove welcome copy without checkout/Stripe internals", () => {
    const box = welcome.slice(
      welcome.indexOf('data-testid="wg-welcome-box"'),
      welcome.indexOf("<WhiteGloveIntakeClient"),
    );
    assert.match(box, /Welcome to White Glove Setup!/);
    assert.match(
      box,
      /We&apos;re excited to help you get Hello to Cheers ready for your venue/,
    );
    assert.match(
      box,
      /Your account login is already set\. The contact information you provide below helps us/,
    );
    assert.doesNotMatch(box, /from checkout/);
    assert.doesNotMatch(box, /Account login stays/);
    assert.doesNotMatch(box, /enrollment\.venue_name/);
    assert.doesNotMatch(box, /owner_email/);
  });

  it("persists Yes as a boolean plus type keys without configuring scheduling", () => {
    assert.equal(tastingAppointmentSignalLabel(true), "Yes");
    assert.match(intake, /offers_tastings_or_appointments: intake\.offersTastingsOrAppointments/);
    assert.match(intake, /appointment_type_keys/);
    assert.match(intake, /appointment_types_other/);
    assert.match(intake, /updateVenueAppointmentOfferSignal/);
    assert.doesNotMatch(intake, /tasting_appointment_choice/);
    assert.match(migration, /offers_tastings_or_appointments boolean/);
    assert.match(typesMigration, /appointment_type_keys text\[\]/);
    assert.deepEqual(
      sanitizeAppointmentTypeKeys(["consultations", "bogus", "menu_tastings", "consultations"]),
      ["consultations", "menu_tastings"],
    );
  });

  it("keeps the White Glove signal without treating Yes as configured scheduling", () => {
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
    assert.equal(tastingAppointmentSignalLabel(false), "No");
    assert.doesNotMatch(intake, /from\("appointments"\)|from\("calendar_blocks"\)|tour_scheduling_enabled: intake\.offersTastings/);
    assert.match(form, /does not turn on booking or\s+create a calendar by itself/);
  });
});
