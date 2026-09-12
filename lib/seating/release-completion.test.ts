import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canEditSeatingWhenDelegated,
  canRevokeSeatingDelegation,
  canViewSeating,
} from "@/lib/seating/authorize";
import {
  classifyVenueSeatingSituation,
  venueSeatingSituationCopy,
} from "@/lib/seating/situation";
import { seatingRpcHttpResult } from "@/lib/seating/http-result";
import { buildVenueSeatingFloorPlanSummaries } from "@/lib/seating/summaries";

const migration = readFileSync(
  resolve("supabase/migrations/20261367000000_seating_release_completion.sql"),
  "utf8",
);

describe("seating venue role permissions", () => {
  it("allows all staff roles to view", () => {
    assert.equal(canViewSeating("owner"), true);
    assert.equal(canViewSeating("manager"), true);
    assert.equal(canViewSeating("coordinator"), true);
    assert.equal(canViewSeating("staff"), true);
    assert.equal(canViewSeating(null), false);
  });

  it("restricts edit/submit to owner/manager/coordinator", () => {
    assert.equal(canEditSeatingWhenDelegated("owner"), true);
    assert.equal(canEditSeatingWhenDelegated("manager"), true);
    assert.equal(canEditSeatingWhenDelegated("coordinator"), true);
    assert.equal(canEditSeatingWhenDelegated("staff"), false);
  });

  it("restricts venue revoke to owner/manager", () => {
    assert.equal(canRevokeSeatingDelegation("owner"), true);
    assert.equal(canRevokeSeatingDelegation("manager"), true);
    assert.equal(canRevokeSeatingDelegation("coordinator"), false);
    assert.equal(canRevokeSeatingDelegation("staff"), false);
  });

  it("enforces role helpers inside venue write RPCs", () => {
    assert.match(migration, /seating_role_can_edit\(\)/);
    assert.match(migration, /assign_guest_to_table_as_venue[\s\S]*seating_role_can_edit/);
    assert.match(migration, /submit_seating_plan_as_venue[\s\S]*seating_role_can_edit/);
    assert.match(migration, /revoke_seating_delegation_as_venue[\s\S]*seating_role_can_revoke/);
    assert.match(migration, /get_operational_seating_plan[\s\S]*seating_role_can_view/);
  });
});

describe("explicit floor plan selection", () => {
  it("rejects null floor_plan_id on couple seating reads and writes", () => {
    assert.match(migration, /if p_floor_plan_id is null then[\s\S]*floor_plan_required/);
    assert.match(migration, /assign_guest_to_table[\s\S]*if p_floor_plan_id is null then return false/);
    assert.match(migration, /remove_guest_assignment[\s\S]*if p_floor_plan_id is null then return false/);
    assert.doesNotMatch(migration, /order by fp\.updated_at desc limit 1/);
  });

  it("provides venue-authenticated plan discovery without portal token", () => {
    assert.match(migration, /list_venue_seating_floor_plans/);
    assert.match(migration, /current_user_venue_id\(\)/);
    const service = readFileSync(resolve("lib/seating/service.ts"), "utf8");
    assert.match(service, /list_venue_seating_floor_plans/);
    assert.doesNotMatch(service, /get_seating_floor_plans/);
  });

  it("blocks whole-floor-plan delete when seating history exists", () => {
    assert.match(migration, /prevent_floor_plan_delete_with_seating/);
    assert.match(migration, /seating_data_exists/);
    const repo = readFileSync(resolve("lib/floor-plans/repository.ts"), "utf8");
    assert.match(repo, /guest_seat_assignments/);
    assert.match(repo, /Resolve seating before deleting/);
  });
});

describe("venue seating empty-state classification", () => {
  it("distinguishes no plans, not shared, choose plan, private, submitted, delegated", () => {
    assert.equal(classifyVenueSeatingSituation({ planCount: 0, sharedPlanCount: 0, selectedPlanId: null }), "no_floor_plans");
    assert.equal(classifyVenueSeatingSituation({ planCount: 2, sharedPlanCount: 0, selectedPlanId: null }), "no_shared_for_seating");
    assert.equal(classifyVenueSeatingSituation({ planCount: 2, sharedPlanCount: 2, selectedPlanId: null }), "choose_plan");
    assert.equal(classifyVenueSeatingSituation({
      planCount: 1, sharedPlanCount: 1, selectedPlanId: "a", hasAssignments: false, notYetSubmitted: true,
    }), "not_started");
    assert.equal(classifyVenueSeatingSituation({
      planCount: 1, sharedPlanCount: 1, selectedPlanId: "a", hasAssignments: true, notYetSubmitted: true,
    }), "private_in_progress");
    assert.equal(classifyVenueSeatingSituation({
      planCount: 1, sharedPlanCount: 1, selectedPlanId: "a", hasSubmission: true, notYetSubmitted: false,
    }), "submitted");
    assert.equal(classifyVenueSeatingSituation({
      planCount: 1, sharedPlanCount: 1, selectedPlanId: "a", isDelegated: true,
    }), "delegated_assistance");
  });

  it("never uses contradictory Client Workspace copy for empty seating", () => {
    for (const situation of [
      "no_floor_plans", "no_shared_for_seating", "choose_plan", "not_started", "private_in_progress",
    ] as const) {
      const copy = venueSeatingSituationCopy(situation, "Alex & Jordan");
      assert.doesNotMatch(copy.title + copy.body, /Client Workspace link/);
      assert.doesNotMatch(copy.title + copy.body, /No floor plan is currently shared/);
    }
  });

  it("assistance copy does not imply venue ownership", () => {
    const copy = venueSeatingSituationCopy("delegated_assistance", "Alex & Jordan");
    assert.match(copy.title + copy.body, /assist/i);
    assert.doesNotMatch(copy.title + copy.body, /owns the seating/i);
  });
});

describe("assistance terminology in UI", () => {
  it("uses Assist with Seating rather than Manage Seating", () => {
    const day = readFileSync(resolve("components/events/wedding-day-seating.tsx"), "utf8");
    const editor = readFileSync(resolve("components/events/venue-seating-editor.tsx"), "utf8");
    const portal = readFileSync(resolve("components/portal/seating-section.tsx"), "utf8");
    assert.match(day, /Assist with Seating/);
    assert.doesNotMatch(day, /Manage Seating/);
    assert.match(editor, /Assisting with seating/);
    assert.match(portal, /Ask Venue to Assist/);
    assert.match(portal, /End Venue Assistance/);
    assert.match(portal, /Resubmit Seating/);
  });

  it("mobile seating offers non-drag confirm flow", () => {
    const portal = readFileSync(resolve("components/portal/seating-section.tsx"), "utf8");
    assert.match(portal, /Confirm seat/);
    assert.match(portal, /no drag required/i);
    assert.match(portal, /max-width: 767px/);
  });
});

describe("seating HTTP + summary contracts", () => {
  it("maps floor_plan_required to 400", () => {
    assert.equal(seatingRpcHttpResult({ error: "floor_plan_required" }).status, 400);
  });

  it("keeps multi-plan summaries independent", () => {
    const result = buildVenueSeatingFloorPlanSummaries(
      [{ id: "ceremony", name: "Ceremony" }, { id: "reception", name: "Reception" }],
      [{ floor_plan_id: "ceremony", revoked_at: null }],
      [
        { floor_plan_id: "reception", guest_count: 80, submitted_by: "couple", created_at: "2026-08-13T12:00:00Z" },
        { floor_plan_id: "ceremony", guest_count: 40, submitted_by: "couple", created_at: "2026-08-14T12:00:00Z" },
      ],
    );
    assert.equal(result[0]?.isDelegated, true);
    assert.equal(result[1]?.isDelegated, false);
    assert.equal(result[0]?.lastSubmission?.count, 40);
    assert.equal(result[1]?.lastSubmission?.count, 80);
  });

  it("portal seating routes require floorPlanId", () => {
    const route = readFileSync(resolve("app/api/portal/seating/route.ts"), "utf8");
    const assign = readFileSync(resolve("app/api/portal/seating/assign/route.ts"), "utf8");
    assert.match(route, /floor_plan_required/);
    assert.match(assign, /!floorPlanId/);
    assert.match(assign, /seatingRpcHttpResult/);
  });

  it("print and venue seating pages require explicit plan selection", () => {
    const seatingPage = readFileSync(resolve("app/(app)/events/[id]/seating/page.tsx"), "utf8");
    const printPage = readFileSync(resolve("app/(app)/events/[id]/seating-print/page.tsx"), "utf8");
    assert.match(seatingPage, /selectable\.length === 1/);
    assert.match(printPage, /selectable\.length === 1/);
    assert.doesNotMatch(seatingPage, /floorPlans\[0\]\?\.id \?\? null/);
    assert.doesNotMatch(printPage, /floorPlans\[0\]/);
  });
});
