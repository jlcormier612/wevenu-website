/**
 * Calendar Slice 2A.2.4 — migration import catalog resolve (pure).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveMigrationCalendarBlockCatalog } from "@/lib/migration/calendar-block-catalog";
import type { VenueScheduleItemType } from "@/lib/calendar/schedule-item-catalog";

function row(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "id" | "source" | "label">,
): VenueScheduleItemType {
  return {
    venueId: "venue-a",
    builtinKey: partial.builtinKey ?? null,
    customKey: partial.customKey ?? null,
    enabled: partial.enabled ?? true,
    blocksAvailability: partial.blocksAvailability ?? true,
    groupKey: partial.groupKey ?? "meetings",
    sortOrder: partial.sortOrder ?? 10,
    archivedAt: partial.archivedAt ?? null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("resolveMigrationCalendarBlockCatalog", () => {
  it("accepts placeholders and legacy tour with null catalog FK", () => {
    for (const type of ["wedding_event_booking", "private_event", "tour"] as const) {
      const r = resolveMigrationCalendarBlockCatalog({
        type,
        catalogById: null,
        catalogByCustomKey: null,
        catalogByBuiltinKey: null,
      });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.resolved.type, type);
      assert.equal(r.resolved.scheduleItemTypeId, null);
      assert.equal(r.resolved.blocksAvailability, true);
    }
  });

  it("accepts builtins via venue catalog FK + snapshot", () => {
    const builtin = row({
      id: "b-consult",
      source: "builtin",
      builtinKey: "consultation",
      label: "Consultation",
      blocksAvailability: false,
    });
    const r = resolveMigrationCalendarBlockCatalog({
      type: "consultation",
      catalogById: null,
      catalogByCustomKey: null,
      catalogByBuiltinKey: builtin,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.resolved.scheduleItemTypeId, "b-consult");
    assert.equal(r.resolved.blocksAvailability, false);
  });

  it("accepts custom when an existing venue catalog row is provided", () => {
    const custom = row({
      id: "c1",
      source: "custom",
      customKey: "wedding_planning_meeting",
      label: "Wedding Planning Meeting",
      blocksAvailability: false,
    });
    const byId = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      scheduleItemTypeId: "c1",
      catalogById: custom,
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(byId.ok, true);
    if (!byId.ok) return;
    assert.equal(byId.resolved.scheduleItemTypeId, "c1");
    assert.equal(byId.resolved.blocksAvailability, false);

    const byKey = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      customKey: "wedding_planning_meeting",
      catalogById: null,
      catalogByCustomKey: custom,
      catalogByBuiltinKey: null,
    });
    assert.equal(byKey.ok, true);
    if (!byKey.ok) return;
    assert.equal(byKey.resolved.scheduleItemTypeId, "c1");
  });

  it("rejects custom without catalog reference (does not invent a type)", () => {
    const r = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      catalogById: null,
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /will not invent/i);
  });

  it("rejects unknown / missing / archived custom catalog rows", () => {
    const missing = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      scheduleItemTypeId: "missing",
      catalogById: null,
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(missing.ok, false);

    const archived = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      scheduleItemTypeId: "c-arch",
      catalogById: row({
        id: "c-arch",
        source: "custom",
        customKey: "old",
        label: "Old",
        archivedAt: "2026-01-01T00:00:00Z",
        enabled: false,
      }),
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(archived.ok, false);

    const builtinAsCustom = resolveMigrationCalendarBlockCatalog({
      type: "custom",
      scheduleItemTypeId: "b1",
      catalogById: row({
        id: "b1",
        source: "builtin",
        builtinKey: "consultation",
        label: "Consultation",
      }),
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(builtinAsCustom.ok, false);
  });

  it("rejects builtins when the venue catalog row is missing", () => {
    const r = resolveMigrationCalendarBlockCatalog({
      type: "consultation",
      catalogById: null,
      catalogByCustomKey: null,
      catalogByBuiltinKey: null,
    });
    assert.equal(r.ok, false);
  });
});

describe("migration calendar_block commit seams", () => {
  it("commit path resolves catalog before insertBlock and never invents custom types", () => {
    const serviceSrc = readFileSync(resolve("lib/migration/service.ts"), "utf8");
    assert.match(serviceSrc, /resolveMigrationCalendarBlockCatalog/);
    assert.match(serviceSrc, /getScheduleItemTypeById/);
    assert.match(serviceSrc, /getCustomScheduleItemTypeByKey/);
    assert.match(serviceSrc, /getBuiltinScheduleItemType/);
    assert.match(serviceSrc, /blocksAvailability: catalogResolved\.resolved\.blocksAvailability/);
    const blockCommit = serviceSrc.slice(serviceSrc.indexOf('if (entityType === "calendar_block")'));
    assert.match(blockCommit, /if \(!catalogResolved\.ok\) return/);
  });
});
