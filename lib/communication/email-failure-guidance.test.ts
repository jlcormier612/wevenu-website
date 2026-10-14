import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import {
  classifyResendBounceGuidance,
  classifyResendHttpFailureGuidance,
  resolveEmailFailureGuidance,
} from "@/lib/communication/email-failure-guidance";
import { translateEmailBounceFailure, translateEmailFailure } from "@/lib/communication/failure-messages";
import { acceptOutboundEmail } from "@/lib/conversations/delivery-result";
import { resolveDeliveryDisplay } from "@/lib/conversations/delivery-display";
import { deliveryRecoveryActions } from "@/lib/conversations/delivery-recovery";
import { classifyResendHttpFailure } from "@/lib/email/resend-failure";

describe("email failure guidance — HTTP mappings", () => {
  it("maps 422 validation_error invalid to → invalid_recipient", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 422,
      bodyText: JSON.stringify({
        statusCode: 422,
        name: "validation_error",
        message: "Invalid `to` field. Please use our testing email address instead of domains like `example.com`.",
      }),
    });
    assert.equal(g.category, "invalid_recipient");
    assert.match(g.explanation, /isn'?t valid|not valid|rejected/i);
    assert.match(g.nextAction, /Verify the email address/i);
    assert.equal(g.retryAppropriate, false);
    assert.ok(g.diagnosticSafe);
    assert.doesNotMatch(g.explanation, /Bearer|api[_-]?key/i);
  });

  it("maps daily_quota_exceeded 429 → quota (not temporary)", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 429,
      bodyText: JSON.stringify({
        statusCode: 429,
        name: "daily_quota_exceeded",
        message: "You have reached your daily email sending quota.",
      }),
    });
    assert.equal(g.category, "quota");
    assert.equal(g.retryAppropriate, false);
    assert.doesNotMatch(g.nextAction, /retried shortly/i);
  });

  it("maps rate_limit_exceeded 429 without quota → rate_limit", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 429,
      bodyText: JSON.stringify({ name: "rate_limit_exceeded", message: "Too many requests" }),
    });
    assert.equal(g.category, "rate_limit");
    assert.equal(g.retryAppropriate, true);
  });

  it("maps 5xx → temporary_provider", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 503,
      bodyText: JSON.stringify({ message: "Service unavailable" }),
    });
    assert.equal(g.category, "temporary_provider");
    assert.equal(g.retryAppropriate, true);
  });

  it("maps unknown 4xx without fabricating bounce/invalid", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 418,
      bodyText: JSON.stringify({ message: "Teapot" }),
    });
    assert.equal(g.category, "unknown");
    assert.match(g.explanation, /could not be determined/i);
    assert.doesNotMatch(g.explanation, /bounce|invalid address/i);
  });
});

describe("email failure guidance — bounce mappings", () => {
  it("maps Permanent bounce from structured fields", () => {
    const g = classifyResendBounceGuidance({
      type: "Permanent",
      subType: "General",
      message: "The email account that you tried to reach does not exist.",
      diagnosticCode: ["smtp; 550 5.1.1 user unknown"],
    });
    assert.equal(g.category, "permanent_bounce");
    assert.match(g.explanation, /does not exist|permanently/i);
    assert.equal(g.retryAppropriate, false);
    assert.ok(g.diagnosticSafe?.includes("550"));
  });

  it("maps Transient bounce from structured fields", () => {
    const g = classifyResendBounceGuidance({
      type: "Transient",
      subType: "General",
      message: "The recipient's email provider sent a general bounce message.",
      diagnosticCode: ["smtp; 550 4.4.7 Message expired"],
    });
    assert.equal(g.category, "temporary_bounce");
    assert.equal(g.retryAppropriate, true);
  });

  it("unknown bounce without type stays unclassified", () => {
    const g = classifyResendBounceGuidance({ message: "" });
    assert.equal(g.category, "unknown");
  });
});

describe("email failure guidance — persistence and display", () => {
  it("preserves legacy Email send failed JSON through resolve", () => {
    const stored =
      'Email send failed: {"statusCode":429,"message":"You have reached your daily email sending quota.","name":"daily_quota_exceeded"}';
    const g = resolveEmailFailureGuidance(stored);
    assert.equal(g.category, "quota");
  });

  it("maps generic provider sentence to unknown without a routine support invite", () => {
    const g = resolveEmailFailureGuidance("Email send failed due to a provider error.");
    assert.equal(g.category, "unknown");
    assert.doesNotMatch(g.nextAction, /contact Hello to Cheers support/i);
    assert.match(g.nextAction, /recipient|try again later/i);
  });

  it("maps Resend hard-bounce prose to permanent_bounce", () => {
    const g = resolveEmailFailureGuidance(
      "The recipient's email provider sent a hard bounce message, but didn't specify the reason for the hard bounce.",
    );
    assert.equal(g.category, "permanent_bounce");
    assert.equal(g.retryAppropriate, false);
  });

  it("maps Resend general bounce prose to temporary_bounce", () => {
    const g = resolveEmailFailureGuidance(
      "The recipient's email provider sent a general bounce message. You might be able to send a message to the same recipient in the future if the issue that caused the message to bounce is resolved.",
    );
    assert.equal(g.category, "temporary_bounce");
    assert.equal(g.retryAppropriate, true);
  });

  it("acceptOutboundEmail does not wipe classified quota messages", () => {
    const accepted = acceptOutboundEmail({
      ok: false,
      message: "The email provider rejected this send because a sending quota was reached. The message was not accepted for delivery.",
      code: "quota",
      retryUnsafe: true,
    });
    assert.equal(accepted.ok, false);
    if (!accepted.ok) {
      assert.match(accepted.message, /quota/i);
      assert.doesNotMatch(accepted.message, /couldn't be delivered/i);
    }
  });

  it("delivery display resolves explanation + next action for email failures", () => {
    const d = resolveDeliveryDisplay({
      status: "failed",
      channel: "email",
      failureReason: "Email send failed due to a provider error.",
      isOutbound: true,
    });
    assert.ok(d);
    assert.equal(d!.label, "Couldn't deliver");
    assert.ok(d!.reason);
    assert.ok(d!.nextAction);
    assert.doesNotMatch(d!.nextAction!, /contact Hello to Cheers support/i);
  });

  it("strips reputation scare language from hard-bounce explanations", () => {
    const g = resolveEmailFailureGuidance(
      "The recipient's email provider sent a hard bounce message, but didn't specify the reason for the hard bounce. We recommend removing the recipient's email address from your mailing list. Sending messages to addresses that produce hard bounces can have a negative impact on your reputation as a sender.",
    );
    assert.equal(g.category, "permanent_bounce");
    assert.doesNotMatch(g.explanation, /reputation/i);
    assert.doesNotMatch(g.explanation, /mailing list/i);
    assert.match(g.nextAction, /Verify the recipient email/i);
  });

  it("preserves delivered / sent / pending semantics", () => {
    assert.equal(
      resolveDeliveryDisplay({ status: "delivered", channel: "email", isOutbound: true })?.label,
      "Delivered",
    );
    assert.equal(
      resolveDeliveryDisplay({ status: "accepted", channel: "email", isOutbound: true })?.label,
      "Sent",
    );
    assert.equal(
      resolveDeliveryDisplay({ status: "sending", channel: "email", isOutbound: true })?.reason,
      null,
    );
  });

  it("hides Retry for quota; allows Retry for temporary bounce", () => {
    const quota = deliveryRecoveryActions({
      channel: "email",
      status: "failed",
      leadId: "l1",
      clientId: null,
      failureReason: "sending quota was reached",
    }).map((a) => a.id);
    assert.ok(!quota.includes("retry"));

    const transient = deliveryRecoveryActions({
      channel: "email",
      status: "failed",
      leadId: "l1",
      clientId: null,
      failureReason: "The recipient's email provider sent a general bounce message. You might be able to send a message to the same recipient in the future",
    }).map((a) => a.id);
    assert.ok(transient.includes("retry"));
  });

  it("redacts emails from diagnostic fragments", () => {
    const g = classifyResendHttpFailureGuidance({
      status: 422,
      bodyText: JSON.stringify({
        name: "validation_error",
        message: "Invalid to field for alice@example.com",
      }),
    });
    assert.ok(g.diagnosticSafe);
    assert.doesNotMatch(g.diagnosticSafe!, /alice@example\.com/);
  });

  it("webhook uses bounce translator; compact badge; detail in timeline popover", () => {
    const reason = translateEmailBounceFailure({
      type: "Transient",
      message: "The recipient's email provider sent a general bounce message.",
    });
    assert.match(reason, /general bounce|temporarily/i);

    const webhook = readFileSync("app/api/messaging/webhook/route.ts", "utf8");
    assert.match(webhook, /translateEmailBounceFailure/);
    assert.doesNotMatch(webhook, /Bounced at \$\{/);

    const badge = readFileSync("components/messaging/message-status-badge.tsx", "utf8");
    assert.doesNotMatch(badge, /message-failure-next-action/);
    assert.doesNotMatch(badge, /message-failure-explanation/);
    assert.doesNotMatch(badge, /sendEmail|sendConversationMessage/);

    const popover = readFileSync("components/messaging/message-timeline-popover.tsx", "utf8");
    assert.match(popover, /message-failure-next-action/);
    assert.match(popover, /message-failure-explanation/);
  });

  it("classifyResendHttpFailure keeps CloudWatch quota/rate codes", () => {
    const q = classifyResendHttpFailure({
      status: 429,
      bodyText: JSON.stringify({ message: "You have reached your daily email quota." }),
    });
    assert.equal(q.code, "quota");
    assert.equal(q.retryUnsafe, true);

    const r = classifyResendHttpFailure({
      status: 429,
      bodyText: JSON.stringify({ name: "rate_limit_exceeded", message: "Too many requests" }),
    });
    assert.equal(r.code, "rate_limit");
  });

  it("translateEmailFailure still maps unstructured invalid to", () => {
    assert.match(translateEmailFailure("422 invalid `to` field"), /isn'?t valid|not valid|rejected/i);
  });

  it("missing failure reason is unknown without routine support invite", () => {
    const g = resolveEmailFailureGuidance(null);
    assert.equal(g.category, "unknown");
    assert.doesNotMatch(g.nextAction, /contact Hello to Cheers support/i);
  });
});
