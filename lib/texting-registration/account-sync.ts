/**
 * Honest venue-facing phase derivation for texting self-service.
 *
 * pending_compliance alone is NEVER "Under review".
 * Under review requires compliance_submitted_at or an in-review Brand/Campaign/Secondary.
 */
import type { VenueTwilioAccount } from "@/lib/sms/venue-twilio-config";
import { isVenueTwilioSendReady } from "@/lib/sms/venue-twilio-config";
import type { TextingPhase } from "@/lib/texting-registration/types";

export type ComplianceEvidence = {
  complianceSubmittedAt?: string | null;
  a2pBrandStatus?: string | null;
  a2pCampaignStatus?: string | null;
  secondaryProfileSid?: string | null;
  a2pBrandSid?: string | null;
  a2pCampaignSid?: string | null;
  phoneNumberSid?: string | null;
  defaultFromE164?: string | null;
  phoneA2pStatus?: string | null;
};

const IN_REVIEW_BRAND = new Set([
  "PENDING",
  "IN_REVIEW",
  "IN_PROGRESS",
  "DRAFT",
]);

const IN_REVIEW_CAMPAIGN = new Set([
  "PENDING",
  "IN_PROGRESS",
  "IN_REVIEW",
  "SUBMITTED",
]);

const FAILED_BRAND = new Set(["FAILED", "SUSPENDED"]);
const FAILED_CAMPAIGN = new Set(["FAILED", "REJECTED"]);

export function hasTwilioComplianceReviewEvidence(
  evidence: ComplianceEvidence | null | undefined,
): boolean {
  if (!evidence) return false;
  if (evidence.complianceSubmittedAt) return true;
  const brand = (evidence.a2pBrandStatus ?? "").toUpperCase();
  const campaign = (evidence.a2pCampaignStatus ?? "").toUpperCase();
  if (brand && (IN_REVIEW_BRAND.has(brand) || brand === "APPROVED")) return true;
  if (campaign && (IN_REVIEW_CAMPAIGN.has(campaign) || campaign === "VERIFIED")) {
    return true;
  }
  // Submitted Brand/Campaign SIDs without terminal failure count as review evidence.
  if (evidence.a2pBrandSid && !FAILED_BRAND.has(brand)) return true;
  if (evidence.a2pCampaignSid && !FAILED_CAMPAIGN.has(campaign)) return true;
  return false;
}

export function resolveTextingDisplayPhase(
  registrationPhase: TextingPhase,
  account: VenueTwilioAccount | null,
  smsReady: boolean,
  evidence?: ComplianceEvidence | null,
): TextingPhase {
  if (smsReady || isVenueTwilioSendReady(account)) {
    return "ready";
  }

  const merged: ComplianceEvidence = {
    complianceSubmittedAt: evidence?.complianceSubmittedAt ?? null,
    a2pBrandStatus: evidence?.a2pBrandStatus ?? null,
    a2pCampaignStatus: evidence?.a2pCampaignStatus ?? null,
    secondaryProfileSid:
      evidence?.secondaryProfileSid ?? account?.secondaryProfileSid ?? null,
    a2pBrandSid: evidence?.a2pBrandSid ?? account?.a2pBrandSid ?? null,
    a2pCampaignSid: evidence?.a2pCampaignSid ?? account?.a2pCampaignSid ?? null,
    phoneNumberSid: evidence?.phoneNumberSid ?? account?.phoneNumberSid ?? null,
    defaultFromE164: evidence?.defaultFromE164 ?? account?.defaultFromE164 ?? null,
    phoneA2pStatus: evidence?.phoneA2pStatus ?? null,
  };

  const brand = (merged.a2pBrandStatus ?? "").toUpperCase();
  const campaign = (merged.a2pCampaignStatus ?? "").toUpperCase();

  if (FAILED_BRAND.has(brand) || FAILED_CAMPAIGN.has(campaign)) {
    return registrationPhase === "needs_attention" || registrationPhase === "failed"
      ? registrationPhase
      : "needs_attention";
  }

  if (!account) {
    return registrationPhase;
  }

  switch (account.status) {
    case "ready":
      return "setting_up_number";
    case "suspended":
      return "paused";
    case "error":
      return "failed";
    case "provisioning":
      // Infra only — never claim Twilio review.
      if (
        registrationPhase === "not_started"
        || registrationPhase === "details_needed"
      ) {
        return registrationPhase;
      }
      return "information_saved";
    case "pending_compliance": {
      if (
        registrationPhase === "not_started"
        || registrationPhase === "details_needed"
      ) {
        return registrationPhase;
      }
      // Campaign verified / approved → phone phase
      if (campaign === "VERIFIED" || campaign === "APPROVED") {
        if (!merged.phoneNumberSid || !merged.defaultFromE164) {
          return "setting_up_number";
        }
        const phoneStatus = (merged.phoneA2pStatus ?? "").toUpperCase();
        if (phoneStatus && phoneStatus !== "REGISTERED" && phoneStatus !== "SUCCESS") {
          return "setting_up_number";
        }
        return "setting_up_number";
      }
      if (hasTwilioComplianceReviewEvidence(merged)) {
        return "under_review";
      }
      // Details saved / infra running, but nothing submitted to Twilio yet.
      return registrationPhase === "information_saved"
        || registrationPhase === "under_review"
        ? "information_saved"
        : registrationPhase;
    }
    default:
      return registrationPhase;
  }
}
