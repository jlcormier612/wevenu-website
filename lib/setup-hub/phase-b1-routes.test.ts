import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSafeSetupHubReturnPath,
  SETUP_HUB_MILESTONE_RETURN,
  withSetupHubReturn,
} from "@/lib/setup-hub/phase-b1-routes";

describe("setup-hub return paths", () => {
  it("allows Phase A milestone parents and nested Make HTC yours routes", () => {
    assert.equal(isSafeSetupHubReturnPath("/setup-hub"), true);
    assert.equal(isSafeSetupHubReturnPath("/setup-hub/protect-calendar"), true);
    assert.equal(isSafeSetupHubReturnPath("/setup-hub/make-htc-yours"), true);
    assert.equal(
      isSafeSetupHubReturnPath("/setup-hub/make-htc-yours/event-experiences/wedding"),
      true,
    );
    assert.equal(isSafeSetupHubReturnPath("/setup-hub/bring-business"), true);
    assert.equal(isSafeSetupHubReturnPath("/setup-hub/take-a-look"), true);
  });

  it("rejects protocol tricks and paths outside setup-hub", () => {
    assert.equal(isSafeSetupHubReturnPath("/settings/availability"), false);
    assert.equal(isSafeSetupHubReturnPath("/setup-hub.evil"), false);
    assert.equal(isSafeSetupHubReturnPath("//evil.example/setup-hub"), false);
    assert.equal(isSafeSetupHubReturnPath("/setup-hub/../settings"), false);
    assert.equal(isSafeSetupHubReturnPath("https://htc.invalid/setup-hub"), false);
  });

  it("preserves Protect your calendar as the availability return parent", () => {
    const href = withSetupHubReturn(
      "/settings/availability?focus=spaces",
      undefined,
      SETUP_HUB_MILESTONE_RETURN.protectCalendar,
    );
    assert.match(href, /from=setup-hub/);
    assert.match(href, /setupReturn=%2Fsetup-hub%2Fprotect-calendar/);
    assert.match(href, /setupReturnLabel=Back\+to\+Protect\+your\+calendar/);
    assert.match(href, /focus=spaces/);
  });

  it("preserves Bring your business over as the Migration Center return parent", () => {
    const href = withSetupHubReturn(
      "/settings/migration",
      undefined,
      SETUP_HUB_MILESTONE_RETURN.bringBusiness,
    );
    assert.match(href, /from=setup-hub/);
    assert.match(href, /setupReturn=%2Fsetup-hub%2Fbring-business/);
    assert.match(href, /setupReturnLabel=Back\+to\+Bring\+your\+business\+over/);
  });

  it("keeps booking-process as the Packages return section", () => {
    const href = withSetupHubReturn("/packages", "booking-process");
    assert.match(href, /from=setup-hub/);
    assert.match(href, /setupSection=booking-process/);
    assert.doesNotMatch(href, /setupReturn=/);
  });
});
