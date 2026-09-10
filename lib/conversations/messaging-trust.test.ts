/**
 * Messaging Trust — delivery display, recovery, permissions, lifecycle, jargon.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  claimsSuccessfulDelivery,
  deliveryDisplayIsHonest,
  resolveDeliveryDisplay,
} from "@/lib/conversations/delivery-display";
import { deliveryRecoveryActions } from "@/lib/conversations/delivery-recovery";
import {
  MESSAGE_STATUS_META,
  channelSupportsReadState,
  isDeliveryFailureStatus,
} from "@/lib/communication/status-labels";
import { shouldAdvanceStatus } from "@/lib/communication/status";
import { translateSmsFailure } from "@/lib/communication/failure-messages";
import {
  SMS_ALLOWS_NOT_OPTED_IN,
  emailPermissionStatusLabel,
  isHardBlocked,
  isSmsOutboundAllowed,
  smsPermissionStatusLabel,
} from "@/lib/communication/permissions";
import { canConfigureVenueTexting } from "@/lib/texting-registration/authority";
import {
  buildTextingStatusPanel,
  impliesProviderRegistrationPending,
} from "@/lib/texting-registration/status-panel";
import { phaseAfterProviderSubmit } from "@/lib/texting-registration/lifecycle";
import { INFORMATION_SAVED_STATUS_COPY } from "@/lib/texting-registration/types";
import { validateAttachmentsForChannel } from "@/lib/conversations/attachment-constraints";

describe("delivery state rendering", () => {
  it("renders sent / delivered / failed / undelivered labels", () => {
    assert.equal(MESSAGE_STATUS_META.accepted.label, "Sent");
    assert.equal(MESSAGE_STATUS_META.delivered.label, "Delivered");
    assert.equal(MESSAGE_STATUS_META.failed.label, "Couldn't deliver");
    assert.equal(MESSAGE_STATUS_META.undelivered.label, "Not delivered");
  });

  it("shows Read/opened only for email", () => {
    assert.equal(channelSupportsReadState("email"), true);
    assert.equal(channelSupportsReadState("sms"), false);
    const smsOpened = resolveDeliveryDisplay({
      status: "opened",
      channel: "sms",
      isOutbound: true,
    });
    assert.equal(smsOpened, null);
    const emailOpened = resolveDeliveryDisplay({
      status: "opened",
      channel: "email",
      isOutbound: true,
    });
    assert.ok(emailOpened);
    assert.equal(emailOpened.label, "Opened");
  });

  it("never claims successful delivery for failed/undelivered", () => {
    assert.equal(isDeliveryFailureStatus("failed"), true);
    assert.equal(isDeliveryFailureStatus("undelivered"), true);
    assert.equal(claimsSuccessfulDelivery("failed"), false);
    assert.equal(claimsSuccessfulDelivery("undelivered"), false);
    assert.equal(deliveryDisplayIsHonest("failed"), true);
    assert.equal(deliveryDisplayIsHonest("undelivered"), true);
    assert.equal(deliveryDisplayIsHonest("delivered"), true);
  });

  it("surfaces human-readable failure reason without raw provider codes by default", () => {
    const display = resolveDeliveryDisplay({
      status: "failed",
      channel: "sms",
      failureReason: "This phone number cannot receive text messages.",
      isOutbound: true,
    });
    assert.ok(display);
    assert.equal(display.reason, "This phone number cannot receive text messages.");
    assert.doesNotMatch(display.reason ?? "", /\b21614\b|Twilio/i);

    const translated = translateSmsFailure("21614 The 'To' phone number is not currently reachable via SMS.");
    assert.equal(translated, "This phone number cannot receive text messages.");
    assert.doesNotMatch(translated, /21614|Twilio/i);
  });
});

describe("delivery recovery actions", () => {
  it("shows supported actions for SMS failure", () => {
    const actions = deliveryRecoveryActions({
      channel: "sms",
      status: "failed",
      leadId: "lead-1",
      clientId: null,
    }).map((a) => a.id);
    assert.deepEqual(actions, ["retry", "use_email", "open_client", "follow_up"]);
  });

  it("shows Use text for email failure with client", () => {
    const actions = deliveryRecoveryActions({
      channel: "email",
      status: "undelivered",
      leadId: null,
      clientId: "client-1",
    }).map((a) => a.id);
    assert.deepEqual(actions, ["retry", "use_sms", "open_client"]);
  });

  it("hides recovery when delivery succeeded", () => {
    assert.deepEqual(
      deliveryRecoveryActions({
        channel: "sms",
        status: "delivered",
        leadId: "lead-1",
        clientId: null,
      }),
      [],
    );
  });
});

describe("SMS permissions (locked release rule)", () => {
  it("allows not_opted_in and opted_in; blocks opted_out", () => {
    assert.equal(SMS_ALLOWS_NOT_OPTED_IN, true);
    assert.equal(isSmsOutboundAllowed("not_opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_in"), true);
    assert.equal(isSmsOutboundAllowed("opted_out"), false);
    assert.equal(isHardBlocked("opted_out"), true);
  });

  it("surfaces clear venue-facing permission labels", () => {
    assert.match(smsPermissionStatusLabel("not_opted_in"), /hasn.?t been collected/i);
    assert.match(smsPermissionStatusLabel("opted_out"), /opted out/i);
    assert.match(smsPermissionStatusLabel("opted_in"), /ready/i);
  });
});

describe("email suppression copy", () => {
  it("explains unsubscribed and bounce without provider jargon", () => {
    assert.match(emailPermissionStatusLabel("opted_out"), /unsubscribed/i);
    assert.match(emailPermissionStatusLabel("provider_blocked"), /bounced/i);
    assert.doesNotMatch(emailPermissionStatusLabel("opted_out"), /Twilio|Resend|webhook/i);
  });
});

describe("texting lifecycle honesty", () => {
  it("deferred submit stays information_saved — not provider under_review", () => {
    assert.equal(
      phaseAfterProviderSubmit({
        ok: true,
        accepted: false,
        deferred: true,
        reason: "Your information is saved. Hello to Cheers is setting up texting for your venue.",
      }),
      "information_saved",
    );
    assert.equal(
      phaseAfterProviderSubmit({ ok: true, accepted: true }),
      "under_review",
    );
    assert.ok(!impliesProviderRegistrationPending(INFORMATION_SAVED_STATUS_COPY));
  });

  it("information_saved panel does not claim provider review", () => {
    const panel = buildTextingStatusPanel({
      registration: null,
      phase: "information_saved",
      smsReady: false,
      textingNumberE164: null,
    });
    assert.equal(panel.messagingRegistration.label, "Saved");
    assert.ok(panel.attention?.message);
    assert.ok(!impliesProviderRegistrationPending(panel.attention!.message));
    assert.ok(!impliesProviderRegistrationPending(panel.messagingRegistration.label));
  });
});

describe("texting setup role gate", () => {
  it("only owner/manager may configure", () => {
    assert.equal(canConfigureVenueTexting("owner"), true);
    assert.equal(canConfigureVenueTexting("manager"), true);
    assert.equal(canConfigureVenueTexting("coordinator"), false);
    assert.equal(canConfigureVenueTexting("staff"), false);
    assert.equal(canConfigureVenueTexting(null), false);
  });
});

describe("status advancement", () => {
  it("records undelivered after accepted and never un-fails", () => {
    assert.equal(shouldAdvanceStatus("accepted", "undelivered"), true);
    assert.equal(shouldAdvanceStatus("undelivered", "delivered"), false);
    assert.equal(shouldAdvanceStatus("failed", "delivered"), false);
  });
});

describe("attachments stay Documents-compatible; no Twilio in customer copy", () => {
  it("rejects oversized SMS media without Twilio jargon", () => {
    const result = validateAttachmentsForChannel("sms", [
      { name: "big.jpg", size: 6 * 1024 * 1024, mimeType: "image/jpeg" },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /5 MB|text\/MMS/i);
      assert.doesNotMatch(result.message, /Twilio/i);
    }
  });
});

describe("customer-facing provider terminology", () => {
  it("Inbox / Messaging / Settings surfaces do not contain Twilio", () => {
    const roots = [
      "components/conversations/conversation-compose.tsx",
      "components/conversations/conversation-thread.tsx",
      "components/settings/text-messaging-setup-section.tsx",
      "components/messaging/message-status-badge.tsx",
      "app/(app)/messaging/health/page.tsx",
      "app/(app)/settings/communications/page.tsx",
      "lib/conversations/attachment-constraints.ts",
    ];
    for (const rel of roots) {
      const text = readFileSync(path.join(process.cwd(), rel), "utf8");
      assert.doesNotMatch(text, /Twilio/i, `${rel} must not mention Twilio`);
    }
  });
});
