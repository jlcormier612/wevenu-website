import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const headerIsland = readFileSync(resolve("components/dashboard/dashboard-header-island.tsx"), "utf8");
const briefing = readFileSync(resolve("lib/luv/briefing-service.ts"), "utf8");
const contractsRepo = readFileSync(resolve("lib/contracts/repository.ts"), "utf8");
const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");

describe("NAV-PERF Wave 2 — dashboard SSR critical path", () => {
  it("exposes a light header data path separate from Focus assembly", () => {
    assert.match(service, /export const getDashboardHeaderData = cache/);
    assert.match(service, /header_parallel_wall/);
    assert.match(headerIsland, /getDashboardHeaderData/);
    assert.doesNotMatch(headerIsland, /getDashboardData\(\)/);
  });

  it("Focus briefing uses lean contracts without content blobs", () => {
    assert.match(contractsRepo, /export async function getContractsForDashboardBriefing/);
    assert.match(contractsRepo, /CONTRACT_WORKSPACE_LIST_SELECT/);
    const leanFn = contractsRepo.slice(
      contractsRepo.indexOf("export async function getContractsForDashboardBriefing"),
      contractsRepo.indexOf("export async function getContractsForClientOrEvent"),
    );
    assert.doesNotMatch(leanFn, /attachSignerSummaries/);
    assert.match(briefing, /leanContracts:\s*true/);
    assert.match(briefing, /getContractsForDashboardBriefing/);
  });

  it("getDashboardFocusCore reuses cached header activation fields (no second activation pass)", () => {
    assert.match(service, /export const getDashboardFocusCore = cache/);
    assert.match(service, /const headerPromise = getDashboardHeaderData\(\)/);
    assert.match(service, /activationScore = header\.activationScore/);
    const wave2 = service.slice(
      service.indexOf('forensicTime("wave2_parallel_wall"'),
      service.indexOf("communicationObservationsRaw.filter"),
    );
    assert.doesNotMatch(wave2, /getActivationScore/);
    assert.doesNotMatch(wave2, /getNextPendingMilestone/);
    assert.doesNotMatch(wave2, /isVenueReadyToInviteCouples/);
  });

  it("Focus island renders from focus core; Luv entry awaits full getDashboardData", () => {
    const focusIsland = readFileSync(resolve("components/dashboard/dashboard-focus-island.tsx"), "utf8");
    assert.match(focusIsland, /getDashboardFocusCore/);
    assert.match(focusIsland, /DashboardLuvEntryIsland/);
    assert.match(focusIsland, /getDashboardData/);
    assert.match(service, /export const getDashboardData = cache/);
    assert.match(service, /getDashboardFocusCore\(\)/);
  });

  it("workspace layout parallelizes enrollment, membership, and staff role after venue", () => {
    assert.match(layout, /Promise\.all\(\[/);
    assert.match(layout, /getActiveVenueMembership\(\)/);
    assert.match(layout, /getCurrentUserRole\(\)/);
    assert.match(layout, /venue_enrollments/);
  });
});
