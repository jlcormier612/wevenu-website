/**
 * Intercepts the real sendEmail call used by client invitations.
 * Fetch is stubbed, so a pass is not Resend acceptance and not a webhook.
 * transmitClientInvitation is the same function inviteClient calls after insert.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { portalActivationState } from "@/lib/activation/portal-open-milestone";
import { portalPendingDeliveryLabel } from "@/lib/activation/portal-open-milestone";
import {
  buildClientInviteEmail,
  clientInviteAcceptUrl,
} from "@/lib/client-auth/client-invite-email";
import {
  transmitClientInvitation,
  type InvitationDeliveryRow,
} from "@/lib/client-auth/invite-delivery";
import { sendEmail } from "@/lib/email/send";

const ENV_KEYS = ["COMMUNICATION_MODE", "RESEND_API_KEY", "FROM_EMAIL", "NEXT_PUBLIC_APP_URL"] as const;
const snapshot: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) snapshot[key] = process.env[key];

const originalFetch = globalThis.fetch;

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    if (snapshot[key] === undefined) delete env[key];
    else env[key] = snapshot[key];
  }
  globalThis.fetch = originalFetch;
});

const RECIPIENT = "invitee@mail.hellotocheers.test";
const TOKEN = "11111111-1111-4111-8111-111111111111";

function invitationPayload() {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
  return buildClientInviteEmail({
    to: RECIPIENT,
    coupleName: "Invitee Example",
    venue: { name: "Jen's Fancy Venue" },
    acceptUrl: clientInviteAcceptUrl(TOKEN),
  });
}

describe("invitation email through the real sendEmail path", () => {
  it("posts the recipient and accept link and returns the provider id", async () => {
    process.env.COMMUNICATION_MODE = "real";
    process.env.RESEND_API_KEY = "re_test_not_a_secret";
    process.env.FROM_EMAIL = "Hello to Cheers <invites@mail.hellotocheers.test>";
    const content = invitationPayload();
    let posted: { url: string; body: Record<string, unknown> } | null = null;
    globalThis.fetch = async (input, init) => {
      posted = {
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      };
      return new Response(JSON.stringify({ id: "re_intercepted_provider" }), { status: 200 });
    };

    const result = await sendEmail({
      to: content.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    assert.equal(posted?.url, "https://api.resend.com/emails");
    assert.deepEqual(posted?.body.to, [RECIPIENT]);
    assert.match(String(posted?.body.subject), /Jen's Fancy Venue planning workspace/);
    assert.match(String(posted?.body.text), new RegExp(clientInviteAcceptUrl(TOKEN).replace(/[?]/g, "\\?")));
    assert.match(String(posted?.body.html), /token=11111111-1111-4111-8111-111111111111/);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.method, "resend");
      assert.equal(result.providerId, "re_intercepted_provider");
    }
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "pending" }),
      "invited_not_opened",
    );
  });

  it("returns provider failure without throwing", async () => {
    process.env.COMMUNICATION_MODE = "real";
    process.env.RESEND_API_KEY = "re_test_not_a_secret";
    const content = invitationPayload();
    globalThis.fetch = async () => new Response("no", { status: 422 });
    const result = await sendEmail({
      to: content.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    assert.equal(result.ok, false);
  });
});

describe("invitation transmit through intercepted sendEmail", () => {
  it("stores the stubbed provider id and does not call the portal opened", async () => {
    process.env.COMMUNICATION_MODE = "real";
    process.env.RESEND_API_KEY = "re_test_not_a_secret";
    process.env.FROM_EMAIL = "Hello to Cheers <invites@mail.hellotocheers.test>";
    const content = invitationPayload();
    const current: InvitationDeliveryRow = {
      id: "inv-1",
      status: "pending",
      email: RECIPIENT,
      token: TOKEN,
      deliveryStatus: null,
      providerMessageId: null,
    };
    globalThis.fetch = async () => new Response(JSON.stringify({ id: "re_intercepted_provider" }), { status: 200 });
    const result = await transmitClientInvitation({
      row: current,
      mode: "invite",
      sendUnrecorded: true,
      store: {
        async markSending() {
          current.deliveryStatus = "sending";
          return {};
        },
        async saveOutcome(_id, patch) {
          current.deliveryStatus = patch.deliveryStatus;
          current.providerMessageId = patch.providerMessageId;
          return {};
        },
      },
      send: () => sendEmail({
        to: content.to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    });
    assert.deepEqual(result, { ok: true });
    assert.equal(current.status, "pending");
    assert.equal(current.deliveryStatus, "accepted");
    assert.equal(current.providerMessageId, "re_intercepted_provider");
    assert.equal(
      portalActivationState({ lastAccessedAt: null, invitationStatus: "pending" }),
      "invited_not_opened",
    );
    assert.equal(
      portalPendingDeliveryLabel(current.deliveryStatus, current.providerMessageId),
      "Provider accepted — portal not opened",
    );
  });
});
