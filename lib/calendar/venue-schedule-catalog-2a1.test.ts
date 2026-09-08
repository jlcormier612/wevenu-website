/**
 * Calendar Slice 2A.1 — catalog foundation (pure + source seams).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PERSPECTIVES } from "@/components/calendar/perspectives";
import {
  coveringCalendarBlockTitle,
  eventCoverageInterval,
  TOUR_CLOSING_CALENDAR_BLOCK_TYPES,
} from "@/lib/availability/calendar-block-coverage";
import { MANUAL_SCHEDULE_TYPES } from "@/lib/availability/types";
import {
  APPOINTMENT_CATALOG_BUILTIN_KEYS,
  APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS,
  resolveScheduleCatalogWrite,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";

const migration = readFileSync(
  resolve("supabase/migrations/20261352000000_venue_schedule_item_types_catalog.sql"),
  "utf8",
);
const perspectivesSrc = readFileSync(resolve("components/calendar/perspectives.ts"), "utf8");
const serviceSrc = readFileSync(resolve("lib/availability/service.ts"), "utf8");
const coverageSrc = readFileSync(resolve("lib/availability/calendar-block-coverage.ts"), "utf8");

function builtinCatalog(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "builtinKey" | "enabled">,
): VenueScheduleItemType {
  return {
    id: partial.id ?? "cat-1",
    venueId: partial.venueId ?? "venue-1",
    source: "builtin",
    builtinKey: partial.builtinKey,
    customKey: null,
    label: partial.label ?? "Label",
    enabled: partial.enabled,
    blocksAvailability: partial.blocksAvailability ?? true,
    groupKey: partial.groupKey ?? "meetings",
    sortOrder: partial.sortOrder ?? 10,
    archivedAt: partial.archivedAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("Calendar Slice 2A.1 — schema seams", () => {
  it("creates catalog table with locked builtins and custom support", () => {
    assert.match(migration, /create table public\.venue_schedule_item_types/);
    for (const key of APPOINTMENT_CATALOG_BUILTIN_KEYS) {
      assert.match(migration, new RegExp(`'${key}'`));
    }
    assert.match(migration, /venue_schedule_item_types_builtin_key_check/);
    assert.doesNotMatch(
      migration.slice(
        migration.indexOf("venue_schedule_item_types_builtin_key_check"),
        migration.indexOf("venue_schedule_item_types_blocked_time_enabled_check"),
      ),
      /'tour'/,
    );
    assert.doesNotMatch(
      migration.slice(
        migration.indexOf("venue_schedule_item_types_builtin_key_check"),
        migration.indexOf("venue_schedule_item_types_blocked_time_enabled_check"),
      ),
      /wedding_event_booking|private_event/,
    );
    assert.match(migration, /'custom'/);
    assert.match(migration, /calendar_blocks_type_check/);
    assert.match(migration, /blocks_availability boolean/);
    assert.match(migration, /schedule_item_type_id/);
    assert.match(migration, /calendar_blocks_schedule_item_type_same_venue_fkey/);
    assert.match(migration, /at most 20 active custom/);
    assert.match(migration, /blocked_time_enabled_check/);
  });

  it("seeds locked defaults including tasting disabled", () => {
    assert.match(migration, /'consultation'[\s\S]*true,\s*true/);
    assert.match(migration, /'tasting',\s*'Tasting',\s*false,\s*true/);
    assert.match(migration, /seed_venue_schedule_item_types/);
    assert.match(migration, /venues_seed_schedule_item_types/);
  });

  it("backfills blocks_availability true before covering change", () => {
    const backfillAt = migration.indexOf("set blocks_availability = true");
    const coveringAt = migration.indexOf("cb.blocks_availability = true");
    assert.ok(backfillAt > 0 && coveringAt > backfillAt);
  });

  it("Finance perspective is removed", () => {
    assert.equal(PERSPECTIVES.some((p) => (p as { id: string }).id === "finance"), false);
    assert.doesNotMatch(perspectivesSrc, /id: "finance"/);
  });
});

describe("Calendar Slice 2A.1 — catalog resolve", () => {
  it("resolves builtin create with catalog snapshot", () => {
    const r = resolveScheduleCatalogWrite({
      type: "walkthrough",
      catalog: builtinCatalog({ builtinKey: "walkthrough", enabled: true, blocksAvailability: true }),
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.type, "walkthrough");
    assert.equal(r.resolved.scheduleItemTypeId, "cat-1");
    assert.equal(r.resolved.blocksAvailability, true);
  });

  it("rejects disabled catalog type for new selection", () => {
    const r = resolveScheduleCatalogWrite({
      type: "tasting",
      catalog: builtinCatalog({ builtinKey: "tasting", enabled: false }),
    });
    assert.equal(r.ok, false);
  });

  it("allows preserving a disabled type on edit", () => {
    const r = resolveScheduleCatalogWrite({
      type: "tasting",
      catalog: builtinCatalog({ id: "t1", builtinKey: "tasting", enabled: false, blocksAvailability: true }),
      preserveExisting: { scheduleItemTypeId: "t1", blocksAvailability: true },
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.scheduleItemTypeId, "t1");
  });

  it("placeholders always block and have no catalog FK", () => {
    const r = resolveScheduleCatalogWrite({ type: "wedding_event_booking", catalog: null });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.scheduleItemTypeId, null);
    assert.equal(r.resolved.blocksAvailability, true);
  });

  it("custom requires an enabled custom catalog row", () => {
    const bad = resolveScheduleCatalogWrite({ type: "custom", catalog: null });
    assert.equal(bad.ok, false);
    const good = resolveScheduleCatalogWrite({
      type: "custom",
      scheduleItemTypeId: "c1",
      catalog: {
        id: "c1",
        venueId: "venue-1",
        source: "custom",
        builtinKey: null,
        customKey: "menu_tasting",
        label: "Menu Tasting",
        enabled: true,
        blocksAvailability: true,
        groupKey: "meetings",
        sortOrder: 100,
        archivedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    assert.equal(good.ok, true);
    if (!good.ok) return;
    assert.equal(good.resolved.type, "custom");
    assert.equal(good.resolved.catalogLabel, "Menu Tasting");
  });

  it("documents the active custom cap constant", () => {
    assert.equal(APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS, 20);
    assert.match(migration, /v_count >= 20/);
  });

  it("closed ManualScheduleType includes custom only as controlled value", () => {
    assert.equal(MANUAL_SCHEDULE_TYPES.includes("custom"), true);
    assert.match(serviceSrc, /resolveScheduleCatalogWrite/);
  });
});

describe("Calendar Slice 2A.1 — Event covering snapshot", () => {
  const block = {
    title: "Staff meeting",
    type: "consultation",
    startDate: "2099-07-01",
    endDate: "2099-07-01",
    isAllDay: true,
    startTime: null,
    endTime: null,
    recurrenceRule: "none" as const,
    recurrenceInterval: 1,
    recurrenceEndsOn: null,
    recurrenceCount: null,
  };

  it("blocks_availability true covers an Event", () => {
    assert.equal(
      coveringCalendarBlockTitle(
        [{ ...block, blocksAvailability: true }],
        eventCoverageInterval({ eventDate: "2099-07-01" }),
      ),
      "Staff meeting",
    );
  });

  it("blocks_availability false does not cover an Event", () => {
    assert.equal(
      coveringCalendarBlockTitle(
        [{ ...block, blocksAvailability: false }],
        eventCoverageInterval({ eventDate: "2099-07-01" }),
      ),
      null,
    );
  });

  it("Tour closing still uses type whitelist, not blocks_availability", () => {
    assert.deepEqual([...TOUR_CLOSING_CALENDAR_BLOCK_TYPES], [
      "blocked_time", "wedding_event_booking", "private_event",
    ]);
    assert.equal(
      coveringCalendarBlockTitle(
        [{ ...block, type: "consultation", blocksAvailability: true }],
        eventCoverageInterval({ eventDate: "2099-07-01" }),
        { types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES },
      ),
      null,
    );
    assert.equal(
      coveringCalendarBlockTitle(
        [{
          ...block,
          type: "blocked_time",
          title: "Closed",
          blocksAvailability: false,
        }],
        eventCoverageInterval({ eventDate: "2099-07-01" }),
        { types: TOUR_CLOSING_CALENDAR_BLOCK_TYPES },
      ),
      "Closed",
    );
    assert.match(coverageSrc, /blocks_availability \(Slice 2A\.1\)/);
  });
});
