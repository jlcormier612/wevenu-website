import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FINAL_HELP_ARTICLES } from "@/lib/help-guides/final-articles";

import { STAGE_COPY } from "./stage-copy";
import { LEGACY_SETUP_GUIDE_REDIRECTS, SETUP_HELP_CROSSWALK } from "./help-crosswalk";

const published = new Set(FINAL_HELP_ARTICLES.map((a) => a.slug));

describe("Setup Hub stage copy", () => {
  it("covers every canonical Setup Hub stage", () => {
    assert.deepEqual(Object.keys(STAGE_COPY), [
      "your-venue",
      "calendar-availability",
      "bring-your-business",
      "your-offerings",
      "client-experience",
      "lead-capture",
      "your-team",
      "financials",
    ]);
  });

  it("links Help only to published final articles (never Setup Guides)", () => {
    for (const [stage, copy] of Object.entries(STAGE_COPY)) {
      if (!copy.helpHref) {
        assert.equal(copy.helpTitle, undefined, `${stage}: no helpHref means no helpTitle`);
        continue;
      }
      assert.ok(copy.helpTitle, `${stage} must label its Help link`);
      const slug = copy.helpHref.replace(/^\/help\//, "");
      assert.ok(published.has(slug), `${stage} links to unpublished Help slug: ${slug}`);
      assert.doesNotMatch(slug, /^setup-/);
    }
  });

  it("uses canonical product destinations from the crosswalk", () => {
    assert.equal(STAGE_COPY["calendar-availability"].destinationHref, "/settings/availability");
    assert.equal(STAGE_COPY.financials.destinationHref, "/settings/integrations");
    assert.equal(STAGE_COPY["your-team"].required, false);
    assert.equal(STAGE_COPY.financials.required, false);
  });

  it("describes Bring Your Business as three equal paths", () => {
    const copy = STAGE_COPY["bring-your-business"].whatToDo.toLowerCase();
    assert.match(copy, /import/);
    assert.match(copy, /add|yourself|individual/i);
    assert.match(copy, /skip/);
  });
});

describe("Setup/Help crosswalk", () => {
  it("every Help slug is a published final article", () => {
    for (const row of SETUP_HELP_CROSSWALK) {
      if (row.helpSlug) {
        assert.ok(published.has(row.helpSlug), `crosswalk ${row.stage} → ${row.helpSlug}`);
        assert.equal(row.helpTitle, FINAL_HELP_ARTICLES.find((a) => a.slug === row.helpSlug)?.title);
      }
    }
  });

  it("redirects every legacy Setup Guide slug to a published article", () => {
    for (const [from, to] of Object.entries(LEGACY_SETUP_GUIDE_REDIRECTS)) {
      assert.ok(from.startsWith("setup-") || from === "understanding-your-calendar", from);
      assert.ok(published.has(to), `${from} → ${to} must be published`);
    }
  });
});
