/**
 * Regression: users with no venue memberships must not 307-loop on intake.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const layoutSrc = readFileSync(
  resolve("app/(app)/layout.tsx"),
  "utf8",
);

describe("workspace layout no_memberships routing", () => {
  it("redirects no_memberships to intake only when not already there", () => {
    assert.match(layoutSrc, /boot\.status === "no_memberships"/);
    assert.match(
      layoutSrc,
      /!pathname\.startsWith\("\/onboarding\/intake"\)/,
    );
    assert.match(layoutSrc, /redirect\("\/onboarding\/intake"\)/);
    // Early return prevents re-entering venue gates that re-trigger the redirect.
    const idx = layoutSrc.indexOf('boot.status === "no_memberships"');
    const slice = layoutSrc.slice(idx, idx + 450);
    assert.match(slice, /return <>\{children\}<\/>/);
  });

  it("does not introduce an owner-role or onboarding bypass", () => {
    assert.doesNotMatch(layoutSrc, /is_owner\s*===\s*true.*bypass/i);
    assert.doesNotMatch(layoutSrc, /skipOnboarding/i);
  });

  it("does not wall activated self-setup venues behind incomplete intake", () => {
    // Four-chapter Setup Hub is the first-time experience; incomplete
    // venue_onboarding_intake must not redirect the whole workspace away.
    assert.doesNotMatch(layoutSrc, /!intake\?\.submittedAt/);
    assert.doesNotMatch(
      layoutSrc,
      /getIntakeForVenue[\s\S]*redirect\("\/onboarding\/intake"\)/,
    );
  });
});
