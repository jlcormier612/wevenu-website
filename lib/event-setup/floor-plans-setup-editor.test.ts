/**
 * Floor Plans event-specific setup editor — offers ≠ operational plans; Change ≠ Open.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { setupReadinessDetail } from "@/lib/event-setup/readiness-detail";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const editor = readFileSync(resolve("components/events/event-floor-plans-setup-editor.tsx"), "utf8");
const actions = readFileSync(resolve("app/(app)/events/[id]/floor-plan-actions.ts"), "utf8");
const service = readFileSync(resolve("lib/floor-plan-offers/service.ts"), "utf8");
const prepare = readFileSync(resolve("lib/event-setup/prepare-release.ts"), "utf8");
const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");

describe("Floor Plans Change vs Open destinations", () => {
  it("Change opens the dedicated floor-plans setup editor, not the management tab", () => {
    assert.match(panel, /setFloorPlansEditorOpen\(true\)/);
    assert.match(panel, /EventFloorPlansSetupEditor/);
    assert.match(editor, /data-testid="event-floor-plans-setup-editor"/);
    const changeFn = panel.slice(panel.indexOf("function changeForEvent"));
    assert.doesNotMatch(changeFn.slice(0, 1400), /navigateStep\("floor_plans"\)/);
  });

  it("Open Floor Plans still navigates to the management workspace", () => {
    assert.match(panel, /Open Floor Plans/);
    assert.match(panel, /step === "floor_plans" \? "floorplan"/);
    assert.match(panel, /onOpenManagement=\{\(\) => navigateStep\("floor_plans"\)\}/);
  });

  it("event-detail passes offers, templates, and operational plans into the panel", () => {
    assert.match(detail, /floorPlanOffers=\{floorPlanOffers\}/);
    assert.match(detail, /floorPlanTemplates=\{floorPlanTemplates\}/);
    assert.match(detail, /operationalFloorPlans=\{/);
    assert.match(detail, /operationalFloorPlanCount=/);
  });
});

describe("Floor Plans setup editor seams", () => {
  it("edits offers only — no operational create/share/release/invoice", () => {
    assert.match(editor, /upsertFloorPlanOfferAction/);
    assert.match(editor, /withdrawFloorPlanOfferAction/);
    assert.match(editor, /ensureEventFloorPlanOffersAction/);
    assert.match(editor, /floor-plans-setup-operational-state/);
    assert.match(editor, /This event&apos;s working layout/);
    assert.match(editor, /you do not need the Floor Plans workspace to manage offers/);
    assert.match(editor, /coupleSelectedPlan/);
    assert.doesNotMatch(editor, /createFloorPlanAction/);
    assert.doesNotMatch(editor, /setCoupleShare/);
    assert.doesNotMatch(editor, /setOperationalFloorPlan/);
    assert.doesNotMatch(editor, /prepareAndReleasePortal/);
    assert.doesNotMatch(editor, /Invite client/);
    assert.doesNotMatch(editor, /createInvoice/);
  });

  it("event-detail passes couple selection into the panel for honest editor state", () => {
    assert.match(detail, /coupleSelectedFloorPlanId=\{event\.coupleSelectedFloorPlanId/);
    assert.match(panel, /coupleSelectedFloorPlanId/);
    assert.match(panel, /coupleSelectedPlan=\{/);
  });

  it("ensure recovers offers idempotently without creating operational plans", () => {
    assert.match(service, /export async function ensureEventFloorPlanOffers/);
    assert.match(service, /if \(existing\.length > 0\)/);
    assert.match(service, /Does not create operational floor_plans/);
    assert.match(actions, /ensureEventFloorPlanOffersAction/);
    assert.doesNotMatch(service, /from\("floor_plans"\)/);
  });

  it("panel does not call ensure; release still recovers offers separately", () => {
    assert.doesNotMatch(panel, /ensureEventFloorPlanOffersAction/);
    assert.match(prepare, /event_floor_plan_offers/);
    assert.match(prepare, /upsertOffer/);
  });
});

describe("Floor Plans readiness distinguishes offers from operational plans", () => {
  const base = {
    step: "floor_plans" as const,
    decision: "set_up" as const,
    inheritedRefs: {},
    playbookApplications: [],
    hasTimeline: false,
    timelineItemCount: 0,
    questionnaires: [],
    vendorRecommendationCount: 0,
    preferredFloorPlanName: null as string | null,
    hasEventInventory: false,
    eventOrder: null,
    templateNames: { planning: null, timeline: null, inventory: null, eventOrder: null },
  };

  it("offers present with no operational plan is Included, not broken", () => {
    const detailRow = setupReadinessDetail({
      ...base,
      floorPlanOfferCount: 2,
      operationalFloorPlanCount: 0,
      preferredFloorPlanName: "Barn dinner",
    });
    assert.equal(detailRow.status, "included");
    assert.match(detailRow.summary, /2 layouts offered/i);
    assert.match(detailRow.summary, /No operational floor plan/i);
    assert.match(detailRow.summary, /separate from offers/i);
  });

  it("operational plans are reported separately when present", () => {
    const detailRow = setupReadinessDetail({
      ...base,
      floorPlanOfferCount: 1,
      operationalFloorPlanCount: 1,
    });
    assert.equal(detailRow.status, "included");
    assert.match(detailRow.summary, /1 operational floor plan/i);
  });

  it("configured refs with no offers yet are recoverable Draft, not Unavailable", () => {
    const detailRow = setupReadinessDetail({
      ...base,
      floorPlanOfferCount: 0,
      operationalFloorPlanCount: 0,
      inheritedRefs: { defaultFloorPlanTemplateId: "fp-1", floorPlanTemplateIds: ["fp-1"] },
    });
    assert.equal(detailRow.status, "draft");
    assert.match(detailRow.summary, /recoverable/i);
    assert.doesNotMatch(detailRow.summary, /Unavailable/i);
  });

  it("no offers and no configured refs is needs_action, not Unavailable", () => {
    const detailRow = setupReadinessDetail({
      ...base,
      floorPlanOfferCount: 0,
      operationalFloorPlanCount: 0,
      inheritedRefs: {},
    });
    assert.equal(detailRow.status, "needs_action");
    assert.match(detailRow.summary, /No floor-plan layouts offered/i);
  });
});
