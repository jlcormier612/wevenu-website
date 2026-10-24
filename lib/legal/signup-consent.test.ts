/**
 * Account-setup Terms + Privacy acknowledgment — all signup audiences.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isLegalAcceptedValue,
  parseLegalAcceptedFromFormData,
  requireSignupLegalAccepted,
  SIGNUP_LEGAL_ACCEPTED_ERROR,
  SIGNUP_LEGAL_DOCUMENT_TYPES,
  signupLegalLinks,
} from "@/lib/legal/signup-consent";

const clientAccept = readFileSync(resolve("app/client/accept/accept-form.tsx"), "utf8");
const participantAccept = readFileSync(
  resolve("app/client/accept-participant/accept-participant-form.tsx"),
  "utf8",
);
const clientActions = readFileSync(resolve("app/client/actions.ts"), "utf8");
const vendorSignup = readFileSync(
  resolve("components/vendor-app/vendor-accept-signup-form.tsx"),
  "utf8",
);
const vendorActions = readFileSync(resolve("app/vendor/actions.ts"), "utf8");
const clientService = readFileSync(resolve("lib/client-auth/service.ts"), "utf8");
const vendorService = readFileSync(resolve("lib/vendor-auth/service.ts"), "utf8");
const clientLogin = readFileSync(resolve("app/client/login/page.tsx"), "utf8");
const enrollmentActivate = readFileSync(
  resolve("app/api/internal/enrollment/activate/route.ts"),
  "utf8",
);
const venueActivateForm = readFileSync(
  resolve("workspace/components/activate/activate-account-form.tsx"),
  "utf8",
);
const legalLinks = [
  resolve("app/end-user-terms/page.tsx"),
  resolve("app/vendor-terms/page.tsx"),
  resolve("app/privacy/page.tsx"),
  resolve("app/legal/[type]/page.tsx"),
];

describe("signup legal consent helpers", () => {
  it("treats only affirmative values as accepted", () => {
    assert.equal(isLegalAcceptedValue(true), true);
    assert.equal(isLegalAcceptedValue("true"), true);
    assert.equal(isLegalAcceptedValue(1), true);
    assert.equal(isLegalAcceptedValue("1"), true);
    assert.equal(isLegalAcceptedValue(false), false);
    assert.equal(isLegalAcceptedValue("false"), false);
    assert.equal(isLegalAcceptedValue(null), false);
    assert.equal(isLegalAcceptedValue(undefined), false);
    assert.equal(isLegalAcceptedValue(""), false);
    assert.equal(isLegalAcceptedValue("on"), false);
  });

  it("parses FormData legalAccepted without inventing consent", () => {
    const empty = new FormData();
    assert.equal(parseLegalAcceptedFromFormData(empty), false);
    const checked = new FormData();
    checked.set("legalAccepted", "true");
    assert.equal(parseLegalAcceptedFromFormData(checked), true);
  });

  it("rejects missing acknowledgment per audience with approved copy", () => {
    for (const audience of ["couple", "vendor", "venue"] as const) {
      const denied = requireSignupLegalAccepted(audience, false);
      assert.equal(denied.ok, false);
      if (!denied.ok) {
        assert.equal(denied.error, SIGNUP_LEGAL_ACCEPTED_ERROR[audience]);
      }
      assert.deepEqual(requireSignupLegalAccepted(audience, true), { ok: true });
    }
  });

  it("maps each audience to Terms + Privacy document types and public hrefs", () => {
    assert.deepEqual(SIGNUP_LEGAL_DOCUMENT_TYPES.couple, [
      "couple_end_user_terms",
      "privacy_policy",
    ]);
    assert.deepEqual(SIGNUP_LEGAL_DOCUMENT_TYPES.vendor, [
      "vendor_end_user_terms",
      "privacy_policy",
    ]);
    assert.deepEqual(SIGNUP_LEGAL_DOCUMENT_TYPES.venue, [
      "venue_terms_of_service",
      "privacy_policy",
    ]);
    assert.equal(signupLegalLinks("couple").termsHref, "/end-user-terms");
    assert.equal(signupLegalLinks("vendor").termsHref, "/vendor-terms");
    assert.equal(signupLegalLinks("venue").termsHref, "/legal/venue_terms_of_service");
    assert.equal(signupLegalLinks("couple").privacyHref, "/privacy");
  });
});

describe("account-creation paths require signup legal UI + server enforcement", () => {
  it("client invite + participant forms mount SignupLegalConsent", () => {
    assert.match(clientAccept, /SignupLegalConsent/);
    assert.match(clientAccept, /audience="couple"/);
    assert.match(participantAccept, /SignupLegalConsent/);
    assert.match(participantAccept, /audience="couple"/);
  });

  it("client actions reject missing acknowledgment before createUser", () => {
    assert.match(clientActions, /requireSignupLegalAccepted\(\s*"couple"/);
    assert.match(clientActions, /parseLegalAcceptedFromFormData/);
    assert.match(clientActions, /legalAccepted: true/);
    assert.match(clientActions, /recordCouplePortalLegalAcceptances/);
    assert.match(clientService, /if \(!options\?\.legalAccepted\)/);
    assert.match(
      clientService,
      /Please agree to the End User Terms and Privacy Policy/,
    );
  });

  it("vendor invite signup mounts consent and rejects without it", () => {
    assert.match(vendorSignup, /SignupLegalConsent/);
    assert.match(vendorSignup, /audience="vendor"/);
    assert.match(vendorActions, /requireSignupLegalAccepted\(\s*"vendor"/);
    assert.match(vendorActions, /recordVendorPortalLegalAcceptances/);
    assert.match(vendorService, /if \(!options\?\.legalAccepted\)/);
    assert.match(
      vendorService,
      /Please agree to the Vendor Terms and Privacy Policy/,
    );
  });

  it("venue activate UI + enrollment activate require legalAccepted", () => {
    assert.match(venueActivateForm, /name="legalAccepted"/);
    assert.match(venueActivateForm, /type="checkbox"/);
    assert.doesNotMatch(
      venueActivateForm,
      /type="hidden"[^>]*name="legalAccepted"/,
    );
    assert.match(enrollmentActivate, /isLegalAcceptedValue\(body\.legalAccepted\)/);
    assert.match(enrollmentActivate, /legal_acceptance_required/);
  });

  it("client login does not invent signup consent", () => {
    assert.doesNotMatch(clientLogin, /SignupLegalConsent|legalAccepted/);
  });

  it("approved legal document pages exist for signup link targets", () => {
    for (const path of legalLinks) {
      assert.ok(readFileSync(path, "utf8").length > 0, path);
    }
  });
});
