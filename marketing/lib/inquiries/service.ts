import { randomUUID } from "crypto";

import { notifyInquiry } from "@/lib/inquiries/notify";
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
 */
export async function submitInquiry(
  input: SubmitInquiryInput,
): Promise<InquirySubmission> {
  const fields = Object.fromEntries(
    Object.entries(input.fields).map(([key, value]) => [key, value.trim()]),
  );

  const submission: InquirySubmission = {
    id: randomUUID(),
    kind: input.kind,
    label: inquiryLabel(input.kind),
    createdAt: new Date().toISOString(),
    fields,
  };

  await storeInquiry(submission);
  await notifyInquiry(submission);
  await syncInquiryToRelationship(submission);
  return submission;
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
