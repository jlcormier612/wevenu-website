import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("Communication Health Inbox navigation", () => {
  it("uses CollectionBackLink labeled Inbox above the page heading", () => {
    const src = readFileSync("app/(app)/messaging/health/page.tsx", "utf8");
    const contracts = readFileSync("app/(app)/library/contracts/page.tsx", "utf8");
    assert.match(
      contracts,
      /CollectionBackLink[\s\S]*href="\/library"[\s\S]*label="Templates"/,
    );
    assert.match(src, /CollectionBackLink[\s\S]*href="\/messaging"[\s\S]*label="Inbox"/);
    const back = src.indexOf("CollectionBackLink");
    const heading = src.indexOf('font-heading text-2xl font-medium text-heading">Communication Health');
    assert.ok(back >= 0, "CollectionBackLink must exist");
    assert.ok(heading > back, "Inbox back link must render above the h1");
    assert.doesNotMatch(src, /Back to Inbox/);
    assert.doesNotMatch(src, /← Back to Inbox/);
    assert.equal((src.match(/label="Inbox"/g) ?? []).length, 1);
  });
});
