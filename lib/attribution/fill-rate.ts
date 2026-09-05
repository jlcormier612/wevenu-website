/**
 * Phase 2A — Attribution fill-rate inventory helpers (no PII).
 * Used by tests / ops checks against a live DB; not a Reporting metric.
 */

export const ATTRIBUTION_SOURCE_DATA_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_page",
  "qr_campaign_id",
  "campaign_id",
  "leadgen_id",
  "ad_id",
  "adset_id",
  "form_id",
  "acquisition_source",
  "platform",
] as const;

export type AttributionFillRateRow = {
  metric: string;
  count: number;
};

/** SQL that returns fill counts without selecting PII columns. */
export const ATTRIBUTION_FILL_RATE_SQL = `
select 'leads_total' as metric, count(*)::bigint as count from public.leads
union all select 'leads_with_operational_source', count(*) from public.leads
  where source is not null and trim(source) <> ''
union all select 'leads_with_acquisition_source', count(*) from public.leads
  where acquisition_source is not null and trim(acquisition_source) <> ''
union all select 'leads_acquisition_other', count(*) from public.leads
  where acquisition_source = 'other'
union all select 'leads_acquisition_null', count(*) from public.leads
  where acquisition_source is null or trim(acquisition_source) = ''
union all select 'utm_source', count(*) from public.leads
  where nullif(trim(source_data->>'utm_source'),'') is not null
union all select 'utm_medium', count(*) from public.leads
  where nullif(trim(source_data->>'utm_medium'),'') is not null
union all select 'utm_campaign', count(*) from public.leads
  where nullif(trim(source_data->>'utm_campaign'),'') is not null
union all select 'utm_content', count(*) from public.leads
  where nullif(trim(source_data->>'utm_content'),'') is not null
union all select 'utm_term', count(*) from public.leads
  where nullif(trim(source_data->>'utm_term'),'') is not null
union all select 'referrer', count(*) from public.leads
  where nullif(trim(source_data->>'referrer'),'') is not null
union all select 'landing_page', count(*) from public.leads
  where nullif(trim(source_data->>'landing_page'),'') is not null
union all select 'qr_campaign', count(*) from public.leads
  where nullif(trim(source_data->>'qr_campaign_id'),'') is not null
union all select 'meta_campaign_id', count(*) from public.leads
  where nullif(trim(source_data->>'campaign_id'),'') is not null
union all select 'meta_leadgen_id', count(*) from public.leads
  where nullif(trim(source_data->>'leadgen_id'),'') is not null
union all select 'lifecycle_first_booked', count(*) from public.lifecycle_booking_events
  where event_kind = 'first_booked'
union all select 'lifecycle_first_with_acquisition', count(*) from public.lifecycle_booking_events
  where event_kind = 'first_booked'
    and acquisition_source is not null and trim(acquisition_source) <> ''
`;
