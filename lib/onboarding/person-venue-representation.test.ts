import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const intakeForm = readFileSync(
  resolve("components/onboarding/onboarding-intake-form.tsx"),
  "utf8",
);
const intakePage = readFileSync(
  resolve("app/(app)/onboarding/intake/page.tsx"),
  "utf8",
);
const whiteGlovePage = readFileSync(
  resolve("app/onboarding/white-glove/[token]/page.tsx"),
  "utf8",
);
const intakeService = readFileSync(
  resolve("lib/onboarding/intake-service.ts"),
  "utf8",
);
const activateRoute = readFileSync(
  resolve("app/api/internal/enrollment/activate/route.ts"),
  "utf8",
);
const activateForm = readFileSync(
  resolve("workspace/components/activate/activate-account-form.tsx"),
  "utf8",
);
const teamPage = readFileSync(
  resolve("app/(app)/settings/team/page.tsx"),
  "utf8",
);
const representation = readFileSync(
  resolve("components/settings/venue-representation-section.tsx"),
  "utf8",
);
const venueService = readFileSync(resolve("lib/venue/service.ts"), "utf8");
const venueInfo = readFileSync(resolve("components/setup/setup-steps.tsx"), "utf8");
const signatureSection = readFileSync(
  resolve("components/settings/communication-identity-section.tsx"),
  "utf8",
);
const initialOwnership = readFileSync(
  resolve("lib/onboarding/initial-ownership.ts"),
  "utf8",
);

describe("person / venue representation model", () => {
  it("removes Primary owner/contact from onboarding and does not re-ask purchaser identity", () => {
    assert.doesNotMatch(intakeForm, /Primary owner\/contact/);
    assert.doesNotMatch(intakeForm, /label="Contact email"/);
    assert.match(intakeForm, /primaryContactName: null/);
    assert.match(intakeForm, /contactEmail: null/);
    assert.match(intakeForm, /Venue phone/);
    assert.doesNotMatch(intakePage, /owner_first_name|owner_email/);
    assert.doesNotMatch(intakePage, /primaryContactName|contactEmail:/);
    assert.doesNotMatch(whiteGlovePage, /primaryContactName|contactEmail:/);
  });

  it("does not overwrite venues.email from empty intake contact email", () => {
    assert.match(
      intakeService,
      /Do not overwrite venues\.email with purchaser identity/,
    );
    assert.match(intakeService, /if \(explicitVenueEmail\)/);
  });

  it("preserves Owner invitation and purchaser-as-Administrator path", () => {
    assert.match(activateForm, /No, I&apos;m setting this up for someone else/);
    assert.match(activateForm, /Who owns this venue\?/);
    assert.match(activateRoute, /You're invited as an Owner of/);
    assert.match(activateRoute, /purchaserIsOwner/);
    assert.match(activateRoute, /inviteOwnerNow/);
    assert.match(initialOwnership, /purchaser_is_owner/);
    assert.match(initialOwnership, /Setup Administrator \(purchaser who said they are not an Owner\)/);
  });

  it("keeps venue representation optional on Team and separate from signatures", () => {
    assert.match(teamPage, /VenueRepresentationSection/);
    assert.match(representation, /How your venue is represented/);
    assert.match(representation, /Add optional venue contact details/);
    assert.match(representation, /Venue contact email/);
    assert.doesNotMatch(representation, /Primary owner\/contact/);
    assert.match(venueService, /saveVenueContactRepresentation/);
    assert.match(venueService, /email_signature/);
    assert.match(signatureSection, /signature/i);
    assert.match(venueInfo, /Venue contact email/);
  });

  it("does not silently promote purchaser identity to Owner via intake", () => {
    assert.doesNotMatch(intakeService, /is_owner\s*:\s*true/);
    assert.doesNotMatch(intakeForm, /is_owner/);
    assert.match(activateRoute, /p_purchaser_is_owner/);
  });
});
