/**
 * Approved arrangement protection + Ready lock — source and pure-helper contracts.
 * Run: npx tsx --test lib/floor-plans/approved-arrangement-protection.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { physicalEditsBlockedReason } from "@/lib/floor-plans/repository";
import { clientMayEditLayout } from "@/lib/floor-plans/client-layout-review";
import { needsSeatingHostResolution } from "@/lib/floor-plans/workspace-status";

const migration = readFileSync(
  resolve("supabase/migrations/20270121120000_floor_plans_complete_workflow.sql"),
  "utf8",
);
const service = readFileSync(resolve("lib/floor-plans/service.ts"), "utf8");
const repo = readFileSync(resolve("lib/floor-plans/repository.ts"), "utf8");

describe("approved arrangement protection", () => {
  it("migration creates revision snapshots and supersedes prior approved", () => {
    assert.match(migration, /create table if not exists public\.floor_plan_layout_revisions/);
    assert.match(migration, /status text not null default 'approved'/);
    assert.match(migration, /objects_snapshot jsonb not null/);
    assert.match(repo, /createApprovedLayoutRevision/);
    assert.match(repo, /status: "superseded"/);
    assert.match(service, /createApprovedLayoutRevision/);
    assert.match(service, /clientLayoutStatus: "approved"/);
  });

  it("approve snapshots before flipping status to approved", () => {
    const approveFn = service.split("export async function approveClientFloorPlanLayout")[1]!
      .split("export async function requestClientFloorPlanChanges")[0]!;
    const snapIdx = approveFn.indexOf("createApprovedLayoutRevision");
    const statusIdx = approveFn.indexOf('clientLayoutStatus: "approved"');
    assert.ok(snapIdx > 0 && statusIdx > snapIdx, "snapshot must precede approved status write");
  });

  it("blocks couple and staff physical edits while approved or Ready", () => {
    assert.equal(
      clientMayEditLayout({ clientLayoutStatus: "approved", isReady: false }),
      false,
    );
    assert.equal(
      clientMayEditLayout({ clientLayoutStatus: "working", isReady: true }),
      false,
    );
    assert.match(
      physicalEditsBlockedReason({ finalizedAt: "2026-01-01", clientLayoutStatus: "working" }) ?? "",
      /Ready/i,
    );
    assert.match(
      physicalEditsBlockedReason({ finalizedAt: null, clientLayoutStatus: "approved" }) ?? "",
      /approved/i,
    );
    assert.equal(
      physicalEditsBlockedReason({ finalizedAt: null, clientLayoutStatus: "working" }),
      null,
    );
    assert.equal(
      physicalEditsBlockedReason({ finalizedAt: null, clientLayoutStatus: "changes_requested" }),
      null,
    );
  });

  it("DB trigger blocks Ready and approved object mutations", () => {
    assert.match(migration, /floor_plan_objects_ready_lock/);
    assert.match(migration, /Physical layout is Ready/);
    assert.match(migration, /This arrangement is approved/);
  });

  it("Make Changes clears Ready and reopens approved to changes_requested without dropping revisions", () => {
    assert.match(repo, /client_layout_status = "changes_requested"/);
    assert.match(repo, /Venue reopened physical editing \(Make Changes\)/);
    assert.doesNotMatch(repo, /delete.*floor_plan_layout_revisions|floor_plan_layout_revisions.*delete/i);
    assert.match(service, /reopenClientFloorPlanLayout/);
  });

  it("seating independence: selection never rewrites guest_seat_assignments", () => {
    const selectBody = migration
      .split("create or replace function public.select_portal_floor_plan_offer")[1]!
      .split("create or replace function public.floor_plan_objects_ready_lock")[0]!;
    assert.doesNotMatch(selectBody, /update public\.guest_seat_assignments/);
    assert.doesNotMatch(selectBody, /delete from public\.guest_seat_assignments/);
    assert.match(selectBody, /needsSeatingResolution/);
    // Case B/C keep seating-in-use for deliberate resolution (do not auto-point at new plan).
    assert.match(selectBody, /v_seating_case in \('B', 'C'\)/);
  });

  it("Case B host gap detection for venue follow-up", () => {
    assert.equal(
      needsSeatingHostResolution({
        operationalFloorPlanId: "b",
        seatingInUseFloorPlanId: "a",
        operationalSeatCount: 0,
        seatingInUseSeatCount: 4,
      }),
      true,
    );
    assert.equal(
      needsSeatingHostResolution({
        operationalFloorPlanId: "a",
        seatingInUseFloorPlanId: "a",
        operationalSeatCount: 4,
        seatingInUseSeatCount: 4,
      }),
      false,
    );
  });

  it("portal exposes seatingEnabled from client_access, not seating-in-use alone", () => {
    assert.match(migration, /'seatingEnabled', \(coalesce\(fp\.client_access, 'hidden'\) = 'view'\)/);
    assert.match(migration, /'seatingAccess', fp\.client_access/);
    const portal = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
    assert.match(portal, /seatingEnabled === true/);
    assert.doesNotMatch(
      portal.split("const seatingEnabled")[1]!.slice(0, 400),
      /isSeatingInUse/,
    );
  });

  it("setup selection establishes working; no Approve preference ceremony in setup UI", () => {
    assert.match(migration, /select_portal_setup_floor_plan_preference/);
    assert.match(migration, /couple_preference_status = 'applied'/);
    const setupUi = readFileSync(resolve("components/events/floor-plan-setup-package.tsx"), "utf8");
    assert.doesNotMatch(setupUi, /Approve preference/);
    assert.doesNotMatch(setupUi, />Defer</);
    assert.match(setupUi, /Accept layout replacement|Keep current layout/);
  });
});
