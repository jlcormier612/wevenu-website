import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isPreGraduationAllowedPath } from "@/lib/setup-hub/pre-graduation-paths";

const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const hub = readFileSync(resolve("app/(app)/setup-hub/page.tsx"), "utf8");
const dashboardService = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const repository = readFileSync(resolve("lib/setup-hub/repository.ts"), "utf8");
const paths = readFileSync(resolve("lib/setup-hub/pre-graduation-paths.ts"), "utf8");

describe("pre-graduation dashboard redirect", () => {
  it("sends a venue that is not ready to invite couples to Setup Hub", () => {
    assert.match(page, /import \{ redirect \} from "next\/navigation"/);
    assert.match(page, /isVenueReadyToInviteCouples/);
    const gate = page.indexOf("isVenueReadyToInviteCouples(venue.id)");
    const redirectAt = page.indexOf('redirect("/setup-hub")');
    const loadAt = page.indexOf("getDashboardData()");
    const deadEnd = page.indexOf("Dashboard unavailable.");
    assert.ok(gate > 0 && redirectAt > gate && loadAt > redirectAt && deadEnd > loadAt);
    assert.match(page, /title="Today's Focus"/);
  });

  it("keeps the readiness gate that withholds dashboard data", () => {
    assert.match(dashboardService, /if \(!readyToInviteCouples\) return null/);
    assert.match(repository, /return data\?\.ready_to_invite_couples === true/);
    assert.match(repository, /No row yet means the venue has never declared readiness/);
    assert.doesNotMatch(paths, /"\/dashboard"/);
    assert.equal(isPreGraduationAllowedPath("/dashboard"), false);
    assert.equal(isPreGraduationAllowedPath("/setup-hub"), true);
  });

  it("does not bounce Setup Hub back to Dashboard or switch the active venue", () => {
    assert.doesNotMatch(hub, /redirect\("\/dashboard"\)/);
    assert.doesNotMatch(page, /setActiveVenue|set_active_venue/);
    assert.equal(isPreGraduationAllowedPath("/setup-hub"), true);
  });
});
