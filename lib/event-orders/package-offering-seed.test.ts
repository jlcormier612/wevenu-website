/**
 * Regression: an accepted package carries its contents onto the Event Order.
 * Proposal-approved selections freeze the chosen packages (not their contents),
 * so seeding used to add one "Signature Wedding" line and lose the contents.
 * Inclusions linked to an Offering seed as Offering lines with its inventory item.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  filterPackageInclusionsToSeed,
  packageNameFromSelectionNotes,
  packageSelectionNotes,
  resolveSelectionInclusions,
} from "@/lib/event-orders/seed-package-inclusions";
import { coupleVisibleLineNotes } from "@/lib/event-orders/share-consistency";
import { isRentalCategoryName, isUnpriced, needsInventoryLink } from "@/lib/offerings/readiness";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const proposalSelection = {
  proposalId: "prop-1",
  includedItems: [
    { description: "Signature Wedding", quantity: 1, unit: "package" },
  ],
};

describe("resolveSelectionInclusions", () => {
  it("proposal-approved selection seeds the chosen packages' contents, not the package name", () => {
    const seeded = resolveSelectionInclusions(proposalSelection, [
      {
        includedItems: [
          { description: "Ceremony chairs", quantity: 150, unit: "each", offeringId: "off-chairs" },
          { description: "Day-of coordination", quantity: 1, unit: null },
        ],
      },
    ]);
    assert.deepEqual(seeded.map((i) => i.description), ["Ceremony chairs", "Day-of coordination"]);
    assert.equal(seeded[0]?.offeringId, "off-chairs");
    assert.ok(!seeded.some((i) => i.description === "Signature Wedding"));
  });

  it("combines contents across chosen primary and add-on options", () => {
    const seeded = resolveSelectionInclusions(proposalSelection, [
      { includedItems: [{ description: "Ceremony chairs", quantity: 150, unit: null }] },
      { includedItems: [{ description: "Champagne toast", quantity: 1, unit: null }] },
    ]);
    assert.equal(seeded.length, 2);
  });

  it("falls back to the selection's own items when chosen options froze no contents", () => {
    assert.deepEqual(resolveSelectionInclusions(proposalSelection, [{ includedItems: [] }]), proposalSelection.includedItems);
    assert.deepEqual(resolveSelectionInclusions(proposalSelection, null), proposalSelection.includedItems);
  });

  it("direct Select package uses the selection's frozen inclusions unchanged", () => {
    const direct = {
      proposalId: null,
      includedItems: [{ description: "Linens", quantity: 20, unit: null, offeringId: "off-linen" }],
    };
    assert.deepEqual(resolveSelectionInclusions(direct, [{ includedItems: [{ description: "x", quantity: 1, unit: null }] }]), direct.includedItems);
  });
});

describe("filterPackageInclusionsToSeed keeps the offering link", () => {
  it("passes offeringId through and omits it for text-only inclusions", () => {
    const seeded = filterPackageInclusionsToSeed(
      [
        { description: "Ceremony chairs", quantity: 150, unit: "each", offeringId: "off-chairs" },
        { description: "Coordination", quantity: 1, unit: null },
      ],
      [],
    );
    assert.equal(seeded[0]?.offeringId, "off-chairs");
    assert.equal("offeringId" in (seeded[1] ?? {}), false);
  });
});

describe("package seed stamp display", () => {
  it("venue sees the package name, couple sees nothing", () => {
    const notes = packageSelectionNotes("0b85946c-0000-4000-8000-000000000000", "Signature Wedding");
    assert.equal(packageNameFromSelectionNotes(notes), "Signature Wedding");
    assert.equal(packageNameFromSelectionNotes("Bring extra linens"), null);
    assert.equal(coupleVisibleLineNotes(notes), null);
    assert.equal(coupleVisibleLineNotes("Bring extra linens"), "Bring extra linens");
  });
});

describe("Offering readiness flags", () => {
  it("flags unpriced and unlinked rentals, never archived rows", () => {
    assert.equal(isUnpriced({ defaultUnitPrice: null }), true);
    assert.equal(isUnpriced({ defaultUnitPrice: 0 }), false);
    assert.equal(isUnpriced({ defaultUnitPrice: null, isArchived: true }), false);
    assert.equal(isRentalCategoryName("Rentals"), true);
    assert.equal(isRentalCategoryName("Catering"), false);
    assert.equal(needsInventoryLink({ categoryName: "Rentals", inventoryItemId: null }), true);
    assert.equal(needsInventoryLink({ categoryName: "Rentals", inventoryItemId: "inv-1" }), false);
    assert.equal(needsInventoryLink({ categoryName: "Bar", inventoryItemId: null }), false);
    assert.equal(needsInventoryLink({ categoryName: "Rentals", inventoryItemId: null, isArchived: true }), false);
  });
});

describe("wiring", () => {
  it("seeding reads chosen proposal options and inserts linked inclusions as Offering lines with inventory", () => {
    const service = read("lib/event-orders/service.ts");
    const start = service.indexOf("async function seedBookingPackageInclusions");
    const end = service.indexOf("async function copyTemplateSnapshotsIntoOrder");
    const seed = service.slice(start, end);
    assert.match(seed, /proposalsRepo\.getProposal/);
    assert.match(seed, /resolveSelectionInclusions/);
    assert.match(seed, /insertLineFromOffering/);
    assert.match(seed, /inventoryItemId: offering\.inventoryItemId/);
    assert.match(seed, /\.eq\("venue_id", venueId\)/);
    assert.match(seed, /insertCustomLine/);
  });

  it("both freeze points copy the inclusion's offering link", () => {
    assert.match(read("lib/commercial-proposals/service.ts"), /offeringId: i\.offeringId/);
    assert.match(read("lib/commercial-selections/service.ts"), /offeringId: item\.offeringId/);
  });

  it("migration adds a nullable same-venue offering link and leaves existing rows alone", () => {
    const sql = read("supabase/migrations/20261426500000_package_items_offering_link.sql");
    assert.match(sql, /add column if not exists offering_id uuid references public\.offerings \(id\) on delete set null/);
    assert.match(sql, /offering_not_in_venue/);
    assert.match(sql, /o\.venue_id = new\.venue_id/);
    assert.doesNotMatch(sql, /\bupdate public\.package_items\b|\bdelete from\b/i);
  });

  it("duplicating a package keeps inclusion links", () => {
    assert.match(read("lib/packages/repository.ts"), /offering_id: item\.offeringId/);
  });
});
