/**
 * Setup Profile defaults — one dropdown per planning type from the active library.
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

describe("Setup Profile one-default model", () => {
  it("exposes a single timeline default select over the timelines prop", () => {
    assert.match(section, /setup-profile-default-timeline/);
    assert.match(section, /timelines\.map/);
    assert.equal((section.match(/Additional available timelines/g) ?? []).length, 0);
    assert.match(section, /timelineTemplateIds:\s*\[\]/);
  });

  it("exposes a single floor-plan default select over the floorPlans prop", () => {
    assert.match(section, /setup-profile-default-floor-plan/);
    assert.match(section, /floorPlans\.map/);
    assert.equal((section.match(/Starting floor-plan options/g) ?? []).length, 0);
    assert.match(section, /floorPlanTemplateIds:\s*\[\]/);
  });

  it("loads options from non-archived library templates", () => {
    assert.match(page, /getTemplates as getTimelineTemplates/);
    assert.match(page, /getTemplates as getFloorPlanTemplates/);
    assert.match(page, /!template\.isArchived/);
  });

  it("keeps book-time inherit applying only the default timeline", () => {
    assert.match(inherit, /timelineTemplateId/);
    assert.doesNotMatch(inherit, /timelineTemplateIds/);
    assert.doesNotMatch(inherit, /defaultFloorPlanTemplateId/);
    assert.doesNotMatch(inherit, /floorPlanTemplateIds/);
  });

  it("removes portal skip warning from Setup Profile but keeps portal non-skippable in event setup", () => {
    assert.doesNotMatch(section, /cannot be skipped/);
    assert.doesNotMatch(section, /Client portal/);
    assert.match(service, /The client portal cannot be skipped/);
    assert.match(panel, /Always included/);
  });

  it("persists a lone preferred floor-plan id without a multi-select membership list", () => {
    const saved = parseTemplateRefs({
      timelineTemplateId: "tl-1",
      timelineTemplateIds: ["legacy-extra"],
      defaultFloorPlanTemplateId: "fp-3",
      floorPlanTemplateIds: ["fp-1", "fp-2"],
    });
    assert.equal(saved.timelineTemplateId, "tl-1");
    assert.equal(saved.defaultFloorPlanTemplateId, "fp-3");
    // Legacy lists still parse for old snapshots; UI clears them on next save.
    assert.deepEqual(saved.timelineTemplateIds, ["legacy-extra"]);
    assert.deepEqual(saved.floorPlanTemplateIds, ["fp-1", "fp-2"]);
  });
});
