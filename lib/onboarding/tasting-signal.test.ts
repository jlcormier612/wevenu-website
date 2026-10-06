import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  tastingAppointmentSignalLabel,
  whiteGloveCalendarCanBeFinished,
} from "@/lib/onboarding/tasting-signal";

const form = readFileSync(resolve("components/onboarding/onboarding-intake-form.tsx"), "utf8");
const intake = readFileSync(resolve("lib/onboarding/intake-service.ts"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261412700000_tasting_appointment_optional_signal.sql"),
  "utf8",
);

describe("optional tasting or appointment signal", () => {
  it("can be left unanswered", () => {
    assert.equal(tastingAppointmentSignalLabel(null), "Not answered");
    assert.equal(tastingAppointmentSignalLabel(undefined), "Not answered");
    assert.doesNotMatch(form, /Please tell us about tastings or other appointments/);
    assert.match(form, /Do you offer tastings or other appointments\?/);
    assert.match(form, /Optional — this helps us understand how your venue works/);
    assert.match(form, /Yes, we offer tastings or other appointments/);
    assert.doesNotMatch(form, /other_appointments|Neither/);
  });

  it("persists Yes as a boolean and does not require the four-way choice", () => {
    assert.equal(tastingAppointmentSignalLabel(true), "Yes");
    assert.match(intake, /offers_tastings_or_appointments: intake\.offersTastingsOrAppointments/);
    assert.doesNotMatch(intake, /tasting_appointment_choice/);
    assert.match(migration, /offers_tastings_or_appointments boolean/);
    assert.match(migration, /when 'neither' then false/);
    assert.match(migration, /drop column if exists tasting_appointment_choice/);
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
  });
});
