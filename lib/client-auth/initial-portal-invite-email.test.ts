import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { initialPortalInviteEmail } from "@/lib/client-auth/initial-portal-invite-email";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("initialPortalInviteEmail", () => {
  it("initializes from the stored primary contact email", () => {
    assert.equal(initialPortalInviteEmail("rebecca@example.com"), "rebecca@example.com");
    assert.equal(initialPortalInviteEmail("  rebecca@example.com  "), "rebecca@example.com");
  });

  it("starts empty when the client has no primary email", () => {
    assert.equal(initialPortalInviteEmail(null), "");
    assert.equal(initialPortalInviteEmail(undefined), "");
    assert.equal(initialPortalInviteEmail(""), "");
    assert.equal(initialPortalInviteEmail("   "), "");
  });

  it("does not invent couple@example.com", () => {
    assert.notEqual(initialPortalInviteEmail(null), "couple@example.com");
    assert.notEqual(initialPortalInviteEmail(""), "couple@example.com");
  });
});

describe("Client Portal invitation field binding", () => {
  const widget = source("components/portal/portal-link-widget.tsx");
  const panel = source("components/events/event-setup-panel.tsx");
  const detail = source("components/events/event-detail.tsx");
  const invite = source("lib/client-auth/service.ts");
  const actions = source("app/(app)/clients/[id]/portal-actions.ts");
  const acceptEmail = source("lib/client-auth/resolve-invitation-email.ts");

  it("seeds the invite field from clients.email via primaryEmail", () => {
    assert.match(widget, /primaryEmail/);
    assert.match(widget, /initialPortalInviteEmail\(primaryEmail\)/);
    assert.match(widget, /onChange=\{\(e\) => setEmail\(e\.target\.value\)\}/);
    assert.doesNotMatch(widget, /couple@example\.com/);
    assert.match(panel, /primaryEmail=\{props\.clientEmail\}/);
    assert.match(detail, /clientEmail=\{coupleEmail\}/);
    const page = source("app/(app)/clients/[id]/page.tsx");
    assert.match(page, /const coupleEmail = client\.email \?\? null/);
  });

  it("sends the edited field value and does not write the client record", () => {
    assert.match(widget, /inviteClientAction\(clientId, email\.trim\(\), coupleName\)/);
    assert.doesNotMatch(widget, /inviteClientAction\(clientId, primaryEmail/);
    assert.match(widget, /if \(!email\.trim\(\)\) \{ toast\.error\("An email address is required to invite the client\."\); return; \}/);
    assert.doesNotMatch(invite, /\.from\("clients"\)/);
    assert.doesNotMatch(actions, /\.from\("clients"\)/);
    assert.doesNotMatch(invite, /updateClientInfo/);
    assert.match(invite, /from\("client_invitations"\)\.insert/);
    assert.match(invite, /email: email\.trim\(\)\.toLowerCase\(\)/);
  });

  it("keeps existing invitation-state UI on invitation.email", () => {
    assert.match(widget, /\{invitation\.email\}/);
    assert.match(widget, /invitation\.status === "accepted"/);
    assert.match(widget, /Invitation sent · awaiting account creation/);
    assert.match(widget, /Account created/);
    assert.match(widget, /Resend invite/);
    assert.doesNotMatch(widget, /setEmail\(invitation/);
    assert.doesNotMatch(widget, /setEmail\(primaryEmail/);
  });

  it("does not change invitation-token account creation", () => {
    assert.match(acceptEmail, /invitation token is authoritative/);
    assert.match(invite, /resolveInvitationAccountEmail/);
  });
});
