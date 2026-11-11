import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const FORBIDDEN = [
  "lib/luv/drafts.ts",
  "lib/luv/couple-ask-prompt.ts",
  "lib/notes/internal-notes-rollup.ts",
  "app/api/portal/luv-ask/route.ts",
  "lib/dashboard/service.ts",
];

describe("Setup Concierge privacy / import boundary", () => {
  for (const file of FORBIDDEN) {
    it(`${file} does not import setup-concierge`, () => {
      const src = readFileSync(resolve(file), "utf8");
      assert.doesNotMatch(src, /setup-concierge/);
      assert.doesNotMatch(src, /VenueSetupState|selectSetupConciergeEntry|loadSetupConciergeEntry/);
    });
  }

  it("buildFollowUpPrompt file never mentions VenueSetupSnapshot", () => {
    const src = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
    assert.doesNotMatch(src, /VenueSetupSnapshot/);
    assert.doesNotMatch(src, /Next in setup/);
  });

  it("dashboard does not render the Setup Concierge card", () => {
    const dashboard = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
    assert.doesNotMatch(dashboard, /SetupConciergeCard|loadSetupConciergeEntry|Next in setup/);
  });

  it("does not add a setup-ask API", () => {
    const glob = readFileSync(resolve("lib/setup-concierge/select.ts"), "utf8");
    assert.doesNotMatch(glob, /openai|OpenAI|chatbot|setup-ask/i);
  });

  it("Setup Hub uses the concierge card, not the multi-finding dump", () => {
    const overview = readFileSync(resolve("components/setup-hub/setup-hub-overview.tsx"), "utf8");
    assert.match(overview, /SetupConciergeCard/);
    assert.doesNotMatch(overview, /OperationalReadinessCard/);
    assert.doesNotMatch(overview, /Luv on your setup/);
    const page = readFileSync(resolve("app/(app)/setup-hub/page.tsx"), "utf8");
    assert.match(page, /loadSetupConciergeEntry/);
    assert.doesNotMatch(page, /loadVenueReadiness/);
  });

  it("concierge loader ignores activation stamps and channel click telemetry", () => {
    const src = readFileSync(resolve("lib/setup-concierge/load.ts"), "utf8");
    assert.doesNotMatch(src, /\.from\("venue_activation_state"\)/);
    assert.doesNotMatch(src, /venue_lead_capture_channels/);
    assert.match(src, /source_master_key/);
  });
});
