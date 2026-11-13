/**
 * Starter provisioning lifecycle — shared seed set, ensure/restore semantics,
 * and venue-path wiring so progress-save / unique-submit cannot bypass seeding.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("provisioning starters module", () => {
  it("exports seedWorkspaceStarters and covers known starter domains", () => {
    const src = readFileSync(join(__dirname, "starters.ts"), "utf8");
    assert.match(src, /export async function seedWorkspaceStarters/);
    assert.match(src, /export async function ensureVenueStarters/);
    assert.match(src, /export async function restoreHtcStarters/);
    assert.match(src, /export async function getStarterProvisioningSnapshot/);
    assert.match(src, /export const STARTER_SEED_STEP_KEYS/);
    for (const key of [
      "inventory",
      "message_templates",
      "automations",
      "contracts",
      "playbooks",
      "questionnaires",
      "event_orders",
      "timelines",
      "floor_plans",
      "packages",
      "faq",
      "brochures",
      "saved_reports",
      "schedule_item_types",
      "standard_pipeline",
      "setup_profiles",
    ]) {
      assert.match(src, new RegExp(`key: "${key}"`));
    }
  });

  it("complete venues skip reseeding unless recreateDeleted", () => {
    const src = readFileSync(join(__dirname, "starters.ts"), "utf8");
    assert.match(src, /if \(snap\.status === "complete" && !opts\?\.recreateDeleted\)/);
    assert.match(src, /do not resurrect intentional deletions|Healthy venue/i);
  });

  it("persists incomplete/failed instead of reporting complete on partial failure", () => {
    const src = readFileSync(join(__dirname, "starters.ts"), "utf8");
    assert.match(
      src,
      /failed\.length === 0 \? "complete" : seeded\.length === 0 \? "failed" : "incomplete"/,
    );
  });

  it("claims a running lease to avoid concurrent duplicate work", () => {
    const src = readFileSync(join(__dirname, "starters.ts"), "utf8");
    assert.match(src, /claimProvisioningRun/);
    assert.match(src, /skippedBecauseRunning/);
  });

  it("submitVenueSetup and saveSetupProgress ensure starters on durable venues", () => {
    const src = readFileSync(join(__dirname, "../venue/service.ts"), "utf8");
    assert.match(src, /ensureVenueStarters/);
    assert.doesNotMatch(src, /seedPackageStarters\(venueId\)/);
    // Progress-save must not bypass provisioning.
    const progressIdx = src.indexOf("export async function saveSetupProgress");
    const progressSlice = src.slice(progressIdx, progressIdx + 1200);
    assert.match(progressSlice, /ensureVenueStarters/);
    // Unique-violation success path must still ensure starters.
    assert.match(src, /code === "23505"[\s\S]*ensureVenueStarters/);
  });

  it("enrollment workspace provisioning uses ensureVenueStarters", () => {
    const src = readFileSync(join(__dirname, "workspace.ts"), "utf8");
    assert.match(src, /ensureVenueStarters/);
  });

  it("owner restore action and banner exist with non-alarming copy", () => {
    const actions = readFileSync(
      join(__dirname, "../../app/(app)/library/starter-provisioning-actions.ts"),
      "utf8",
    );
    assert.match(actions, /restoreHtcStartersAction/);
    const banner = readFileSync(
      join(__dirname, "../../components/library/starter-provisioning-banner.tsx"),
      "utf8",
    );
    assert.match(banner, /Some of your starter resources aren't ready yet/);
    assert.match(banner, /Restore HTC starters/);
    assert.match(banner, /Confirm restore deleted starters/);
  });
});
