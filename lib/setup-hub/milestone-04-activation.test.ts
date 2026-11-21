/**
 * Milestone 04 activation — owner-driven readiness via existing ready_to_invite_couples.
 * Recommended setup is guided; Practice Run / optional integrations never block.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { takeALookStatus } from "@/lib/setup-hub/phase-a-milestones";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const takeALookPage = read("app/(app)/setup-hub/take-a-look/page.tsx");
const readinessAction = read("components/setup-hub/phase-a/milestone-04-readiness-action.tsx");
const actions = read("app/(app)/setup-hub/actions.ts");
const service = read("lib/setup-hub/service.ts");
const repository = read("lib/setup-hub/repository.ts");

describe("Milestone 04 activation wiring", () => {
  it("exposes owner readiness CTA on take-a-look via existing action", () => {
    assert.match(takeALookPage, /Milestone04ReadinessAction/);
    assert.match(readinessAction, /setReadyToInviteCouplesAction/);
    assert.match(readinessAction, /We&apos;re ready to start working with clients/);
    assert.match(actions, /setReadyToInviteCouplesAction/);
    assert.match(actions, /setupHub\.setReadyToInviteCouples\(ready\)/);
    assert.match(actions, /revalidatePath\("\/setup-hub\/take-a-look"\)/);
    assert.match(service, /setReadyToInviteCouples/);
    assert.match(repository, /ready_to_invite_couples: true/);
  });

  it("does not hard-require Milestones 01–03 before activation", () => {
    assert.doesNotMatch(readinessAction, /prerequisitesReady/);
    assert.doesNotMatch(takeALookPage, /prerequisitesReady/);
    assert.doesNotMatch(readinessAction, /Finish Milestones 01–03 first/);
    assert.match(readinessAction, /m04-ready-incomplete-confirm/);
    assert.match(readinessAction, /I understand — we&apos;re ready/);
  });

  it("keeps Practice Run and optional integrations optional", () => {
    assert.match(takeALookPage, /Never required to go live/);
    assert.match(takeALookPage, /Practice Run is optional/);
    assert.match(readinessAction, /Practice Run and optional/);
    assert.doesNotMatch(takeALookPage, /stripe|twilio|quickbooks|SMS/i);
    assert.doesNotMatch(readinessAction, /stripe|twilio|quickbooks/i);
  });

  it("enables Finish only after ready_to_invite_couples; M04 Ready follows declaration", () => {
    assert.match(takeALookPage, /phase-a-finish-enabled/);
    assert.match(takeALookPage, /phase-a-finish-disabled/);
    assert.match(takeALookPage, /readyToGoLive/);
    assert.equal(takeALookStatus({ readyToInviteCouples: false }), "not_started");
    assert.equal(takeALookStatus({ readyToInviteCouples: true }), "ready");
  });

  it("does not invent a second readiness flag or DB bypass", () => {
    assert.doesNotMatch(readinessAction, /setup_completed|markMilestone04|ready_to_go_live/);
    assert.doesNotMatch(takeALookPage, /\.update\(|from\("venue_setup_hub_state"\)/);
    assert.doesNotMatch(actions, /ready_to_invite_couples/);
  });
});
