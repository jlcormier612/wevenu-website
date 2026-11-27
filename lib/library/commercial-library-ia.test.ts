/**
 * Commercial Library IA — three heroes; Offerings + starting lists secondary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve("app/(app)/library/page.tsx"), "utf8");

describe("Commercial Library information architecture", () => {
  it("titles the page Templates with sell/stock/deliver framing", () => {
    assert.match(page, /title="Templates"/);
    assert.match(page, /What you sell, what you have, and what you deliver/);
    assert.match(page, /data-testid="library-commercial-ia"/);
  });

  it("presents commercial heroes including equal Delivery destinations", () => {
    assert.match(page, /Packages & Pricing/);
    assert.match(page, /Available Inventory/);
    assert.match(page, /title="Event Order Templates"/);
    assert.match(page, /title="Offerings Catalog"/);
  });

  it("uses Template and Catalog labels matching Other templates & assets treatments", () => {
    const salesIdx = page.indexOf('title="Packages & Pricing"');
    const stockIdx = page.indexOf('title="Available Inventory"');
    const eotIdx = page.indexOf('title="Event Order Templates"');
    const offIdx = page.indexOf('title="Offerings Catalog"');
    assert.ok(salesIdx > 0 && stockIdx > salesIdx && eotIdx > stockIdx && offIdx > eotIdx);
    const salesBlock = page.slice(salesIdx - 80, salesIdx + 40);
    const stockBlock = page.slice(stockIdx - 80, stockIdx + 40);
    const eotBlock = page.slice(eotIdx - 80, eotIdx + 40);
    const offBlock = page.slice(offIdx - 80, offIdx + 40);
    assert.match(salesBlock, /kind="template"/);
    assert.match(stockBlock, /kind="catalog"/);
    assert.match(eotBlock, /kind="template"/);
    assert.match(offBlock, /kind="catalog"/);
    assert.doesNotMatch(salesBlock, /kind="primary"/);
    assert.doesNotMatch(stockBlock, /kind="primary"/);
    // Same Badge treatments used for Other templates & assets.
    assert.match(page, /kind === "template" && <Badge variant="accent"/);
    assert.match(page, /kind === "catalog" && <Badge variant="outline"/);
  });

  it("awaits ensure before counting and does not fire-and-forget overview starters", () => {
    assert.match(page, /await ensureVenueStarters\(venue\.id\)/);
    assert.match(page, /await ensureOfferingStartersForCurrentVenue\(\)/);
    assert.doesNotMatch(page, /\bafter\s*\(/);
  });

  it("keeps starting lists secondary under Stock and does not merge Offerings with Inventory", () => {
    assert.match(page, /Saved starting lists/);
    assert.match(page, /Group title="Stock"/);
    assert.match(page, /title="Available Inventory"/);
    assert.doesNotMatch(page, /title="Inventory Templates"/);
    assert.doesNotMatch(page, /Choices catalog/);
  });
});
