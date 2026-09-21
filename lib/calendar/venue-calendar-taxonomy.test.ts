/**
 * Locked Calendar taxonomy — legend / hold wording / tasting classification /
 * perspective retirement / category colors.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { venueCalendarLegendEntries, MANUAL_TYPE_META, TYPE_META } from "@/components/calendar/calendar-shared";
import {
  buildScheduleItemPickerGroups,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
  filtersFromTaxonomySelection,
  presentVenueCalendarTaxonomyKeys,
  taxonomySelectionFromFilters,
  venueCalendarTaxonomyKey,
  venueCalendarTaxonomyLabel,
  VENUE_CALENDAR_TAXONOMY,
} from "@/lib/calendar/venue-calendar-scope";

function catalogRow(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "id" | "source" | "label" | "enabled">,
): VenueScheduleItemType {
  return {
    venueId: partial.venueId ?? "v1",
    builtinKey: partial.builtinKey ?? null,
    customKey: partial.customKey ?? null,
    blocksAvailability: partial.blocksAvailability ?? true,
    groupKey: partial.groupKey ?? "meetings",
    sortOrder: partial.sortOrder ?? 0,
    archivedAt: partial.archivedAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("venue Calendar locked taxonomy", () => {
  it("legend lists exactly Event Tour Appointment Hold Blocked Time", () => {
    const labels = venueCalendarLegendEntries().map((e) => e.label);
    assert.deepEqual(labels, ["Event", "Tour", "Appointment", "Hold", "Blocked Time"]);
    assert.deepEqual([...VENUE_CALENDAR_TAXONOMY], [
      "event", "tour", "appointment", "hold", "blocked_time",
    ]);
  });

  it("appointment classifications never appear as legend peers", () => {
    const labels = venueCalendarLegendEntries({ tastingEnabled: true }).map((e) => e.label);
    for (const banned of [
      "Consultation", "Client Meeting", "Vendor Meeting", "Walkthrough",
      "Tasting", "Personal Appointment", "Other", "Date Hold",
    ]) {
      assert.equal(labels.includes(banned), false, banned);
    }
  });

  it("maps items onto taxonomy keys without inventing peers", () => {
    assert.equal(venueCalendarTaxonomyKey({ type: "event" }), "event");
    assert.equal(venueCalendarTaxonomyKey({ type: "tour" }), "tour");
    assert.equal(venueCalendarTaxonomyKey({ type: "date_hold" }), "hold");
    assert.equal(venueCalendarTaxonomyKey({ type: "calendar_block", manualType: "blocked_time" }), "blocked_time");
    assert.equal(venueCalendarTaxonomyKey({ type: "calendar_block", manualType: "wedding_event_booking" }), "hold");
    assert.equal(venueCalendarTaxonomyKey({ type: "calendar_block", manualType: "consultation" }), "appointment");
    assert.equal(venueCalendarTaxonomyKey({ type: "calendar_block", manualType: "tasting" }), "appointment");
    assert.equal(venueCalendarTaxonomyKey({ type: "calendar_block", manualType: "tour" }), "appointment");
    assert.equal(venueCalendarTaxonomyLabel("hold"), "Hold");
  });

  it("Tasting OFF is absent from classification picker groups", () => {
    const catalog: VenueScheduleItemType[] = [
      catalogRow({
        id: "c-consult", source: "builtin", builtinKey: "consultation",
        label: "Consultation", enabled: true,
      }),
      catalogRow({
        id: "c-taste", source: "builtin", builtinKey: "tasting",
        label: "Tasting", enabled: false,
      }),
    ];
    const groups = buildScheduleItemPickerGroups(catalog);
    const labels = groups.flatMap((g) => g.options.map((o) => o.label));
    assert.equal(labels.includes("Tasting"), false);
    assert.equal(labels.includes("Consultation"), true);
  });

  it("Tasting ON appears as a classification, not a top-level legend concept", () => {
    const catalog: VenueScheduleItemType[] = [
      catalogRow({
        id: "c-taste", source: "builtin", builtinKey: "tasting",
        label: "Tasting", enabled: true,
      }),
    ];
    const groups = buildScheduleItemPickerGroups(catalog);
    const labels = groups.flatMap((g) => g.options.map((o) => o.label));
    assert.equal(labels.includes("Tasting"), true);
    assert.equal(
      venueCalendarLegendEntries({ tastingEnabled: true }).some((e) => e.label === "Tasting"),
      false,
    );
  });

  it("no user-facing Date Hold string in Calendar shared/view sources", () => {
    const shared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
    const view = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    const perspectives = readFileSync(resolve("components/calendar/perspectives.ts"), "utf8");
    assert.doesNotMatch(shared, /Date Hold/);
    assert.doesNotMatch(view, /Date Hold/);
    assert.doesNotMatch(perspectives, /date holds/i);
    assert.doesNotMatch(perspectives, /Date Hold/);
  });

  it("perspective buckets are retired from Calendar UI and module", () => {
    const perspectives = readFileSync(resolve("components/calendar/perspectives.ts"), "utf8");
    const shared = readFileSync(resolve("components/calendar/calendar-shared.tsx"), "utf8");
    const view = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
    const week = readFileSync(resolve("components/calendar/week-view.tsx"), "utf8");
    const day = readFileSync(resolve("components/calendar/day-view.tsx"), "utf8");
    const agenda = readFileSync(resolve("components/calendar/agenda-view.tsx"), "utf8");
    assert.match(perspectives, /CALENDAR_PERSPECTIVES_RETIRED/);
    assert.doesNotMatch(perspectives, /id: "everything"|id: "sales"|id: "planning"|id: "operations"|id: "wedding-day"/);
    assert.doesNotMatch(perspectives, /getPerspectives|activePerspectiveId|PerspectiveSwitcher/);
    for (const src of [shared, view, week, day, agenda]) {
      assert.doesNotMatch(src, /PerspectiveSwitcher/);
      assert.doesNotMatch(src, /emoji: "🗓️"|emoji: "🤝"|emoji: "📋"|emoji: "🧭"|emoji: "💍"/);
      assert.doesNotMatch(src, /id: "everything"|id: "sales"|id: "wedding-day"/);
    }
  });

  it("category colors map to locked visual language", () => {
    assert.equal(TYPE_META.event.dotColor, "var(--cal-event)");
    assert.equal(TYPE_META.tour.dotColor, "var(--cal-tour)");
    assert.equal(TYPE_META.date_hold.dotColor, "var(--cal-date-hold)");
    assert.equal(TYPE_META.calendar_block.dotColor, "var(--cal-blocked)");
    assert.equal(MANUAL_TYPE_META.consultation.dotColor, "var(--cal-meeting)");
    assert.equal(MANUAL_TYPE_META.walkthrough.dotColor, "var(--cal-meeting)");
    assert.equal(MANUAL_TYPE_META.tasting.dotColor, "var(--cal-meeting)");
    assert.equal(MANUAL_TYPE_META.wedding_event_booking.dotColor, "var(--cal-date-hold)");
    assert.equal(MANUAL_TYPE_META.blocked_time.dotColor, "var(--cal-blocked)");
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    assert.match(css, /--cal-tour:\s*#4A7EA8/);
    assert.match(css, /--cal-date-hold:\s*#E8C200/);
    assert.match(css, /--cal-blocked:\s*var\(--destructive\)/);
    assert.match(css, /--cal-event:\s*#7B5EA0/);
    assert.match(css, /--cal-meeting:\s*#D68A3E/);
  });

  it("taxonomy filter helpers round-trip Event/Tour/Appointment/Hold/Blocked Time", () => {
    const present = [...VENUE_CALENDAR_TAXONOMY];
    const all = filtersFromTaxonomySelection(present, present);
    assert.deepEqual(all, { types: null, manualTypes: null });

    const eventOnly = filtersFromTaxonomySelection(["event"], present);
    assert.deepEqual(eventOnly.types, ["event"]);
    assert.equal(eventOnly.manualTypes, null);

    const appointment = filtersFromTaxonomySelection(["appointment"], present);
    assert.ok(appointment.types?.includes("calendar_block"));
    assert.ok(appointment.manualTypes?.includes("consultation"));
    assert.ok(appointment.manualTypes?.includes("walkthrough"));
    assert.equal(appointment.manualTypes?.includes("blocked_time"), false);

    const blocked = filtersFromTaxonomySelection(["blocked_time"], present);
    assert.deepEqual(blocked.manualTypes, ["blocked_time"]);

    const hold = filtersFromTaxonomySelection(["hold"], present);
    assert.ok(hold.types?.includes("date_hold"));
    assert.ok(hold.manualTypes?.includes("wedding_event_booking"));

    const items = [
      { type: "event" as const },
      { type: "tour" as const },
      { type: "date_hold" as const },
      { type: "calendar_block" as const, manualType: "consultation" as const },
      { type: "calendar_block" as const, manualType: "blocked_time" as const },
    ];
    assert.deepEqual(presentVenueCalendarTaxonomyKeys(items), [...VENUE_CALENDAR_TAXONOMY]);
    assert.deepEqual(
      taxonomySelectionFromFilters({ types: ["event"], manualTypes: null }, present),
      ["event"],
    );
  });
});
