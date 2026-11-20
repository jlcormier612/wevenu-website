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

  it("schedules pipeline ensure after response with observable failure logging", () => {
    const leads = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    const board = readFileSync(resolve("app/(app)/leads/pipeline/page.tsx"), "utf8");
    const starters = readFileSync(resolve("lib/provisioning/starters.ts"), "utf8");
    assert.match(leads, /from "next\/server"/);
    assert.match(leads, /after\(/);
    assert.match(leads, /ensureStandardSalesPipelineForCurrentVenue/);
    assert.doesNotMatch(leads, /await ensureStandardSalesPipelineForCurrentVenue/);
    assert.match(leads, /leads_pipeline_ensure_failed/);
    assert.match(leads, /\.catch\(/);
    assert.match(board, /await ensureStandardSalesPipelineForCurrentVenue/);
    assert.match(starters, /ensure_standard_sales_pipeline/);
  });

  it("defers booked chip count off the list critical path", () => {
    const island = readFileSync(resolve("components/leads/leads-list-island.tsx"), "utf8");
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const actions = readFileSync(resolve("app/(app)/leads/actions.ts"), "utf8");
    assert.match(island, /getLeadsListPage/);
    assert.match(island, /LeadsBookedChipCount/);
    assert.match(island, /bookedCountSlot/);
    assert.match(island, /Suspense/);
    assert.doesNotMatch(island, /loadBookedMembershipSets/);
    assert.match(list, /bookedCountSlot/);
    assert.doesNotMatch(actions, /loadBookedMembershipSets/);
  });

  it("gates session persist until restore settles; cancel leaves session", () => {
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    const sidebar = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    const session = readFileSync(resolve("lib/leads/list-session.ts"), "utf8");
    const actions = readFileSync(resolve("app/(app)/leads/actions.ts"), "utf8");
    assert.match(list, /planLeadsListRestore/);
    assert.match(list, /shouldPersistLeadsListSession/);
    assert.match(list, /restorePhaseRef/);
    assert.match(list, /restoreSettled/);
    assert.match(list, /if \(!restoreSettled\) return/);
    assert.match(list, /restorePhaseRef\.current === "pending"/);
    assert.match(list, /restoredFingerprintRef\.current = null/);
    assert.match(session, /shouldPersistLeadsListSession/);
    assert.match(session, /LEADS_LIST_RESTORE_MAX_ROWS/);
    assert.match(session, /clampLeadsRestoreCount/);
    assert.match(actions, /clampLeadsRestoreCount/);
    assert.match(sidebar, /leadsShellHrefFromSession/);
    assert.match(sidebar, /readLeadsListSession/);
  });

  it("keeps Booked chip as Clients link and progressive Show more action", () => {
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(list, /href="\/clients\?filter=all"/);
    assert.match(list, /loadMoreLeadsAction/);
    assert.match(list, /Show 20 more/);
  });
});
