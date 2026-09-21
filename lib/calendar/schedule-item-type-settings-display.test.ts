/**
 * Settings Availability custom types — toggle semantics + gate probe cleanup.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildScheduleItemPickerGroups,
  countActiveCustomTypes,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";

const sectionSrc = readFileSync(
  resolve("components/settings/scheduled-appointment-types-section.tsx"),
  "utf8",
);
const serviceSrc = readFileSync(
  resolve("lib/calendar/schedule-item-catalog-service.ts"),
  "utf8",
);
const repoSrc = readFileSync(
  resolve("lib/calendar/schedule-item-catalog-repository.ts"),
  "utf8",
);
const actionsSrc = readFileSync(
  resolve("app/(app)/settings/schedule-appointment-types-actions.ts"),
  "utf8",
);

function customRow(
  partial: Partial<VenueScheduleItemType> & Pick<VenueScheduleItemType, "id" | "label">,
): VenueScheduleItemType {
  return {
    venueId: "v1",
    source: "custom",
    builtinKey: null,
    customKey: partial.customKey ?? "custom_key",
    enabled: partial.enabled ?? true,
    blocksAvailability: partial.blocksAvailability ?? true,
    groupKey: partial.groupKey ?? "meetings",
    sortOrder: partial.sortOrder ?? 100,
    archivedAt: partial.archivedAt ?? null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("gate probe custom types", () => {
  it("no longer aliases Gate labels to Custom Type in catalog or Settings", () => {
    assert.doesNotMatch(sectionSrc, /scheduleItemTypeSettingsDisplayLabel/);
    assert.doesNotMatch(sectionSrc, /Custom Type/);
    const catalogSrc = readFileSync(resolve("lib/calendar/schedule-item-catalog.ts"), "utf8");
    assert.doesNotMatch(catalogSrc, /Gate Appt 032692/);
    assert.doesNotMatch(catalogSrc, /SETTINGS_CUSTOM_TYPE_DISPLAY_ALIASES/);
  });
});

describe("custom type enabled + blocksAvailability controls", () => {
  it("Settings custom rows expose On/Off and Blocks event bookings", () => {
    assert.match(sectionSrc, /BLOCKS_EVENT_BOOKINGS_LABEL = "Blocks event bookings"/);
    assert.match(sectionSrc, /onCustomEnabled/);
    assert.match(sectionSrc, /onCustomReserves/);
    assert.match(sectionSrc, /aria-label=\{`\$\{row\.label\} enabled`\}/);
    assert.match(sectionSrc, /aria-label=\{`\$\{row\.label\} \$\{BLOCKS_EVENT_BOOKINGS_LABEL\}`\}/);
    // Create form has both controls
    assert.match(sectionSrc, /aria-label="Enabled"/);
    assert.match(sectionSrc, /aria-label=\{BLOCKS_EVENT_BOOKINGS_LABEL\}/);
    assert.match(sectionSrc, /enabled: newEnabled/);
    assert.match(sectionSrc, /blocksAvailability: newReserves/);
  });

  it("service/repo/actions persist enabled independently of blocksAvailability", () => {
    assert.match(serviceSrc, /enabled: input\.enabled/);
    assert.match(serviceSrc, /blocksAvailability: input\.blocksAvailability/);
    assert.match(repoSrc, /if \(patch\.enabled !== undefined\) update\.enabled = patch\.enabled/);
    assert.match(repoSrc, /if \(patch\.blocksAvailability !== undefined\) update\.blocks_availability/);
    assert.match(actionsSrc, /enabled\?: boolean/);
    assert.match(actionsSrc, /blocksAvailability\?: boolean/);
  });

  it("enabled Off removes a custom type from Calendar create picker; archive is distinct", () => {
    const enabledOn = customRow({
      id: "c1",
      label: "Wedding Planning Meeting",
      enabled: true,
      blocksAvailability: false,
      customKey: "wedding_planning_meeting",
    });
    const enabledOff = customRow({
      id: "c2",
      label: "Staff Only Hold",
      enabled: false,
      blocksAvailability: true,
      customKey: "staff_only_hold",
    });
    const archived = customRow({
      id: "c3",
      label: "Old Probe",
      enabled: false,
      blocksAvailability: true,
      customKey: "gate_appt_032692",
      archivedAt: "2026-09-21T00:00:00.000Z",
    });

    const groups = buildScheduleItemPickerGroups([enabledOn, enabledOff, archived]);
    const labels = groups.flatMap((g) => g.options.map((o) => o.label));
    assert.ok(labels.includes("Wedding Planning Meeting"));
    assert.ok(!labels.includes("Staff Only Hold"));
    assert.ok(!labels.includes("Old Probe"));
    assert.ok(!labels.includes("Gate Appt 032692"));

    // Cap counts non-archived customs even when disabled (Off ≠ Archive).
    assert.equal(countActiveCustomTypes([enabledOn, enabledOff, archived]), 2);
  });

  it("blocksAvailability and enabled remain independent in picker occupancy snapshot", () => {
    const usableNoBlock = customRow({
      id: "c4",
      label: "Private Facility Use Soft",
      enabled: true,
      blocksAvailability: false,
      customKey: "private_soft",
    });
    const usableBlocks = customRow({
      id: "c5",
      label: "Private Facility Use",
      enabled: true,
      blocksAvailability: true,
      customKey: "private_hard",
    });
    const groups = buildScheduleItemPickerGroups([usableNoBlock, usableBlocks]);
    const labels = groups.flatMap((g) => g.options.map((o) => o.label));
    assert.ok(labels.includes("Private Facility Use Soft"));
    assert.ok(labels.includes("Private Facility Use"));
    // Independence is on the catalog row, not the picker option shape.
    assert.equal(usableNoBlock.enabled, true);
    assert.equal(usableNoBlock.blocksAvailability, false);
    assert.equal(usableBlocks.enabled, true);
    assert.equal(usableBlocks.blocksAvailability, true);
  });
});

describe("Blocked Time remains locked", () => {
  it("Settings still locks enabled + blocks controls for blocked_time", () => {
    assert.match(sectionSrc, /const locked = key === "blocked_time"/);
    assert.match(sectionSrc, /disabled=\{!canEdit \|\| locked \|\| busy\}/);
    assert.match(sectionSrc, /Always available — your safe way to close time on the Calendar/);
  });
});

describe("blocksAvailability label copy", () => {
  it("uses Blocks event bookings and preferred explanatory sentence", () => {
    assert.match(sectionSrc, /Blocks event bookings/);
    assert.doesNotMatch(sectionSrc, /Reserves venue time for events/);
    assert.match(
      sectionSrc,
      /When on, this time counts as reserved on your Calendar so another event can.t book over it/,
    );
  });
});
