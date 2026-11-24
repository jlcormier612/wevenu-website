import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  marketingCanonicalPath,
  marketingPageMetadata,
  marketingStructuredDataGraph,
} from "./seo";

describe("marketing SEO helpers", () => {
  it("builds canonical path and page metadata", () => {
    assert.equal(marketingCanonicalPath("/"), "/");
    assert.equal(marketingCanonicalPath("pricing"), "/pricing");
    const meta = marketingPageMetadata({
      title: "Support",
      description: "Get help with Hello to Cheers venue software support.",
      path: "/support",
    });
    assert.equal(meta.title, "Support");
    assert.equal(
      (meta.alternates as { canonical?: string })?.canonical,
      "/support",
    );
    assert.match(String(meta.description), /venue software support/i);
  });

  it("emits Organization and SoftwareApplication without ratings", () => {
    const graph = marketingStructuredDataGraph();
    const raw = JSON.stringify(graph);
    assert.match(raw, /"Organization"/);
    assert.match(raw, /"SoftwareApplication"/);
    assert.ok(!/"AggregateRating"/.test(raw));
    assert.ok(!/"reviewRating"/.test(raw));
    assert.ok(!/"ratingValue"/.test(raw));
  });
});
