import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { INTEGRATION_SETUP_ARTICLES } from "@/lib/help-guides/integration-setup-articles";
import {
  isPrimaryGuideTocHeading,
  splitGuideTocHeadings,
} from "@/lib/help-guides/guide-toc";

function headingsFromBody(body: string): { id: string; text: string }[] {
  return [...body.matchAll(/^###\s+(.+)$/gm)].map((m) => ({
    id: m[1]
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80),
    text: m[1],
  }));
}

describe("guide TOC compact navigation", () => {
  it("treats Steps, Before you begin, FAQ, and Additional resources as primary", () => {
    assert.equal(isPrimaryGuideTocHeading("Before you begin"), true);
    assert.equal(isPrimaryGuideTocHeading("Step 1 — Connect Stripe"), true);
    assert.equal(isPrimaryGuideTocHeading("Frequently asked questions"), true);
    assert.equal(isPrimaryGuideTocHeading("Additional Stripe resources"), true);
    assert.equal(isPrimaryGuideTocHeading("What happens next?"), true);
  });

  it("treats detailed subsections as secondary", () => {
    assert.equal(isPrimaryGuideTocHeading("Already have a Stripe account?"), false);
    assert.equal(isPrimaryGuideTocHeading("Choosing your industry"), false);
    assert.equal(isPrimaryGuideTocHeading("Connected, setup incomplete"), false);
    assert.equal(isPrimaryGuideTocHeading("Credit/Debit Card"), false);
    assert.equal(isPrimaryGuideTocHeading("Squarespace"), false);
    assert.equal(isPrimaryGuideTocHeading("Example messaging purpose"), false);
    assert.equal(isPrimaryGuideTocHeading("Under review"), false);
  });

  it("keeps every integration guide's collapsed TOC shorter than the full heading list", () => {
    for (const article of INTEGRATION_SETUP_ARTICLES) {
      const headings = headingsFromBody(article.body);
      if (headings.length < 4) continue;
      const { primary, secondary } = splitGuideTocHeadings(headings);
      assert.ok(primary.length >= 3, `${article.slug} should keep several primary sections`);
      assert.ok(
        secondary.length > 0 || headings.length <= 10,
        `${article.slug}: expected secondary headings for long guides`,
      );
      if (secondary.length > 0) {
        assert.ok(
          primary.length < headings.length,
          `${article.slug}: collapsed TOC must be shorter than full TOC`,
        );
      }
      // All headings remain reachable when expanded
      assert.equal(primary.length + secondary.length, headings.length);
    }
  });

  it("ArticleContents uses Show all / Show fewer and keeps In this guide heading", () => {
    const src = readFileSync(resolve("components/help/integration-setup-help-prose.tsx"), "utf8");
    assert.match(src, /In this guide/);
    assert.match(src, /Show all sections/);
    assert.match(src, /Show fewer sections/);
    assert.match(src, /splitGuideTocHeadings/);
    assert.match(src, /data-testid="guide-toc"/);
    assert.match(src, /aria-expanded=\{showAll\}/);
    // Must not reopen the old always-expanded mobile chevron-only pattern as the sole control
    assert.doesNotMatch(src, /sm:cursor-default[\s\S]*sm:hidden/);
  });
});
