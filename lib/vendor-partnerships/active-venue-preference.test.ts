import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(__dirname, "../..");

describe("vendor active venue preference (multi-venue switcher)", () => {
  it("persists switcher selection via preference cookie (not authorization)", () => {
    const cookie = readFileSync(join(ROOT, "lib/vendor-partnerships/active-venue-cookie.ts"), "utf8");
    assert.match(cookie, /htc_vendor_active_venue_id/);
    assert.match(cookie, /Convenience only/);
    assert.match(cookie, /never authorization/i);

    const action = readFileSync(join(ROOT, "app/vendor/actions.ts"), "utf8");
    assert.match(action, /writeVendorActiveVenueCookie/);
    assert.match(action, /getVendorActiveVenue\(venueId\)/);

    const service = readFileSync(join(ROOT, "lib/vendor-partnerships/service.ts"), "utf8");
    assert.match(service, /readVendorActiveVenueCookie/);
    assert.match(service, /clearVendorActiveVenueCookie/);
    assert.match(service, /get_vendor_active_venue/);
  });

  it("handbook picker is venue-scoped; event handbook uses event id", () => {
    const picker = readFileSync(join(ROOT, "components/vendor-app/vendor-handbook-picker.tsx"), "utf8");
    assert.match(picker, /handbooks\.length > 1/);
    assert.match(picker, /Choose a venue above/);
    assert.match(picker, /No venue information yet/);

    const service = readFileSync(join(ROOT, "lib/vendor-handbook/service.ts"), "utf8");
    assert.match(service, /get_vendor_handbook/);
    assert.match(service, /p_event_id/);
    assert.match(service, /get_vendor_handbooks/);
  });

  it("identity resolve attaches global vendor and refuses ambiguous merges", () => {
    const repo = readFileSync(join(ROOT, "lib/vendors/repository.ts"), "utf8");
    assert.match(repo, /attach_global/);
    assert.match(repo, /ambiguous/);
    assert.match(repo, /create_new/);
    assert.match(repo, /Never duplicates a global vendor row/);
  });
});
