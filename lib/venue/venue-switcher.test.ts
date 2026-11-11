import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { offersPersistentVenueSwitch } from "@/lib/venue/venue-switcher";

describe("persistent venue switch", () => {
  it("stays closed for zero or one membership", () => {
    assert.equal(offersPersistentVenueSwitch([]), false);
    assert.equal(offersPersistentVenueSwitch([{ venueId: "a" }]), false);
    assert.equal(
      offersPersistentVenueSwitch([{ venueId: "a" }, { venueId: "a" }]),
      false,
    );
  });

  it("opens when two distinct memberships exist", () => {
    assert.equal(
      offersPersistentVenueSwitch([{ venueId: "cedar" }, { venueId: "maple" }]),
      true,
    );
  });

  it("shell switcher uses the existing select action and not a second auth key", () => {
    const src = readFileSync(
      join(process.cwd(), "components/shell/venue-switcher.tsx"),
      "utf8",
    );
    assert.match(src, /selectActiveVenueAction/);
    assert.match(src, /offersPersistentVenueSwitch/);
    assert.doesNotMatch(src, /owner_user_id/);
    assert.doesNotMatch(src, /stripe/i);
    assert.doesNotMatch(src, /from\("venues"\)/);
  });

  it("shell switcher uses full-document navigation after a successful select", () => {
    const src = readFileSync(
      join(process.cwd(), "components/shell/venue-switcher.tsx"),
      "utf8",
    );
    assert.match(src, /window\.location\.assign\("\/dashboard"\)/);
    assert.doesNotMatch(src, /useRouter/);
    assert.doesNotMatch(src, /\brouter\.(replace|refresh)\b/);
  });

  it("select-venue form uses the same full-document navigation after select", () => {
    const src = readFileSync(
      join(process.cwd(), "components/venue/venue-select-form.tsx"),
      "utf8",
    );
    assert.match(src, /selectActiveVenueAction/);
    assert.match(src, /window\.location\.assign\("\/dashboard"\)/);
    assert.doesNotMatch(src, /\brouter\.(replace|refresh)\b/);
  });
});
