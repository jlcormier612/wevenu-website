import type { RawIntakeInput } from "@/lib/lead-intake/types";

type FieldDatum = { name: string; values: string[] };

/** Attempt-log source — stable idempotency namespace for Meta leadgen_id. */
export const META_INTAKE_SOURCE = "facebook_lead_ads";

/**
 * Graph fields on GET /{leadgen_id}. `platform` is Meta's documented
 * placement field on Lead Gen Data (`fb` | `ig` | `an` | `msg` | `unknown`).
 * Instagram Instant Forms still arrive through the same Page `leadgen`
 * subscription as Facebook; this field is how we tell them apart.
 */
export const LEADGEN_FETCH_FIELDS =
  "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data,platform,is_organic";

export const LEADGEN_FETCH_FIELDS_MINIMAL = "id,created_time,form_id,field_data";

export type GraphLeadPayload = {
  id?: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
  is_organic?: boolean;
  field_data?: FieldDatum[];
  error?: { message?: string; code?: number };
};

export type QueueLeadContext = {
  leadgenId: string;
  formId: string;
  pageId: string;
};

/**
 * Instagram only when Meta explicitly says `ig`. A linked Instagram account
 * on the Page is not evidence — both FB and IG Lead Ads share one Page
 * leadgen subscription.
 */
export function acquisitionSourceFromPlatform(platform: string | null | undefined): "instagram" | "facebook" {
  return String(platform ?? "").trim().toLowerCase() === "ig" ? "instagram" : "facebook";
}

/** `leads.source` FK — Instagram when Meta says so, otherwise the Lead Ads webhook source. */
export function leadSourceKeyFromPlatform(platform: string | null | undefined): "instagram" | "facebook_lead_ads" {
  return acquisitionSourceFromPlatform(platform) === "instagram" ? "instagram" : META_INTAKE_SOURCE;
}

export function leadgenFetchPath(leadgenId: string, fields = LEADGEN_FETCH_FIELDS): string {
  return `/${leadgenId}?fields=${fields}`;
}

/**
 * Best-effort mapping, same philosophy as the email extractor: recognize
 * common field names directly, stash anything unrecognized into
 * sourceData rather than requiring a venue to manually map every custom
 * question before first use. Meta's own field names vary per form (a
 * venue's custom questions can be named anything), so this is
 * necessarily approximate, not exhaustive.
 */
export function mapFacebookFieldData(fieldData: FieldDatum[]): RawIntakeInput {
  const byName = new Map(fieldData.map((f) => [f.name.toLowerCase(), f.values[0] ?? ""]));
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = byName.get(k);
      if (v) return v;
    }
    return null;
  };

  const fullName = get("full_name", "name");
  let firstName = get("first_name") ?? "";
  let lastName = get("last_name") ?? "";
  if (!firstName && !lastName && fullName) {
    const parts = fullName.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  const recognized = new Set([
    "full_name", "name", "first_name", "last_name", "email", "phone_number",
    "event_type", "event_date", "guest_count",
  ]);
  const sourceData: Record<string, unknown> = {};
  for (const f of fieldData) {
    const key = f.name.toLowerCase();
    if (!recognized.has(key)) sourceData[f.name] = f.values[0] ?? null;
  }

  return {
    firstName: firstName || "Unknown",
    lastName: lastName || "Lead",
    email: get("email"),
    phone: get("phone_number", "phone"),
    partnerFirstName: null,
    partnerLastName: null,
    partnerEmail: null,
    eventType: get("event_type"),
    eventDate: get("event_date"),
    endDate: null,
    guestCount: get("guest_count") ? Number(get("guest_count")) || null : null,
    estimatedBudget: null,
    inquiryMessage: null,
    inquiryDate: null,
    confidenceScore: null,
    sourceData,
  };
}

export function mapGraphLeadToIntake(payload: GraphLeadPayload, queue: QueueLeadContext): {
  input: RawIntakeInput;
  leadSource: "instagram" | "facebook_lead_ads";
} {
  const input = mapFacebookFieldData(payload.field_data ?? []);
  const platform = payload.platform ?? null;
  const acquisitionSource = acquisitionSourceFromPlatform(platform);
  const leadSource = leadSourceKeyFromPlatform(platform);

  input.sourceData = {
    ...input.sourceData,
    intake_mechanism: "meta_webhook",
    acquisition_source: acquisitionSource,
    platform,
    is_organic: payload.is_organic ?? null,
    leadgen_id: payload.id ?? queue.leadgenId,
    form_id: payload.form_id ?? queue.formId,
    page_id: queue.pageId,
    ad_id: payload.ad_id ?? null,
    ad_name: payload.ad_name ?? null,
    adset_id: payload.adset_id ?? null,
    adset_name: payload.adset_name ?? null,
    campaign_id: payload.campaign_id ?? null,
    campaign_name: payload.campaign_name ?? null,
    created_time: payload.created_time ?? null,
  };

  return { input, leadSource };
}

export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export function isStaleProcessing(lastAttemptedAt: string | null | undefined, nowMs: number, staleMs = STALE_PROCESSING_MS): boolean {
  if (!lastAttemptedAt) return true;
  const attempted = Date.parse(lastAttemptedAt);
  if (Number.isNaN(attempted)) return true;
  return nowMs - attempted >= staleMs;
}
