import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  canSetupPurchaserEstablishOwners,
  emailsMatch,
  needsInitialOwnerRecords,
  needsInitialOwnershipStep,
  needsPurchaserOwnershipQuestion,
  setupPersonDisplayName,
} from "@/lib/onboarding/initial-ownership";

const enrollment = {
  id: "enr-1",
  owner_email: "jennifer@example.com",
  owner_first_name: "Jennifer",
  owner_last_name: "Fancy",
  purchaser_is_owner: null as boolean | null,
};

describe("initial ownership — purchaser vs owner", () => {
  it("uses authenticated name/email and does not invent a second owner model", () => {
    assert.equal(setupPersonDisplayName(enrollment), "Jennifer Fancy");
    assert.equal(emailsMatch("Jennifer@example.com", "jennifer@example.com"), true);
    const service = readFileSync(resolve("lib/team/service.ts"), "utf8");
    assert.match(service, /canSetupPurchaserEstablishOwners/);
    assert.match(service, /is_owner: true/);
    assert.match(service, /owner_invite_pending: false/);
  });

  it("asks the purchaser only when ownership has not been declared", () => {
    assert.equal(
      needsPurchaserOwnershipQuestion({
        actorEmail: "jennifer@example.com",
        enrollment,
        actorIsOwner: false,
      }),
      true,
    );
    assert.equal(
      needsPurchaserOwnershipQuestion({
        actorEmail: "jennifer@example.com",
        enrollment: { ...enrollment, purchaser_is_owner: true },
        actorIsOwner: true,
      }),
      false,
    );
    assert.equal(
      needsPurchaserOwnershipQuestion({
        actorEmail: "jennifer@example.com",
        enrollment,
        actorIsOwner: true,
      }),
      false,
    );
  });

  it("Path B requires owner records after the purchaser is Administrator", () => {
    assert.equal(
      needsInitialOwnerRecords({ purchaserIsOwner: false, ownerCount: 0 }),
      true,
    );
    assert.equal(
      needsInitialOwnerRecords({ purchaserIsOwner: false, ownerCount: 1 }),
      false,
    );
    assert.equal(
      needsInitialOwnerRecords({ purchaserIsOwner: true, ownerCount: 0 }),
      false,
    );
  });

  it("lets the setup Administrator establish owners without becoming Owner", () => {
    assert.equal(
      canSetupPurchaserEstablishOwners({
        isOwner: false,
        isActive: true,
        accessTitle: "administrator",
        actorEmail: "jennifer@example.com",
        enrollment: { ...enrollment, purchaser_is_owner: false },
      }),
      true,
    );
    assert.equal(
      canSetupPurchaserEstablishOwners({
        isOwner: false,
        isActive: true,
        accessTitle: "coordinator",
        actorEmail: "jennifer@example.com",
        enrollment: { ...enrollment, purchaser_is_owner: false },
      }),
      false,
    );
    assert.equal(
      canSetupPurchaserEstablishOwners({
        isOwner: true,
        isActive: true,
        accessTitle: "administrator",
        actorEmail: "jennifer@example.com",
        enrollment: { ...enrollment, purchaser_is_owner: true },
      }),
      true,
    );
  });

  it("activation copy shows the locked ownership question", () => {
    const form = readFileSync(
      resolve("workspace/components/activate/activate-account-form.tsx"),
      "utf8",
    );
    assert.match(form, /Who owns this venue\?/);
    assert.match(form, /You&apos;re setting up Hello to Cheers for:/);
    assert.match(form, /Yes, I&apos;m an owner/);
    assert.match(form, /No, I&apos;m setting this up for someone else/);
    assert.match(form, /I&apos;ll manage the venue in HTC, and I&apos;ll add the owner\(s\)\./);
    assert.doesNotMatch(form, /I&apos;m an owner of this venue/);
    assert.doesNotMatch(form, /setting this up on behalf of the venue/);
  });

  it("Owners settings is ongoing management, not the initial discovery question", () => {
    const ownersUi = readFileSync(
      resolve("components/settings/venue-owners-section.tsx"),
      "utf8",
    );
    assert.match(ownersUi, /Owners have ownership-level access to this venue/);
    assert.doesNotMatch(
      ownersUi,
      /Who owns this venue\? Owners have full access/,
    );
    const page = readFileSync(
      resolve("app/(app)/onboarding/ownership/page.tsx"),
      "utf8",
    );
    assert.match(page, /InitialOwnershipClient/);
    assert.equal(
      needsInitialOwnershipStep({
        actorEmail: "jennifer@example.com",
        enrollment: { ...enrollment, purchaser_is_owner: false },
        actorIsOwner: false,
        ownerCount: 0,
      }),
      true,
    );
  });
});
