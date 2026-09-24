import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Owner setup — ownership vs invitation", () => {
  const service = readFileSync(resolve("lib/team/service.ts"), "utf8");
  const ownersUi = readFileSync(
    resolve("components/settings/venue-owners-section.tsx"),
    "utf8",
  );
  const roster = readFileSync(
    resolve("components/settings/team-roster.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    resolve("app/(app)/settings/team/actions.ts"),
    "utf8",
  );

  it("exposes record-without-invite and invite-recorded paths", () => {
    assert.match(service, /export async function recordOwnerMember/);
    assert.match(service, /export async function inviteRecordedOwner/);
    assert.match(service, /owner_invite_pending: false/);
    assert.match(service, /invite_token: null/);
    assert.match(service, /is_owner: true/);
    assert.match(actions, /recordOwnerMemberAction/);
    assert.match(actions, /inviteRecordedOwnerAction/);
  });

  it("Add owner UI requires an explicit invitation decision", () => {
    assert.match(ownersUi, /Add owner only/);
    assert.match(ownersUi, /Invite owner now/);
    assert.match(ownersUi, /Record them as an owner without sending an invitation/);
    assert.match(ownersUi, /How should this owner access Hello to Cheers/);
    assert.doesNotMatch(ownersUi, /They'll receive an Owner invitation and get full access/);
    assert.doesNotMatch(ownersUi, /Send Owner invitation/);
  });

  it("shows customer-facing owner states (not owner_invite_pending)", () => {
    assert.match(ownersUi, /Owner access not yet invited/);
    assert.match(ownersUi, /Invitation sent/);
    assert.match(ownersUi, /You/);
    assert.doesNotMatch(ownersUi, /Owner invite pending/);
    assert.match(roster, /Invitation sent/);
    assert.match(roster, /Not yet invited/);
    assert.doesNotMatch(roster, /Owner invite pending/);
  });

  it("does not restore Invite as Owner on Team staff invite", () => {
    assert.doesNotMatch(roster, /Invite as Owner/);
    assert.doesNotMatch(roster, /isOwner:\s*true/);
  });

  it("promotes existing HTC members instead of duplicating owner invites", () => {
    assert.match(service, /Already has HTC access/);
    assert.match(service, /promoteAcceptedMemberToOwner/);
  });

  it("setup Administrator purchaser can establish owners without changing the owner model", () => {
    assert.match(service, /canSetupPurchaserEstablishOwners/);
    assert.match(ownersUi, /actorCanManageOwners/);
  });
});
