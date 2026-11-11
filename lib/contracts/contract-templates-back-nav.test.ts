/**
 * Contract Templates back hierarchy:
 * Edit/New → Contract Templates (/library/contracts) → Templates (/library).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Contract Templates back navigation", () => {
  it("list under Templates hub links back to Templates", () => {
    const list = read("app/(app)/library/contracts/page.tsx");
    assert.match(list, /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/);
  });

  it("edit and new go back to Contract Templates library list — not /contracts", () => {
    const edit = read("app/(app)/contracts/templates/[id]/edit/page.tsx");
    const neu = read("app/(app)/contracts/templates/new/page.tsx");
    const form = read("components/contracts/template-form.tsx");
    for (const src of [edit, neu]) {
      assert.match(src, /CollectionBackLink[\s\S]*href="\/library\/contracts"[\s\S]*label="Contract Templates"/);
      assert.doesNotMatch(src, /href="\/contracts\/templates"/);
      assert.doesNotMatch(src, /href="\/contracts"/);
    }
    assert.match(form, /router\.push\("\/library\/contracts"\)/);
    assert.doesNotMatch(form, /router\.push\("\/contracts\/templates"\)/);
  });

  it("legacy /contracts/templates list redirects to /library/contracts", () => {
    const legacy = read("app/(app)/contracts/templates/page.tsx");
    assert.match(legacy, /redirect\("\/library\/contracts"\)/);
  });

  it("Contracts workflow Templates button opens the library collection", () => {
    const contracts = read("app/(app)/contracts/page.tsx");
    assert.match(contracts, /href="\/library\/contracts"/);
    assert.doesNotMatch(contracts, /href="\/contracts\/templates"/);
  });
});
