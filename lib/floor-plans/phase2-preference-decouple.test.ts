/**
 * Floor Plans Phase 2 — preference ≠ working ≠ share ≠ seating.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyPreferenceApprovalCase,
  couplePreferenceStatusCopy,
  nextPreferenceState,
  nextStateAfterCoupleSelect,
  normalizeCouplePreferenceStatus,
  venuePreferenceStatusCopy,
} from "@/lib/floor-plans/preference-lifecycle";
import {
  resolveWorkingTemplateId,
} from "@/lib/floor-plans/ensure-working-layout";

const migration = readFileSync(
  resolve("supabase/migrations/20261424600000_floor_plans_phase2_preference_decouple.sql"),
  "utf8",
);
const ensure = readFileSync(resolve("lib/floor-plans/ensure-working-layout.ts"), "utf8");
const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const selectRoute = readFileSync(resolve("app/api/portal/floor-plan-offers/select/route.ts"), "utf8");
const preferenceService = readFileSync(resolve("lib/floor-plans/preference-service.ts"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/floor-plan-actions.ts"), "utf8");

describe("Phase 2 — select RPC preference only", () => {
  it("migration select sets couple_selected + pending and does not set operational/share/seating", () => {
    assert.match(migration, /create or replace function public\.select_portal_floor_plan_offer/);
    assert.match(migration, /couple_preference_status = 'pending'/);
    assert.match(migration, /couple_selected_floor_plan_id = v_plan_id/);
    assert.doesNotMatch(
      migration.split("create or replace function public.select_portal_floor_plan_offer")[1]!
        .split("create or replace function public.ensure_portal_floor_plan_assignment")[0]!,
      /operational_floor_plan_id\s*=\s*v_plan_id/,
    );
    const selectBody = migration
      .split("create or replace function public.select_portal_floor_plan_offer")[1]!
      .split("create or replace function public.ensure_portal_floor_plan_assignment")[0]!;
    assert.doesNotMatch(selectBody, /shared_with_couple\s*=\s*true/);
    assert.doesNotMatch(selectBody, /client_access\s*=\s*'view'/);
    assert.match(selectRoute, /preference only|Does not change operational/i);
  });

  it("ensure_portal no longer auto-selects sole offer or heals seating", () => {
    const ensureBody = migration
      .split("create or replace function public.ensure_portal_floor_plan_assignment")[1]!
      .split("create or replace function public.get_portal_floor_plans")[0]!;
    assert.doesNotMatch(ensureBody, /select_portal_floor_plan_offer\(/);
    assert.doesNotMatch(ensureBody, /client_access\s*=\s*'view'/);
    assert.match(ensureBody, /sole_offer_shared|sole_offer_awaiting_share|needs_selection|already_selected/);
  });
});

describe("Phase 2 — ensureWorkingLayoutForEvent decoupling", () => {
  it("does not retarget operational from couple_selected", () => {
    assert.doesNotMatch(ensure, /reason:\s*"couple_selected"/);
    assert.doesNotMatch(ensure, /Client confirmed selection always wins/);
    assert.match(ensure, /Preference must never rewrite the working-layout pointer/);
  });

  it("sole offer may seed working+share; multi-offer leaves unset", () => {
    assert.equal(
      resolveWorkingTemplateId({ offeredTemplateIds: ["only"] }),
      "only",
    );
    assert.equal(
      resolveWorkingTemplateId({
        offeredTemplateIds: ["a", "b"],
        preferredTemplateId: "b",
      }),
      null,
    );
    assert.match(ensure, /ambiguous_offers/);
    assert.match(ensure, /shared_with_couple: true/);
    // Share must succeed before the working pointer is written (§9.2).
    const soleSeed = ensure.slice(ensure.indexOf("Sole-offer simple path"));
    assert.match(soleSeed, /shared_with_couple: true[\s\S]+operational_floor_plan_id: floorPlanId/);
    assert.match(soleSeed, /Sole-offer seed could not set layout share/);
    assert.doesNotMatch(ensure, /client_access:\s*"view"/);
    assert.doesNotMatch(ensure, /couple_selected_floor_plan_id:\s*floorPlanId/);
  });

  it("sole offer is not preference approval", () => {
    assert.match(workspace, /offering alone does not approve anything/i);
    assert.match(workspace, /Sharing and seating still wait for you/i);
  });
});

describe("Phase 2 — preference lifecycle pure transitions", () => {
  it("normalize treats legacy pointer without status as pending", () => {
    assert.equal(normalizeCouplePreferenceStatus(null, "plan-1"), "pending");
    assert.equal(normalizeCouplePreferenceStatus(null, null), null);
    assert.equal(normalizeCouplePreferenceStatus("approved", "plan-1"), "approved");
  });

  it("couple select supersedes pending and preserves approved", () => {
    const next = nextStateAfterCoupleSelect({
      newPreferredFloorPlanId: "plan-b",
      coupleSelectedFloorPlanId: "plan-a",
      coupleApprovedFloorPlanId: "plan-approved",
      couplePreferenceStatus: "pending",
    });
    assert.equal(next.coupleSelectedFloorPlanId, "plan-b");
    assert.equal(next.coupleApprovedFloorPlanId, "plan-approved");
    assert.equal(next.couplePreferenceStatus, "pending");
    assert.equal(next.supersededPriorPending, true);
  });

  it("decline and defer preserve approved and operational", () => {
    for (const decision of ["decline", "defer"] as const) {
      const next = nextPreferenceState({
        coupleSelectedFloorPlanId: "pref",
        coupleApprovedFloorPlanId: "approved",
        couplePreferenceStatus: "pending",
        operationalFloorPlanId: "working",
        seatingInUseFloorPlanId: "working",
        decision: { decision },
      });
      assert.equal(next.ok, true);
      if (!next.ok) return;
      assert.equal(next.coupleApprovedFloorPlanId, "approved");
      assert.equal(next.operationalFloorPlanId, "working");
      assert.equal(next.seatingInUseFloorPlanId, "working");
      assert.equal(next.couplePreferenceStatus, decision === "decline" ? "declined" : "deferred");
    }
  });

  it("Case B3 approve switches working/seating-in-use without claiming seat rewrite", () => {
    assert.equal(
      classifyPreferenceApprovalCase({
        currentOperationalId: "old",
        preferredId: "new",
        currentHasSeats: true,
        preferredHasSeats: false,
      }),
      "B",
    );
    const next = nextPreferenceState({
      coupleSelectedFloorPlanId: "new",
      coupleApprovedFloorPlanId: "old-approved",
      couplePreferenceStatus: "pending",
      operationalFloorPlanId: "old",
      seatingInUseFloorPlanId: "old",
      decision: { decision: "approve", case: "B", seatingChoice: "start_on_preferred" },
    });
    assert.equal(next.ok, true);
    if (!next.ok) return;
    assert.equal(next.operationalFloorPlanId, "new");
    assert.equal(next.seatingInUseFloorPlanId, "new");
    assert.equal(next.coupleApprovedFloorPlanId, "new");
    assert.equal(next.couplePreferenceStatus, "approved");
  });

  it("Case C requires explicit seating-in-use and preserves both pointers' meaning", () => {
    assert.equal(
      classifyPreferenceApprovalCase({
        currentOperationalId: "a",
        preferredId: "b",
        currentHasSeats: true,
        preferredHasSeats: true,
      }),
      "C",
    );
    const next = nextPreferenceState({
      coupleSelectedFloorPlanId: "b",
      coupleApprovedFloorPlanId: null,
      couplePreferenceStatus: "pending",
      operationalFloorPlanId: "a",
      seatingInUseFloorPlanId: null,
      decision: { decision: "approve", case: "C", seatingInUseFloorPlanId: "a" },
    });
    assert.equal(next.ok, true);
    if (!next.ok) return;
    assert.equal(next.operationalFloorPlanId, "b");
    assert.equal(next.seatingInUseFloorPlanId, "a");
  });
});

describe("Phase 2 — approval × sharing copy matrix", () => {
  it("approved-but-unshared, shared-but-unapproved, approved-and-shared", () => {
    const approvedUnshared = venuePreferenceStatusCopy({
      status: "approved",
      preferredName: "Reception",
      approvedName: "Reception",
      shared: false,
      isWorking: true,
    });
    assert.match(approvedUnshared.detail, /not shared yet/i);

    const pendingShared = couplePreferenceStatusCopy({
      status: "pending",
      preferredName: "Reception",
      approvedAndShared: false,
    });
    assert.match(pendingShared.detail, /does not mean your venue approved/i);

    const approvedShared = couplePreferenceStatusCopy({
      status: "approved",
      preferredName: "Reception",
      approvedAndShared: true,
    });
    assert.match(approvedShared.headline, /approved/i);
    assert.match(approvedShared.detail, /working layout and shared/i);
  });

  it("does not claim venue will use layout unless approved path copy", () => {
    assert.doesNotMatch(portalSection, /Your venue will use this/);
    assert.match(portalSection, /does not approve the layout or change what the venue/);
    assert.match(portalSection, /floor-plan-preference-pending-banner/);
    assert.match(portalSection, /couplePreferenceStatusCopy|preferenceCopy\.headline/);
    assert.match(
      readFileSync(resolve("lib/floor-plans/preference-lifecycle.ts"), "utf8"),
      /does not mean your venue approved/i,
    );
  });

  it("venue export allowlist includes preference lifecycle fields next to existing pointers", () => {
    assert.match(
      migration,
      /couple_approved_floor_plan_id,couple_preference_status,couple_selected_floor_plan_id/,
    );
    assert.match(migration, /operational_floor_plan_id,seating_in_use_floor_plan_id,setup_time/);
    assert.match(migration, /create or replace function public\.get_venue_export/);
  });
});

describe("Phase 2 — venue UX + authorization surface", () => {
  it("workspace exposes preference review and B1/B3/C actions", () => {
    assert.match(workspace, /floor-plan-preference-review/);
    assert.match(workspace, /Approve preference|Approve and start seating/);
    assert.match(workspace, /floor-plan-decline-preference/);
    assert.match(workspace, /floor-plan-defer-preference/);
    assert.match(workspace, /floor-plan-case-b/);
    assert.match(workspace, /floor-plan-case-c/);
    assert.match(workspace, /floor-plan-seating-in-use/);
    assert.match(workspace, /Cancel/);
    assert.match(workspace, /prior state was not partially rewritten/i);
  });

  it("service never updates guest_seat_assignments on preference decide", () => {
    assert.doesNotMatch(preferenceService, /\.from\(\s*["']guest_seat_assignments["']/);
    assert.doesNotMatch(preferenceService, /\.update\([\s\S]{0,80}guest_seat/);
    assert.match(preferenceService, /Never rewrites guest_seat_assignments/);
    assert.match(actions, /decideCoupleFloorPlanPreferenceAction/);
    assert.match(actions, /setSeatingInUseFloorPlanAction/);
    assert.match(preferenceService, /FLOOR_PLAN_EDIT_DENIED|canEditFloorPlans/);
  });

  it("seat counts authorize via floor_plans then read assignments with admin (staff RLS gap)", () => {
    const repoSrc = readFileSync(
      new URL("./repository.ts", import.meta.url),
      "utf8",
    );
    assert.match(repoSrc, /countGuestSeatAssignmentsForEvent/);
    assert.match(repoSrc, /createAdminClient/);
    assert.match(repoSrc, /staff JWT cannot read guest_seat_assignments/);
    assert.match(preferenceService, /countGuestSeatAssignments\(\s*supabase,\s*operationalId,\s*venueId/);
    assert.match(preferenceService, /countGuestSeatAssignments\(\s*supabase,\s*preferredId,\s*venueId/);
  });

  it("schema adds preference lifecycle + seating-in-use distinct from client_layout_status", () => {
    assert.match(migration, /couple_preference_status/);
    assert.match(migration, /couple_approved_floor_plan_id/);
    assert.match(migration, /seating_in_use_floor_plan_id/);
    assert.match(migration, /Distinct from floor_plans\.client_layout_status/);
  });
});

describe("Phase 2 — Phase 1 independence preserved in copy", () => {
  it("keeps share vs seating and working-layout labels", () => {
    assert.match(workspace, /Share Floor Plan/);
    assert.match(workspace, /Seating open|Seating paused/);
    assert.match(workspace, /Set as working layout/);
    assert.doesNotMatch(workspace, />\s*Operational\s*</);
    assert.match(workspace, /sharing and seating are separate steps/i);
  });
});
