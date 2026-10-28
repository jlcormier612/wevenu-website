import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  builtInOfferingCategoryNames,
  findMatchingOfferingCategory,
} from "@/lib/offerings/category-identity";
import { OFFERING_STARTER_CATEGORIES } from "@/lib/offerings/starters";
import { SUGGESTED_CATEGORIES } from "@/lib/event-order-templates/guided-setup";
import type { OfferingCategory } from "@/lib/offerings/types";

function cat(partial: Partial<OfferingCategory> & { id: string; name: string }): OfferingCategory {
  return {
    venueId: "v1",
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("offering category identity", () => {
  it("exposes every built-in EO suggested category including Décor and Florals", () => {
    const names = builtInOfferingCategoryNames();
    assert.ok(names.includes("Décor"));
    assert.ok(names.includes("Florals"));
    assert.ok(names.includes("Bar Service"));
    assert.ok(names.includes("Catering"));
    for (const suggested of SUGGESTED_CATEGORIES.filter((c) => c.key !== "custom")) {
      assert.ok(names.includes(suggested.name), `missing ${suggested.name}`);
    }
  });

  it("starter catalog includes Florals and Décor and uses Bar Service canonical label", () => {
    const byKey = new Map(OFFERING_STARTER_CATEGORIES.map((c) => [c.key, c]));
    assert.equal(byKey.get("OFF-CAT-decor")?.name, "Décor");
    assert.equal(byKey.get("OFF-CAT-florals")?.name, "Florals");
    assert.equal(byKey.get("OFF-CAT-bar")?.name, "Bar Service");
  });

  it("reuses existing Bar row when asking for Bar Service (alias bucket)", () => {
    const existing = [cat({ id: "c1", name: "Bar" })];
    const match = findMatchingOfferingCategory(existing, "Bar Service");
    assert.equal(match?.id, "c1");
  });

  it("reuses case/whitespace variants without inventing a second identity", () => {
    const existing = [cat({ id: "c2", name: "Get Ready Space" })];
    assert.equal(findMatchingOfferingCategory(existing, "  get ready space ")?.id, "c2");
  });

  it("does not collapse unrelated custom categories", () => {
    const existing = [cat({ id: "c3", name: "AV Equipment" })];
    assert.equal(findMatchingOfferingCategory(existing, "Get Ready Inclusions"), null);
  });

  it("EO addSection ensures offering category; provision syncs template section names", () => {
    const eoService = readFileSync(
      join(process.cwd(), "lib/event-order-templates/service.ts"),
      "utf8",
    );
    const provision = readFileSync(join(process.cwd(), "lib/offerings/provision.ts"), "utf8");
    assert.match(eoService, /findOrCreateOfferingCategory/);
    assert.match(provision, /ensureVenueCommercialCategories/);
    assert.match(provision, /event_order_template_sections/);
  });

  it("guided wizard exposes Change package categories on configure", () => {
    const wizard = readFileSync(
      join(process.cwd(), "components/event-order-templates/guided-setup-wizard.tsx"),
      "utf8",
    );
    assert.match(wizard, /eo-guided-edit-package-categories/);
    assert.match(wizard, /openPackageCategories/);
    assert.match(wizard, /Package categories/);
  });
});
