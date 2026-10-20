import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeExtractedPdfText } from "@/lib/import/file-parsing";

describe("normalizeExtractedPdfText", () => {
  it("treats page-marker-only PDF text as empty (scanned / unreadable)", () => {
    assert.equal(normalizeExtractedPdfText("\n\n-- 1 of 1 --\n\n"), "");
    assert.equal(normalizeExtractedPdfText("-- 2 of 5 --"), "");
  });

  it("preserves real vendor/client content while stripping footers", () => {
    const raw = "Business: PDF Florist Co\n-- 1 of 1 --\n";
    assert.equal(normalizeExtractedPdfText(raw), "Business: PDF Florist Co");
  });
});
