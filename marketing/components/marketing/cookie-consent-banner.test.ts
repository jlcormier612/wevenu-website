import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("CookieConsentBanner", () => {
  it("offers accept and essential-only paths without loading GA before choice", () => {
    const src = readFileSync(
      resolve(__dirname, "cookie-consent-banner.tsx"),
      "utf8",
    );
    assert.match(src, /Accept analytics/);
    assert.match(src, /Essential only/);
    assert.match(src, /writeMarketingAnalyticsConsent\(analytics\)/);
    assert.match(src, /hasMarketingCookieChoice/);
    assert.doesNotMatch(src, /ensureGa4|gtag|G-/);
  });
});

describe("footer Cookie Preferences link", () => {
  it("exposes persistent /cookies destination in FOOTER_LEGAL", () => {
    const src = readFileSync(
      resolve(__dirname, "../../lib/marketing/nav.ts"),
      "utf8",
    );
    assert.match(src, /href: "\/cookies", label: "Cookie Preferences"/);
    assert.match(src, /href: "\/cookie-policy", label: "Cookie Policy"/);
  });
});
