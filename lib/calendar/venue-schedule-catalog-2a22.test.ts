/**
 * Calendar Slice 2A.2.2 — catalog-driven Schedule Item create/edit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { getPerspectives, PERSPECTIVES } from "@/components/calendar/perspectives";
import {
  LEGACY_MANUAL_SCHEDULE_TYPE_LABELS,
  isCreatableManualScheduleType,
} from "@/lib/availability/constants";
import {
  buildScheduleItemPickerGroups,
  flattenScheduleItemPickerOptions,
  parseScheduleItemPickerValue,
  resolveScheduleCatalogWrite,
  scheduleItemPickerValue,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";
import {
  isLegacyOnlyManualScheduleType,
  sanitizeVenueCalendarFilters,
} from "@/lib/calendar/venue-calendar-scope";
import type { CalendarItemType } from "@/lib/calendar/types";

const availServiceSrc = readFileSync(resolve("lib/availability/service.ts"), "utf8");
const calendarViewSrc = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const pageSrc = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
const catalogServiceSrc = readFileSync(resolve("lib/calendar/schedule-item-catalog-service.ts"), "utf8");
const repoSrc = readFileSync(resolve("lib/calendar/schedule-item-catalog-repository.ts"), "utf8");

function catalogRow(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "id" | "source" | "label" | "enabled">,
): VenueScheduleItemType {
  return {
    venueId: partial.venueId ?? "venue-a",
    builtinKey: partial.builtinKey ?? null,
    customKey: partial.customKey ?? null,
    blocksAvailability: partial.blocksAvailability ?? true,
    groupKey: partial.groupKey ?? "meetings",
    sortOrder: partial.sortOrder ?? 10,
    archivedAt: partial.archivedAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const defaultSeedCatalog: VenueScheduleItemType[] = [
  catalogRow({ id: "c-consult", source: "builtin", builtinKey: "consultation", label: "Consultation", enabled: true, groupKey: "meetings", sortOrder: 10 }),
  catalogRow({ id: "c-client", source: "builtin", builtinKey: "client_meeting", label: "Client Meeting", enabled: true, groupKey: "meetings", sortOrder: 20 }),
  catalogRow({ id: "c-walk", source: "builtin", builtinKey: "walkthrough", label: "Walkthrough", enabled: true, groupKey: "meetings", sortOrder: 30 }),
  catalogRow({ id: "c-vendor", source: "builtin", builtinKey: "vendor_meeting", label: "Vendor Meeting", enabled: true, groupKey: "meetings", sortOrder: 40 }),
  catalogRow({ id: "c-taste", source: "builtin", builtinKey: "tasting", label: "Tasting", enabled: false, groupKey: "meetings", sortOrder: 50 }),
  catalogRow({ id: "c-personal", source: "builtin", builtinKey: "personal_appointment", label: "Personal Appointment", enabled: true, groupKey: "availability", sortOrder: 60 }),
  catalogRow({ id: "c-block", source: "builtin", builtinKey: "blocked_time", label: "Blocked Time", enabled: true, groupKey: "availability", sortOrder: 70 }),
  catalogRow({ id: "c-other", source: "builtin", builtinKey: "other", label: "Other", enabled: true, groupKey: "other", sortOrder: 80 }),
];

describe("Calendar Slice 2A.2.2 — picker from catalog", () => {
  it("new Schedule Item picker contains enabled built-ins and reserved dates", () => {
    const groups = buildScheduleItemPickerGroups(defaultSeedCatalog);
    const flat = flattenScheduleItemPickerOptions(groups);
    const values = flat.map((o) => o.value);
    assert.equal(groups[0]?.label, "Appointments");
    assert.equal(groups.some((g) => g.label === "Blocked & personal time"), true);
    assert.equal(groups.some((g) => g.label === "Holds"), true);
    for (const key of ["consultation", "client_meeting", "walkthrough", "vendor_meeting", "personal_appointment", "blocked_time", "other"]) {
      assert.equal(values.includes(key), true, key);
    }
    assert.equal(values.includes("wedding_event_booking"), true);
    assert.equal(values.includes("private_event"), true);
    assert.equal(values.includes("tour"), false);
  });

  it("disabled built-ins do not appear for new creation; Tasting absent by default", () => {
    const values = flattenScheduleItemPickerOptions(buildScheduleItemPickerGroups(defaultSeedCatalog)).map((o) => o.value);
    assert.equal(values.includes("tasting"), false);
  });

  it("enabling Tasting makes it available; custom rows appear without a second store", () => {
    const withTasting = defaultSeedCatalog.map((r) =>
      r.builtinKey === "tasting" ? { ...r, enabled: true } : r,
    );
    withTasting.push(catalogRow({
      id: "c-custom",
      source: "custom",
      customKey: "menu_tasting",
      label: "Menu Tasting",
      enabled: true,
      groupKey: "meetings",
      sortOrder: 100,
    }));
    const values = flattenScheduleItemPickerOptions(buildScheduleItemPickerGroups(withTasting)).map((o) => o.value);
    assert.equal(values.includes("tasting"), true);
    assert.equal(values.includes("custom:c-custom"), true);
    assert.deepEqual(parseScheduleItemPickerValue("custom:c-custom"), {
      type: "custom",
      scheduleItemTypeId: "c-custom",
    });
    assert.equal(scheduleItemPickerValue({ type: "custom", scheduleItemTypeId: "c-custom" }), "custom:c-custom");
  });

  it("Calendar page loads catalog for the picker; CTA remains Add Schedule Item", () => {
    assert.match(pageSrc, /getScheduleItemTypesForPicker/);
    assert.match(pageSrc, /scheduleCatalog/);
    assert.match(calendarViewSrc, /buildScheduleItemPickerGroups/);
    assert.match(calendarViewSrc, /Add Schedule Item/);
    assert.doesNotMatch(calendarViewSrc, /MANUAL_SCHEDULE_TYPE_GROUPS/);
  });
});

describe("Calendar Slice 2A.2.2 — create/edit resolve & snapshots", () => {
  it("new catalog-backed item stores schedule_item_type_id and snapshots blocks_availability", () => {
    const r = resolveScheduleCatalogWrite({
      type: "consultation",
      catalog: catalogRow({
        id: "c-consult",
        source: "builtin",
        builtinKey: "consultation",
        label: "Consultation",
        enabled: true,
        blocksAvailability: false,
      }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.scheduleItemTypeId, "c-consult");
    assert.equal(r.resolved.blocksAvailability, false);
  });

  it("disabled types cannot be created by bypassing the UI", () => {
    const r = resolveScheduleCatalogWrite({
      type: "tasting",
      catalog: catalogRow({
        id: "c-taste",
        source: "builtin",
        builtinKey: "tasting",
        label: "Tasting",
        enabled: false,
      }),
    });
    assert.equal(r.ok, false);
    assert.match(availServiceSrc, /isAppointmentCatalogBuiltinKey\(input\.type\)/);
    assert.match(availServiceSrc, /resolveScheduleCatalogWrite/);
    assert.match(availServiceSrc, /Book tours from Tours/);
  });

  it("same-type edit preserves existing snapshot even if catalog policy changed", () => {
    const r = resolveScheduleCatalogWrite({
      type: "consultation",
      catalog: catalogRow({
        id: "c-consult",
        source: "builtin",
        builtinKey: "consultation",
        label: "Consultation",
        enabled: true,
        blocksAvailability: false,
      }),
      preserveExisting: { scheduleItemTypeId: "c-consult", blocksAvailability: true },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.blocksAvailability, true);
    assert.equal(r.resolved.scheduleItemTypeId, "c-consult");
  });

  it("changing to a different catalog type applies the new snapshot", () => {
    const r = resolveScheduleCatalogWrite({
      type: "walkthrough",
      catalog: catalogRow({
        id: "c-walk",
        source: "builtin",
        builtinKey: "walkthrough",
        label: "Walkthrough",
        enabled: true,
        blocksAvailability: false,
      }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.blocksAvailability, false);
    assert.equal(r.resolved.scheduleItemTypeId, "c-walk");
  });

  it("legacy tasting remains editable while disabled; tour remains legacy-only", () => {
    const tasting = resolveScheduleCatalogWrite({
      type: "tasting",
      catalog: catalogRow({
        id: "c-taste",
        source: "builtin",
        builtinKey: "tasting",
        label: "Tasting",
        enabled: false,
        blocksAvailability: true,
      }),
      preserveExisting: { scheduleItemTypeId: "c-taste", blocksAvailability: true },
    });
    assert.equal(tasting.ok, true);
    assert.equal(isLegacyOnlyManualScheduleType("tour"), true);
    assert.equal(isLegacyOnlyManualScheduleType("tasting"), false);
    assert.match(LEGACY_MANUAL_SCHEDULE_TYPE_LABELS.tour ?? "", /not a booked tour/i);
    assert.equal(isCreatableManualScheduleType("tour"), false);
    assert.equal(isCreatableManualScheduleType("tasting"), false);
  });

  it("booking placeholders remain available and distinct; catalog Settings never rewrite blocks", () => {
    const r = resolveScheduleCatalogWrite({ type: "private_event", catalog: null });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.scheduleItemTypeId, null);
    assert.equal(r.resolved.blocksAvailability, true);
    assert.equal(repoSrc.includes('.from("calendar_blocks")'), false);
    assert.match(catalogServiceSrc, /Does not rewrite existing calendar_blocks snapshots/);
  });

  it("create/update are venue-scoped via withVenue + catalog lookups by venueId", () => {
    assert.match(availServiceSrc, /withVenue/);
    assert.match(availServiceSrc, /getBuiltinScheduleItemType\(supabase, venueId/);
    assert.match(availServiceSrc, /getScheduleItemTypeById\(supabase, venueId/);
    assert.match(repoSrc, /\.eq\("venue_id", venueId\)/);
  });

  it("edit UI keeps Current type section for non-creatable / disabled types", () => {
    assert.match(calendarViewSrc, /Current type/);
    assert.match(calendarViewSrc, /editOnlyCurrentType/);
    assert.match(calendarViewSrc, /no longer offered for new items/);
  });
});

describe("Calendar Slice 2A.2.2 — perspectives & filters", () => {
  it("relevant perspectives include custom; tasting only when enabled", () => {
    const sales = PERSPECTIVES.find((p) => p.id === "sales")!;
    const planning = PERSPECTIVES.find((p) => p.id === "planning")!;
    const operations = PERSPECTIVES.find((p) => p.id === "operations")!;
    assert.equal(sales.filters.manualTypes?.includes("custom"), true);
    assert.equal(sales.filters.manualTypes?.includes("tasting"), false);
    assert.equal(planning.filters.manualTypes?.includes("custom"), true);
    assert.equal(planning.filters.manualTypes?.includes("tasting"), false);
    assert.equal(operations.filters.manualTypes?.includes("custom"), true);
    assert.equal(operations.filters.manualTypes?.includes("personal_appointment"), true);
    assert.equal(operations.filters.manualTypes?.includes("other"), true);
    assert.equal((sales.filters.manualTypes ?? []).includes("tour"), false);
    const withTaste = getPerspectives(true);
    assert.equal(withTaste.find((p) => p.id === "sales")!.filters.manualTypes?.includes("tasting"), true);
    assert.equal(withTaste.find((p) => p.id === "planning")!.filters.manualTypes?.includes("tasting"), true);
  });

  it("sanitize keeps tasting filterable; still strips manual tour and excluded item types", () => {
    const cleaned = sanitizeVenueCalendarFilters({
      types: ["event", "payment_due", "follow_up"] as CalendarItemType[],
      manualTypes: ["tour", "consultation", "tasting"] as never,
      staffId: null,
      spaceId: null,
    });
    assert.deepEqual(cleaned.types, ["event"]);
    assert.deepEqual(cleaned.manualTypes, ["consultation", "tasting"]);
  });
});
