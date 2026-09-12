/**
 * Starter provisioning list — ensures the shared layer owns the seed set
 * that used to live only inside submitVenueSetup.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("provisioning starters module", () => {
  it("exports seedWorkspaceStarters and covers known starter domains", () => {
    const src = readFileSync(join(__dirname, "starters.ts"), "utf8");
    assert.match(src, /export async function seedWorkspaceStarters/);
    for (const key of [
      "inventory",
      "message_templates",
      "automations",
      "contracts",
      "questionnaires",
      "packages",
      "brochures",
      "saved_reports",
    ]) {
      assert.match(src, new RegExp(`key: "${key}"`));
    }
  });

  it("submitVenueSetup delegates to seedWorkspaceStarters", () => {
    const src = readFileSync(join(__dirname, "../venue/service.ts"), "utf8");
    assert.match(src, /seedWorkspaceStarters/);
    assert.doesNotMatch(src, /seedPackageStarters\(venueId\)/);
  });
});
