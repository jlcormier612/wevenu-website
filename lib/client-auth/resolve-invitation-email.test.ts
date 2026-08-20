import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveInvitationAccountEmail } from "@/lib/client-auth/resolve-invitation-email";

describe("resolveInvitationAccountEmail", () => {
  it("uses the invitation email when the form submits an empty email (disabled field)", () => {
    const result = resolveInvitationAccountEmail({
      invitationEmail: "nicole@example.com",
      submittedEmail: "",
    });
    assert.deepEqual(result, { ok: true, email: "nicole@example.com" });
  });

  it("accepts a matching submitted email", () => {
    const result = resolveInvitationAccountEmail({
      invitationEmail: "Nicole@Example.com",
      submittedEmail: " nicole@example.com ",
    });
    assert.deepEqual(result, { ok: true, email: "nicole@example.com" });
  });

  it("rejects a submitted email that does not match the invitation", () => {
    const result = resolveInvitationAccountEmail({
      invitationEmail: "nicole@example.com",
      submittedEmail: "other@example.com",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /email address this invitation was sent to/i);
    }
  });

  it("fails clearly when the invitation itself has no email", () => {
    const result = resolveInvitationAccountEmail({
      invitationEmail: null,
      submittedEmail: "",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /missing an email/i);
    }
  });
});
