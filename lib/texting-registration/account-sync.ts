/**
 * Map venue_twilio_accounts (ops-provisioned ISV state) onto HTC texting phases
 * for honest venue-facing display. Does not call Twilio APIs and does not
 * invent compliance — ops writes venue_twilio_accounts; the app reflects it.
 */
import type { VenueTwilioAccount } from "@/lib/sms/venue-twilio-config";
import { isVenueTwilioSendReady } from "@/lib/sms/venue-twilio-config";
import type { TextingPhase } from "@/lib/texting-registration/types";

/**
 * Effective phase for status panel / setup UX.
 * Registration row remains the venue-writable source of business details;
 * provider account state overlays when ops has provisioned further.
 */
export function resolveTextingDisplayPhase(
  registrationPhase: TextingPhase,
  account: VenueTwilioAccount | null,
  smsReady: boolean,
): TextingPhase {
  if (smsReady || isVenueTwilioSendReady(account)) {
    return "ready";
  }

  if (!account) {
    return registrationPhase;
  }

  switch (account.status) {
    case "ready":
      // status=ready but missing sender → still setting up number
      return "setting_up_number";
    case "pending_compliance":
    case "provisioning":
      return registrationPhase === "not_started" || registrationPhase === "details_needed"
        ? registrationPhase
        : "under_review";
    case "suspended":
      return "paused";
    case "error":
      return "failed";
    default:
      return registrationPhase;
  }
}
