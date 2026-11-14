/**
 * Commercial Library IA — three heroes; Offerings + starting lists secondary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");

describe("Commercial Library information architecture", () => {
  it("titles the page Library with sell/stock/deliver framing", () => {
    assert.match(page, /title="Library"/);
    assert.match(page, /What you sell, what you have, and what you deliver/);
    assert.match(page, /data-testid="library-commercial-ia"/);
  });

  it("presents commercial heroes including equal Delivery destinations", () => {
    assert.match(page, /Packages & Pricing/);
    assert.match(page, /Available Inventory/);
    assert.match(page, /title="Event Order Templates"/);
    assert.match(page, /title="Offerings Catalog"/);
  });

  it("keeps starting lists secondary under Stock and does not merge Offerings with Inventory", () => {
    assert.match(page, /Saved starting lists/);
    assert.match(page, /Group title="Stock"/);
    assert.match(page, /title="Available Inventory"/);
    assert.doesNotMatch(page, /title="Inventory Templates"/);
    assert.doesNotMatch(page, /Choices catalog/);
  });
});
