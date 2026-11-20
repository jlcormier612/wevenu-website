import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("NAV-PERF Wave 1 — Leads sales workflow", () => {
  it("disables detail prefetch only on Leads list row links", () => {
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const detailHrefs = list.match(/href=\{`\/leads\/\$\{lead\.id\}`\}[\s\S]{0,120}/g) ?? [];
    assert.ok(detailHrefs.length >= 2, "name + View links must both target lead detail");
    for (const chunk of detailHrefs) {
      assert.match(chunk, /prefetch=\{false\}/);
    }
    assert.match(list, /View →/);
    assert.doesNotMatch(list, /prefetch=\{true\}/);
  });

  it("schedules pipeline ensure after response; Board still blocks on ensure", () => {
    const leads = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    const board = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    const starters = readFileSync(resolve("lib/provisioning/starters.ts"), "utf8");
    assert.match(leads, /from "next\/server"/);
    assert.match(leads, /after\(/);
    assert.match(leads, /ensureStandardSalesPipelineForCurrentVenue/);
    assert.doesNotMatch(leads, /await ensureStandardSalesPipelineForCurrentVenue/);
    assert.match(board, /await ensureStandardSalesPipelineForCurrentVenue/);
    assert.match(starters, /ensure_standard_sales_pipeline/);
  });

  it("parallelizes booked membership with lean index on the common path", () => {
    const island = readFileSync(resolve("components/leads/leads-list-island.tsx"), "utf8");
    assert.match(island, /Promise\.all\(/);
    assert.match(island, /loadBookedMembershipSets/);
    assert.match(island, /getLeadsListPage/);
    assert.match(island, /booked: bookedMembership\.currentClientIds\.size/);
  });

  it("preserves Leads working context via session + shell return href", () => {
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    const session = readFileSync(resolve("lib/leads/list-session.ts"), "utf8");
    assert.match(list, /shouldRestoreProgressiveSession/);
    assert.match(list, /saveLeadsListWorkingContext|persistWorkingContext/);
    assert.match(list, /clearLeadsListSession/);
    assert.match(sidebar, /leadsShellHrefFromSession/);
    assert.match(sidebar, /readLeadsListSession/);
    assert.match(session, /shouldRestoreProgressiveSession/);
    assert.match(session, /leadsShellHrefFromSession/);
  });

  it("keeps Booked chip as Clients link and progressive Show more action", () => {
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(list, /href="\/clients\?filter=all"/);
    assert.match(list, /loadMoreLeadsAction/);
    assert.match(list, /Show 20 more/);
  });
});
