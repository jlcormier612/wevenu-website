/**
 * Resolve venue Twilio send/webhook context (config + credentials).
 * Fail closed when the venue has no ready subaccount configuration.
 *
 * When test overrides are active (NODE_ENV=test + TWILIO_VENUE_ACCOUNTS_JSON),
 * skips Supabase for config lookup so unit tests do not require admin credentials.
 */
import {
  getVenueTwilioAccountByAccountSid,
  getVenueTwilioAccountByVenueId,
  isVenueTwilioConsentOfferAvailable,
  isVenueTwilioSendReady,
  type VenueTwilioAccount,
} from "@/lib/sms/venue-twilio-config";
import {
  loadVenueTwilioSecret,
  type VenueTwilioSecret,
} from "@/lib/sms/venue-twilio-secrets";
import { twilioVenueTestOverridesAllowed } from "@/lib/sms/venue-twilio-runtime";

export type VenueTwilioSendContext = {
  account: VenueTwilioAccount;
  secret: VenueTwilioSecret;
};

export type VenueTwilioResolveResult =
  | { ok: true; ctx: VenueTwilioSendContext }
  | { ok: false; message: string };

const NOT_READY =
  "Texting isn’t set up yet for your venue. Enable it in Settings → Communications.";

function hasEnvAccountOverride(): boolean {
  return twilioVenueTestOverridesAllowed()
    && !!process.env.TWILIO_VENUE_ACCOUNTS_JSON?.trim();
}

async function adminClientOrNull() {
  if (hasEnvAccountOverride()) return null;
  const { createAdminClient } = await import("@/integrations/supabase/admin");
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export async function resolveVenueTwilioForSend(
  venueId: string,
): Promise<VenueTwilioResolveResult> {
  const supabase = await adminClientOrNull();
  let account: VenueTwilioAccount | null;
  try {
    account = await getVenueTwilioAccountByVenueId(supabase, venueId);
  } catch {
    return { ok: false, message: NOT_READY };
  }
  if (!isVenueTwilioSendReady(account)) {
    return { ok: false, message: NOT_READY };
  }
  try {
    const secret = await loadVenueTwilioSecret(account!.twilioAccountSid);
    return { ok: true, ctx: { account: account!, secret } };
  } catch {
    return { ok: false, message: NOT_READY };
  }
}

export async function resolveVenueTwilioForWebhookAccountSid(
  accountSid: string,
): Promise<VenueTwilioResolveResult> {
  const supabase = await adminClientOrNull();
  let account: VenueTwilioAccount | null;
  try {
    account = await getVenueTwilioAccountByAccountSid(supabase, accountSid);
  } catch {
    return { ok: false, message: "Unknown Twilio account." };
  }
  if (!account) {
    return { ok: false, message: "Unknown Twilio account." };
  }
  try {
    const secret = await loadVenueTwilioSecret(account.twilioAccountSid);
    return { ok: true, ctx: { account, secret } };
  } catch {
    return { ok: false, message: "Twilio credentials unavailable for this account." };
  }
}

export async function isVenueSmsConfigured(venueId: string): Promise<boolean> {
  const resolved = await resolveVenueTwilioForSend(venueId);
  return resolved.ok;
}

/**
 * True when the venue may show the optional SMS consent checkbox / SMS preference.
 * Independent of send-ready: consent can be collected while A2P is pending.
 */
export async function isVenueSmsConsentOfferAvailable(venueId: string): Promise<boolean> {
  if (!venueId?.trim()) return false;
  const supabase = await adminClientOrNull();
  let account: VenueTwilioAccount | null;
  try {
    account = await getVenueTwilioAccountByVenueId(supabase, venueId);
  } catch {
    return false;
  }
  return isVenueTwilioConsentOfferAvailable(account);
}
