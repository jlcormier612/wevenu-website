/**
 * Regression: Event Order quantities meant nothing.
 * - Per-person template lines landed as quantity 1 ("×1 guest").
 * - Package inclusions linked to an offering always carried 1, so the floor plan
 *   read "2 required · 96 placed" for chairs.
 * - The venue header "Total" added package-covered values into the money line.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { eventOrderChargeSplit } from "@/lib/client-choices/unbilled-delta";
import {
  defaultApplySelections,
  packageStartingSelections,
  startingQuantityForLine,
} from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import { filterPackageInclusionsToSeed, seededInclusionQuantity } from "@/lib/event-orders/seed-package-inclusions";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

function line(id: string, over: Partial<EventOrderTemplateLine>): EventOrderTemplateLine {
  return {
    id, templateId: "t", venueId: "v", sectionId: null, description: id, descriptionDetail: null,
    quantity: 1, unitPrice: 10, pricingModel: "flat", unit: null, includedByDefault: true,
    offeringId: null, sortOrder: 0, createdAt: "", updatedAt: "", ...over,
  };
}

const dinner = line("dinner", { pricingModel: "per_person", unitPrice: 85, unit: "guest" });
const chairs = line("chairs", { pricingModel: "per_unit", unitPrice: 5, unit: "chair", quantity: 10 });
const dj = line("dj", { pricingModel: "flat", unitPrice: 900 });

describe("per-person template lines start at the guest count", () => {
  it("per-person line uses the event guest count", () => {
    assert.equal(startingQuantityForLine(dinner, 120), 120);
  });
  it("without a guest count it keeps the template quantity", () => {
    assert.equal(startingQuantityForLine(dinner, null), 1);
    assert.equal(startingQuantityForLine(dinner, 0), 1);
  });
  it("per-unit and flat lines are not touched by the guest count", () => {
    assert.equal(startingQuantityForLine(chairs, 120), 10);
    assert.equal(startingQuantityForLine(dj, 120), 1);
  });
  it("apply-sheet defaults and package starting selections both follow it", () => {
    const apply = defaultApplySelections([dinner, chairs, dj], 120);
    assert.deepEqual(apply.map((s) => s.quantity), [120, 10, 1]);
    const pkg = packageStartingSelections([dinner, chairs, dj], 120);
    assert.deepEqual(pkg.map((s) => s.quantity), [120, 10, 1]);
  });
  it("callers that pass no guest count behave exactly as before", () => {
    assert.deepEqual(defaultApplySelections([dinner, chairs]).map((s) => s.quantity), [1, 10]);
    assert.deepEqual(packageStartingSelections([dinner, chairs]).map((s) => s.quantity), [1, 10]);
  });
  it("server default path loads the guest count; apply sheets get it from the event", () => {
    const service = read("lib/event-orders/service.ts");
    assert.match(service, /packageStartingSelections\(template\.lines, await loadEventOrderGuestCount\(/);
    assert.match(service, /from\("events"\)\.select\("guest_count"\)/);
    assert.match(service, /from\("clients"\)\.select\("guest_count"\)/);
    const panel = read("components/event-orders/event-order-panel.tsx");
    assert.equal((panel.match(/guestCount=\{applyGuestCount\}/g) ?? []).length, 2);
    const sheet = read("components/event-order-templates/apply-event-order-template-sheet.tsx");
    assert.match(sheet, /defaultApplySelections\(template\.lines, guestCount\)/);
    const list = read("components/event-order-templates/event-order-template-list.tsx");
    assert.match(list, /defaultApplySelections\(loaded\.lines, ev\.guestCount\)/);
  });
});

describe("package inclusions can count per guest", () => {
  it("per-guest inclusion scales with the guest count", () => {
    assert.equal(seededInclusionQuantity({ quantity: 1, perGuest: true }, 120), 120);
    assert.equal(seededInclusionQuantity({ quantity: 2, perGuest: true }, 50), 100);
  });
  it("fixed inclusions and unknown guest counts keep the set quantity", () => {
    assert.equal(seededInclusionQuantity({ quantity: 12 }, 120), 12);
    assert.equal(seededInclusionQuantity({ quantity: 1, perGuest: true }, null), 1);
  });
  it("the per-guest flag survives seeding filters", () => {
    const out = filterPackageInclusionsToSeed(
      [{ description: "Chiavari chairs", quantity: 1, unit: null, offeringId: "off", perGuest: true }],
      [],
    );
    assert.equal(out[0]?.perGuest, true);
    assert.equal(out[0]?.offeringId, "off");
  });
  it("proposals and direct selections freeze the flag; seeding applies it", () => {
    assert.match(read("lib/commercial-proposals/service.ts"), /\.\.\.\(i\.perGuest \? \{ perGuest: true \} : \{\}\)/);
    assert.match(read("lib/commercial-selections/service.ts"), /\.\.\.\(item\.perGuest \? \{ perGuest: true \} : \{\}\)/);
    assert.match(read("lib/event-orders/service.ts"), /quantity: String\(seededInclusionQuantity\(item, guestCount\)\)/);
    const repo = read("lib/packages/repository.ts");
    assert.match(repo, /perGuest: r\.per_guest === true/);
    assert.match(repo, /per_guest: item\.perGuest === true/);
    assert.match(
      read("supabase/migrations/20261426900000_package_items_per_guest.sql"),
      /add column if not exists per_guest boolean not null default false/,
    );
  });
  it("linked inclusions show an editable count with a per-guest option", () => {
    const editor = read("components/packages/package-inclusions-editor.tsx");
    assert.match(editor, /item\.offeringId && \(\s*<InclusionCount/);
    assert.match(editor, /setPackageItemQuantityAction\(packageId, itemId, nextQuantity, nextPerGuest\)/);
  });
});

describe("venue header separates new charges from package-covered value", () => {
  it("splits billable lines from included lines", () => {
    const split = eventOrderChargeSplit([
      { amount: 750, unitPrice: 750, isIncluded: false },
      { amount: 435, unitPrice: 435, isIncluded: true },
      { amount: 0, unitPrice: null, isIncluded: false },
    ]);
    assert.deepEqual(split, { newCharges: 750, coveredByPackage: 435 });
  });
  it("header no longer shows a combined Total", () => {
    const panel = read("components/event-orders/event-order-panel.tsx");
    assert.doesNotMatch(panel, /Total <span className="font-medium text-foreground">\{formatMoney\(eventOrder\.total\)\}/);
    assert.match(panel, /New charges <span/);
    assert.match(panel, /Covered by package/);
  });
});
