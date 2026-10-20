import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ensurePdfJsDomPolyfills,
  extractPdfText,
  normalizeExtractedPdfText,
} from "@/lib/import/file-parsing";

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

describe("ensurePdfJsDomPolyfills", () => {
  it("defines DOMMatrix when missing so pdf-parse can load in Node", () => {
    const g = globalThis as typeof globalThis & { DOMMatrix?: unknown };
    const prior = g.DOMMatrix;
    try {
      // @ts-expect-error intentional delete for polyfill coverage
      delete g.DOMMatrix;
      ensurePdfJsDomPolyfills();
      assert.equal(typeof g.DOMMatrix, "function");
    } finally {
      if (prior) g.DOMMatrix = prior;
    }
  });
});

describe("extractPdfText", () => {
  it("reads synthetic text PDFs used in final migration cert", async () => {
    const text = await extractPdfText(
      readFileSync("docs/qa/final-migration-cert/fixtures/vendors-pdf.pdf"),
    );
    assert.match(text, /PDF Florist Co/);
    assert.match(text, /pdf\.florist@example\.invalid/);
  });

  it("returns empty for page-marker-only PDFs", async () => {
    const text = await extractPdfText(
      readFileSync("docs/qa/final-migration-cert/fixtures/empty-text.pdf"),
    );
    assert.equal(text, "");
  });
});
