/**
 * Activate-account password + legal form: enablement, visibility, and submit wiring.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  ACTIVATE_LEGAL_ERROR,
  ACTIVATE_OWNERSHIP_REQUIRED_ERROR,
  ACTIVATE_PASSWORD_LENGTH_ERROR,
  ACTIVATE_PASSWORD_MIN_LENGTH,
  ACTIVATE_PASSWORD_MISMATCH_ERROR,
  activatePasswordInputType,
  activatePasswordToggleLabel,
  canSubmitActivateAccount,
  gateActivateAccountSubmission,
  isActivateLegalAccepted,
  parseActivateAccountFormData,
  validateActivateAccountFields,
} from "./activate-account-form";

const formSrc = readFileSync(
  resolve("workspace/components/activate/activate-account-form.tsx"),
  "utf8",
);
const actionSrc = readFileSync(
  resolve("workspace/app/activate/actions.ts"),
  "utf8",
);

const VALID_PASSWORD = "abcdefgh";

function formDataFrom(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

describe("canSubmitActivateAccount / validateActivateAccountFields", () => {
  it("matching valid password plus accepted Terms/Privacy enables submission", () => {
    const input = {
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: true,
      ownershipChoice: "owner" as const,
    };
    assert.equal(validateActivateAccountFields(input).ok, true);
    assert.equal(canSubmitActivateAccount(input), true);
    assert.equal(VALID_PASSWORD.length >= ACTIVATE_PASSWORD_MIN_LENGTH, true);
  });

  it("mismatched password blocks submission", () => {
    const input = {
      password: VALID_PASSWORD,
      confirm: "abcdefghx",
      legalAccepted: true,
      ownershipChoice: "owner" as const,
    };
    const result = validateActivateAccountFields(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, ACTIVATE_PASSWORD_MISMATCH_ERROR);
    }
    assert.equal(canSubmitActivateAccount(input), false);
  });

  it("too-short password blocks submission", () => {
    const input = {
      password: "short",
      confirm: "short",
      legalAccepted: true,
      ownershipChoice: "owner" as const,
    };
    const result = validateActivateAccountFields(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, ACTIVATE_PASSWORD_LENGTH_ERROR);
    }
    assert.equal(canSubmitActivateAccount(input), false);
  });

  it("unchecked Terms/Privacy blocks submission even with matching valid passwords", () => {
    const input = {
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: false,
      ownershipChoice: "owner" as const,
    };
    const result = validateActivateAccountFields(input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, ACTIVATE_LEGAL_ERROR);
    }
    assert.equal(canSubmitActivateAccount(input), false);
  });

  it("pending blocks submission when fields are otherwise valid", () => {
    assert.equal(
      canSubmitActivateAccount({
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
        legalAccepted: true,
        ownershipChoice: "owner",
        pending: true,
      }),
      false,
    );
  });

  it("on-behalf can continue without an owner yet; incomplete pair is rejected", () => {
    const empty = validateActivateAccountFields({
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: true,
      ownershipChoice: "on_behalf",
    });
    assert.equal(empty.ok, true);
    const incomplete = validateActivateAccountFields({
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: true,
      ownershipChoice: "on_behalf",
      invitedOwnerName: "Pat Owner",
    });
    assert.equal(incomplete.ok, false);
    const ok = validateActivateAccountFields({
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: true,
      ownershipChoice: "on_behalf",
      invitedOwnerName: "Pat Owner",
      invitedOwnerEmail: "pat@example.com",
    });
    assert.equal(ok.ok, true);
  });

  it("missing ownership choice is rejected — does not default to Owner", () => {
    const missing = validateActivateAccountFields({
      password: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
      legalAccepted: true,
      ownershipChoice: "",
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, ACTIVATE_OWNERSHIP_REQUIRED_ERROR);
    }
    const gated = gateActivateAccountSubmission(
      formDataFrom({
        token: "tok_1",
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
        legalAccepted: "true",
      }),
    );
    assert.equal(gated.ok, false);
  });
});

describe("parseActivateAccountFormData", () => {
  it("reads matching passwords and named legal checkbox value true", () => {
    const parsed = parseActivateAccountFormData(
      formDataFrom({
        token: "tok_1",
        email: "owner@example.com",
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
        legalAccepted: "true",
        ownershipChoice: "owner",
      }),
    );
    assert.equal(parsed.token, "tok_1");
    assert.equal(parsed.password, VALID_PASSWORD);
    assert.equal(parsed.confirm, VALID_PASSWORD);
    assert.equal(parsed.legalAccepted, true);
    assert.equal(parsed.ownershipChoice, "owner");
    assert.equal(canSubmitActivateAccount(parsed), true);
  });

  it("treats missing legalAccepted as unchecked", () => {
    const parsed = parseActivateAccountFormData(
      formDataFrom({
        token: "tok_1",
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
      }),
    );
    assert.equal(parsed.legalAccepted, false);
    assert.equal(isActivateLegalAccepted(null), false);
    assert.equal(canSubmitActivateAccount(parsed), false);
  });
});

describe("password visibility toggles", () => {
  it("defaults to masked and reveals independently per field", () => {
    assert.equal(activatePasswordInputType(false), "password");
    assert.equal(activatePasswordInputType(true), "text");
    assert.equal(activatePasswordToggleLabel(false, "password"), "Show password");
    assert.equal(activatePasswordToggleLabel(true, "password"), "Hide password");
    assert.equal(
      activatePasswordToggleLabel(false, "confirm"),
      "Show confirm password",
    );
    assert.equal(
      activatePasswordToggleLabel(true, "confirm"),
      "Hide confirm password",
    );
  });

  it("wires independent show/hide state for both password fields", () => {
    assert.match(formSrc, /const \[showPassword, setShowPassword\] = useState\(false\)/);
    assert.match(formSrc, /const \[showConfirm, setShowConfirm\] = useState\(false\)/);
    assert.match(formSrc, /activatePasswordInputType\(showPassword\)/);
    assert.match(formSrc, /activatePasswordInputType\(showConfirm\)/);
    assert.match(formSrc, /setShowPassword\(\(v\) => !v\)/);
    assert.match(formSrc, /setShowConfirm\(\(v\) => !v\)/);
  });
});

describe("Let's go submit path", () => {
  it("enables Let's go from matching valid passwords plus accepted legal", () => {
    assert.match(formSrc, /canSubmitActivateAccount\(/);
    assert.match(formSrc, /disabled=\{pending \|\| \(hydrated && !canSubmit\)\}/);
    assert.match(formSrc, /name="legalAccepted"/);
    assert.match(formSrc, /value="true"/);
    assert.doesNotMatch(formSrc, /type="hidden"[^>]*name="legalAccepted"/);
    assert.match(formSrc, /type="checkbox"/);
    assert.match(formSrc, /name="ownershipChoice"/);
    assert.match(formSrc, /Yes, I&apos;m an owner/);
    assert.match(formSrc, /No, I&apos;m setting this up for someone else/);
  });

  it("successful submit is wired to activateAccountAction → activateVenueAccount", () => {
    assert.match(formSrc, /import \{ activateAccountAction \}/);
    assert.match(formSrc, /useActionState\(activateAccountAction/);
    assert.match(formSrc, /<form[\s\S]*action=\{action\}/);
    assert.match(actionSrc, /gateActivateAccountSubmission\(formData\)/);
    assert.match(actionSrc, /activateVenueAccount\(\{/);
    assert.match(actionSrc, /purchaserIsOwner/);
  });

  it("successful gated payload is what activateVenueAccount would receive", () => {
    const gated = gateActivateAccountSubmission(
      formDataFrom({
        token: "tok_live",
        email: "owner@example.com",
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
        legalAccepted: "true",
        ownershipChoice: "owner",
      }),
    );
    assert.equal(gated.ok, true);
    if (gated.ok) {
      assert.equal(gated.token, "tok_live");
      assert.equal(gated.password, VALID_PASSWORD);
      assert.equal(gated.purchaserIsOwner, true);
    }
  });

  it("on-behalf gated payload includes invited Owner", () => {
    const gated = gateActivateAccountSubmission(
      formDataFrom({
        token: "tok_live",
        email: "gm@example.com",
        password: VALID_PASSWORD,
        confirm: VALID_PASSWORD,
        legalAccepted: "true",
        ownershipChoice: "on_behalf",
        invitedOwnerName: "Venue Owner",
        invitedOwnerEmail: "owner@example.com",
      }),
    );
    assert.equal(gated.ok, true);
    if (gated.ok) {
      assert.equal(gated.purchaserIsOwner, false);
      assert.equal(gated.invitedOwnerName, "Venue Owner");
      assert.equal(gated.invitedOwnerEmail, "owner@example.com");
    }
  });

  it("invalid gated payload never proceeds to account creation", () => {
    assert.equal(
      gateActivateAccountSubmission(
        formDataFrom({
          token: "tok_live",
          password: VALID_PASSWORD,
          confirm: VALID_PASSWORD,
        }),
      ).ok,
      false,
    );
    assert.equal(
      gateActivateAccountSubmission(
        formDataFrom({
          token: "tok_live",
          password: VALID_PASSWORD,
          confirm: "otherpass",
          legalAccepted: "true",
          ownershipChoice: "owner",
        }),
      ).ok,
      false,
    );
    assert.equal(
      gateActivateAccountSubmission(
        formDataFrom({
          token: "tok_live",
          password: "short",
          confirm: "short",
          legalAccepted: "true",
          ownershipChoice: "owner",
        }),
      ).ok,
      false,
    );
  });

  it("keeps server-side password and legal checks before the account bridge", () => {
    const validateIdx = actionSrc.indexOf("gateActivateAccountSubmission");
    const bridgeIdx = actionSrc.indexOf("activateVenueAccount({");
    assert.ok(validateIdx > 0 && bridgeIdx > validateIdx);
  });
});
