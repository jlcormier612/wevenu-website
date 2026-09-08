/**
 * Non-secret per-venue Twilio configuration (ISV subaccount model).
 * Credentials are never stored here — see venue-twilio-secrets.ts.
 *
 * TWILIO_VENUE_ACCOUNTS_JSON is test-only (NODE_ENV=test). Production and ECS
 * sandbox always load from venue_twilio_accounts.
 */
import { twilioVenueTestOverridesAllowed } from "@/lib/sms/venue-twilio-runtime";
export type VenueTwilioAccountStatus =
  | "provisioning"
  | "pending_compliance"
  | "ready"
  | "suspended"
  | "error";

export type VenueTwilioAccount = {
  venueId: string;
  twilioAccountSid: string;
  messagingServiceSid: string;
  defaultFromE164: string | null;
  phoneNumberSid: string | null;
  secondaryProfileSid: string | null;
  a2pBrandSid: string | null;
  a2pCampaignSid: string | null;
  status: VenueTwilioAccountStatus;
  statusDetail: string | null;
};

type Row = {
  venue_id: string;
  twilio_account_sid: string;
  messaging_service_sid: string;
  default_from_e164: string | null;
  phone_number_sid: string | null;
  secondary_profile_sid: string | null;
  a2p_brand_sid: string | null;
  a2p_campaign_sid: string | null;
  status: VenueTwilioAccountStatus;
  status_detail: string | null;
};

function mapRow(row: Row): VenueTwilioAccount {
  return {
    venueId: row.venue_id,
    twilioAccountSid: row.twilio_account_sid,
    messagingServiceSid: row.messaging_service_sid,
    defaultFromE164: row.default_from_e164,
    phoneNumberSid: row.phone_number_sid,
    secondaryProfileSid: row.secondary_profile_sid,
    a2pBrandSid: row.a2p_brand_sid,
    a2pCampaignSid: row.a2p_campaign_sid,
    status: row.status,
    statusDetail: row.status_detail,
  };
}

function mapLoose(entry: Record<string, unknown>): VenueTwilioAccount | null {
  const venueId = String(entry.venue_id ?? entry.venueId ?? "").trim();
  const twilioAccountSid = String(entry.twilio_account_sid ?? entry.twilioAccountSid ?? "").trim();
  const messagingServiceSid = String(entry.messaging_service_sid ?? entry.messagingServiceSid ?? "").trim();
  const status = String(entry.status ?? "ready").trim() as VenueTwilioAccountStatus;
  if (!venueId || !twilioAccountSid || !messagingServiceSid) return null;
  return {
    venueId,
    twilioAccountSid,
    messagingServiceSid,
    defaultFromE164: (entry.default_from_e164 ?? entry.defaultFromE164 ?? null) as string | null,
    phoneNumberSid: (entry.phone_number_sid ?? entry.phoneNumberSid ?? null) as string | null,
    secondaryProfileSid: (entry.secondary_profile_sid ?? entry.secondaryProfileSid ?? null) as string | null,
    a2pBrandSid: (entry.a2p_brand_sid ?? entry.a2pBrandSid ?? null) as string | null,
    a2pCampaignSid: (entry.a2p_campaign_sid ?? entry.a2pCampaignSid ?? null) as string | null,
    status,
    statusDetail: (entry.status_detail ?? entry.statusDetail ?? null) as string | null,
  };
}

/** Test-only override — array or map of venue Twilio account rows. */
function fromEnvAccounts(): VenueTwilioAccount[] {
  if (!twilioVenueTestOverridesAllowed()) return [];
  const raw = process.env.TWILIO_VENUE_ACCOUNTS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((e) => (e && typeof e === "object" ? mapLoose(e as Record<string, unknown>) : null))
        .filter((a): a is VenueTwilioAccount => !!a);
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => {
        if (!value || typeof value !== "object") return [];
        const loose = mapLoose({
          ...(value as Record<string, unknown>),
          venue_id: (value as Record<string, unknown>).venue_id
            ?? (value as Record<string, unknown>).venueId
            ?? key,
        });
        return loose ? [loose] : [];
      });
    }
  } catch {
    return [];
  }
  return [];
}

const SELECT_COLS =
  "venue_id, twilio_account_sid, messaging_service_sid, default_from_e164, phone_number_sid, secondary_profile_sid, a2p_brand_sid, a2p_campaign_sid, status, status_detail";

export async function getVenueTwilioAccountByVenueId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  venueId: string,
): Promise<VenueTwilioAccount | null> {
  const fromEnv = fromEnvAccounts().find((a) => a.venueId === venueId);
  if (fromEnv) return fromEnv;
  if (!client) return null;

  const { data, error } = await client
    .from("venue_twilio_accounts")
    .select(SELECT_COLS)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache|Could not find the table|PGRST205|42P01/i.test(msg) || error.code === "PGRST205") {
      return null;
    }
    throw new Error(error.message);
  }
  return data ? mapRow(data as Row) : null;
}

export async function getVenueTwilioAccountByAccountSid(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  twilioAccountSid: string,
): Promise<VenueTwilioAccount | null> {
  const fromEnv = fromEnvAccounts().find((a) => a.twilioAccountSid === twilioAccountSid);
  if (fromEnv) return fromEnv;
  if (!client) return null;

  const { data, error } = await client
    .from("venue_twilio_accounts")
    .select(SELECT_COLS)
    .eq("twilio_account_sid", twilioAccountSid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Row) : null;
}

/** Ready to send customer SMS/MMS for this venue. */
export function isVenueTwilioSendReady(account: VenueTwilioAccount | null): boolean {
  return !!account
    && account.status === "ready"
    && !!account.twilioAccountSid
    && !!account.messagingServiceSid;
}
