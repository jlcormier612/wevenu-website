import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Documents tab is a document-management surface — not a second Activity
 * dashboard and not a duplicate Recent list.
 */
describe("Documents workspace surface structure", () => {
  const src = readFileSync("components/document-workspace/document-workspace.tsx", "utf8");

  it("keeps a single All Documents list with category/search/sort controls", () => {
    assert.match(src, /All Documents/);
    assert.match(src, /Categories/);
    assert.match(src, /Search documents/);
    assert.match(src, /Most Recent/);
    assert.match(src, /WorkspaceUploadButton/);
  });

  it("does not render a separate Recent documents section", () => {
    assert.doesNotMatch(src, />\s*Recent\s*</);
    assert.doesNotMatch(src, /initialRecentEntries/);
    assert.doesNotMatch(src, /recentMap/);
  });

  it("does not render a Documents-tab Activity section", () => {
    // Preview panel may still mention Activity; the list surface must not.
    const activitySection = src.includes("Document Activity") || /uppercase[^>]*>\s*Activity\s*</.test(src);
    assert.equal(activitySection, false);
  });

  it("pages no longer fetch recent interaction maps solely for Documents UI", () => {
    for (const path of [
      "app/(app)/documents/page.tsx",
      "app/(app)/leads/[id]/page.tsx",
      "app/(app)/clients/[id]/page.tsx",
      "app/(app)/vendors/[id]/page.tsx",
    ]) {
      const page = readFileSync(path, "utf8");
      assert.doesNotMatch(page, /getRecentInteractionMap/);
      assert.doesNotMatch(page, /initialRecentEntries/);
      assert.doesNotMatch(page, /recentDocumentEntries/);
    }
  });
});
