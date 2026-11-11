/**
 * Regression: booking Selected Package inclusions seed into EO without Offering invention.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  filterPackageInclusionsToSeed,
  packageLinesIgnoreHeadcount,
  PACKAGE_SELECTION_NOTES_PREFIX,
  packageInclusionDedupeKey,
  packageSelectionNotes,
} from "@/lib/event-orders/seed-package-inclusions";

const root = process.cwd();

describe("filterPackageInclusionsToSeed", () => {
  it("seeds missing inclusion text as distinct items", () => {
    const seeded = filterPackageInclusionsToSeed(
      [
        { description: "Day-of Coordination", quantity: 1, unit: null },
        { description: "Tables & chairs", quantity: 10, unit: "sets" },
      ],
      [],
    );
    assert.equal(seeded.length, 2);
    assert.equal(seeded[0]?.description, "Day-of Coordination");
    assert.equal(seeded[1]?.quantity, 10);
    assert.equal(seeded[1]?.unit, "sets");
  });

  it("dedupes against existing EO lines by description (case-insensitive, any section)", () => {
    const seeded = filterPackageInclusionsToSeed(
      [
        { description: "Day-of Coordination", quantity: 1, unit: null },
        { description: "Champagne Toast", quantity: 1, unit: null },
      ],
      ["day-of coordination", "Something else"],
    );
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0]?.description, "Champagne Toast");
  });

  it("dedupes duplicate inclusion rows within the package snapshot", () => {
    const seeded = filterPackageInclusionsToSeed(
      [
        { description: "Bar service", quantity: 1, unit: null },
        { description: "Bar Service", quantity: 2, unit: null },
      ],
      [],
    );
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0]?.quantity, 1);
  });

  it("skips blank descriptions and normalizes zero quantity to 1", () => {
    const seeded = filterPackageInclusionsToSeed(
      [
        { description: "   ", quantity: 1, unit: null },
        { description: "Linens", quantity: 0, unit: null },
      ],
      [],
    );
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0]?.description, "Linens");
    assert.equal(seeded[0]?.quantity, 1);
  });
});

describe("packageSelectionNotes", () => {
  it("stamps selection id for audit without inventing Offering links", () => {
    const notes = packageSelectionNotes("sel-1", "Full Day Package");
    assert.ok(notes.startsWith(PACKAGE_SELECTION_NOTES_PREFIX));
    assert.match(notes, /sel-1/);
    assert.match(notes, /Full Day Package/);
    assert.equal(packageInclusionDedupeKey("  Foo  "), "foo");
  });
});

describe("ensureEventOrder wires booking package inclusion seed", () => {
  it("service seeds after template copy and on replace", () => {
    const service = readFileSync(join(root, "lib/event-orders/service.ts"), "utf8");
    assert.match(service, /seedBookingPackageInclusions/);
    assert.match(service, /filterPackageInclusionsToSeed/);
    assert.match(service, /getActiveSelectionForEvent/);
    assert.doesNotMatch(service, /name.?match|matchByName|auto.?link.*offering/i);
    const ensureIdx = service.indexOf("export async function ensureEventOrder");
    const replaceIdx = service.indexOf("export async function replaceEventOrderFromTemplate");
    const seedCalls = [...service.matchAll(/await seedBookingPackageInclusions/g)];
    assert.ok(seedCalls.length >= 3, "ensure (create+heal) and replace must seed");
    assert.ok(ensureIdx >= 0 && replaceIdx > ensureIdx);
  });

  it("Event Order panel reconciles ensure when an open EO already exists", () => {
    const panel = readFileSync(join(root, "components/event-orders/event-order-panel.tsx"), "utf8");
    assert.match(panel, /ensuredRef/);
    assert.match(panel, /ensureEventOrderAction/);
    assert.doesNotMatch(
      panel,
      /if \(eventOrder \|\| !preferredExists/,
    );
  });
});

describe("package EO headcount nudge", () => {
  const seeded = { notes: packageSelectionNotes("sel-1", "Garden Package"), boundToHeadcount: false };
  const custom = { notes: null, boundToHeadcount: false };

  it("flags an order whose package lines all keep fixed quantities", () => {
    assert.equal(packageLinesIgnoreHeadcount([seeded, custom]), true);
  });

  it("stays quiet once any line follows the headcount", () => {
    assert.equal(packageLinesIgnoreHeadcount([seeded, { notes: null, boundToHeadcount: true }]), false);
    assert.equal(packageLinesIgnoreHeadcount([{ ...seeded, boundToHeadcount: true }]), false);
  });

  it("stays quiet when nothing came from a package", () => {
    assert.equal(packageLinesIgnoreHeadcount([custom]), false);
    assert.equal(packageLinesIgnoreHeadcount([]), false);
  });

  it("renders on the booked, editable Event Order next to Apply a template", () => {
    const panel = readFileSync(join(process.cwd(), "components/event-orders/event-order-panel.tsx"), "utf8");
    assert.match(panel, /!preBooking && !isFinalized && templates\.length > 0 && packageLinesIgnoreHeadcount\(eventOrder\.lines\)/);
    assert.match(panel, /event-order-package-headcount-banner/);
  });
});
