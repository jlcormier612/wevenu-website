/**
 * Rejected / failed Twilio compliance must not auto-retry.
 * Waiting for Brand/Campaign approval may poll; terminal failures must not.
 */

/** Far-future next_attempt_at so claimDueProvisioningVenueIds never reclaims. */
export const TERMINAL_PROVISIONING_RETRY_AT = new Date("2099-01-01T00:00:00.000Z");

const TERMINAL_ERROR_CODES = new Set([
  "FAILED",
  "SUSPENDED",
  "REJECTED",
  "twilio-rejected",
  "noncompliant",
  "brand_rejected",
  "campaign_rejected",
  "secondary_rejected",
  "trust_product_rejected",
  "details_needed",
  "secondary_rejected_only",
]);

export function isTerminalProvisioningErrorCode(
  code: string | null | undefined,
): boolean {
  if (!code?.trim()) return false;
  return TERMINAL_ERROR_CODES.has(code.trim());
}

export function provisioningRetryAt(retryable: boolean, attempt: number): Date {
  if (!retryable) return TERMINAL_PROVISIONING_RETRY_AT;
  const base = Math.min(30 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + base);
}

export type TrustHubBundleSummary = {
  sid: string;
  status: string;
  friendlyName?: string | null;
};

/**
 * Prefer an approved bundle, then one already in Twilio review.
 * If every bundle is rejected, signal stop — do not create another automatically.
 */
export function selectReusableTrustHubBundle(
  bundles: TrustHubBundleSummary[],
):
  | { kind: "reuse"; sid: string; status: string }
  | { kind: "rejected_only"; rejectedSids: string[] }
  | { kind: "none" } {
  const approved = bundles.find((b) => /approved/i.test(b.status));
  if (approved) return { kind: "reuse", sid: approved.sid, status: approved.status };

  const pendingReview = bundles.find((b) =>
    /pending-review|in-review/i.test(b.status)
  );
  if (pendingReview) {
    return { kind: "reuse", sid: pendingReview.sid, status: pendingReview.status };
  }

  const rejected = bundles.filter((b) => /reject/i.test(b.status));
  if (rejected.length > 0) {
    return {
      kind: "rejected_only",
      rejectedSids: rejected.map((b) => b.sid),
    };
  }

  return { kind: "none" };
}
