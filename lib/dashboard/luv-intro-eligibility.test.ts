import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  shouldIncludeDashboardSetupGapObservations,
  shouldShowDashboardLuvIntro,
} from "@/lib/dashboard/luv-intro-eligibility";

const NOW = Date.parse("2026-10-12T12:00:00.000Z");
const RECENT = "2026-10-01T12:00:00.000Z";
const OLD = "2025-01-01T12:00:00.000Z";

describe("shouldShowDashboardLuvIntro — readiness-gated setup prompt", () => {
  it("shows the setup prompt when the venue is otherwise eligible and has not declared ready", () => {
    assert.equal(
      shouldShowDashboardLuvIntro({
        readyToInviteCouples: false,
        luvIntroSeenAt: null,
        activationPhase: "setup",
        venueCreatedAt: OLD,
        nowMs: NOW,
      }),
      true,
    );
    assert.equal(
      shouldShowDashboardLuvIntro({
        readyToInviteCouples: false,
        luvIntroSeenAt: null,
        activationPhase: "operate",
        venueCreatedAt: RECENT,
        nowMs: NOW,
      }),
      true,
    );
  });

  it("hides the setup prompt when ready_to_invite_couples is true", () => {
    assert.equal(
      shouldShowDashboardLuvIntro({
        readyToInviteCouples: true,
        luvIntroSeenAt: null,
        activationPhase: "setup",
        venueCreatedAt: RECENT,
        nowMs: NOW,
      }),
      false,
    );
  });

  it("suppression is driven by the ready flag (reload / saved-state equivalent)", () => {
    const base = {
      luvIntroSeenAt: null as string | null,
      activationPhase: "setup" as string | null,
      venueCreatedAt: RECENT,
      nowMs: NOW,
    };
    assert.equal(shouldShowDashboardLuvIntro({ ...base, readyToInviteCouples: true }), false);
    // Same inputs after a "reload" still suppress when the saved flag remains true.
    assert.equal(shouldShowDashboardLuvIntro({ ...base, readyToInviteCouples: true }), false);
  });

  it("reversing the declaration restores the setup prompt when still eligible", () => {
    const base = {
      luvIntroSeenAt: null as string | null,
      activationPhase: "setup" as string | null,
      venueCreatedAt: RECENT,
      nowMs: NOW,
    };
    assert.equal(shouldShowDashboardLuvIntro({ ...base, readyToInviteCouples: true }), false);
    assert.equal(shouldShowDashboardLuvIntro({ ...base, readyToInviteCouples: false }), true);
  });

  it("one venue's readiness does not affect another's eligibility inputs", () => {
    const venueAReady = shouldShowDashboardLuvIntro({
      readyToInviteCouples: true,
      luvIntroSeenAt: null,
      activationPhase: "setup",
      venueCreatedAt: RECENT,
      nowMs: NOW,
    });
    const venueBNotReady = shouldShowDashboardLuvIntro({
      readyToInviteCouples: false,
      luvIntroSeenAt: null,
      activationPhase: "setup",
      venueCreatedAt: RECENT,
      nowMs: NOW,
    });
    assert.equal(venueAReady, false);
    assert.equal(venueBNotReady, true);
  });

  it("dismissed intro stays hidden independently of readiness", () => {
    assert.equal(
      shouldShowDashboardLuvIntro({
        readyToInviteCouples: false,
        luvIntroSeenAt: "2026-10-01T00:00:00.000Z",
        activationPhase: "setup",
        venueCreatedAt: RECENT,
        nowMs: NOW,
      }),
      false,
    );
  });

  it("ineligible mature venues stay hidden without inventing readiness", () => {
    assert.equal(
      shouldShowDashboardLuvIntro({
        readyToInviteCouples: false,
        luvIntroSeenAt: null,
        activationPhase: "operate",
        venueCreatedAt: OLD,
        nowMs: NOW,
      }),
      false,
    );
  });
});

describe("setup-gap observations vs readiness", () => {
  it("includes setup-gap nudges only when not declared ready", () => {
    assert.equal(shouldIncludeDashboardSetupGapObservations(false), true);
    assert.equal(shouldIncludeDashboardSetupGapObservations(true), false);
  });
});

describe("Dashboard wiring uses authoritative ready_to_invite_couples", () => {
  const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
  const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
  const intro = readFileSync(resolve("components/dashboard/luv-intro.tsx"), "utf8");
  const repository = readFileSync(resolve("lib/setup-hub/repository.ts"), "utf8");

  it("Dashboard page renders DashboardLuvIntro from showLuvIntro (eligibility path)", () => {
    assert.match(page, /DashboardLuvIntro/);
    assert.match(page, /show=\{data\.showLuvIntro\}/);
    assert.match(intro, /Let's finish setting up your venue/);
  });

  it("service derives showLuvIntro via shouldShowDashboardLuvIntro and venue-scoped ready flag", () => {
    assert.match(service, /shouldShowDashboardLuvIntro/);
    assert.match(service, /isVenueReadyToInviteCouples\(venue\.id\)/);
    assert.match(service, /showLuvIntro:\s*shouldShowDashboardLuvIntro\(/);
    assert.match(service, /readyToInviteCouples,/);
    // Does not gate the whole dashboard payload on the flag.
    assert.doesNotMatch(service, /if \(!readyToInviteCouples\) return null/);
  });

  it("read path does not overwrite ready_to_invite_couples", () => {
    assert.doesNotMatch(service, /setReadyToInviteCouples/);
    assert.match(repository, /ready_to_invite_couples: true/);
    assert.match(repository, /ready_to_invite_couples: false/);
  });

  it("setup-gap observations are suppressed when ready, without touching other Luv sources", () => {
    assert.match(service, /shouldIncludeDashboardSetupGapObservations\(readyToInviteCouples\)/);
    assert.match(service, /getCommunicationObservations/);
    assert.match(service, /readinessDashboardObservations/);
  });

  it("Setup Hub incomplete items and invite permissions are not rewritten by this path", () => {
    assert.doesNotMatch(service, /setLeadCapturePath|inviteCouples|assertCanInvite/);
    assert.doesNotMatch(page, /setReadyToInviteCouples/);
  });
});
