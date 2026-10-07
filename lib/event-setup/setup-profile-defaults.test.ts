/**
 * Setup Profile defaults — timeline one-default; floor plans multi-option + preferred.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { parseTemplateRefs } from "@/lib/event-setup/template-refs";

const section = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
const page = readFileSync(resolve("app/(app)/settings/leads/setup-profiles/page.tsx"), "utf8");
const inherit = readFileSync(resolve("lib/event-setup/inherit.ts"), "utf8");
const service = readFileSync(resolve("lib/event-setup/service.ts"), "utf8");
const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");

describe("Setup Profile one-default timeline model", () => {
  it("exposes a single timeline default select over the timelines prop", () => {
    assert.match(section, /setup-profile-default-timeline/);
    assert.match(section, /timelines\.map/);
    assert.equal((section.match(/Additional available timelines/g) ?? []).length, 0);
    assert.match(section, /timelineTemplateIds:\s*\[\]/);
  });

  it("exposes multi-select floor-plan options plus preferred starting plan", () => {
    assert.match(section, /setup-profile-floor-plans/);
    assert.match(section, /setup-profile-default-floor-plan/);
    assert.match(section, /floorPlans\.map/);
    assert.match(section, /Floor plans clients can choose from/);
    assert.match(section, /Preferred starting plan/);
  });

  it("loads options from non-archived library templates", () => {
    assert.match(page, /getTemplates as getTimelineTemplates/);
    assert.match(page, /getTemplates as getFloorPlanTemplates/);
    assert.match(page, /!template\.isArchived/);
  });

  it("keeps book-time inherit applying the default timeline and floor-plan offers", () => {
    assert.match(inherit, /timelineTemplateId/);
    assert.doesNotMatch(inherit, /timelineTemplateIds/);
    assert.match(inherit, /defaultFloorPlanTemplateId/);
    assert.match(inherit, /floorPlanTemplateIds/);
    assert.match(inherit, /upsertOffer/);
  });

  it("removes portal skip warning from Setup Profile but keeps portal non-skippable in event setup", () => {
    assert.doesNotMatch(section, /cannot be skipped/);
    assert.match(service, /The client portal cannot be skipped/);
    assert.match(panel, /Always included/);
  });

  it("persists preferred floor-plan id with optional multi-select membership list", () => {
    const saved = parseTemplateRefs({
      timelineTemplateId: "tl-1",
      timelineTemplateIds: ["legacy-extra"],
      defaultFloorPlanTemplateId: "fp-3",
      floorPlanTemplateIds: ["fp-1", "fp-2"],
    });
    assert.equal(saved.timelineTemplateId, "tl-1");
    assert.equal(saved.defaultFloorPlanTemplateId, "fp-3");
    assert.deepEqual(saved.timelineTemplateIds, ["legacy-extra"]);
    assert.deepEqual(saved.floorPlanTemplateIds, ["fp-1", "fp-2"]);
  });
});
