/**
 * Client Planning starter is provisioned as a real library row, like Contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  STANDARD_CLIENT_PLANNING_MILESTONES,
  STANDARD_CLIENT_PLANNING_TASKS,
} from "@/lib/playbooks/constants";
import { visiblePlanningStarterKinds } from "@/lib/playbooks/planning-starter-visibility";
import {
  CLIENT_PLANNING_STARTER_KEY,
  CLIENT_PLANNING_STARTER_NAME,
  shouldSkipClientPlanningStarterProvision,
} from "@/lib/playbooks/provision";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Client Planning starter skip rules", () => {
  it("seeds when the venue has no client template and no master key", () => {
    assert.equal(
      shouldSkipClientPlanningStarterProvision({
        hasPbClient01: false,
        hasActiveClientTemplate: false,
        hasSameName: false,
      }),
      false,
    );
  });

  it("does not duplicate an existing PB-CLIENT-01 row", () => {
    assert.equal(
      shouldSkipClientPlanningStarterProvision({
        hasPbClient01: true,
        hasActiveClientTemplate: true,
        hasSameName: true,
      }),
      true,
    );
  });

  it("does not duplicate an existing active Client Planning template", () => {
    assert.equal(
      shouldSkipClientPlanningStarterProvision({
        hasPbClient01: false,
        hasActiveClientTemplate: true,
        hasSameName: false,
      }),
      true,
    );
  });

  it("does not overwrite a same-named customized template", () => {
    assert.equal(
      shouldSkipClientPlanningStarterProvision({
        hasPbClient01: false,
        hasActiveClientTemplate: false,
        hasSameName: true,
      }),
      true,
    );
  });
});

describe("workspace seed includes Client Planning", () => {
  it("seedWorkspaceStarters runs playbooks via seedPlaybookStarters", () => {
    const starters = read("lib/provisioning/starters.ts");
    assert.match(starters, /key: "playbooks"/);
    assert.match(starters, /seedPlaybookStarters/);
  });

  it("provision creates PB-CLIENT-01 client wedding starter", () => {
    const src = read("lib/playbooks/provision.ts");
    assert.match(src, /"client"/);
    assert.match(src, /"wedding"/);
    assert.match(src, /STANDARD_CLIENT_PLANNING_MILESTONES/);
    assert.match(src, /STANDARD_CLIENT_PLANNING_TASKS/);
    assert.match(src, /CLIENT_PLANNING_STARTER_KEY/);
    assert.doesNotMatch(src, /event_tasks/);
    assert.doesNotMatch(src, /event_vendor/);
    assert.doesNotMatch(src, /ready_to_invite_couples/);
  });
});

describe("Setup Profile still uses active client library rows", () => {
  it("does not special-case starter examples in the planning dropdown", () => {
    const page = read("app/(app)/settings/leads/setup-profiles/page.tsx");
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(page, /template\.kind === "client" && !template\.isArchived/);
    assert.match(section, /Starting client planning checklist/);
    assert.match(section, /Options come from active Client Planning templates in your library/);
    assert.doesNotMatch(section, /Use this starter/);
    assert.doesNotMatch(section, /STANDARD_CLIENT_PLANNING/);
    assert.doesNotMatch(page, /PlanningStarterExamples/);
  });
});

describe("starter example card hides once the real row exists", () => {
  it("PB-CLIENT-01 hides the Client starter card; Venue card stays until PB-VENUE-01", () => {
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: CLIENT_PLANNING_STARTER_KEY },
    ]);
    assert.equal(showClient, false);
    assert.equal(showVenue, true);
    assert.equal(CLIENT_PLANNING_STARTER_NAME, "Standard Wedding — Client Planning");
  });
});

describe("SQL backfill matches the Client Planning constants", () => {
  it("inserts only for venues with no active client template / master / same name", () => {
    const sql = read("supabase/migrations/20261413600000_seed_client_planning_starter.sql");
    assert.match(sql, /source_master_key = 'PB-CLIENT-01'/);
    assert.match(sql, /kind = 'client'/);
    assert.match(sql, /is_archived = false/);
    assert.match(sql, /Standard Wedding — Client Planning/);
    assert.doesNotMatch(sql, /insert into public\.event_tasks/i);
    assert.doesNotMatch(sql, /update public\.event_tasks/i);
    assert.doesNotMatch(sql, /venue_vendor_relationships/);
    for (const m of STANDARD_CLIENT_PLANNING_MILESTONES) {
      assert.match(sql, new RegExp(m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const t of STANDARD_CLIENT_PLANNING_TASKS) {
      assert.match(sql, new RegExp(t.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.equal(STANDARD_CLIENT_PLANNING_TASKS.length, 8);
  });
});

describe("Vendor and Setup Hub remain untouched", () => {
  it("does not change required-vendor booking SQL or Setup Hub copy", () => {
    const vendorSql = read(
      "supabase/migrations/20261413500000_book_relationship_assign_required_vendors.sql",
    );
    assert.match(vendorSql, /is_required = true/);
    const readiness = read("components/setup-hub/setup-readiness.tsx");
    assert.match(readiness, /We&apos;re ready to start working with couples/);
  });
});
