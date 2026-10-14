import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { HTC_EMAIL_CTA_BACKGROUND, htcEmailCtaAnchorHtml } from "@/lib/email/htc-cta";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/venue/constants";

describe("HTC email CTA styling", () => {
  it("uses Heritage Sage, not solid black", () => {
    assert.equal(HTC_EMAIL_CTA_BACKGROUND, DEFAULT_PRIMARY_COLOR);
    assert.equal(HTC_EMAIL_CTA_BACKGROUND, "#5D6F5D");
    const html = htcEmailCtaAnchorHtml("https://example.test/x", "View this lead");
    assert.match(html, /background:#5D6F5D/);
    assert.doesNotMatch(html, /#1a1a1a/);
    assert.match(html, /View this lead/);
  });

  it("HTC-owned notification and invite templates use the shared CTA helper", () => {
    for (const rel of [
      "lib/notifications/venue-notification-email.ts",
      "lib/email/team-invite.ts",
      "lib/email/vendor-invite.ts",
      "lib/email/vendor-assignment.ts",
    ]) {
      const src = readFileSync(resolve(rel), "utf8");
      assert.match(src, /htcEmailCtaAnchorHtml/, rel);
      assert.doesNotMatch(src, /background:#1a1a1a/, rel);
    }
  });

  it("tour booked coordinator side-effect sends branded HTML", () => {
    const src = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    assert.match(src, /buildVenueNotificationEmail/);
    assert.match(src, /html:\s*email\.html/);
    assert.match(src, /New tour booked/);
  });

  it("tour protection alert uses the shared CTA helper for both destinations", () => {
    const src = readFileSync(resolve("lib/tours/booked-side-effects.ts"), "utf8");
    assert.match(src, /buildTourProtectionAlertEmail/);
    assert.match(src, /htcEmailCtaAnchorHtml/);
    assert.match(src, /View this lead/);
  });
});
