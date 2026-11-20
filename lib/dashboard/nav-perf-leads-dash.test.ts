import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const focusIsland = readFileSync(resolve("components/dashboard/dashboard-focus-island.tsx"), "utf8");
const leadsPage = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");

describe("NAV-PERF Leads + Dashboard Focus remediation", () => {
  it("defers Dashboard wave2 Luv observations behind Focus/Coming Up", () => {
    assert.match(service, /export const getDashboardFocusCore = cache/);
    assert.match(focusIsland, /get_dashboard_focus_core/);
    assert.match(focusIsland, /Suspense/);
    assert.match(focusIsland, /DashboardLuvEntryIsland/);
    const coreReturn = service.slice(
      service.indexOf("export const getDashboardFocusCore"),
      service.indexOf("export const getDashboardData"),
    );
    assert.match(coreReturn, /luvObservations: \[\]/);
    assert.match(service, /wave2_parallel_wall/);
  });

  it("Leads page streams chrome and defers spot-pattern + list islands", () => {
    assert.match(leadsPage, /data-testid="leads-streaming-root"/);
    assert.match(leadsPage, /LeadsListIsland/);
    assert.match(leadsPage, /Suspense fallback=\{null\}/);
  });
});
