import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  CLIENT_INVITE_ACCESS_WARNING,
  CLIENT_INVITE_CTA_LABEL,
  buildClientInviteEmail,
  clientInviteAcceptUrl,
  clientInvitePreviewAcceptUrl,
} from "@/lib/client-auth/client-invite-email";
import {
  beginClientInviteSend,
  endClientInviteSend,
} from "@/lib/client-auth/invite-send-lock";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("buildClientInviteEmail — preview uses the same path as send", () => {
  const venue = { name: "Meadowbrook Valley Venue", primaryColor: "#D8A7AA" };

  it("builds subject, CTA, branding, and recipient from the shared builder", () => {
    const content = buildClientInviteEmail({
      to: "client@example.test",
      coupleName: "Alex & Jordan",
      venue,
      acceptUrl: clientInviteAcceptUrl("real-token"),
    });
    assert.equal(content.to, "client@example.test");
    assert.equal(content.subject, "You're invited to your Meadowbrook Valley Venue planning workspace");
    assert.equal(content.ctaLabel, CLIENT_INVITE_CTA_LABEL);
    assert.equal(content.venueName, "Meadowbrook Valley Venue");
    assert.match(content.html, /Create Your Account/);
    assert.match(content.html, /Meadowbrook Valley Venue/);
    assert.match(content.html, /Alex &amp; Jordan|Alex & Jordan/);
    assert.match(content.acceptUrl, /\/client\/accept\?token=real-token/);
    assert.match(content.text, /Create your account to get started/);
  });

  it("preview accept URL is a stand-in that never implies a persisted token", () => {
    assert.equal(clientInvitePreviewAcceptUrl(), clientInviteAcceptUrl("preview"));
    const preview = buildClientInviteEmail({
      to: "client@example.test",
      coupleName: "Alex",
      venue,
      acceptUrl: clientInvitePreviewAcceptUrl(),
    });
    const send = buildClientInviteEmail({
      to: "client@example.test",
      coupleName: "Alex",
      venue,
      acceptUrl: clientInviteAcceptUrl("tok-abc"),
    });
    assert.equal(preview.subject, send.subject);
    assert.equal(preview.ctaLabel, send.ctaLabel);
    assert.equal(preview.html.replace(/token=preview/g, "token=tok-abc"), send.html);
    assert.equal(preview.text.replace(/token=preview/g, "token=tok-abc"), send.text);
  });

  it("exposes the access warning for the confirm step", () => {
    assert.match(CLIENT_INVITE_ACCESS_WARNING, /create or access their account/);
    assert.match(CLIENT_INVITE_ACCESS_WARNING, /Drafts/);
  });
});

describe("beginClientInviteSend — no duplicate concurrent sends", () => {
  it("rejects a second begin until end", () => {
    const key = `test-lock-${Date.now()}`;
    assert.equal(beginClientInviteSend(key), true);
    assert.equal(beginClientInviteSend(key), false);
    endClientInviteSend(key);
    assert.equal(beginClientInviteSend(key), true);
    endClientInviteSend(key);
  });
});

describe("Client invite prepare/preview/confirm seams", () => {
  it("PortalLinkWidget opens preview first; confirm alone calls inviteClientAction", () => {
    const widget = source("components/portal/portal-link-widget.tsx");
    assert.match(widget, /openInvitePreview/);
    assert.match(widget, /previewClientInviteAction/);
    assert.match(widget, /ClientInvitePreviewOverlay/);
    assert.match(widget, /data-testid="open-client-invite-preview"/);
    assert.match(widget, /onClick=\{openInvitePreview\}/);
    assert.doesNotMatch(widget, /onClick=\{handleInvite\}/);
    assert.match(widget, /async function confirmSend/);
    const confirm = widget.slice(widget.indexOf("async function confirmSend"));
    assert.match(confirm, /inviteClientAction\(clientId, email\.trim\(\), coupleName\)/);
    assert.match(widget, /openResendPreview/);
    assert.match(widget, /previewResendClientInviteAction/);
  });

  it("CommunicationsReviewPanel and activation row require confirm before send", () => {
    const panel = source("components/clients/communications-review-panel.tsx");
    assert.match(panel, /openInvitePreview/);
    assert.match(panel, /previewClientInviteAction/);
    assert.match(panel, /ClientInvitePreviewOverlay/);
    assert.match(panel, /confirmSend/);
    const openFn = panel.slice(
      panel.indexOf("async function openInvitePreview"),
      panel.indexOf("function closePreview"),
    );
    assert.doesNotMatch(openFn, /inviteClientAction/);

    const row = source("components/clients/portal-activation-row-actions.tsx");
    assert.match(row, /openInvitePreview/);
    assert.match(row, /openResendPreview/);
    assert.match(row, /ClientInvitePreviewOverlay/);
    assert.doesNotMatch(row, /onClick=\{invite\}/);
    assert.doesNotMatch(row, /onClick=\{resend\}/);
  });

  it("preview overlay warns and only primary action is Send invitation", () => {
    const overlay = source("components/portal/client-invite-preview-overlay.tsx");
    assert.match(overlay, /CLIENT_INVITE_ACCESS_WARNING/);
    assert.match(overlay, /data-testid="client-invite-access-warning"/);
    assert.match(overlay, /data-testid="confirm-send-client-invite"/);
    assert.match(overlay, /Send invitation/);
    assert.match(overlay, /ArtifactReviewOverlay/);
    assert.doesNotMatch(overlay, /inviteClientAction/);
    assert.doesNotMatch(overlay, /sendEmail/);
  });

  it("preview service paths never call sendEmail; send uses the shared builder", () => {
    const service = source("lib/client-auth/service.ts");
    const previewInvite = service.slice(
      service.indexOf("export async function previewClientInviteEmail"),
      service.indexOf("export async function previewResendClientInviteEmail"),
    );
    assert.doesNotMatch(previewInvite, /sendEmail/);
    assert.doesNotMatch(previewInvite, /from\("client_invitations"\)\.insert/);
    assert.match(previewInvite, /buildClientInviteEmail/);
    assert.match(previewInvite, /clientInvitePreviewAcceptUrl/);

    const previewResend = service.slice(
      service.indexOf("export async function previewResendClientInviteEmail"),
      service.indexOf("async function sendClientInviteEmail"),
    );
    assert.doesNotMatch(previewResend, /sendEmail/);
    assert.match(previewResend, /buildClientInviteEmail/);

    const sendFn = service.slice(
      service.indexOf("async function sendClientInviteEmail"),
      service.indexOf("export function shouldSendClientInvitation"),
    );
    assert.match(sendFn, /buildClientInviteEmail/);
    assert.match(sendFn, /sendEmail/);

    const inviteFn = service.slice(
      service.indexOf("export async function inviteClient"),
      service.indexOf("export async function resendClientInvitation"),
    );
    assert.match(inviteFn, /beginClientInviteSend/);
    assert.match(inviteFn, /endClientInviteSend/);

    const actions = source("app/(app)/clients/[id]/portal-actions.ts");
    assert.match(actions, /previewClientInviteAction/);
    assert.match(actions, /previewResendClientInviteAction/);
  });

  it("send inserts an invitation before email and the clients list does not provision questionnaires", () => {
    const service = source("lib/client-auth/service.ts");
    const inviteFn = service.slice(
      service.indexOf("export async function inviteClient"),
      service.indexOf("export async function resendClientInvitation"),
    );
    const insertAt = inviteFn.indexOf('from("client_invitations")');
    const sendAt = inviteFn.lastIndexOf("sendClientInviteEmail(");
    assert.ok(insertAt >= 0 && sendAt > insertAt);
    assert.match(inviteFn, /shouldSendClientInvitation\(existing\)/);
    assert.doesNotMatch(
      inviteFn.slice(0, sendAt),
      /sendEmail/,
    );

    const list = source("app/(app)/clients/page.tsx");
    assert.doesNotMatch(list, /ensureQuestionnaireFamilyForCurrentVenue/);
    const detail = source("app/(app)/clients/[id]/page.tsx");
    assert.match(detail, /ensureQuestionnaireFamilyForCurrentVenue/);
  });
});
