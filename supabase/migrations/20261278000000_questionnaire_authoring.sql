-- Questionnaire authoring: venue-owned custom questions + wording overrides + order.
-- Masters remain in code. Working forms snapshot these columns at apply time (draft only).

alter table public.questionnaire_templates
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists master_overrides jsonb not null default '{}'::jsonb,
  add column if not exists field_order text[];

alter table public.event_questionnaires
  add column if not exists custom_fields jsonb not null default '[]'::jsonb,
  add column if not exists master_overrides jsonb not null default '{}'::jsonb,
  add column if not exists field_order text[];

comment on column public.questionnaire_templates.custom_fields is
  'Venue-authored questions for this reusable form. destination is always family.';
comment on column public.questionnaire_templates.master_overrides is
  'Optional label/helper overrides for code-master field ids. Does not change destinations.';
comment on column public.questionnaire_templates.field_order is
  'Ordered master + custom field ids. Null = master order then customs.';

-- Public couple loader must return authoring snapshot fields
drop function if exists public.get_questionnaire_for_couple(text);

create or replace function public.get_questionnaire_for_couple(p_key text)
returns table (
  questionnaire_id       uuid,
  access_key             text,
  kind                   text,
  event_name             text,
  event_date             date,
  event_guest_count      integer,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  public_review_url      text,
  status                 text,
  final_guest_count      integer,
  meal_notes             text,
  processional_song      text,
  recessional_song       text,
  first_dance_song       text,
  parent_dances          text,
  emergency_contact_name text,
  emergency_contact_phone text,
  special_requests       text,
  ceremony_start_time    text,
  reception_start_time   text,
  ceremony_location      text,
  reception_location     text,
  vendor_notes           text,
  included_fields        text[],
  required_fields        text[],
  additional             jsonb,
  updated_at             timestamptz,
  custom_fields          jsonb,
  master_overrides       jsonb,
  field_order            text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.id,
    q.access_key,
    q.kind,
    e.name,
    e.event_date,
    e.guest_count,
    v.name,
    v.logo_url,
    v.primary_color,
    v.public_review_url,
    q.status,
    q.final_guest_count,
    q.meal_notes,
    q.processional_song,
    q.recessional_song,
    q.first_dance_song,
    q.parent_dances,
    q.emergency_contact_name,
    q.emergency_contact_phone,
    q.special_requests,
    q.ceremony_start_time::text,
    q.reception_start_time::text,
    q.ceremony_location,
    q.reception_location,
    q.vendor_notes,
    q.included_fields,
    q.required_fields,
    q.additional,
    q.updated_at,
    coalesce(q.custom_fields, '[]'::jsonb),
    coalesce(q.master_overrides, '{}'::jsonb),
    q.field_order
  from public.event_questionnaires q
  join public.events   e on e.id = q.event_id
  join public.venues   v on v.id = q.venue_id
  where q.access_key = p_key
    and q.status in ('sent', 'submitted', 'reviewed');
$$;

grant execute on function public.get_questionnaire_for_couple(text) to anon, authenticated;

-- Portal loader (token-based; must match existing app/api/portal/questionnaire)
drop function if exists public.get_questionnaire_for_portal(text);

create or replace function public.get_questionnaire_for_portal(p_token text)
returns table (
  questionnaire_id       uuid,
  access_key             text,
  kind                   text,
  event_name             text,
  event_date             date,
  event_guest_count      integer,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  public_review_url      text,
  status                 text,
  final_guest_count      integer,
  meal_notes             text,
  processional_song      text,
  recessional_song       text,
  first_dance_song       text,
  parent_dances          text,
  emergency_contact_name text,
  emergency_contact_phone text,
  special_requests       text,
  ceremony_start_time    text,
  reception_start_time   text,
  ceremony_location      text,
  reception_location     text,
  vendor_notes           text,
  included_fields        text[],
  required_fields        text[],
  additional             jsonb,
  updated_at             timestamptz,
  custom_fields          jsonb,
  master_overrides       jsonb,
  field_order            text[]
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null then return; end if;

  return query
  select
    q.id,
    q.access_key,
    q.kind,
    e.name,
    e.event_date,
    e.guest_count,
    v.name,
    v.logo_url,
    v.primary_color,
    v.public_review_url,
    q.status,
    q.final_guest_count,
    q.meal_notes,
    q.processional_song,
    q.recessional_song,
    q.first_dance_song,
    q.parent_dances,
    q.emergency_contact_name,
    q.emergency_contact_phone,
    q.special_requests,
    q.ceremony_start_time::text,
    q.reception_start_time::text,
    q.ceremony_location,
    q.reception_location,
    q.vendor_notes,
    q.included_fields,
    q.required_fields,
    q.additional,
    q.updated_at,
    coalesce(q.custom_fields, '[]'::jsonb),
    coalesce(q.master_overrides, '{}'::jsonb),
    q.field_order
  from public.event_questionnaires q
  join public.events e on e.id = q.event_id
  join public.venues v on v.id = q.venue_id
  where q.event_id = v_ids.event_id
    and q.venue_id = v_ids.venue_id
    and q.status in ('sent', 'submitted', 'reviewed')
  order by
    case q.kind
      when 'client_planning' then 1
      when 'final_details' then 2
      else 3
    end,
    q.created_at;
end;
$$;

grant execute on function public.get_questionnaire_for_portal(text) to anon, authenticated;
