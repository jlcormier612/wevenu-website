/**
 * Locked invitation hierarchy + joined-text regression.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const panel = readFileSync(resolve("components/events/event-setup-panel.tsx"), "utf8");
const widget = readFileSync(resolve("components/portal/portal-link-widget.tsx"), "utf8");
const profiles = readFileSync(resolve("components/settings/setup-profiles-section.tsx"), "utf8");
const bookingModel = readFileSync(resolve("lib/booking-journey/model.ts"), "utf8");

describe("Client workspace invitation hierarchy", () => {
  it("uses the locked Overview heading and separates invite from prepare/release", () => {
    assert.match(panel, /Your client&apos;s planning workspace/);
    assert.match(panel, /invite the client/);
    assert.match(panel, /Invite client/);
    assert.match(panel, /Release to client portal/);
    assert.match(panel, /sends an email when an address is on file/);
    assert.match(panel, /Questionnaires are never sent by/);
    assert.match(panel, /data-testid="client-workspace-invite"/);
  });

  it("does not recreate the Invite to portalfrom joined-text defect", () => {
    assert.doesNotMatch(profiles, /Invite to portalfrom/);
    assert.doesNotMatch(panel, /Invite to portalfrom/);
    assert.doesNotMatch(widget, /Invite to portalfrom/);
    // Explicit space tokens around the emphasized CTA in Setup Profiles.
    assert.match(profiles, /use\{\s*" "\s*\}/);
    assert.match(profiles, /\{\s*" "\s*\}/);
    assert.match(profiles, /Invite client/);
  });

  it("keeps invitation available without gating on optional setup completion", () => {
    assert.match(panel, /ClientWorkspaceInvite/);
    assert.doesNotMatch(panel, /complete \? null/);
    assert.match(widget, /inviteLabel = "Invite client"/);
    assert.match(widget, /Not invited/);
    assert.match(widget, /Invitation sent/);
    assert.match(widget, /Accepted/);
  });

  it("updates booking-journey primary label", () => {
    assert.match(bookingModel, /Invite client/);
    assert.doesNotMatch(bookingModel, /Invite to portal/);
  });
});
