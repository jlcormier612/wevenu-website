/**
 * Planning Templates hub count = active Client + Venue library rows.
 * Setup Profile stays client-only (asserted separately).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { countActivePlanningLibraryTemplates } from "@/lib/playbooks/library-count";
import { visiblePlanningStarterKinds } from "@/lib/playbooks/planning-starter-visibility";
import {
  shouldSkipClientPlanningStarterProvision,
  shouldSkipVenuePlanningStarterProvision,
  VENUE_PLANNING_STARTER_KEY,
  CLIENT_PLANNING_STARTER_KEY,
} from "@/lib/playbooks/provision";
import {
  STANDARD_VENUE_WORKFLOW_MILESTONES,
  STANDARD_VENUE_WORKFLOW_TASKS,
} from "@/lib/playbooks/constants";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Planning Templates library count", () => {
  it("fresh venue with Client + Venue = count 2", () => {
    assert.equal(
      countActivePlanningLibraryTemplates([
        { kind: "client", isArchived: false },
        { kind: "venue", isArchived: false },
      ]),
      2,
    );
  });

  it("existing venues with only one active Planning template show count 1", () => {
    assert.equal(
      countActivePlanningLibraryTemplates([{ kind: "client", isArchived: false }]),
      1,
    );
  });

  it("archived Planning templates do not count", () => {
    assert.equal(
      countActivePlanningLibraryTemplates([
        { kind: "client", isArchived: false },
        { kind: "venue", isArchived: true },
      ]),
      1,
    );
  });

  it("starter/example cards that are not library rows do not count", () => {
    // Count function only sees real template rows — empty library stays 0.
    assert.equal(countActivePlanningLibraryTemplates([]), 0);
    const { showClient, showVenue } = visiblePlanningStarterKinds([]);
    assert.equal(showClient, true);
    assert.equal(showVenue, true);
  });

  it("Templates hub uses countActivePlanningLibraryTemplates", () => {
    const page = read("app/(app)/library/page.tsx");
    assert.match(page, /countActivePlanningLibraryTemplates/);
    assert.match(page, /count=\{playbookTemplatesCount\}/);
  });
});

describe("Setup Profile remains client-only", () => {
  it("Client Planning selectable; Venue Planning excluded from dropdown source", () => {
    const page = read("app/(app)/settings/leads/setup-profiles/page.tsx");
    assert.match(page, /template\.kind === "client" && !template\.isArchived/);
    assert.doesNotMatch(page, /kind === "venue"/);
  });
});

describe("Venue Planning starter provisioning", () => {
  it("seeds PB-VENUE-01 when venue has no active venue template", () => {
    assert.equal(
      shouldSkipVenuePlanningStarterProvision({
        hasPbVenue01: false,
        hasActiveVenueTemplate: false,
        hasSameName: false,
      }),
      false,
    );
  });

  it("does not duplicate existing Venue Planning / master / same name", () => {
    assert.equal(
      shouldSkipVenuePlanningStarterProvision({
        hasPbVenue01: true,
        hasActiveVenueTemplate: false,
        hasSameName: false,
      }),
      true,
    );
    assert.equal(
      shouldSkipVenuePlanningStarterProvision({
        hasPbVenue01: false,
        hasActiveVenueTemplate: true,
        hasSameName: false,
      }),
      true,
    );
  });

  it("seedPlaybookStarters provisions both Client and Venue", () => {
    const src = read("lib/playbooks/provision.ts");
    assert.match(src, /provisionClientPlanningStarter/);
    assert.match(src, /provisionVenuePlanningStarter/);
    assert.match(src, /PB-VENUE-01/);
    assert.match(src, /STANDARD_VENUE_WORKFLOW/);
  });

  it("SQL backfill matches Venue Planning constants", () => {
    const sql = read("supabase/migrations/20261413700000_seed_venue_planning_starter.sql");
    assert.match(sql, /source_master_key = 'PB-VENUE-01'/);
    assert.match(sql, /kind = 'venue'/);
    assert.match(sql, /Standard Wedding — Venue Planning/);
    assert.doesNotMatch(sql, /insert into public\.event_tasks/i);
    for (const m of STANDARD_VENUE_WORKFLOW_MILESTONES) {
      assert.match(sql, new RegExp(m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const t of STANDARD_VENUE_WORKFLOW_TASKS) {
      assert.match(sql, new RegExp(t.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.equal(STANDARD_VENUE_WORKFLOW_TASKS.length, 7);
  });

  it("Client skip rules remain; masters hide both starter cards when present", () => {
    assert.equal(
      shouldSkipClientPlanningStarterProvision({
        hasPbClient01: true,
        hasActiveClientTemplate: false,
        hasSameName: false,
      }),
      true,
    );
    const { showClient, showVenue } = visiblePlanningStarterKinds([
      { sourceMasterKey: CLIENT_PLANNING_STARTER_KEY },
      { sourceMasterKey: VENUE_PLANNING_STARTER_KEY },
    ]);
    assert.equal(showClient, false);
    assert.equal(showVenue, false);
  });
});

describe("regression boundaries", () => {
  it("does not alter Vendor booking or Setup Hub readiness copy", () => {
    const vendorSql = read(
      "supabase/migrations/20261413500000_book_relationship_assign_required_vendors.sql",
    );
    assert.match(vendorSql, /is_required = true/);
    const readiness = read("components/setup-hub/setup-readiness.tsx");
    assert.match(readiness, /We&apos;re ready to start working with couples/);
  });
});
