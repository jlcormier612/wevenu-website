/**
 * Floor Plans Phase 1 contract invariants (F1–F7 / C1–C9 Phase 1 exit).
 * Phase 2 preference review is authorized separately; Phase 1 share/working/seating
 * independence and truthful working-layout labels must still hold.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
const portalSection = readFileSync(resolve("components/portal/floor-plan-section.tsx"), "utf8");
const portalView = readFileSync(resolve("components/portal/floor-plan-view.tsx"), "utf8");
const repository = readFileSync(resolve("lib/floor-plans/repository.ts"), "utf8");
const service = readFileSync(resolve("lib/floor-plans/service.ts"), "utf8");
const readiness = readFileSync(resolve("lib/event-setup/readiness-detail.ts"), "utf8");

describe("Floor Plans Phase 1 — truthful working-layout labels", () => {
  it("venue workspace labels the pointer as working layout, not Operational approval", () => {
    assert.match(workspace, /Set as working layout/);
    assert.match(workspace, /isOperational \? "Working layout" : "Set as working layout"/);
    assert.match(workspace, />\s*Working layout\s*</);
    assert.doesNotMatch(workspace, /Operational plan|Set as operational|>\s*Operational\s*</);
    assert.match(workspace, /This is not approval/);
  });

  it("portal chooser uses Working layout, not Operational", () => {
    assert.match(portalSection, / · Venue working layout| · Working layout/);
    assert.match(portalView, / · Working layout/);
    assert.doesNotMatch(portalSection, / · Operational/);
    assert.doesNotMatch(portalView, / · Operational/);
  });

  it("setup readiness refers to working layout, not operational plan as approval", () => {
    assert.match(readiness, /edits the working layout/);
    assert.doesNotMatch(readiness, /edits the operational plan/);
  });
});

describe("Floor Plans Phase 1 — share vs seating remain distinct", () => {
  it("workspace exposes independent Share Floor Plan and seating toggles", () => {
    assert.match(workspace, /function ShareFloorPlanToggle/);
    assert.match(workspace, /function ShareForSeatingToggle/);
    assert.match(workspace, /Share Floor Plan/);
    assert.match(workspace, /Seating open|Seating paused/);
    assert.match(workspace, /setCoupleShareAction/);
    assert.match(workspace, /setClientAccessAction/);
    assert.match(workspace, /Independent of Seating/);
  });

  it("does not treat shared or working layout as Client approved", () => {
    assert.match(workspace, /clientLayoutStatus === "approved"/);
    assert.doesNotMatch(
      workspace,
      /isOperational[\s\S]{0,80}Client approved|sharedWithCouple[\s\S]{0,80}Client approved/,
    );
  });
});

describe("Floor Plans Phase 1 — multi-layout coexistence without package claims", () => {
  it("surfaces other layouts with progressive, non-package guidance", () => {
    assert.match(workspace, /floor-plan-multi-layout-note/);
    assert.match(workspace, /not a finished setup-package or\s+multi-phase system/);
    assert.match(workspace, /Multiple layouts may coexist without a setup\s+package/);
    assert.match(workspace, /\+ Additional layout/);
  });

  it("portal multi-offer chooser does not claim a setup-package system", () => {
    assert.match(portalSection, /floor-plan-choose-layout/);
    assert.match(portalSection, /not a\s+multi-setup package/);
  });
});

describe("Floor Plans Phase 1 — library isolation and seating preservation", () => {
  it("applyTemplate clones into a new event plan via source_template_id", () => {
    assert.match(service, /export async function applyTemplate/);
    assert.match(service, /createFloorPlan\(supabase, venueId, eventId, name\.trim\(\), spaceId, templateId\)/);
    assert.match(repository, /source_template_id: sourceTemplateId/);
  });

  it("duplicateFloorPlan never mutates the source plan", () => {
    assert.match(service, /Never touches the source/);
    assert.match(repository, /duplicateFloorPlanInto/);
  });

  it("setEventOperationalFloorPlan updates only the event pointer", () => {
    assert.match(
      repository,
      /update\(\{\s*operational_floor_plan_id:\s*floorPlanId\s*\}\)/,
    );
    assert.doesNotMatch(
      repository,
      /setEventOperationalFloorPlan[\s\S]{0,400}guest_seat_assignments/,
    );
  });

  it("deleteFloorPlan blocks when seating history exists", () => {
    assert.match(repository, /guest_seat_assignments/);
    assert.match(repository, /seating history is never deleted silently/);
    assert.match(repository, /Resolve seating before deleting the plan/);
  });
});

describe("Floor Plans Phase 1 — Phase 4–5 product surface still deferred", () => {
  it("workspace does not introduce linked flip or booking-review Phase 4–5 claims", () => {
    assert.doesNotMatch(workspace, /linked flip|booking-review flag/);
  });
});

describe("Floor Plans Phase 3 — package view replaces whole-event false chooser when setups exist", () => {
  it("portal hosts Your wedding setups package surface", () => {
    assert.match(portalSection, /Your wedding setups/);
    assert.match(portalSection, /floor-plan-wedding-setups/);
    assert.match(portalSection, /showPackageView/);
  });

  it("venue workspace exposes optional setup organizer without forcing package builder", () => {
    assert.match(workspace, /FloorPlanSetupPackagePanel|floor-plan-setup-package/);
  });
});
