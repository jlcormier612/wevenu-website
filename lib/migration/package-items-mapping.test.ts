import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Migration Center package mapping exposes includedItems", () => {
  it("FIELD_KEYS_BY_ENTITY.package includes includedItems for CSV mapping", () => {
    const ui = readFileSync("components/settings/migration-center.tsx", "utf8");
    const pkgBlock = ui.match(/package:\s*\[[\s\S]*?\],\s*event:/)?.[0] ?? "";
    assert.match(pkgBlock, /key:\s*"includedItems"/);
    assert.match(pkgBlock, /Included Items \(desc\|qty\|unit/);
  });

  it("generic CSV normalizer reads includedItems", () => {
    const src = readFileSync("lib/migration/sources/generic-csv.ts", "utf8");
    assert.match(src, /parsePackageIncludedItems/);
    assert.match(src, /includedItems/);
  });
});
