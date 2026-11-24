import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { acquisitionAttributionFromCalendlyTracking } from "./acquisition-from-tracking";

describe("Calendly acquisition attribution", () => {
  it("ignores handoff UTMs (identity only)", () => {
    const payload = acquisitionAttributionFromCalendlyTracking({
      utm_source: "htc_website",
      utm_medium: "walkthrough_intake",
      utm_content: "htc_aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    assert.equal(payload, null);
  });

  it("stamps calendly/embed for direct bookings without campaign UTMs", () => {
    const payload = acquisitionAttributionFromCalendlyTracking({});
    assert.equal(payload?.first_touch?.utm_source, "calendly");
    assert.equal(payload?.first_touch?.utm_medium, "embed");
    assert.equal(payload?.first_touch?.landing_page, "/walkthrough");
  });

  it("keeps real campaign UTMs on direct bookings", () => {
    const payload = acquisitionAttributionFromCalendlyTracking({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
    });
    assert.equal(payload?.first_touch?.utm_source, "google");
    assert.equal(payload?.first_touch?.utm_campaign, "spring");
  });
});
