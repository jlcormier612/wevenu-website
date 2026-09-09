/**
 * Locked Calendar taxonomy — legend / hold wording / tasting classification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { venueCalendarLegendEntries } from "@/components/calendar/calendar-shared";
import {
  buildScheduleItemPickerGroups,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
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
});
