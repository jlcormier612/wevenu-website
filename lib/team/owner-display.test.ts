import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  currentActorNonOwnerLabel,
  ownerStatusLabel,
  shouldShowCurrentActorOutsideOwnersList,
} from "./owner-display.ts";

const owner = {
  id: "staff-you",
  acceptedAt: "2026-10-01T00:00:00.000Z",
  ownerInvitePending: false,
  isOwner: true,
};

describe("Owners display clarity — You marker", () => {
  it("marks the current accepted owner as You · Owner", () => {
    assert.deepEqual(ownerStatusLabel(owner, "staff-you"), {
      line: "You · Owner",
      isYou: true,
    });
  });

  it("leaves another accepted owner as Owner without You", () => {
    assert.deepEqual(ownerStatusLabel(owner, "staff-other"), {
      line: "Owner",
      isYou: false,
    });
  });

  it("keeps pending owner invitations unchanged", () => {
    assert.deepEqual(
      ownerStatusLabel(
        {
          id: "invite-1",
          acceptedAt: null,
          ownerInvitePending: true,
          isOwner: false,
        },
        "staff-you",
      ),
      { line: "Invitation sent", isYou: false },
    );
  });

  it("does not label a non-owner current user as Owner", () => {
    assert.equal(currentActorNonOwnerLabel("administrator"), "You · Administrator");
    assert.equal(currentActorNonOwnerLabel("manager"), "You · Manager");
    assert.equal(currentActorNonOwnerLabel("coordinator"), "You · Coordinator");
    assert.ok(
      shouldShowCurrentActorOutsideOwnersList(
        {
          staffId: "staff-admin",
          name: "Pat Purchaser",
          accessTitle: "administrator",
          isOwner: false,
        },
        new Set(["owner-1"]),
      ),
    );
    assert.equal(
      shouldShowCurrentActorOutsideOwnersList(
        {
          staffId: "staff-owner",
          name: "Jen Owner",
          accessTitle: "administrator",
          isOwner: true,
        },
        new Set(["staff-owner"]),
      ),
      false,
    );
  });

  it("does not mutate membership/ownership helpers from the display module", () => {
    const src = readFileSync(resolve("lib/team/owner-display.ts"), "utf8");
    assert.doesNotMatch(src, /from\("venue_staff"\)/);
    assert.doesNotMatch(src, /purchaser_is_owner/);
    assert.doesNotMatch(src, /\.update\(/);
    assert.doesNotMatch(src, /\.insert\(/);
  });

  it("Owners UI renders a You badge for the current owner", () => {
    const ui = readFileSync(resolve("components/settings/venue-owners-section.tsx"), "utf8");
    assert.match(ui, /ownerStatusLabel/);
    assert.match(ui, /You/);
    assert.match(ui, /Badge/);
    assert.match(ui, /shouldShowCurrentActorOutsideOwnersList/);
    assert.match(ui, /Not an owner of this venue/);
  });

  it("Owners & Administrators heading and model copy are present; CTA stays owner-only", () => {
    const ui = readFileSync(resolve("components/settings/venue-owners-section.tsx"), "utf8");
    assert.match(ui, /Owners &amp; Administrators/);
    assert.match(
      ui,
      /Adding\s+an owner or administrator does not change who purchased the account or\s+who is currently signed in/,
    );
    // Add flow still only creates Owners (isOwner: true / recordOwnerMember) —
    // do not relabel the CTA as if non-owner Administrators can be added here.
    assert.match(ui, />\s*Add owner\s*</);
    assert.doesNotMatch(ui, /Add owner or administrator/);
    assert.match(ui, /isOwner:\s*true/);
    assert.match(ui, /recordOwnerMemberAction/);
  });
});
