import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Automations edit page back navigation", () => {
  it("uses CollectionBackLink labeled Automations above the page header", () => {
    const src = readFileSync("app/(app)/communication/series/[id]/edit/page.tsx", "utf8");
    const contracts = readFileSync("app/(app)/library/contracts/page.tsx", "utf8");
    assert.match(
      contracts,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );
    assert.match(
      src,
      /CollectionBackLink[\s\S]*href="\/communication\/series"[\s\S]*label="Automations"/,
    );
    const back = src.indexOf("CollectionBackLink");
    const header = src.indexOf("<PageHeader");
    assert.ok(back >= 0, "CollectionBackLink must exist");
    assert.ok(header > back, "Automations back link must render above PageHeader");
    assert.doesNotMatch(src, /Back to Automations/);
    assert.doesNotMatch(src, /← Back to Automations/);
    assert.equal((src.match(/label="Automations"/g) ?? []).length, 1);
  });
});
