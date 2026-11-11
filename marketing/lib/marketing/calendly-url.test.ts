import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCalendlyEmbedUrl } from "@/lib/marketing/calendly-url";
import { MORE_INFO_CTA, PRIMARY_CTA } from "@/lib/marketing/nav";

describe("resolveCalendlyEmbedUrl", () => {
  it("returns null when unset or placeholder", () => {
    assert.equal(resolveCalendlyEmbedUrl(undefined), null);
    assert.equal(resolveCalendlyEmbedUrl(""), null);
    assert.equal(
      resolveCalendlyEmbedUrl("https://calendly.com/YOUR-LINK/walkthrough"),
      null,
    );
  });

  it("accepts https calendly.com event URLs", () => {
    const url = "https://calendly.com/hello-to-cheers/venue-walkthrough";
    assert.equal(resolveCalendlyEmbedUrl(url), url);
  });

  it("rejects non-Calendly hosts", () => {
    assert.equal(
      resolveCalendlyEmbedUrl("https://example.com/schedule"),
      null,
    );
  });
});

describe("Walkthrough CTA routing", () => {
  it("keeps Schedule and Request more information as distinct destinations", () => {
    assert.equal(PRIMARY_CTA.href, "/walkthrough");
    assert.equal(PRIMARY_CTA.label, "Schedule a Walkthrough");
    assert.equal(MORE_INFO_CTA.href, "/contact");
    assert.equal(MORE_INFO_CTA.label, "Request more information");
  });
});
