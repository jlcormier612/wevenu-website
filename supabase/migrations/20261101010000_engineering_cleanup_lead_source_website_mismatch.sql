-- ============================================================================
-- Engineering Cleanup — Lead source mismatch: 'website_form' vs 'website'
--
-- docs/release-readiness-status.md §3 item 6. create_public_lead
-- (20260719000000_program2_phase2_relationship_and_conversation_foundation.sql,
-- the current live definition) hardcodes leads.source = 'website_form' on
-- every new lead created through the public inquiry embed. LEAD_SOURCES
-- (lib/leads/constants.ts), the dropdown every other lead-creation path
-- (manual entry, CSV import, etc.) writes through, uses 'website' for the
-- same real-world channel. One real channel silently splits into two
-- distinct values in any by-source report (Lead Funnel's by-source
-- breakdown, Pipeline & Lead Management analytics).
--
-- p_source_data (the JSONB the form also submits, which separately and
-- correctly carries {"source": "website_form", ...} as a sub-field for UTM/
-- referrer tracking) is untouched — only the top-level leads.source column,
-- the one LEAD_SOURCES actually governs, changes. Implementation-quality
-- fix only: no new lead source, no behavior change to what a venue sees
-- beyond the label now matching every other website-sourced lead.
-- ============================================================================

create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id       uuid;
  v_lead_id        uuid;
  v_relationship_id uuid;
  v_ref            text;
  v_is_new         boolean;
begin
  select id into v_venue_id
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  if nullif(trim(p_email), '') is not null then
    v_lead_id := public.find_lead_by_email(v_venue_id, p_email);
  end if;
  v_is_new := v_lead_id is null;

  v_relationship_id := public.find_or_create_relationship(v_venue_id, p_email, p_first_name, p_last_name);

  if v_is_new then
    insert into public.leads (
      venue_id, status, source, first_name, last_name,
      email, phone, partner_first_name, partner_last_name, partner_email,
      event_type, event_date, guest_count, estimated_budget,
      inquiry_message, inquiry_date, source_data, relationship_id
    ) values (
      v_venue_id, 'new', 'website', p_first_name, p_last_name,
      p_email, p_phone, nullif(p_partner_first, ''), nullif(p_partner_last, ''), nullif(p_partner_email, ''),
      nullif(p_event_type, ''), p_event_date, p_guest_count,
      case when p_estimated_budget > 0 then p_estimated_budget else null end,
      nullif(p_message, ''), now(),
      p_source_data || jsonb_build_object('submitted_at', now()),
      v_relationship_id
    )
    returning id into v_lead_id;
  else
    update public.leads
    set relationship_id = coalesce(relationship_id, v_relationship_id)
    where id = v_lead_id;
  end if;

  v_ref := upper(left(replace(v_lead_id::text, '-', ''), 8));

  insert into public.lead_activities (
    venue_id, lead_id, type, title, description
  ) values (
    v_venue_id, v_lead_id,
    'inquiry_received',
    case when v_is_new then 'Inquiry received via website form' else 'New inquiry from returning contact (website form)' end,
    'Submitted by ' || p_first_name || ' ' || p_last_name ||
    case when p_email != '' then ' (' || p_email || ')' else '' end
  );

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'reference_code', v_ref
  );
end;
$$;

-- Backfill: correct existing rows created under the old mismatched value so
-- reporting reflects one real channel, not two. source_data is untouched —
-- only the reporting-facing top-level column.
update public.leads set source = 'website' where source = 'website_form';
