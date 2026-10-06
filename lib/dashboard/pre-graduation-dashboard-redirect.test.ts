import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isPreGraduationAllowedPath } from "@/lib/setup-hub/pre-graduation-paths";

const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");
const hub = readFileSync(resolve("app/(app)/setup-hub/page.tsx"), "utf8");
const dashboardService = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const repository = readFileSync(resolve("lib/setup-hub/repository.ts"), "utf8");
const setupPage = readFileSync(resolve("app/setup/page.tsx"), "utf8");

describe("ready_to_invite_couples is not a workspace access wall", () => {
  it("does not redirect Dashboard when the venue has not declared readiness", () => {
    assert.doesNotMatch(page, /isVenueReadyToInviteCouples/);
    assert.doesNotMatch(page, /import \{ redirect \} from "next\/navigation"/);
    assert.doesNotMatch(page, /redirect\("\/setup-hub"\)/);
    assert.match(page, /getDashboardData\(\)/);
    assert.match(page, /title="Today's Focus"/);
  });

  it("does not withhold Dashboard data because the flag is false", () => {
    assert.doesNotMatch(dashboardService, /isVenueReadyToInviteCouples/);
    assert.doesNotMatch(dashboardService, /if \(!readyToInviteCouples\) return null/);
    assert.match(repository, /return data\?\.ready_to_invite_couples === true/);
    assert.match(repository, /This flag does not gate the workspace/);
  });

  it("does not redirect operational routes from the workspace layout for readiness", () => {
    assert.doesNotMatch(layout, /isVenueReadyToInviteCouples/);
    assert.doesNotMatch(layout, /isPreGraduationAllowedPath/);
    assert.doesNotMatch(layout, /redirect\("\/setup-hub"\)/);
  });

  it("legacy /setup always continues to Setup Hub after auth, not Dashboard", () => {
    assert.doesNotMatch(setupPage, /isVenueReadyToInviteCouples/);
    assert.match(setupPage, /redirect\("\/setup-hub"\)/);
    assert.doesNotMatch(setupPage, /redirect\("\/dashboard"\)/);
  });

  it("does not bounce Setup Hub back to Dashboard or switch the active venue", () => {
    assert.doesNotMatch(hub, /redirect\("\/dashboard"\)/);
    assert.doesNotMatch(page, /setActiveVenue|set_active_venue/);
    assert.equal(isPreGraduationAllowedPath("/setup-hub"), true);
  });
});
