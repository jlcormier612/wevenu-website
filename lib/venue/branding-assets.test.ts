import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLiveVenueBrandingUrls,
  versionedVenueAssetUrl,
} from "@/lib/venue/branding-assets";

describe("versionedVenueAssetUrl", () => {
  it("returns null for empty urls", () => {
    assert.equal(versionedVenueAssetUrl(null, "2026-01-01"), null);
    assert.equal(versionedVenueAssetUrl("  ", "2026-01-01"), null);
  });

  it("leaves url unchanged when version is missing", () => {
    assert.equal(
      versionedVenueAssetUrl("https://example.com/logo.png", null),
      "https://example.com/logo.png",
    );
  });

  it("appends v= from updated_at and replaces prior t=/v=", () => {
    const iso = "2026-08-20T21:00:17.102Z";
    const ms = Date.parse(iso);
    const out = versionedVenueAssetUrl(
      "https://example.com/uploads/x/logo.png?t=111&other=1",
      iso,
    );
    assert.ok(out?.includes(`v=${ms}`));
    assert.ok(out?.includes("other=1"));
    assert.ok(!out?.includes("t=111"));
  });
});

describe("applyLiveVenueBrandingUrls", () => {
  it("versions logo and hero together", () => {
    const iso = "2026-08-20T21:00:17.102Z";
    const ms = Date.parse(iso);
    const next = applyLiveVenueBrandingUrls(
      {
        logoUrl: "https://example.com/logo.png",
        heroImageUrl: "https://example.com/hero.png",
        name: "Venue",
      },
      iso,
    );
    assert.equal(next.name, "Venue");
    assert.ok(next.logoUrl?.endsWith(`v=${ms}`) || next.logoUrl?.includes(`v=${ms}`));
    assert.ok(next.heroImageUrl?.includes(`v=${ms}`));
  });
});
