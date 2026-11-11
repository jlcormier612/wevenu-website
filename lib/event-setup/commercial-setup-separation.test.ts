/**
 * Actual overhaul — Inventory / Event Order removed from Setup experience.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";
import {
  applicableSetupSteps,
  isCommercialSetupStep,
  overviewSetupSteps,
  setupExperienceSteps,
} from "@/lib/event-setup/state";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("Setup excludes Inventory and Event Order", () => {
  it("applicableSetupSteps never offers inventory or event_order", () => {
    const steps = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
    assert.deepEqual(steps, ["planning", "timeline", "floor_plans", "vendors", "questionnaires"]);
    assert.equal(steps.includes("inventory"), false);
    assert.equal(steps.includes("event_order"), false);
    assert.equal(isCommercialSetupStep("inventory"), true);
    assert.equal(isCommercialSetupStep("planning"), false);
  });

  it("overview / setup experience keeps only planning areas", () => {
    const applicable = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
    assert.deepEqual(overviewSetupSteps(applicable), [
      "planning", "timeline", "floor_plans", "vendors",
    ]);
    assert.deepEqual(setupExperienceSteps(applicable), [
      "planning", "timeline", "floor_plans", "vendors",
    ]);
  });

  it("booking inherit does not ensure Inventory or Event Order drafts", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.doesNotMatch(inherit, /ensureEventInventory/);
    assert.doesNotMatch(inherit, /ensureEventOrder/);
    assert.doesNotMatch(inherit, /applyInheritedInventoryAndEventOrder/);
  });

  it("portal release does not create Inventory or Event Order drafts", () => {
    const prepare = read("lib/event-setup/prepare-release.ts");
    assert.doesNotMatch(prepare, /ensureEventInventory/);
    assert.doesNotMatch(prepare, /ensureEventOrder/);
    assert.match(prepare, /commercial workflows/);
  });

  it("Setup Profile UI no longer configures starting Inventory/EO templates", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.doesNotMatch(section, /setup-profile-inventory/);
    assert.doesNotMatch(section, /setup-profile-event-order/);
    assert.doesNotMatch(section, /Starting inventory template/);
    assert.doesNotMatch(section, /Starting Event Order template/);
    assert.match(section, /commercial workflows/);
  });

  it("Event Setup panel has no Inventory/EO editors or readiness rows wiring", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.doesNotMatch(panel, /EventInventorySetupEditor/);
    assert.doesNotMatch(panel, /EventOrderSetupEditor/);
    assert.doesNotMatch(panel, /"inventory", "event_order"/);
    assert.match(panel, /commercial workflows on their own event tabs/);
  });
});
