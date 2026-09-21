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
  /** Mirrored Twilio Brand status when known (APPROVED, FAILED, …). */
  a2pBrandStatus?: string | null;
  /** Mirrored Twilio Campaign status when known (VERIFIED, FAILED, …). */
  a2pCampaignStatus?: string | null;
  /** Phone A2P registration status when known. */
  phoneA2pStatus?: string | null;
  /** Set when Secondary/Trust/Brand/Campaign was actually submitted to Twilio. */
  complianceSubmittedAt?: string | null;
  status: VenueTwilioAccountStatus;
  statusDetail: string | null;
};

type Row = {
  venue_id: string;
  twilio_account_sid: string;
  messaging_service_sid: string | null;
  default_from_e164: string | null;
  phone_number_sid: string | null;
  secondary_profile_sid: string | null;
  a2p_brand_sid: string | null;
  a2p_campaign_sid: string | null;
  a2p_brand_status?: string | null;
  a2p_campaign_status?: string | null;
  phone_a2p_status?: string | null;
  compliance_submitted_at?: string | null;
  status: VenueTwilioAccountStatus;
  status_detail: string | null;
};

function mapRow(row: Row): VenueTwilioAccount {
  return {
    venueId: row.venue_id,
    twilioAccountSid: row.twilio_account_sid,
    messagingServiceSid: row.messaging_service_sid ?? "",
    defaultFromE164: row.default_from_e164,
    phoneNumberSid: row.phone_number_sid,
    secondaryProfileSid: row.secondary_profile_sid,
    a2pBrandSid: row.a2p_brand_sid,
    a2pCampaignSid: row.a2p_campaign_sid,
    a2pBrandStatus: row.a2p_brand_status ?? null,
    a2pCampaignStatus: row.a2p_campaign_status ?? null,
    phoneA2pStatus: row.phone_a2p_status ?? null,
    complianceSubmittedAt: row.compliance_submitted_at ?? null,
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
    a2pBrandStatus: (entry.a2p_brand_status ?? entry.a2pBrandStatus ?? null) as string | null,
    a2pCampaignStatus: (entry.a2p_campaign_status ?? entry.a2pCampaignStatus ?? null) as string | null,
    phoneA2pStatus: (entry.phone_a2p_status ?? entry.phoneA2pStatus ?? null) as string | null,
    complianceSubmittedAt: (entry.compliance_submitted_at ?? entry.complianceSubmittedAt ?? null) as string | null,
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

/** Prefer extended columns when migration is applied; fall back if PostgREST rejects them. */
const SELECT_COLS_EXTENDED =
  `${SELECT_COLS}, a2p_brand_status, a2p_campaign_status, phone_a2p_status, compliance_submitted_at`;

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
    .select(SELECT_COLS_EXTENDED)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache|Could not find the table|PGRST205|42P01/i.test(msg) || error.code === "PGRST205") {
      return null;
    }
    // Pre-migration: extended columns missing — retry base select.
    if (/a2p_brand_status|compliance_submitted_at|phone_a2p_status|column/i.test(msg)) {
      const retry = await client
        .from("venue_twilio_accounts")
        .select(SELECT_COLS)
        .eq("venue_id", venueId)
        .maybeSingle();
      if (retry.error) {
        if (/does not exist|schema cache|PGRST205|42P01/i.test(retry.error.message ?? "")) return null;
        throw new Error(retry.error.message);
      }
      return retry.data ? mapRow(retry.data as Row) : null;
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

function normalizedStatus(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Ready to send customer SMS/MMS for this venue.
 * Fail closed until status is ready AND compliance + sender are actually present.
 * pending_compliance alone is never sufficient.
 */
export function isVenueTwilioSendReady(account: VenueTwilioAccount | null): boolean {
  if (!account) return false;
  if (account.status !== "ready") return false;
  if (!account.twilioAccountSid?.trim()) return false;
  if (!account.messagingServiceSid?.trim()) return false;
  if (!account.defaultFromE164?.trim()) return false;
  if (!account.phoneNumberSid?.trim()) return false;
  if (!account.a2pBrandSid?.trim()) return false;
  if (!account.a2pCampaignSid?.trim()) return false;

  const brand = normalizedStatus(account.a2pBrandStatus);
  if (brand && brand !== "APPROVED") return false;

  const campaign = normalizedStatus(account.a2pCampaignStatus);
  if (campaign && campaign !== "VERIFIED" && campaign !== "APPROVED") return false;

  const phoneA2p = normalizedStatus(account.phoneA2pStatus);
  if (phoneA2p && phoneA2p !== "REGISTERED" && phoneA2p !== "SUCCESS" && phoneA2p !== "APPROVED") {
    return false;
  }

  return true;
}

/**
 * Whether the public inquiry/tour form may offer optional SMS consent.
 * True once a real sender number exists and compliance is in progress or ready —
 * so reviewers and end users can see/opt-in before A2P campaign approval.
 * Does NOT authorize outbound sends (see isVenueTwilioSendReady).
 */
export function isVenueTwilioConsentOfferAvailable(account: VenueTwilioAccount | null): boolean {
  if (!account) return false;
  if (!account.twilioAccountSid?.trim() || !account.messagingServiceSid?.trim()) return false;
  if (!account.defaultFromE164?.trim()) return false;
  return account.status === "ready" || account.status === "pending_compliance";
}
