/**
 * Relationship-aware product email — single send path for marketing + workspace.
 *
 * Always appends timeline `email_sent` + outbound communication when a
 * relationshipId is provided (even in dry-run / simulated mode).
 */

import {
  appendCommunication,
  appendTimelineEvent,
  loadLiveStore,
} from "../relationships";
import {
  buildRelationshipReplyTo,
  isResendConfigured,
  sendRawEmail,
} from "./client";
import { renderEmailTemplate } from "./templates/registry";
import type {
  EmailTemplateId,
  EmailTemplateVars,
  RelationshipEmailResult,
  RenderedEmail,
} from "./types";

export type SendRelationshipEmailInput = {
  /** Required for timeline + communication append. */
  relationshipId: string;
  to: string;
  templateId: EmailTemplateId;
  vars?: EmailTemplateVars;
  /** Optional overrides (e.g. Luv-edited subject/body). */
  subject?: string;
  text?: string;
  html?: string;
  timelineTitle?: string;
  actorId?: string;
  authorName?: string;
  replyTo?: string;
  /** Extra timeline meta merged with delivery flags. */
  meta?: Record<string, string | number | boolean | null>;
  /**
   * When false, skip timeline/comms (rare — prefer always logging).
   * Default true.
   */
  recordOnTimeline?: boolean;
};

function applyOverrides(
  rendered: RenderedEmail,
  input: SendRelationshipEmailInput,
): RenderedEmail {
  const subject = input.subject?.trim() || rendered.subject;
  const text = input.text?.trim() || rendered.text;
  const html = input.html?.trim() || rendered.html;
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);
  const timelineTitle =
    input.timelineTitle?.trim() ||
    (input.subject?.trim() ? `Email Sent — ${subject}` : rendered.timelineTitle);
  return {
    subject,
    text,
    html,
    preview: preview || rendered.preview,
    timelineTitle,
  };
}

export async function sendRelationshipEmail(
  input: SendRelationshipEmailInput,
): Promise<RelationshipEmailResult> {
  const to = input.to.trim();
  if (!to) {
    return {
      ok: false,
      delivery: "failed",
      templateId: input.templateId,
      subject: "",
      preview: "",
      message: "Missing recipient email",
    };
  }

  const rendered = applyOverrides(
    renderEmailTemplate(input.templateId, input.vars ?? {}),
    input,
  );

  // Prefer relationship+{id}@inbound-domain for reliable inbound matching.
  const replyTo =
    input.replyTo?.trim() ||
    buildRelationshipReplyTo(input.relationshipId) ||
    undefined;

  const sendResult = await sendRawEmail({
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    replyTo,
    tags: [
      { name: "template", value: input.templateId },
      { name: "relationship", value: input.relationshipId.slice(0, 48) },
    ],
  });

  const delivery = sendResult.ok
    ? sendResult.delivery === "sent"
      ? "sent"
      : "simulated"
    : "failed";

  const simulated = delivery !== "sent";
  let timelineEventId: string | undefined;
  let communicationId: string | undefined;

  if (input.recordOnTimeline !== false) {
    const now = new Date().toISOString();
    const store = await loadLiveStore();
    const exists = store.relationships.some((r) => r.id === input.relationshipId);

    if (exists) {
      try {
        const comm = await appendCommunication(input.relationshipId, {
          channel: "email",
          subject: rendered.subject,
          body: rendered.text,
          direction: "outbound",
          occurredAt: now,
          actorId: input.actorId,
          authorName: input.authorName ?? "Hello to Cheers",
        });
        communicationId = comm?.id;

        const event = await appendTimelineEvent(input.relationshipId, {
          type: "email_sent",
          title: rendered.timelineTitle,
          body: rendered.preview,
          occurredAt: now,
          actorId: input.actorId,
          meta: {
            template_id: input.templateId,
            delivery,
            simulated,
            provider_id: sendResult.ok ? (sendResult.providerId ?? null) : null,
            to,
            resend_configured: isResendConfigured(),
            ...(input.meta ?? {}),
          },
        });
        timelineEventId = event?.id;
      } catch (error) {
        console.error(
          "[email] failed to append timeline/communication",
          input.relationshipId,
          error,
        );
      }
    } else {
      console.warn(
        "[email] relationship not in live store; send completed without timeline",
        input.relationshipId,
      );
    }
  }

  if (!sendResult.ok) {
    return {
      ok: false,
      delivery: "failed",
      templateId: input.templateId,
      subject: rendered.subject,
      preview: rendered.preview,
      message: sendResult.message,
      timelineEventId,
      communicationId,
    };
  }

  return {
    ok: true,
    delivery,
    templateId: input.templateId,
    subject: rendered.subject,
    preview: rendered.preview,
    providerId: sendResult.providerId,
    timelineEventId,
    communicationId,
  };
}

/**
 * Auto-reply after Contact Us / Request more information / unscheduled walkthrough
 * inquiry forms. Not used for Calendly-scheduled confirmation.
 */
export async function sendInquiryConfirmationEmail(input: {
  relationshipId: string;
  to: string;
  firstName?: string | null;
  venueName?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<RelationshipEmailResult> {
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to: input.to,
    templateId: "inquiry_confirmation",
    vars: {
      firstName: input.firstName,
      venueName: input.venueName,
    },
    meta: {
      trigger: "inquiry.submit",
      ...(input.meta ?? {}),
    },
  });
}

function feedbackKindLabel(raw?: string | null): string {
  switch ((raw || "").trim().toLowerCase()) {
    case "support":
      return "support request";
    case "bug":
      return "bug report";
    case "feature":
      return "idea";
    case "nps":
      return "rating feedback";
    case "general":
      return "feedback";
    default:
      return "feedback";
  }
}

/**
 * Auto-ack after product Get Help / bug / idea / NPS or marketing /support.
 * Dry-runs without RESEND_API_KEY; still writes timeline.
 */
export async function sendFeedbackConfirmationEmail(input: {
  relationshipId: string;
  to: string;
  firstName?: string | null;
  venueName?: string | null;
  feedbackType?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<RelationshipEmailResult> {
  const kind = feedbackKindLabel(input.feedbackType);
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to: input.to,
    templateId: "feedback_confirmation",
    vars: {
      firstName: input.firstName,
      venueName: input.venueName,
      feedbackKindLabel: kind,
    },
    meta: {
      trigger: "feedback.submit",
      feedback_type: input.feedbackType ?? null,
      ...(input.meta ?? {}),
    },
  });
}

/**
 * Hook point: trial reminder (template ready; call when trial product is live).
 */
export async function sendTrialReminder(input: {
  relationshipId: string;
  to: string;
  vars?: EmailTemplateVars;
}): Promise<RelationshipEmailResult> {
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to: input.to,
    templateId: "trial_reminder",
    vars: input.vars,
    meta: { hook: "trial_reminder" },
  });
}

/**
 * Hook point: renewal reminder (template ready; wire from renewal workflows later).
 */
export async function sendRenewalReminder(input: {
  relationshipId: string;
  to: string;
  vars?: EmailTemplateVars;
}): Promise<RelationshipEmailResult> {
  return sendRelationshipEmail({
    relationshipId: input.relationshipId,
    to: input.to,
    templateId: "renewal_reminder",
    vars: input.vars,
    meta: { hook: "renewal_reminder" },
  });
}
