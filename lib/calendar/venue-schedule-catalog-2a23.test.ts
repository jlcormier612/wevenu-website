/**
 * Calendar Slice 2A.2.3 — custom scheduled appointment type CRUD.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PERSPECTIVES } from "@/components/calendar/perspectives";
import {
  APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS,
  buildScheduleItemPickerGroups,
  catalogLabelsEqual,
  countActiveCustomTypes,
  customKindToGroupKey,
  flattenScheduleItemPickerOptions,
  generateCustomKey,
  normalizeCatalogLabel,
  resolveScheduleCatalogWrite,
  validateActiveCustomCap,
  validateCustomScheduleItemTypeLabel,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";

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
const pageSrc = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20261353000000_venue_schedule_item_types_custom_label_unique.sql"),
  "utf8",
);
const catalogMigration = readFileSync(
  resolve("supabase/migrations/20261352000000_venue_schedule_item_types_catalog.sql"),
  "utf8",
);

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

const builtins: VenueScheduleItemType[] = [
  row({ id: "b1", source: "builtin", builtinKey: "consultation", label: "Consultation", groupKey: "meetings" }),
  row({ id: "b2", source: "builtin", builtinKey: "blocked_time", label: "Blocked Time", groupKey: "availability" }),
  row({ id: "b3", source: "builtin", builtinKey: "tasting", label: "Tasting", enabled: false, groupKey: "meetings" }),
];

describe("Calendar Slice 2A.2.3 — validation", () => {
  it("requires a non-blank trimmed name", () => {
    assert.equal(normalizeCatalogLabel("  Wedding Planning Meeting  "), "Wedding Planning Meeting");
    const blank = validateCustomScheduleItemTypeLabel({ label: "   ", catalog: builtins });
    assert.equal(blank.ok, false);
    const ok = validateCustomScheduleItemTypeLabel({
      label: "  Wedding Planning Meeting  ",
      catalog: builtins,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.label, "Wedding Planning Meeting");
  });

  it("rejects case-insensitive duplicate active customs", () => {
    const catalog = [
      ...builtins,
      row({
        id: "c1",
        source: "custom",
        customKey: "wedding_planning_meeting",
        label: "Wedding Planning Meeting",
      }),
    ];
    const dup = validateCustomScheduleItemTypeLabel({
      label: "wedding planning meeting",
      catalog,
    });
    assert.equal(dup.ok, false);
    assert.equal(catalogLabelsEqual("Wedding Planning Meeting", "wedding planning meeting"), true);
  });

  it("rejects collision with built-in catalog names", () => {
    const hit = validateCustomScheduleItemTypeLabel({ label: "consultation", catalog: builtins });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.message, /built-in/i);
  });

  it("rename succeeds when keeping the same name (excludeId) and rejects other active duplicates", () => {
    const catalog = [
      ...builtins,
      row({
        id: "c1",
        source: "custom",
        customKey: "wedding_planning_meeting",
        label: "Wedding Planning Meeting",
      }),
      row({
        id: "c2",
        source: "custom",
        customKey: "other_meeting",
        label: "Other Meeting",
      }),
    ];
    const keep = validateCustomScheduleItemTypeLabel({
      label: "  Wedding Planning Meeting  ",
      catalog,
      excludeId: "c1",
    });
    assert.equal(keep.ok, true);
    if (keep.ok) assert.equal(keep.label, "Wedding Planning Meeting");
    const collide = validateCustomScheduleItemTypeLabel({
      label: "other meeting",
      catalog,
      excludeId: "c1",
    });
    assert.equal(collide.ok, false);
  });

  it("rename rejects built-in-name collision", () => {
    const catalog = [
      ...builtins,
      row({
        id: "c1",
        source: "custom",
        customKey: "planning",
        label: "Wedding Planning Meeting",
      }),
    ];
    const hit = validateCustomScheduleItemTypeLabel({
      label: "Blocked Time",
      catalog,
      excludeId: "c1",
    });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.message, /built-in/i);
  });

  it("archived customs do not count toward the 20-active limit or block the same name", () => {
    const archived = Array.from({ length: 5 }, (_, i) =>
      row({
        id: `a${i}`,
        source: "custom",
        customKey: `arch_${i}`,
        label: `Archived ${i}`,
        archivedAt: "2026-01-02T00:00:00Z",
      }),
    );
    const active = Array.from({ length: 19 }, (_, i) =>
      row({
        id: `c${i}`,
        source: "custom",
        customKey: `act_${i}`,
        label: `Custom ${i}`,
      }),
    );
    const catalog = [...builtins, ...archived, ...active];
    assert.equal(countActiveCustomTypes(catalog), 19);
    assert.equal(validateActiveCustomCap(catalog).ok, true);
    const reuse = validateCustomScheduleItemTypeLabel({
      label: "Archived 0",
      catalog,
    });
    assert.equal(reuse.ok, true);
  });

  it("enforces the 20-active-custom limit", () => {
    assert.equal(APPOINTMENT_CATALOG_MAX_ACTIVE_CUSTOMS, 20);
    const active = Array.from({ length: 20 }, (_, i) =>
      row({
        id: `c${i}`,
        source: "custom",
        customKey: `act_${i}`,
        label: `Custom ${i}`,
      }),
    );
    const full = validateActiveCustomCap([...builtins, ...active]);
    assert.equal(full.ok, false);
    assert.match(catalogMigration, /at most 20 active custom/);
  });

  it("generates custom_key server-side from the label", () => {
    assert.equal(generateCustomKey("Wedding Planning Meeting"), "wedding_planning_meeting");
    assert.doesNotMatch(sectionSrc, /custom_key|builtin_key|schedule_item_type_id|blocks_availability/);
  });

  it("maps Kind to catalog groups", () => {
    assert.equal(customKindToGroupKey("appointment"), "meetings");
    assert.equal(customKindToGroupKey("reserved_blocked"), "availability");
  });
});

describe("Calendar Slice 2A.2.3 — picker & perspectives", () => {
  it("puts custom types in the correct Calendar picker group and omits archived", () => {
    const catalog = [
      ...builtins,
      row({
        id: "c-appt",
        source: "custom",
        customKey: "planning",
        label: "Wedding Planning Meeting",
        groupKey: "meetings",
        blocksAvailability: false,
      }),
      row({
        id: "c-res",
        source: "custom",
        customKey: "staff_block",
        label: "Staff Only Block",
        groupKey: "availability",
      }),
      row({
        id: "c-arch",
        source: "custom",
        customKey: "old",
        label: "Old Type",
        groupKey: "meetings",
        archivedAt: "2026-02-01T00:00:00Z",
        enabled: false,
      }),
    ];
    const groups = buildScheduleItemPickerGroups(catalog);
    const appt = groups.find((g) => g.label === "Appointments")?.options.map((o) => o.value) ?? [];
    const reserved = groups.find((g) => g.label === "Reserved & blocked time")?.options.map((o) => o.value) ?? [];
    assert.equal(appt.includes("custom:c-appt"), true);
    assert.equal(reserved.includes("custom:c-res"), true);
    assert.equal(appt.includes("custom:c-arch"), false);
    assert.equal(
      flattenScheduleItemPickerOptions(groups).find((o) => o.value === "custom:c-appt")?.label,
      "Wedding Planning Meeting",
    );
  });

  it("existing item referencing archived custom remains editable via preserveExisting", () => {
    const archived = row({
      id: "c-arch",
      source: "custom",
      customKey: "old",
      label: "Old Type",
      enabled: false,
      archivedAt: "2026-02-01T00:00:00Z",
      blocksAvailability: true,
    });
    const create = resolveScheduleCatalogWrite({ type: "custom", catalog: archived, scheduleItemTypeId: "c-arch" });
    assert.equal(create.ok, false);
    const edit = resolveScheduleCatalogWrite({
      type: "custom",
      catalog: archived,
      scheduleItemTypeId: "c-arch",
      preserveExisting: { scheduleItemTypeId: "c-arch", blocksAvailability: false },
    });
    assert.equal(edit.ok, true);
    if (!edit.ok) return;
    assert.equal(edit.resolved.blocksAvailability, false);
    assert.equal(edit.resolved.scheduleItemTypeId, "c-arch");
  });

  it("custom types remain visible in relevant Calendar perspectives", () => {
    for (const id of ["sales", "planning", "operations"] as const) {
      const p = PERSPECTIVES.find((x) => x.id === id)!;
      assert.equal(p.filters.manualTypes?.includes("custom"), true, id);
    }
  });

  it("custom reserve-time snapshot is taken from catalog on create; same-type edit preserves", () => {
    const custom = row({
      id: "c1",
      source: "custom",
      customKey: "planning",
      label: "Wedding Planning Meeting",
      blocksAvailability: false,
    });
    const created = resolveScheduleCatalogWrite({
      type: "custom",
      catalog: custom,
      scheduleItemTypeId: "c1",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.resolved.blocksAvailability, false);
    const preserved = resolveScheduleCatalogWrite({
      type: "custom",
      catalog: { ...custom, blocksAvailability: true },
      scheduleItemTypeId: "c1",
      preserveExisting: { scheduleItemTypeId: "c1", blocksAvailability: false },
    });
    assert.equal(preserved.ok, true);
    if (!preserved.ok) return;
    assert.equal(preserved.resolved.blocksAvailability, false);
  });
});

describe("Calendar Slice 2A.2.3 — service/UI seams", () => {
  it("wires create/rename/archive/restore with owner-manager auth and no calendar_blocks rewrite", () => {
    assert.match(serviceSrc, /createCustomScheduleItemType/);
    assert.match(serviceSrc, /updateCustomScheduleItemType/);
    assert.match(serviceSrc, /archiveCustomScheduleItemType/);
    assert.match(serviceSrc, /restoreCustomScheduleItemType/);
    assert.match(serviceSrc, /Only an owner or manager/);
    assert.match(serviceSrc, /validateCustomScheduleItemTypeLabel/);
    assert.match(serviceSrc, /validateActiveCustomCap/);
    assert.match(actionsSrc, /createCustomScheduleItemTypeAction/);
    assert.match(actionsSrc, /archiveCustomScheduleItemTypeAction/);
    assert.match(actionsSrc, /restoreCustomScheduleItemTypeAction/);
    assert.equal(repoSrc.includes('.from("calendar_blocks")'), false);
    assert.match(repoSrc, /insertCustomScheduleItemTypeRow/);
    assert.match(repoSrc, /Never rewrites calendar_blocks/);
  });

  it("Settings UI exposes Add your own type with Name, Kind, and reserve control", () => {
    assert.match(sectionSrc, /Add your own type/);
    assert.match(sectionSrc, /Name/);
    assert.match(sectionSrc, /Kind/);
    assert.match(sectionSrc, /Reserves venue time for events/);
    assert.match(sectionSrc, /Archive/);
    assert.match(sectionSrc, /Restore/);
    assert.match(sectionSrc, /Rename/);
    assert.match(sectionSrc, /Archived types/);
    assert.match(pageSrc, /getScheduleItemTypesForSettings/);
  });

  it("rename does not rewrite calendar item titles (catalog label only)", () => {
    assert.doesNotMatch(serviceSrc, /from\("calendar_blocks"\)/);
    assert.doesNotMatch(repoSrc, /from\("calendar_blocks"\)/);
    assert.match(repoSrc, /Never rewrites calendar_blocks titles or snapshots/);
  });

  it("DB enforces active custom cap and case-insensitive active label uniqueness", () => {
    assert.match(catalogMigration, /venue_schedule_item_types_enforce_custom_cap/);
    assert.match(migration, /venue_schedule_item_types_active_label_uidx/);
    assert.match(migration, /lower\(label\)/);
    assert.match(migration, /archived_at is null/);
  });

  it("restore re-checks cap and name collision in service", () => {
    const restoreFn = serviceSrc.slice(serviceSrc.indexOf("export async function restoreCustomScheduleItemType"));
    assert.match(restoreFn, /validateActiveCustomCap/);
    assert.match(restoreFn, /validateCustomScheduleItemTypeLabel/);
  });

  it("unauthorized staff mutations are rejected server-side; UI can be read-only", () => {
    assert.match(serviceSrc, /requireManageCatalog|Only an owner or manager/);
    assert.match(serviceSrc, /role === "owner" \|\| role === "manager"/);
    for (const fn of [
      "createCustomScheduleItemType",
      "updateCustomScheduleItemType",
      "archiveCustomScheduleItemType",
      "restoreCustomScheduleItemType",
    ]) {
      const body = serviceSrc.slice(serviceSrc.indexOf(`export async function ${fn}`));
      assert.match(body, /requireManageCatalog/, fn);
    }
    assert.match(sectionSrc, /canEdit/);
    assert.match(pageSrc, /canEditCatalog/);
  });

  it("repository mutations are venue-scoped", () => {
    assert.match(repoSrc, /\.eq\("venue_id", venueId\)/);
    assert.match(repoSrc, /insertCustomScheduleItemTypeRow/);
    assert.match(repoSrc, /updateCustomScheduleItemTypeRow/);
    assert.match(repoSrc, /archiveCustomScheduleItemTypeRow/);
    assert.match(repoSrc, /restoreCustomScheduleItemTypeRow/);
    for (const fn of [
      "updateCustomScheduleItemTypeRow",
      "archiveCustomScheduleItemTypeRow",
      "restoreCustomScheduleItemTypeRow",
    ]) {
      const body = repoSrc.slice(repoSrc.indexOf(`export async function ${fn}`));
      assert.match(body, /\.eq\("venue_id", venueId\)/, fn);
      assert.match(body, /\.eq\("source", "custom"\)/, fn);
    }
  });
});
