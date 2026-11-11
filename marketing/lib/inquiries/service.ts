import { randomUUID } from "crypto";

import {
  sendFeedbackConfirmationEmail,
  sendInquiryConfirmationEmail,
} from "@shared/email";
import { findRelationshipByTimelineSourceId } from "@shared/relationships";
import { notifyInquiry } from "@/lib/inquiries/notify";
import { normalizeInquiryIdempotencyKey } from "@/lib/inquiries/spam";
import { storeInquiry } from "@/lib/inquiries/store";
import {
  inquiryLabel,
  type InquiryKind,
  type InquirySubmission,
  type SubmitInquiryInput,
} from "@/lib/inquiries/types";
import { syncInquiryToRelationship } from "@/lib/relationships/bridge";

/**
 * Store + notify for marketing inquiries, then upsert the Relationship Workspace record.
 * Welcome Back requests use kind `welcome_back_request` and label "Welcome Back Request".
 * Optional introductions only — not a purchase gate and not auto-approved.
 *
 * Reliability order (CRM is the durable system of record in Sandbox/Prod):
 * 1. Idempotency short-circuit via timeline meta.sourceId
 * 2. CRM sync (fail closed — visitor can safely retry)
 * 3. Best-effort local JSONL audit (ephemeral on ECS)
 * 4. Ops notify + visitor confirmation (Resend idempotency keyed by inquiry id)
 *
 * Contact Us and unscheduled walkthrough / more-info requests get an automated
 * customer confirmation (not Calendly-scheduled). Marketing /support gets
 * feedback confirmation (same template as product Get Help).
 */
export async function submitInquiry(
  input: SubmitInquiryInput,
): Promise<InquirySubmission> {
  const fields = Object.fromEntries(
    Object.entries(input.fields).map(([key, value]) => [key, value.trim()]),
  );

  const id =
    normalizeInquiryIdempotencyKey(input.idempotencyKey) ?? randomUUID();

  const submission: InquirySubmission = {
    id,
    kind: input.kind,
    label: inquiryLabel(input.kind),
    createdAt: new Date().toISOString(),
    fields,
  };

  const prior = await findPriorInquiryBySourceId(submission);
  if (prior) {
    return { ...submission, replayed: true };
  }

  // Durable write first — do not notify until CRM accepts the inquiry.
  const synced = await syncInquiryToRelationship(submission);
  if (!synced?.relationshipId) {
    throw new Error("Unable to save your message. Please try again.");
  }

  try {
    await storeInquiry(submission);
  } catch (error) {
    // Local JSONL is audit-only / ephemeral on ECS — never fail the visitor.
    console.error("[inquiries] local audit store failed", submission.id, error);
  }

  await notifyInquiry(submission);

  if (synced.relationshipId) {
    const email =
      submission.fields.email?.trim() ||
      submission.fields.businessEmail?.trim() ||
      "";
    if (email && shouldSendInquiryConfirmation(submission)) {
      try {
        const result = await sendInquiryConfirmationEmail({
          relationshipId: synced.relationshipId,
          to: email,
          firstName: submission.fields.firstName || null,
          venueName:
            submission.fields.venue || submission.fields.venueName || null,
          meta: {
            inquiry_id: submission.id,
            inquiry_kind: submission.kind,
          },
        });
        console.info("[inquiries] confirmation email", {
          inquiryId: submission.id,
          relationshipId: synced.relationshipId,
          templateId: result.templateId,
          delivery: result.delivery,
          ok: result.ok,
        });
      } catch (error) {
        console.error(
          "[inquiries] confirmation email failed",
          submission.id,
          error,
        );
      }
    } else if (email && submission.kind === "support") {
      try {
        const result = await sendFeedbackConfirmationEmail({
          relationshipId: synced.relationshipId,
          to: email,
          firstName: submission.fields.firstName || null,
          venueName:
            submission.fields.venue || submission.fields.venueName || null,
          feedbackType: "support",
          meta: {
            inquiry_id: submission.id,
            inquiry_kind: submission.kind,
            source: "marketing_support",
          },
        });
        console.info("[inquiries] support confirmation email", {
          inquiryId: submission.id,
          relationshipId: synced.relationshipId,
          delivery: result.delivery,
          ok: result.ok,
        });
      } catch (error) {
        console.error(
          "[inquiries] support confirmation email failed",
          submission.id,
          error,
        );
      }
    }
  }

  return submission;
}

async function findPriorInquiryBySourceId(
  submission: InquirySubmission,
): Promise<boolean> {
  switch (submission.kind) {
    case "contact": {
      const prior = await findRelationshipByTimelineSourceId(submission.id, [
        "contact_form",
      ]);
      return Boolean(prior);
    }
    case "walkthrough": {
      const prior = await findRelationshipByTimelineSourceId(submission.id, [
        "walkthrough_requested",
        "walkthrough_scheduled",
      ]);
      return Boolean(prior);
    }
    case "newsletter": {
      const prior = await findRelationshipByTimelineSourceId(submission.id, [
        "newsletter_signup",
      ]);
      return Boolean(prior);
    }
    case "support": {
      const prior = await findRelationshipByTimelineSourceId(submission.id, [
        "support_request",
      ]);
      return Boolean(prior);
    }
    case "welcome_back_request": {
      const prior = await findRelationshipByTimelineSourceId(submission.id, [
        "welcome_back_requested",
      ]);
      return Boolean(prior);
    }
    default:
      return false;
  }
}

/**
 * Customer confirmation for more-info / contact-style inquiries only.
 * Skips Calendly-style walkthroughs that include a real scheduled datetime,
 * plus support / newsletter / Welcome Back (support uses feedback_confirmation).
 */
function shouldSendInquiryConfirmation(submission: InquirySubmission): boolean {
  if (submission.kind === "contact") return true;
  if (submission.kind !== "walkthrough") return false;

  const rawWhen =
    submission.fields.scheduledAt?.trim() ||
    submission.fields.preferredDate?.trim() ||
    "";
  if (!rawWhen) return true;
  const parsed = new Date(rawWhen);
  return Number.isNaN(parsed.getTime());
}

export function isInquiryKind(value: string): value is InquiryKind {
  return (
    value === "contact" ||
    value === "walkthrough" ||
    value === "welcome_back_request" ||
    value === "newsletter" ||
    value === "support"
  );
}
