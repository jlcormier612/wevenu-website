/**
 * Live self-service texting provider orchestrator.
 * Enqueues idempotent Twilio provisioning; does not claim Under review until
 * compliance is actually submitted (handled by the processor).
 */
import {
  assertVenueAllowedForSelfServiceProvisioning,
  isProtectedTextingVenueId,
} from "@/lib/sms/twilio-protected-resources";
import { isTextingSelfServiceProvisioningEnabled } from "@/lib/texting-provisioning/feature";
import {
  enqueueVenueTextingProvisioning,
  processVenueTextingProvisioning,
} from "@/lib/texting-provisioning/processor";
import {
  getVenueTwilioAccountExtended,
} from "@/lib/texting-provisioning/account-repository";
import type {
  TextingProviderOrchestrator,
  TextingProviderSubmitResult,
  TextingProviderSyncResult,
} from "@/lib/texting-registration/provider-contract";
import { hasTwilioComplianceReviewEvidence } from "@/lib/texting-registration/account-sync";

export class LiveTextingProviderOrchestrator implements TextingProviderOrchestrator {
  async submitRegistration(venueId: string): Promise<TextingProviderSubmitResult> {
    if (!isTextingSelfServiceProvisioningEnabled()) {
      return {
        ok: true,
        accepted: false,
        deferred: true,
        reason:
          "Your information is saved. Hello to Cheers is setting up texting for your venue.",
      };
    }
    if (isProtectedTextingVenueId(venueId)) {
      return {
        ok: false,
        message: "Automated texting setup isn’t available for this venue.",
      };
    }
    try {
      assertVenueAllowedForSelfServiceProvisioning(venueId);
      await enqueueVenueTextingProvisioning(venueId);
      // Kick one pass so infra can start immediately; review phase comes later.
      // explicitResume: true allows Needs attention → corrected details → new submit.
      await processVenueTextingProvisioning(venueId, { explicitResume: true });
      return {
        ok: true,
        accepted: false,
        deferred: true,
        reason:
          "Your information is saved. Hello to Cheers is setting up texting for your venue.",
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error
          ? err.message
          : "We couldn’t start texting setup. Try again, or contact support.",
      };
    }
  }

  async syncRegistration(venueId: string): Promise<TextingProviderSyncResult> {
    if (!isTextingSelfServiceProvisioningEnabled()) {
      return { ok: true };
    }
    if (isProtectedTextingVenueId(venueId)) {
      return { ok: true };
    }
    try {
      await processVenueTextingProvisioning(venueId);
      const account = await getVenueTwilioAccountExtended(venueId);
      if (!account) return { ok: true };

      if (account.status === "ready") {
        return {
          ok: true,
          suggestedPhase: "ready",
          textingNumberE164: account.defaultFromE164,
        };
      }
      if (account.status === "error") {
        return {
          ok: true,
          suggestedPhase: "needs_attention",
          attentionCode: "setup_error",
          attentionMessage:
            account.statusDetail
            ?? "Texting setup needs attention. Update your details and try again, or contact support.",
          attentionFixHint: "Review the highlighted details, then resubmit.",
        };
      }
      if (
        (account.a2pCampaignStatus ?? "").toUpperCase() === "VERIFIED"
        || (account.a2pCampaignStatus ?? "").toUpperCase() === "APPROVED"
      ) {
        if (!account.phoneNumberSid || !account.defaultFromE164) {
          return { ok: true, suggestedPhase: "setting_up_number" };
        }
      }
      if (
        hasTwilioComplianceReviewEvidence({
          complianceSubmittedAt: account.complianceSubmittedAt,
          a2pBrandStatus: account.a2pBrandStatus,
          a2pCampaignStatus: account.a2pCampaignStatus,
          a2pBrandSid: account.a2pBrandSid,
          a2pCampaignSid: account.a2pCampaignSid,
          secondaryProfileSid: account.secondaryProfileSid,
        })
      ) {
        return { ok: true, suggestedPhase: "under_review" };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Sync failed.",
      };
    }
  }
}
