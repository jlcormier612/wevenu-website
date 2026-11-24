import assert from "node:assert/strict";
import { describe, it } from "node:test";

import sitemap from "./sitemap";
import robots from "./robots";

describe("marketing SEO routes", () => {
  it("sitemap lists public marketing pages only", () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    assert.ok(urls.some((u) => u.endsWith("hellotocheers.com") || u.includes("hellotocheers.com/")));
    assert.ok(urls.some((u) => u.endsWith("/pricing")));
    assert.ok(urls.some((u) => u.endsWith("/contact")));
    assert.ok(!urls.some((u) => u.includes("/api/")));
    assert.ok(!urls.some((u) => u.includes("/custom-offer/")));
    assert.ok(!urls.some((u) => u.includes("showroom-preview")));
  });

  it("robots allows public site and points at sitemap", () => {
    const r = robots();
    assert.equal(typeof r.sitemap, "string");
    assert.match(String(r.sitemap), /sitemap\.xml$/);
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.ok(rules);
    const disallow = rules.disallow;
    const list = Array.isArray(disallow) ? disallow : [disallow];
    assert.ok(list.some((d) => String(d).includes("/api/")));
    assert.ok(list.some((d) => String(d).includes("/custom-offer/")));
  });
});
