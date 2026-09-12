/**
 * White Glove pre-login routes must be public; broader /onboarding must not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicPath } from "./proxy.ts";

describe("White Glove public token paths", () => {
  it("allows token intake page and API without session", () => {
    assert.equal(isPublicPath("/onboarding/white-glove/intake_abc"), true);
    assert.equal(isPublicPath("/onboarding/white-glove/intake_abc/waiting"), true);
    assert.equal(isPublicPath("/api/onboarding/white-glove/intake"), true);
    assert.equal(isPublicPath("/api/onboarding/white-glove/materials"), true);
  });

  it("does not make the rest of onboarding public", () => {
    assert.equal(isPublicPath("/onboarding/intake"), false);
    assert.equal(isPublicPath("/onboarding"), false);
    assert.equal(isPublicPath("/api/onboarding/other"), false);
    assert.equal(isPublicPath("/admin/onboarding/venue-1"), false);
  });
});
