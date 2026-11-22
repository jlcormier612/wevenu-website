import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCalendlySchedulingUrl,
  resolveCalendlyEmbedUrl,
} from "@/lib/marketing/calendly-url";
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

describe("buildCalendlySchedulingUrl", () => {
  it("prefills name/email/venue(a1) and attaches opaque handoff as utm_content", () => {
    const url = buildCalendlySchedulingUrl(
      "https://calendly.com/jennifer-hellotocheers/new-meeting",
      {
        name: "Ada Venue",
        email: "ada@example.com",
        venueName: "Ada Garden Hall",
        handoffToken: "htc_aaaaaaaaaaaaaaaaaaaaaaaa",
      },
    );
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("name"), "Ada Venue");
    assert.equal(parsed.searchParams.get("email"), "ada@example.com");
    assert.equal(parsed.searchParams.get("a1"), "Ada Garden Hall");
    assert.equal(parsed.searchParams.get("utm_source"), "htc_website");
    assert.equal(parsed.searchParams.get("utm_medium"), "walkthrough_intake");
    assert.equal(
      parsed.searchParams.get("utm_content"),
      "htc_aaaaaaaaaaaaaaaaaaaaaaaa",
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
