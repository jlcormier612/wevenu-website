/**
 * Internal founder/admin notice when a venue referral is submitted.
 * Never emails the referred prospect.
 *
 * Reuses shared ops notify (INQUIRY_NOTIFY_EMAIL + sendRawEmail idempotency),
 * the same path as subscription / White Glove internal alerts.
 */

import { activationBaseUrl, sendOpsInternalEmail } from "@shared/email";
import type { VenueReferralRecord } from "@shared/pricing";

export const INTERNAL_REFERRAL_NOTICE_META_KEY = "internalFounderNoticeSentAt";

/**
 * Workspace CRM origin for referral review links.
 * Venue-app Sandbox task currently has INQUIRY_NOTIFY_EMAIL but not WORKSPACE_URL;
 * derive the known workspace host from the venue-app public URL when needed.
 */
export function referralWorkspaceBaseUrl(): string {
  const explicit =
    process.env.WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const app = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL ||
    ""
  ).trim();
  if (app.includes("app.sandbox.hellotocheers.com")) {
    return "https://workspace.sandbox.hellotocheers.com";
  }
  if (app.includes("app.hellotocheers.com")) {
    return "https://workspace.hellotocheers.com";
  }
  return activationBaseUrl();
}

export function referralReviewWorkspaceUrl(referralId: string): string {
  const base = referralWorkspaceBaseUrl();
  return `${base}/referrals?referralId=${encodeURIComponent(referralId)}`;
}

export function internalReferralNoticeIdempotencyKey(referralId: string): string {
  return `referral-internal-notice:v1:${referralId}`;
}

export function shouldSendInternalReferralNotice(
  referral: Pick<VenueReferralRecord, "status" | "metadata">,
): { ok: true } | { ok: false; reason: string } {
  if (referral.status === "closed_duplicate") {
    return { ok: false, reason: "closed_duplicate" };
  }
  const sentAt = referral.metadata?.[INTERNAL_REFERRAL_NOTICE_META_KEY];
  if (typeof sentAt === "string" && sentAt.trim()) {
    return { ok: false, reason: "already_notified" };
  }
  return { ok: true };
}

export function buildInternalReferralNoticeText(input: {
  referringVenueName: string;
  referredVenueName: string;
  submittedAt: string;
  reviewUrl: string;
  status: string;
}): string {
  return [
    "A new Refer a Venue submission is ready for review.",
    "",
    `Referring venue: ${input.referringVenueName}`,
    `Referred venue: ${input.referredVenueName}`,
    `Submitted: ${input.submittedAt}`,
    `Workflow status: ${input.status}`,
    "",
    `Review: ${input.reviewUrl}`,
    "",
    "Do not contact the referred venue from this notice — follow your normal founder review process.",
    "",
    "— Hello to Cheers",
  ].join("\n");
}

export type InternalReferralNoticeResult =
  | {
      sent: true;
      delivery: "sent" | "simulated" | "skipped";
      to: string | null;
      reviewUrl: string;
      idempotencyKey: string;
    }
  | {
      sent: false;
      reason: string;
      to?: string | null;
      reviewUrl?: string;
      idempotencyKey?: string;
    };

/**
 * Notify the configured ops inbox about a new referral submission.
 * Callers must persist INTERNAL_REFERRAL_NOTICE_META_KEY after sent:true
 * (including delivery:"skipped" when the inbox env is unset — still mark so
 * we do not retry-spam logs). Provider idempotencyKey covers Resend retries.
 */
export async function notifyInternalReferralSubmitted(input: {
  referral: VenueReferralRecord;
  referringVenueName: string;
  sendOps?: typeof sendOpsInternalEmail;
}): Promise<InternalReferralNoticeResult> {
  const gate = shouldSendInternalReferralNotice(input.referral);
  if (!gate.ok) {
    return { sent: false, reason: gate.reason };
  }

  const reviewUrl = referralReviewWorkspaceUrl(input.referral.id);
  const idempotencyKey = internalReferralNoticeIdempotencyKey(input.referral.id);
  const referringVenueName =
    input.referringVenueName.trim() || "Unknown venue";
  const text = buildInternalReferralNoticeText({
    referringVenueName,
    referredVenueName: input.referral.referredVenueName,
    submittedAt: input.referral.createdAt,
    reviewUrl,
    status: input.referral.status,
  });
  const subject = `New referral: ${input.referral.referredVenueName} (via ${referringVenueName})`;
  const send = input.sendOps ?? sendOpsInternalEmail;

  const result = await send({
    subject,
    text,
    idempotencyKey,
    tags: [
      { name: "template", value: "referral_internal_notice" },
      { name: "referral_id", value: input.referral.id.slice(0, 48) },
    ],
  });

  if (!result.ok) {
    return {
      sent: false,
      reason: "send_failed",
      to: result.to ?? null,
      reviewUrl,
      idempotencyKey,
    };
  }

  return {
    sent: true,
    delivery: result.delivery,
    to: result.to ?? null,
    reviewUrl,
    idempotencyKey,
  };
}
