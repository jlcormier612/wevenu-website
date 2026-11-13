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

  it("presents three primary commercial heroes", () => {
    assert.match(page, /Packages & Pricing/);
    assert.match(page, /Available Inventory/);
    assert.match(page, /Event Order plans/);
  });

  it("keeps Offerings and starting lists as secondary links", () => {
    assert.match(page, /Saved starting lists/);
    assert.match(page, /Choices catalog/);
    assert.doesNotMatch(page, /title="Offerings"/);
    assert.doesNotMatch(page, /title="Inventory Templates"/);
    assert.doesNotMatch(page, /title="Event Order Templates"/);
  });
});
