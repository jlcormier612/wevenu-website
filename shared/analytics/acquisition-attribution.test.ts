import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeAcquisitionPayload,
  normalizeAcquisitionTouch,
} from "./acquisition-attribution";

describe("acquisition attribution normalize", () => {
  it("keeps UTMs and drops empty/unknown keys", () => {
    const touch = normalizeAcquisitionTouch({
      utm_source: " google ",
      utm_medium: "cpc",
      utm_campaign: "spring",
      email: "nope@example.com",
      captured_at: "2026-01-01T00:00:00.000Z",
    });
    assert.ok(touch);
    assert.equal(touch!.utm_source, "google");
    assert.equal(touch!.utm_medium, "cpc");
    assert.equal((touch as { email?: string }).email, undefined);
  });

  it("builds first/latest payload", () => {
    const payload = normalizeAcquisitionPayload({
      first_touch: {
        utm_source: "newsletter",
        landing_page: "/",
        captured_at: "2026-01-01T00:00:00.000Z",
      },
      latest_touch: {
        utm_campaign: "retarget",
        landing_page: "/pricing",
        captured_at: "2026-02-01T00:00:00.000Z",
      },
    });
    assert.equal(payload?.first_touch?.utm_source, "newsletter");
    assert.equal(payload?.latest_touch?.utm_campaign, "retarget");
  });
});
