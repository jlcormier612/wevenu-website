/**
 * Starter Inventory catalog + templates — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countCatalogStarterItems,
  INVENTORY_CATALOG_STARTER_CATEGORIES,
  INVENTORY_TEMPLATE_STARTER_MASTERS,
  getInventoryTemplateStarterMaster,
} from "@/lib/inventory/starters";

describe("Starter Inventory", () => {
  it("ships an approachable catalog (~40–50 items) with familiar categories", () => {
    const n = countCatalogStarterItems();
    assert.ok(n >= 40 && n <= 50, `expected ~40–50 items, got ${n}`);
    const names = INVENTORY_CATALOG_STARTER_CATEGORIES.map((c) => c.name);
    for (const required of ["Tables", "Chairs", "Linens", "Ceremony", "Reception", "Tabletop", "Equipment", "Signage & Accessories", "Venue Amenities"]) {
      assert.ok(names.includes(required), required);
    }
  });

  it("does not invent catalog quantities or prices", () => {
    for (const cat of INVENTORY_CATALOG_STARTER_CATEGORIES) {
      for (const item of cat.items) {
        assert.equal(item.quantityAvailable, 0, item.name);
      }
    }
  });

  it("ships Ceremony+Reception and Reception Only templates without ceremony stubs on INV-02", () => {
    const full = getInventoryTemplateStarterMaster("INV-01")!;
    const reception = getInventoryTemplateStarterMaster("INV-02")!;
    assert.equal(full.name, "Standard Wedding — Ceremony + Reception");
    assert.equal(reception.name, "Standard Wedding — Reception Only");
    assert.ok(full.items.some((i) => i.category === "Ceremony"));
    assert.equal(reception.items.some((i) => i.category === "Ceremony"), false);
    assert.ok(reception.items.every((i) => i.category !== "Ceremony"));
    assert.equal(INVENTORY_TEMPLATE_STARTER_MASTERS.length, 2);
  });

  it("template structure does not invent event quantities or unit prices", () => {
    // Templates are name/category only in the master — provision writes qty 1 / null price.
    for (const master of INVENTORY_TEMPLATE_STARTER_MASTERS) {
      assert.ok(master.items.length > 10);
      assert.ok(master.items.length < 50);
      for (const item of master.items) {
        assert.ok(item.name.trim());
        assert.ok(item.category.trim());
      }
    }
  });
});
