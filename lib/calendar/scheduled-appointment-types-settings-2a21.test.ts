/**
 * Calendar Slice 2A.2.1 — Scheduled appointment types Settings.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  APPOINTMENT_CATALOG_BUILTIN_KEYS,
  SCHEDULE_APPOINTMENT_SETTINGS_GROUPS,
} from "@/lib/calendar/schedule-item-catalog";
import { guardBuiltinScheduleItemTypeSettingsChange } from "@/lib/calendar/schedule-item-catalog-service";

const pageSrc = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
const sectionSrc = readFileSync(
  resolve("components/settings/scheduled-appointment-types-section.tsx"),
  "utf8",
);
const serviceSrc = readFileSync(resolve("lib/calendar/schedule-item-catalog-service.ts"), "utf8");
const repoSrc = readFileSync(resolve("lib/calendar/schedule-item-catalog-repository.ts"), "utf8");
const actionsSrc = readFileSync(
  resolve("app/(app)/settings/schedule-appointment-types-actions.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve("supabase/migrations/20261352000000_venue_schedule_item_types_catalog.sql"),
  "utf8",
);

const EXPECTED_LABELS = [
  "Consultation",
  "Client Meeting",
  "Walkthrough",
  "Vendor Meeting",
  "Tasting",
  "Personal Appointment",
  "Blocked Time",
  "Other",
] as const;

describe("Calendar Slice 2A.2.1 — Settings placement & copy", () => {
  it("adds Scheduled appointment types on /settings/availability", () => {
    assert.match(pageSrc, /Scheduled appointment types/);
    assert.match(
      pageSrc,
      /Choose the kinds of appointments and reserved time your team can add on the Calendar\. You can turn types on or off and add your own\./,
    );
    assert.match(pageSrc, /ScheduledAppointmentTypesSection/);
    assert.match(pageSrc, /getScheduleItemTypesForSettings|getBuiltinScheduleItemTypesForSettings/);
    assert.match(pageSrc, /id="scheduled-appointment-types"/);
  });

  it("keeps Tour Availability, Capacity, and Event Spaces unchanged and distinct", () => {
    assert.match(pageSrc, /id="tour-availability"/);
    assert.match(pageSrc, /Weekly Availability &amp; Blocked Dates/);
    assert.match(pageSrc, /TourAvailabilityEditor/);
    assert.match(pageSrc, /id="capacity"/);
    assert.match(pageSrc, /Scheduling Capacity/);
    assert.match(pageSrc, /id="spaces"/);
    assert.match(pageSrc, /Event Spaces/);
    // Tour Availability card remains above scheduled appointment types.
    const tourAt = pageSrc.indexOf('id="tour-availability"');
    const typesAt = pageSrc.indexOf('id="scheduled-appointment-types"');
    const capacityAt = pageSrc.indexOf('id="capacity"');
    assert.ok(tourAt > 0 && typesAt > tourAt && capacityAt > typesAt);
  });

  it("uses locked occupancy label and helper copy", () => {
    assert.match(sectionSrc, /Reserves venue time for events/);
    assert.match(
      sectionSrc,
      /When on, this time counts as reserved on your Calendar so another event can’t book over it\. It does not change when couples can book tours — that’s under Tour Availability above\./,
    );
  });

  it("does not expose Tour / Wedding / Private Event in Settings catalog UI", () => {
    assert.doesNotMatch(sectionSrc, /Wedding\/Event Booking|Private Event/);
    // Manual tour disambiguation stays Calendar-side; Settings must not invent Tour rows.
    assert.doesNotMatch(sectionSrc, /Manual tour \(not a booked tour\)/);
    for (const group of SCHEDULE_APPOINTMENT_SETTINGS_GROUPS) {
      assert.equal(group.keys.includes("tour" as never), false);
    }
  });
});

describe("Calendar Slice 2A.2.1 — rendering/defaults", () => {
  it("groups all eight built-ins in locked display order", () => {
    const flat = SCHEDULE_APPOINTMENT_SETTINGS_GROUPS.flatMap((g) => g.keys);
    assert.deepEqual(flat, [
      "consultation",
      "client_meeting",
      "walkthrough",
      "vendor_meeting",
      "tasting",
      "personal_appointment",
      "blocked_time",
      "other",
    ]);
    assert.equal(flat.length, 8);
    assert.equal(new Set(flat).size, 8);
    for (const key of APPOINTMENT_CATALOG_BUILTIN_KEYS) {
      assert.equal(flat.includes(key), true, key);
    }
    assert.equal(SCHEDULE_APPOINTMENT_SETTINGS_GROUPS[0]?.label, "Appointments");
    assert.equal(SCHEDULE_APPOINTMENT_SETTINGS_GROUPS[1]?.label, "Reserved & blocked time");
  });

  it("seed defaults: tasting off; blocked_time locked on; personal/other reserve on", () => {
    assert.match(migration, /'tasting',\s*'Tasting',\s*false,\s*true/);
    assert.match(migration, /'personal_appointment',\s*'Personal Appointment',\s*true,\s*true/);
    assert.match(migration, /'blocked_time',\s*'Blocked Time',\s*true,\s*true/);
    assert.match(migration, /'other',\s*'Other',\s*true,\s*true/);
    assert.match(migration, /venue_schedule_item_types_blocked_time_enabled_check/);
    for (const label of EXPECTED_LABELS) {
      assert.match(migration, new RegExp(`'${label}'`));
    }
  });

  it("Settings UI locks Blocked Time enabled + reserve controls", () => {
    assert.match(sectionSrc, /builtinKey === "blocked_time"/);
    assert.match(sectionSrc, /locked = key === "blocked_time"/);
    assert.match(sectionSrc, /disabled=\{!canEdit \|\| locked \|\| busy\}/);
    assert.match(sectionSrc, /Always available/);
  });

  it("renders from venue catalog rows rather than a second hardcoded defaults list", () => {
    assert.match(sectionSrc, /initialTypes/);
    assert.match(sectionSrc, /SCHEDULE_APPOINTMENT_SETTINGS_GROUPS/);
    assert.match(sectionSrc, /row\.label/);
    assert.doesNotMatch(sectionSrc, /Consultation.*Client Meeting.*Walkthrough/);
    assert.match(pageSrc, /getScheduleItemTypesForSettings/);
  });
});

describe("Calendar Slice 2A.2.1 — mutations & permissions", () => {
  it("owner and manager may change builtins; coordinator/staff may not", () => {
    for (const role of ["owner", "manager"] as const) {
      const r = guardBuiltinScheduleItemTypeSettingsChange({
        role,
        builtinKey: "consultation",
        enabled: false,
      });
      assert.equal(r.ok, true);
    }
    for (const role of ["coordinator", "staff", "member", null] as const) {
      const r = guardBuiltinScheduleItemTypeSettingsChange({
        role,
        builtinKey: "consultation",
        enabled: false,
      });
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.match(r.message, /owner or manager/i);
      }
    }
    assert.match(pageSrc, /role === "owner" \|\| role === "manager"/);
    assert.match(sectionSrc, /canEdit/);
  });

  it("allows enabling tasting and changing reserve for non-locked builtins", () => {
    const tasting = guardBuiltinScheduleItemTypeSettingsChange({
      role: "owner",
      builtinKey: "tasting",
      enabled: true,
    });
    assert.equal(tasting.ok, true);
    const reserve = guardBuiltinScheduleItemTypeSettingsChange({
      role: "manager",
      builtinKey: "personal_appointment",
      blocksAvailability: false,
    });
    assert.equal(reserve.ok, true);
  });

  it("rejects disabling blocked_time or turning reserve off", () => {
    const disable = guardBuiltinScheduleItemTypeSettingsChange({
      role: "owner",
      builtinKey: "blocked_time",
      enabled: false,
    });
    assert.equal(disable.ok, false);
    const reserveOff = guardBuiltinScheduleItemTypeSettingsChange({
      role: "owner",
      builtinKey: "blocked_time",
      blocksAvailability: false,
    });
    assert.equal(reserveOff.ok, false);
  });

  it("rejects non-builtin / custom keys through Settings mutation API", () => {
    for (const builtinKey of ["tour", "wedding_event_booking", "private_event", "custom", "menu_tasting"]) {
      const r = guardBuiltinScheduleItemTypeSettingsChange({
        role: "owner",
        builtinKey,
        enabled: true,
      });
      assert.equal(r.ok, false);
    }
  });

  it("wires server action to catalog service and revalidates availability settings", () => {
    assert.match(actionsSrc, /updateBuiltinScheduleItemTypeSettings/);
    assert.match(actionsSrc, /revalidatePath\("\/settings\/availability"\)/);
    assert.match(serviceSrc, /guardBuiltinScheduleItemTypeSettingsChange/);
    assert.match(serviceSrc, /updateBuiltinScheduleItemTypeRow/);
  });
});

describe("Calendar Slice 2A.2.1 — data integrity", () => {
  it("catalog Settings updates never rewrite calendar_blocks snapshots", () => {
    assert.match(repoSrc, /Never rewrites calendar_blocks rows/);
    assert.match(serviceSrc, /Does not rewrite existing calendar_blocks snapshots/);
    assert.equal(repoSrc.includes('.from("venue_schedule_item_types")'), true);
    assert.equal(repoSrc.includes('.from("calendar_blocks")'), false);
    assert.doesNotMatch(serviceSrc, /\.from\("calendar_blocks"\)/);
  });

  it("mutations are scoped to the current venue id", () => {
    assert.match(serviceSrc, /getCurrentVenue/);
    assert.match(repoSrc, /\.eq\("venue_id", venueId\)/);
    assert.match(repoSrc, /\.eq\("source", "builtin"\)/);
    assert.match(repoSrc, /\.eq\("builtin_key", builtinKey\)/);
  });

  it("disabled built-ins remain addressable in Settings (list all builtins, not only enabled)", () => {
    assert.match(serviceSrc, /getScheduleItemTypesForSettings|getBuiltinScheduleItemTypesForSettings/);
    assert.doesNotMatch(
      serviceSrc.slice(
        serviceSrc.indexOf("getScheduleItemTypesForSettings"),
        serviceSrc.indexOf("updateBuiltinScheduleItemTypeSettings"),
      ),
      /\.filter\(\(.*enabled/,
    );
    assert.match(sectionSrc, /onBuiltinEnabled|onEnabledChange/);
  });

  it("enabled state copy reflects catalog enabled, not a static On", () => {
    assert.match(sectionSrc, /\{row\.enabled \? "On" : "Off"\}/);
    assert.doesNotMatch(sectionSrc, /<span className="text-xs text-muted-foreground">On<\/span>/);
  });
});
