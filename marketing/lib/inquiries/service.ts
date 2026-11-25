import { randomUUID } from "crypto";

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
 * 4. Ops notify only (internal; not a visitor business acknowledgment)
 *
 * Visitor-facing business acknowledgments are owned by CRM Program 3
 * (templates / automatic responses / sequences / workflows). Marketing must not
 * send an independent hardcoded confirmation when CRM rules are absent or disabled.
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
    ...(input.acquisitionAttribution
      ? { acquisitionAttribution: input.acquisitionAttribution }
      : {}),
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

  return {
    ...submission,
    ...(synced.handoffToken ? { handoffToken: synced.handoffToken } : {}),
  };
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

export function isInquiryKind(value: string): value is InquiryKind {
  return (
    value === "contact" ||
    value === "walkthrough" ||
    value === "welcome_back_request" ||
    value === "newsletter" ||
    value === "support"
  );
}
