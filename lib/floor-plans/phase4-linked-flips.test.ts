/**
 * Floor Plans Phase 4 — linked before/after flips (F7 / Journey 15).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  COUPLE_FORBIDDEN_FLIP_KEYS,
  sanitizeTransitionNotes,
  spaceIdsMismatch,
} from "@/lib/floor-plans/flips";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261425100000_floor_plans_phase4_linked_flips.sql"),
  "utf8",
);
const flipService = readFileSync(join(root, "lib/floor-plans/flip-service.ts"), "utf8");
const repository = readFileSync(join(root, "lib/floor-plans/repository.ts"), "utf8");
const panel = readFileSync(join(root, "components/events/floor-plan-flip-panel.tsx"), "utf8");
const workspace = readFileSync(join(root, "components/events/floor-plan-workspace.tsx"), "utf8");
const portalSection = readFileSync(join(root, "components/portal/floor-plan-section.tsx"), "utf8");
const portalPlansRoute = readFileSync(join(root, "app/api/portal/floor-plans/route.ts"), "utf8");
const portalSetupsRoute = readFileSync(
  join(root, "app/api/portal/floor-plan-setups/route.ts"),
  "utf8",
);
const starters = readFileSync(join(root, "lib/floor-plan-templates/starters.ts"), "utf8");
const phase1 = readFileSync(join(root, "lib/floor-plans/phase1-contract-invariants.test.ts"), "utf8");

describe("Phase 4 helpers", () => {
  it("space mismatch is advisory only when both space ids are present and differ", () => {
    assert.equal(spaceIdsMismatch("a", "b"), true);
    assert.equal(spaceIdsMismatch("a", "a"), false);
    assert.equal(spaceIdsMismatch(null, "b"), false);
    assert.equal(spaceIdsMismatch("a", null), false);
  });

  it("sanitizes transition notes without inventing schedule fields", () => {
    assert.equal(sanitizeTransitionNotes("  turn chairs  "), "turn chairs");
    assert.equal(sanitizeTransitionNotes("   "), null);
    assert.equal(sanitizeTransitionNotes(null), null);
    assert.ok((sanitizeTransitionNotes("x".repeat(5000)) ?? "").length <= 2000);
  });
});

describe("Phase 4 migration — real link table, not FP-SR", () => {
  it("creates event_floor_plan_flips with distinct layouts and one pair per event", () => {
    assert.match(migration, /create table if not exists public\.event_floor_plan_flips/);
    assert.match(migration, /before_floor_plan_id/);
    assert.match(migration, /after_floor_plan_id/);
    assert.match(migration, /transition_notes/);
    assert.match(migration, /event_floor_plan_flips_distinct_layouts/);
    assert.match(migration, /event_floor_plan_flips_one_per_event unique \(event_id\)/);
    assert.match(migration, /venue-only/i);
    assert.match(migration, /Not a timed\/staffed auto-transition/);
  });

  it("validates both layouts belong to the same event/venue", () => {
    assert.match(migration, /before layout must belong to the same event and venue/);
    assert.match(migration, /after layout must belong to the same event and venue/);
  });

  it("does not treat setup membership as the link persistence model", () => {
    assert.doesNotMatch(migration, /event_floor_plan_setup_members/);
    assert.match(migration, /FP-SR \/ dual-zone starters \/ catalog metadata are never a link/);
  });
});

describe("Phase 4 service — link/unlink preserve layouts", () => {
  it("unlink deletes only the relationship row", () => {
    assert.match(flipService, /deleteEventFloorPlanFlip/);
    assert.match(flipService, /Layouts, objects, seating/);
    assert.match(repository, /Deletes only the flip relationship row/);
    assert.match(repository, /Never deletes/);
    assert.match(repository, /rewrites either floor_plan/);
  });

  it("rejects identical layout ids in the service", () => {
    assert.match(flipService, /Before and after must be two different layouts/);
    assert.match(flipService, /beforeFloorPlanId === afterFloorPlanId/);
  });

  it("link path does not rewrite preference, seating, share, or setup membership", () => {
    assert.doesNotMatch(flipService, /couple_selected|shared_with_couple|guest_seat|setup_members/);
    assert.match(flipService, /upsertEventFloorPlanFlip/);
  });
});

describe("Phase 4 venue UI — progressive, honest copy", () => {
  it("is opt-in and mounted from the workspace", () => {
    assert.match(workspace, /FloorPlanFlipPanel/);
    assert.match(panel, /floor-plan-flip-toggle/);
    assert.match(panel, /Set up flip link/);
    assert.match(panel, /optional/i);
  });

  it("states link is for staff planning, not automatic turnover", () => {
    assert.match(panel, /does not switch rooms automatically/i);
    assert.match(panel, /not an automatic room switch/i);
    assert.match(panel, /Unlink \(keep both layouts\)/);
    assert.match(panel, /venue only/i);
  });

  it("FP-SR remains a static illustration in starters", () => {
    assert.match(starters, /static reference only \(not a timed flip\)/);
    assert.match(starters, /does not switch layouts by event phase/i);
  });
});

describe("Phase 4 couple privacy", () => {
  it("portal floor-plan surfaces do not reference transition notes keys", () => {
    for (const key of COUPLE_FORBIDDEN_FLIP_KEYS) {
      assert.doesNotMatch(portalSection, new RegExp(key));
      assert.doesNotMatch(portalPlansRoute, new RegExp(key));
      assert.doesNotMatch(portalSetupsRoute, new RegExp(key));
    }
  });

  it("portal routes do not read event_floor_plan_flips", () => {
    assert.doesNotMatch(portalPlansRoute, /event_floor_plan_flips/);
    assert.doesNotMatch(portalSetupsRoute, /event_floor_plan_flips/);
    assert.doesNotMatch(portalSection, /transitionNotes|transition_notes/);
  });
});

describe("Phase 4 coexists with Phase 5 review flags", () => {
  it("phase1 still requires flip panel; Phase 5 review panel is separately authorized", () => {
    assert.match(phase1, /FloorPlanFlipPanel|floor-plan-flip-panel/);
    assert.match(phase1, /FloorPlanReviewFlagsPanel|Phase 5/);
  });
});
