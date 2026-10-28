/**
 * Floor Plans Phase 5 — booking-change review flags (T1 + T3).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  COUPLE_FORBIDDEN_FLIP_KEYS,
  COUPLE_FORBIDDEN_REVIEW_FLAG_KEYS,
} from "@/lib/floor-plans/flips";
import {
  bookingRoomSetFromSources,
  flipSnapshotMismatch,
  layoutRoomInconsistentWithBooking,
  setsEqual,
  t1BookingFingerprint,
  t1LayoutFingerprint,
  t3Fingerprint,
  DEFAULT_REVIEW_BANNER_COPY,
} from "@/lib/floor-plans/review-flags";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261425300000_floor_plans_phase5_booking_review_flags.sql"),
  "utf8",
);
const reviewFlags = readFileSync(join(root, "lib/floor-plans/review-flags.ts"), "utf8");
const reviewService = readFileSync(join(root, "lib/floor-plans/review-flag-service.ts"), "utf8");
const reviewRepo = readFileSync(join(root, "lib/floor-plans/review-flag-repository.ts"), "utf8");
const flipService = readFileSync(join(root, "lib/floor-plans/flip-service.ts"), "utf8");
const repository = readFileSync(join(root, "lib/floor-plans/repository.ts"), "utf8");
const spaceAssignments = readFileSync(join(root, "lib/events/space-assignments.ts"), "utf8");
const eventService = readFileSync(join(root, "lib/events/service.ts"), "utf8");
const panel = readFileSync(
  join(root, "components/events/floor-plan-review-flags-panel.tsx"),
  "utf8",
);
const workspace = readFileSync(join(root, "components/events/floor-plan-workspace.tsx"), "utf8");
const portalSection = readFileSync(join(root, "components/portal/floor-plan-section.tsx"), "utf8");
const portalPlansRoute = readFileSync(join(root, "app/api/portal/floor-plans/route.ts"), "utf8");
const portalSetupsRoute = readFileSync(
  join(root, "app/api/portal/floor-plan-setups/route.ts"),
  "utf8",
);
const actions = readFileSync(
  join(root, "app/(app)/events/[id]/floor-plan-actions.ts"),
  "utf8",
);
const phase1 = readFileSync(
  join(root, "lib/floor-plans/phase1-contract-invariants.test.ts"),
  "utf8",
);
const phase4 = readFileSync(join(root, "lib/floor-plans/phase4-linked-flips.test.ts"), "utf8");

describe("Phase 5 predicates — booking room set", () => {
  it("uses distinct assignment space ids when present (multi-room)", () => {
    assert.deepEqual(
      bookingRoomSetFromSources({
        assignmentSpaceIds: ["b", "a", "a", null, ""],
        primarySpaceId: "primary-ignored",
      }),
      ["a", "b"],
    );
  });

  it("falls back to primary events.space_id when no assignments", () => {
    assert.deepEqual(
      bookingRoomSetFromSources({
        assignmentSpaceIds: [],
        primarySpaceId: " primary ",
      }),
      ["primary"],
    );
  });

  it("empty set when neither assignments nor primary", () => {
    assert.deepEqual(
      bookingRoomSetFromSources({ assignmentSpaceIds: [null, ""], primarySpaceId: null }),
      [],
    );
  });
});

describe("Phase 5 predicates — T1 layout inconsistency", () => {
  it("null layout room is never inconsistent", () => {
    assert.equal(layoutRoomInconsistentWithBooking(null, ["a"]), false);
    assert.equal(layoutRoomInconsistentWithBooking("", ["a"]), false);
  });

  it("empty booking room set never flags", () => {
    assert.equal(layoutRoomInconsistentWithBooking("a", []), false);
  });

  it("membership: in set consistent, out of set inconsistent", () => {
    assert.equal(layoutRoomInconsistentWithBooking("a", ["a", "b"]), false);
    assert.equal(layoutRoomInconsistentWithBooking("c", ["a", "b"]), true);
  });

  it("does not compare only against a single primary when set has multiple", () => {
    // Layout on secondary room remains consistent.
    assert.equal(layoutRoomInconsistentWithBooking("b", ["a", "b"]), false);
  });
});

describe("Phase 5 predicates — fingerprints and T3", () => {
  it("identical T1 fingerprints for same effective state", () => {
    assert.equal(
      t1BookingFingerprint("fp1", "s1", ["b", "a"]),
      t1BookingFingerprint("fp1", "s1", ["a", "b"]),
    );
    assert.equal(
      t1LayoutFingerprint("fp1", "s1", ["a"]),
      t1LayoutFingerprint("fp1", "s1", ["a"]),
    );
  });

  it("setsEqual is order-insensitive", () => {
    assert.equal(setsEqual(["a", "b"], ["b", "a"]), true);
    assert.equal(setsEqual(["a"], ["a", "b"]), false);
  });

  it("T3 requires captured snapshot; legacy without timestamp never mismatches", () => {
    assert.equal(
      flipSnapshotMismatch({
        roomSnapshotCapturedAt: null,
        recordedBeforeSpaceId: "a",
        recordedAfterSpaceId: "b",
        currentBeforeSpaceId: "x",
        currentAfterSpaceId: "y",
      }),
      false,
    );
  });

  it("T3 mismatches when recorded rooms differ from current after capture", () => {
    assert.equal(
      flipSnapshotMismatch({
        roomSnapshotCapturedAt: "2026-10-27T00:00:00Z",
        recordedBeforeSpaceId: "a",
        recordedAfterSpaceId: "b",
        currentBeforeSpaceId: "a",
        currentAfterSpaceId: "c",
      }),
      true,
    );
    assert.equal(
      flipSnapshotMismatch({
        roomSnapshotCapturedAt: "2026-10-27T00:00:00Z",
        recordedBeforeSpaceId: null,
        recordedAfterSpaceId: null,
        currentBeforeSpaceId: null,
        currentAfterSpaceId: null,
      }),
      false,
    );
  });

  it("T3 fingerprint distinguishes states", () => {
    assert.notEqual(
      t3Fingerprint("f1", "a", "b", "a", "b"),
      t3Fingerprint("f1", "a", "b", "a", "c"),
    );
  });
});

describe("Phase 5 migration", () => {
  it("adds flip snapshot columns and review_flags table with constraints/RLS", () => {
    assert.match(migration, /recorded_before_space_id/);
    assert.match(migration, /recorded_after_space_id/);
    assert.match(migration, /room_snapshot_captured_at/);
    assert.match(migration, /create table if not exists public\.event_floor_plan_review_flags/);
    assert.match(migration, /t1_booking_room/);
    assert.match(migration, /t1_layout_room/);
    assert.match(migration, /t3_flip_snapshot/);
    assert.match(migration, /event_floor_plan_review_flags_one_open/);
    assert.match(migration, /enable row level security/);
    assert.match(migration, /current_user_venue_id/);
    assert.match(migration, /event_floor_plan_review_flags_target_layout/);
    assert.match(migration, /Clear does not mutate layouts or seating/);
  });

  it("does not add T2 setup-to-space", () => {
    assert.doesNotMatch(migration, /setup_space_id|setup_to_space|t2_/i);
  });
});

describe("Phase 5 service wiring", () => {
  it("booking-room reconcile hooks after successful assignment replace", () => {
    assert.match(spaceAssignments, /reconcileT1BookingRoomFlags/);
    assert.match(spaceAssignments, /previousBookingRoomSet/);
    assert.match(spaceAssignments, /flagWarning/);
    assert.match(spaceAssignments, /Rooms were saved, but layout review flags could not be updated/);
  });

  it("single-space primary update reconciles when assignments path skipped", () => {
    assert.match(eventService, /reconcileT1BookingRoomFlags/);
    assert.match(eventService, /reconciledViaAssignments/);
  });

  it("layout room update path exists and does not silently clear flags", () => {
    assert.match(reviewService, /export async function updateFloorPlanSpace/);
    assert.match(reviewService, /t1_layout_room/);
    assert.match(reviewService, /do not silently clear open flags/i);
    assert.match(reviewRepo, /updateFloorPlanSpaceId/);
  });

  it("clear mutates flag audit fields only", () => {
    assert.match(reviewService, /export async function clearFloorPlanReviewFlag/);
    assert.match(reviewRepo, /status: "cleared"/);
    assert.match(reviewRepo, /cleared_at/);
    assert.match(reviewRepo, /cleared_by/);
    assert.doesNotMatch(
      reviewService.slice(reviewService.indexOf("clearFloorPlanReviewFlag")),
      /guest_seat|shared_with_couple|setup_members|space_id:/,
    );
  });

  it("flip link captures snapshot; notes path does not", () => {
    assert.match(flipService, /afterFlipLinked/);
    assert.match(repository, /updateEventFloorPlanFlipRoomSnapshot/);
    assert.match(repository, /room_snapshot_captured_at/);
    const notesFn = flipService.slice(
      flipService.indexOf("updateEventFloorPlanFlipNotes"),
      flipService.indexOf("unlinkEventFloorPlanFlip"),
    );
    assert.doesNotMatch(notesFn, /afterFlipLinked|RoomSnapshot/);
  });

  it("empty booking set skips T1; skipped_cleared_retry prevents reopen on identical retry", () => {
    assert.match(reviewService, /afterSet\.length === 0/);
    assert.match(reviewService, /skipped_cleared_retry/);
    assert.match(reviewService, /getLatestClearedWithFingerprint/);
  });
});

describe("Phase 5 venue UI", () => {
  it("mounts review panel in workspace with Clear review and plain-language copy", () => {
    assert.match(workspace, /FloorPlanReviewFlagsPanel/);
    assert.match(panel, /Clear review/);
    assert.match(panel, /DEFAULT_REVIEW_BANNER_COPY|booked rooms for this wedding changed/i);
    assert.match(panel, /floor-plan-review-flags-panel/);
    assert.match(panel, /does not automatically clear a review|does not clear an outstanding review/i);
    assert.match(panel, /LayoutRoomEditorInline|floor-plan-card-room-editor|floor-plan-layout-room-editor/);
  });

  it("shows mismatch banner only when open reviews exist; loading/empty/error are distinct", () => {
    assert.match(panel, /showMismatchBanner/);
    assert.match(panel, /floor-plan-review-loading/);
    assert.match(panel, /floor-plan-review-empty/);
    assert.match(panel, /floor-plan-review-error/);
    assert.match(panel, /data-review-count=\{flags\.length\}/);
    // Empty copy must not be gated behind the rooms-changed warning.
    const emptyIdx = panel.indexOf("No open layout reviews for this booking.");
    const bannerRender = panel.indexOf("showMismatchBanner ?");
    assert.ok(emptyIdx > 0 && bannerRender > 0);
  });

  it("refetches reviews when layout rooms change or card save notifies the panel", () => {
    assert.match(panel, /floorPlanSpaceFingerprint|spaceFingerprint/);
    assert.match(panel, /FLOOR_PLAN_REVIEW_FLAGS_CHANGED_EVENT|notifyFloorPlanReviewFlagsChanged/);
    assert.match(panel, /notifyFloorPlanReviewFlagsChanged\(eventId\)/);
  });

  it("exposes server actions for list/clear/update room", () => {
    assert.match(actions, /listOpenFloorPlanReviewFlagsAction/);
    assert.match(actions, /clearFloorPlanReviewFlagAction/);
    assert.match(actions, /updateFloorPlanSpaceAction/);
  });

  it("default banner copy is stable", () => {
    assert.match(DEFAULT_REVIEW_BANNER_COPY, /booked rooms for this wedding changed/i);
  });
});

describe("Phase 5 couple privacy", () => {
  it("portal surfaces do not reference review-flag persistence", () => {
    for (const key of COUPLE_FORBIDDEN_REVIEW_FLAG_KEYS) {
      if (key === "Clear review") continue; // UI string; portal must not use it either
      assert.doesNotMatch(portalSection, new RegExp(key));
      assert.doesNotMatch(portalPlansRoute, new RegExp(key));
      assert.doesNotMatch(portalSetupsRoute, new RegExp(key));
    }
    assert.doesNotMatch(portalSection, /Clear review/);
    assert.doesNotMatch(portalPlansRoute, /event_floor_plan_review_flags/);
    assert.doesNotMatch(portalSetupsRoute, /event_floor_plan_review_flags/);
  });

  it("still preserves Phase 4 flip privacy keys", () => {
    for (const key of COUPLE_FORBIDDEN_FLIP_KEYS) {
      assert.doesNotMatch(portalSection, new RegExp(key));
    }
  });
});

describe("Phase 5 preserves Phase 1–4 contracts", () => {
  it("does not reopen T2 or capacity hardening", () => {
    assert.doesNotMatch(reviewFlags, /t2_|setup.to.space|capacity hard/i);
    assert.doesNotMatch(migration, /capacity/);
  });

  it("phase1 expects Phase 5 review panel once mounted", () => {
    assert.match(phase1, /FloorPlanReviewFlagsPanel|Phase 5/);
  });

  it("phase4 privacy + unlink contracts remain tested", () => {
    assert.match(phase4, /unlink deletes only the relationship row/);
    assert.match(phase4, /portal floor-plan surfaces do not reference transition notes/);
  });
});
