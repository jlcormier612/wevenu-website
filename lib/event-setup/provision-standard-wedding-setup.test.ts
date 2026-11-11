/**
 * Platform Standard Wedding Setup provisioner — decisions and wiring guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  STANDARD_WEDDING_SETUP_PROFILE_NAME,
  standardWeddingSetupDecisions,
} from "@/lib/event-setup/provision-standard-wedding-setup";
import { profileHardConfigGaps } from "@/lib/event-setup/profile-config-gaps";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Standard Wedding Setup decisions", () => {
  it("includes planning, timeline, questionnaires, and vendors; floor plans stay Not included", () => {
    const decisions = standardWeddingSetupDecisions();
    assert.equal(decisions.planning, "set_up");
    assert.equal(decisions.timeline, "set_up");
    assert.equal(decisions.questionnaires, "set_up");
    assert.equal(decisions.vendors, "set_up");
    assert.equal(decisions.floor_plans, "skipped");
    assert.equal(decisions.inventory, undefined);
    assert.equal(decisions.event_order, undefined);
  });

  it("is honestly configured when wedding starter refs are present", () => {
    const decisions = standardWeddingSetupDecisions();
    const gaps = profileHardConfigGaps(
      decisions,
      {
        planningPlaybookTemplateId: "pb-client",
        venuePlanningPlaybookTemplateId: "pb-venue",
        timelineTemplateId: "tl-01",
        questionnaireTemplateIds: ["q-cp", "q-fd"],
        recommendedVendorIds: [],
        requiredVendorIds: [],
      },
      applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES),
    );
    assert.deepEqual(gaps, []);
  });

  it("seeds from workspace starters after Library resources", () => {
    const starters = read("lib/provisioning/starters.ts");
    assert.match(starters, /key: "setup_profiles"/);
    assert.match(starters, /seedStandardWeddingSetupProfile/);
    const idxPlaybooks = starters.indexOf('key: "playbooks"');
    const idxProfiles = starters.indexOf('key: "setup_profiles"');
    assert.ok(idxPlaybooks >= 0 && idxProfiles > idxPlaybooks);
  });

  it("never assigns a null venue-default and uses the locked profile name", () => {
    const src = read("lib/event-setup/provision-standard-wedding-setup.ts");
    assert.equal(STANDARD_WEDDING_SETUP_PROFILE_NAME, "Standard Wedding Setup");
    assert.match(src, /event_type:\s*"wedding"/);
    assert.doesNotMatch(src, /event_type:\s*null/);
    assert.doesNotMatch(src, /venueDefault:\s*true/);
  });
});

describe("playbook lazy-ensure wiring", () => {
  it("Planning Library page ensures starters on load", () => {
    const page = read("app/(app)/library/playbooks/page.tsx");
    assert.match(page, /ensurePlaybookStartersForCurrentVenue/);
    const provision = read("lib/playbooks/provision.ts");
    assert.match(provision, /PB-CLIENT-CORP-01/);
    assert.match(provision, /PB-CLIENT-SOCIAL-01/);
    assert.match(provision, /hasMasterKey \|\| input\.hasSameName/);
  });
});
